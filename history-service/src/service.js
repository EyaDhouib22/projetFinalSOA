const { getDB } = require('./db');
const { Timestamp } = require('google-protobuf/google/protobuf/timestamp_pb'); // Pour convertir Date en Timestamp proto
const { v4: uuidv4 } = require('uuid'); // Pour générer des IDs

const storeEntry = async (call, callback) => {
    try {
        const db = getDB();
        const entry = {
            _id: uuidv4(), // MongoDB utilise _id, mais on peut aussi utiliser un 'id' custom si besoin
            original_text_id: call.request.original_text_id,
            original_text: call.request.original_text,
            sentiment: call.request.sentiment,
            suggested_keywords: call.request.suggested_keywords,
            user_id: call.request.user_id || null,
            processed_at: new Date() // MongoDB stocke les dates nativement
        };
        console.log('[HistoryService] Storing entry:', entry);
        const result = await db.collection('history_entries').insertOne(entry);

        callback(null, {
            entry_id: entry._id, // Retourne l'_id généré
            success: true
        });
    } catch (error) {
        console.error("[HistoryService] Error storing entry:", error);
        callback(null, { success: false, error_message: error.message });
    }
};

const getHistory = async (call, callback) => {
    try {
        const db = getDB();
        const { limit = 10, offset = 0, user_id } = call.request;
        const query = {};
        if (user_id) {
            query.user_id = user_id;
        }

        console.log(`[HistoryService] Fetching history with limit: ${limit}, offset: ${offset}, query:`, query);

        const entriesCursor = db.collection('history_entries')
            .find(query)
            .sort({ processed_at: -1 }) // Plus récent en premier
            .skip(offset)
            .limit(limit);

        const entriesArray = await entriesCursor.toArray();
        const total_count = await db.collection('history_entries').countDocuments(query);

        const protoEntries = entriesArray.map(e => {
            const ts = new Timestamp();
            ts.fromDate(e.processed_at);
            return {
                id: e._id.toString(), // Assurez-vous que l'ID est une chaîne
                original_text_id: e.original_text_id,
                original_text: e.original_text,
                sentiment: e.sentiment,
                suggested_keywords: e.suggested_keywords,
                processed_at: ts,
                user_id: e.user_id
            };
        });
        callback(null, { entries: protoEntries, total_count });
    } catch (error) {
        console.error("[HistoryService] Error fetching history:", error);
        callback(error); // gRPC s'attend à un objet Error pour le premier argument en cas d'erreur
    }
};

const getEntryById = async (call, callback) => {
    try {
        const db = getDB();
        const { entry_id } = call.request;
        console.log(`[HistoryService] Fetching entry by ID: ${entry_id}`);

        const entry = await db.collection('history_entries').findOne({ _id: entry_id });

        if (!entry) {
            return callback({
                code: grpc.status.NOT_FOUND,
                details: "Entry not found"
            });
        }
        
        const ts = new Timestamp();
        ts.fromDate(entry.processed_at);

        const protoEntry = {
            id: entry._id.toString(),
            original_text_id: entry.original_text_id,
            original_text: entry.original_text,
            sentiment: entry.sentiment,
            suggested_keywords: entry.suggested_keywords,
            processed_at: ts,
            user_id: entry.user_id
        };
        callback(null, protoEntry);

    } catch (error) {
        console.error(`[HistoryService] Error fetching entry by ID ${call.request.entry_id}:`, error);
         callback({
            code: grpc.status.INTERNAL,
            details: error.message
        });
    }
};

module.exports = { storeEntry, getHistory, getEntryById };