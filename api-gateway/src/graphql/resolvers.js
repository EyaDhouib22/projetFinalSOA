const { contentProcessorClient, historyClient } = require('../grpcClient');
const { v4: uuidv4 } = require('uuid'); // Pour générer des text_id si non fournis

const resolvers = {
  Timestamp: { // Custom scalar pour gérer les Timestamps de Protobuf
    __parseValue(value) {
      return new Date(value); // value from the client
    },
    __serialize(value) {
      if (value && value.seconds !== undefined && value.nanos !== undefined) {
         // Convert Protobuf Timestamp to ISO string or milliseconds
         return new Date(value.seconds * 1000 + value.nanos / 1000000).toISOString();
      }
      return value; // value sent to the client
    },
    __parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(parseInt(ast.value, 10)); // ast value is always in string format
      }
      return null;
    },
  },
  Query: {
    getProcessedTextHistory: async (_, { limit, offset, userId }) => {
      return new Promise((resolve, reject) => {
        historyClient.GetHistory({ limit: limit || 10, offset: offset || 0, user_id: userId }, (error, response) => {
          if (error) {
            console.error("GraphQL GetHistory Error:", error);
            return reject(error);
          }
          resolve(response);
        });
      });
    },
    getHistoryEntry: async (_, { id }) => {
      return new Promise((resolve, reject) => {
        historyClient.GetEntryById({ entry_id: id }, (error, response) => {
          if (error) {
            console.error(`GraphQL GetEntryById Error (id: ${id}):`, error);
            if (error.code === grpc.status.NOT_FOUND) { // Assurez-vous que grpc est importé ou disponible
                return reject(new Error("Entry not found")); // GraphQL friendly error
            }
            return reject(error);
          }
          resolve(response);
        });
      });
    }
  },
  Mutation: {
    submitText: async (_, { text, text_id, user_id }) => {
      const currentTextId = text_id || `txt-${uuidv4()}`;

      return new Promise((resolve, reject) => {
        contentProcessorClient.ProcessText({ text_id: currentTextId, text: text }, (error, processedData) => {
          if (error || processedData.error_message) {
            console.error("GraphQL ProcessText Error:", error || processedData.error_message);
            return reject(error || new Error(processedData.error_message));
          }

          // Maintenant, stockons dans l'historique
          const historyEntry = {
            original_text_id: currentTextId,
            original_text: text,
            sentiment: processedData.sentiment,
            suggested_keywords: processedData.suggested_keywords,
            user_id: user_id
          };

          historyClient.StoreEntry(historyEntry, (storeError, storeResponse) => {
            if (storeError || !storeResponse.success) {
              console.error("GraphQL StoreEntry Error:", storeError || storeResponse.error_message);
              // On retourne quand même le résultat du traitement, mais on signale l'erreur d'historique
              return resolve({
                ...processedData,
                history_entry_id: null, // Indique que le stockage a échoué
                error_message: `Processing OK, but history store failed: ${storeError ? storeError.details : storeResponse.error_message}`
              });
            }
            resolve({
              ...processedData,
              history_entry_id: storeResponse.entry_id
            });
          });
        });
      });
    }
  }
};
module.exports = resolvers;