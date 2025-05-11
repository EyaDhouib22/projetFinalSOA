// api-gateway/src/graphql/typeDefs.js
const { gql } = require('graphql-tag'); // Ou require('apollo-server-express').gql

const typeDefs = gql`
  scalar Timestamp

  type ProcessedText {
    text_id: String!
    sentiment: String
    suggested_keywords: [String]
    error_message: String
  }

  type HistoryEntry {
    id: ID!
    original_text_id: String!
    original_text: String!
    sentiment: String
    suggested_keywords: [String]
    processed_at: Timestamp 
    user_id: String
  }

  type HistoryResponse {
    entries: [HistoryEntry]
    total_count: Int
  }

  type Query {
    getProcessedTextHistory(limit: Int, offset: Int, userId: String): HistoryResponse
    getHistoryEntry(id: ID!): HistoryEntry
  }

  type Mutation {
    submitText(text: String!, text_id: String, user_id: String): ProcessedTextAndHistoryId
  }
  
  type ProcessedTextAndHistoryId {
    text_id: String!
    sentiment: String
    suggested_keywords: [String]
    history_entry_id: String # ID de l'entrée stockée dans l'historique
    error_message: String
  }
`;

module.exports = typeDefs;