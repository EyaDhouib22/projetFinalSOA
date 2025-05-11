const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const config = require('../../config/app-config.json').historyService;
const { connectDB } = require('./db');
const serviceImpl = require('./service');

const PROTO_PATH = path.join(__dirname, '../protos/history.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, '../protos'), path.join(__dirname, '../../node_modules/google-proto-files')] // Pour google/protobuf/timestamp.proto
});
const historyProto = grpc.loadPackageDefinition(packageDefinition).history;

async function main() {
    await connectDB(); // Connect to MongoDB before starting the server

    const server = new grpc.Server();
    server.addService(historyProto.HistoryService.service, {
        StoreEntry: serviceImpl.storeEntry,
        GetHistory: serviceImpl.getHistory,
        GetEntryById: serviceImpl.getEntryById
    });

    const serverAddress = `${config.host}:${config.port}`;
    server.bindAsync(serverAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error(`[HistoryService] Server error: ${err.message}`);
            return;
        }
        console.log(`[HistoryService] Server running at ${serverAddress}`);
        server.start();
    });
}

main();