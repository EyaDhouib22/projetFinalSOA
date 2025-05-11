const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const config = require('../../config/app-config.json').contentProcessorService;
const serviceImpl = require('./service');

const PROTO_PATH = path.join(__dirname, '../protos/content_processor.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const contentProcessorProto = grpc.loadPackageDefinition(packageDefinition).content_processor;

function main() {
    const server = new grpc.Server();
    server.addService(contentProcessorProto.ContentProcessorService.service, {
        ProcessText: serviceImpl.processText
    });

    const serverAddress = `${config.host}:${config.port}`;
    server.bindAsync(serverAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error(`[ContentProcessorService] Server error: ${err.message}`);
            return;
        }
        console.log(`[ContentProcessorService] Server running at ${serverAddress}`);
        server.start();
    });
}

main();