const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const config = require('../../config/app-config.json');

// Configuration des chemins Proto
const CONTENT_PROCESSOR_PROTO_PATH = path.join(__dirname, '../protos/content_processor.proto');
const HISTORY_PROTO_PATH = path.join(__dirname, '../protos/history.proto');

// Options de chargement Proto
const loaderOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, '../protos'), path.join(__dirname, '../../../node_modules/google-proto-files')]
};

// Chargement des définitions de package
const contentProcessorPkgDef = protoLoader.loadSync(CONTENT_PROCESSOR_PROTO_PATH, loaderOptions);
const historyPkgDef = protoLoader.loadSync(HISTORY_PROTO_PATH, loaderOptions);

// Obtention des constructeurs de service gRPC
const ContentProcessorService = grpc.loadPackageDefinition(contentProcessorPkgDef).content_processor.ContentProcessorService;
const HistoryService = grpc.loadPackageDefinition(historyPkgDef).history.HistoryService;

// Création des clients gRPC
const contentProcessorClient = new ContentProcessorService(
    `${config.contentProcessorService.host}:${config.contentProcessorService.port}`,
    grpc.credentials.createInsecure()
);

const historyClient = new HistoryService(
    `${config.historyService.host}:${config.historyService.port}`,
    grpc.credentials.createInsecure()
);

module.exports = {
    contentProcessorClient,
    historyClient
};