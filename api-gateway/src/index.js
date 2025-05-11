const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const http = require('http'); // Pour le serveur WebSocket
const { WebSocketServer } = require('ws'); // Pour le serveur WebSocket

const config = require('../../config/app-config.json').apiGateway;
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { contentProcessorClient, historyClient } = require('./grpcClient');
const { v4: uuidv4 } = require('uuid'); // Pour générer des IDs

async function startServer() {
    const app = express();
    const httpServer = http.createServer(app); // Utiliser http.createServer pour Apollo et WebSocket

    app.use(cors());
    app.use(bodyParser.json());

    // Serveur Apollo (GraphQL)
    const apolloServer = new ApolloServer({
        typeDefs,
        resolvers,
    });
    await apolloServer.start();
    app.use('/graphql', expressMiddleware(apolloServer));

    // --- Endpoints REST ---
    const restRouter = express.Router();

    // Endpoint REST pour soumettre du texte
    restRouter.post('/submit', async (req, res) => {
        const { text, user_id } = req.body;
        const text_id = `txt-${uuidv4()}`;

        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        contentProcessorClient.ProcessText({ text_id, text }, (error, processedData) => {
            if (error || processedData.error_message) {
                console.error("REST ProcessText Error:", error || processedData.error_message);
                return res.status(500).json({ error: "Failed to process text", details: error ? error.details : processedData.error_message });
            }

            const historyEntry = {
                original_text_id: text_id,
                original_text: text,
                sentiment: processedData.sentiment,
                suggested_keywords: processedData.suggested_keywords,
                user_id: user_id
            };

            historyClient.StoreEntry(historyEntry, (storeError, storeResponse) => {
                let history_info = {};
                if (storeError || !storeResponse.success) {
                    console.error("REST StoreEntry Error:", storeError || storeResponse.error_message);
                    history_info = { history_error: `History store failed: ${storeError ? storeError.details : storeResponse.error_message}` };
                } else {
                    history_info = { history_entry_id: storeResponse.entry_id };
                }
                
                res.json({
                    ...processedData,
                    ...history_info
                });
            });
        });
    });

    // Endpoint REST pour récupérer l'historique
    restRouter.get('/history', (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const user_id = req.query.user_id;

        historyClient.GetHistory({ limit, offset, user_id }, (error, response) => {
            if (error) {
                console.error("REST GetHistory Error:", error);
                return res.status(500).json({ error: "Failed to get history", details: error.details });
            }
            // Convertir les timestamps protobuf en ISO strings pour JSON
            if (response.entries) {
                response.entries.forEach(entry => {
                    if (entry.processed_at) {
                        entry.processed_at = new Date(entry.processed_at.seconds * 1000 + entry.processed_at.nanos / 1000000).toISOString();
                    }
                });
            }
            res.json(response);
        });
    });
    
    // Endpoint REST pour récupérer une entrée d'historique par ID
    restRouter.get('/history/:id', (req, res) => {
        const entry_id = req.params.id;
        historyClient.GetEntryById({ entry_id }, (error, entry) => {
            if (error) {
                console.error(`REST GetEntryById Error (id: ${entry_id}):`, error);
                 if (error.code === grpc.status.NOT_FOUND) {
                    return res.status(404).json({ error: "Entry not found" });
                }
                return res.status(500).json({ error: "Failed to get history entry", details: error.details });
            }
            if (entry.processed_at) {
                 entry.processed_at = new Date(entry.processed_at.seconds * 1000 + entry.processed_at.nanos / 1000000).toISOString();
            }
            res.json(entry);
        });
    });


    app.use(config.restBasePath, restRouter);
    
    // --- Serveur WebSocket ---
    const wss = new WebSocketServer({ server: httpServer }); // Attacher au même serveur HTTP
    console.log(`[APIGateway] WebSocket Server initialized on port ${config.port}`);

    wss.on('connection', (ws) => {
        console.log('[APIGateway] Client connected via WebSocket');

        ws.on('message', async (message) => {
            console.log('[APIGateway] WebSocket received:', message.toString());
            let requestData;
            try {
                requestData = JSON.parse(message.toString());
            } catch (e) {
                ws.send(JSON.stringify({ error: "Invalid JSON message" }));
                return;
            }

            const { type, payload } = requestData;

            if (type === 'submitText') {
                const { text, user_id } = payload;
                const text_id = `ws-txt-${uuidv4()}`;
                
                if (!text) {
                    ws.send(JSON.stringify({ type: 'submitTextResponse', error: "Text is required" }));
                    return;
                }

                contentProcessorClient.ProcessText({ text_id, text }, (error, processedData) => {
                    if (error || processedData.error_message) {
                        ws.send(JSON.stringify({ type: 'submitTextResponse', error: "Failed to process text", details: error ? error.details : processedData.error_message, text_id }));
                        return;
                    }

                    const historyEntry = {
                        original_text_id: text_id,
                        original_text: text,
                        sentiment: processedData.sentiment,
                        suggested_keywords: processedData.suggested_keywords,
                        user_id: user_id
                    };

                    historyClient.StoreEntry(historyEntry, (storeError, storeResponse) => {
                        let history_info = {};
                        if (storeError || !storeResponse.success) {
                            history_info = { history_error: `History store failed: ${storeError ? storeError.details : storeResponse.error_message}` };
                        } else {
                            history_info = { history_entry_id: storeResponse.entry_id };
                        }
                        ws.send(JSON.stringify({ type: 'submitTextResponse', payload: {...processedData, ...history_info} }));
                    });
                });

            } else if (type === 'getHistory') {
                const { limit = 10, offset = 0, user_id } = payload || {};
                 historyClient.GetHistory({ limit, offset, user_id }, (error, response) => {
                    if (error) {
                        ws.send(JSON.stringify({ type: 'historyResponse', error: "Failed to get history", details: error.details }));
                        return;
                    }
                    if (response.entries) {
                        response.entries.forEach(entry => {
                            if (entry.processed_at) {
                                entry.processed_at = new Date(entry.processed_at.seconds * 1000 + entry.processed_at.nanos / 1000000).toISOString();
                            }
                        });
                    }
                    ws.send(JSON.stringify({ type: 'historyResponse', payload: response }));
                });
            } else {
                ws.send(JSON.stringify({ error: "Unknown request type" }));
            }
        });

        ws.on('close', () => {
            console.log('[APIGateway] Client disconnected WebSocket');
        });
        
        ws.on('error', (err) => {
            console.error('[APIGateway] WebSocket error:', err);
        });
    });


    // Démarrage du serveur HTTP (qui héberge Express et le serveur WebSocket)
    httpServer.listen(config.port, () => {
        console.log(`[APIGateway] HTTP/GraphQL/WebSocket Server running on http://localhost:${config.port}`);
        console.log(`[APIGateway] GraphQL endpoint available at http://localhost:${config.port}/graphql`);
        console.log(`[APIGateway] REST base path: http://localhost:${config.port}${config.restBasePath}`);
    });
}

startServer().catch(err => {
    console.error("Failed to start API Gateway:", err);
});