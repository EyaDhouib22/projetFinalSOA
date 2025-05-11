const { MongoClient } = require('mongodb');
const config = require('../../config/app-config.json').mongoDB;

let db;

async function connectDB() {
    if (db) return db;
    try {
        const client = new MongoClient(config.uri);
        await client.connect();
        db = client.db(); // Le nom de la DB est dans l'URI
        console.log("[HistoryService] Connected successfully to MongoDB");
        return db;
    } catch (err) {
        console.error("[HistoryService] Failed to connect to MongoDB", err);
        process.exit(1); // Quitter si la connexion DB échoue
    }
}

function getDB() {
    if (!db) {
        throw new Error("Database not initialized. Call connectDB first.");
    }
    return db;
}

module.exports = { connectDB, getDB };