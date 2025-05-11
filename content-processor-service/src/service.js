// contentProcessorService.js (or whatever you name your file)

require('dotenv').config(); // Load environment variables from .env file
const fetch = require('node-fetch'); // Make sure to install: npm install node-fetch@2

// --- OpenRouter API Configuration ---
const OPENROUTER_API_KEY = "sk-or-v1-xxxxxxxx";
YOUR_SITE_URL="http://localhost:8080";
YOUR_SITE_NAME="MyLocalContentService" ;

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "meta-llama/llama-4-scout:free"; // Or your preferred model

// --- Helper function to call OpenRouter API ---
async function callOpenRouter(promptContent, max_tokens, temperature = 0.3) {
    if (!OPENROUTER_API_KEY) {
        console.error("[OpenRouter] Error: OPENROUTER_API_KEY is not set.");
        return null;
    }

    const body = {
        model: MODEL_NAME,
        messages: [{ role: "user", content: promptContent }],
        temperature: temperature,
        max_tokens: max_tokens
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": YOUR_SITE_URL,
                "X-Title": YOUR_SITE_NAME,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OpenRouter] API Error: ${response.status} ${response.statusText}. Details: ${errorBody.substring(0, 300)}...`);
            return null;
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            return data.choices[0].message.content.trim();
        } else {
            console.error("[OpenRouter] Unexpected response structure from API:", JSON.stringify(data).substring(0, 300) + "...");
            return null;
        }
    } catch (error) {
        console.error("[OpenRouter] Error calling API:", error.message);
        return null;
    }
}

// --- Function to get sentiment from OpenRouter ---
async function getSentimentFromAPI(text) {
    const prompt = `Analyze the sentiment of the following text and classify it as "POSITIVE", "NEGATIVE", or "NEUTRAL". Respond with only one word: "POSITIVE", "NEGATIVE", or "NEUTRAL".

Text: "${text}"
Sentiment:`;
    const result = await callOpenRouter(prompt, 10, 0.3);
    if (result && ["POSITIVE", "NEGATIVE", "NEUTRAL"].includes(result.toUpperCase())) {
        return result.toUpperCase();
    }
    // console.warn(`[OpenRouter] Sentiment result ("${result}") not one of POSITIVE, NEGATIVE, NEUTRAL. For text: "${text.substring(0,50)}..."`);
    return null; // Or a default like "NEUTRAL" if the API fails to give a valid response
}

// --- Function to get keywords from OpenRouter ---
async function getKeywordsFromAPI(text) {
    const prompt = `Extract up to 3 main keywords from the following text. List them comma-separated. If fewer than 3 keywords are relevant, list only those. If no specific keywords stand out, respond with "general-topic".

Text: "${text}"
Keywords:`;
    const result = await callOpenRouter(prompt, 30, 0.3); // max_tokens for keywords, e.g., 3 keywords * ~8 chars + 2 commas
    if (result) {
        // Clean up potential prefixes
        let keywordsString = result.replace(/^keywords: /i, '').trim();
        keywordsString = keywordsString.replace(/^the keywords are: /i, '').trim();

        if (keywordsString.toLowerCase() === "general-topic" && text.trim().length > 0) {
             return ["general-topic"];
        }

        const keywordsArray = keywordsString.split(',')
            .map(kw => kw.trim())
            .filter(kw => kw.length > 0 && kw.toLowerCase() !== "general-topic"); // Filter out empty and "general-topic" if other keywords are present

        if (keywordsArray.length > 0) {
            return keywordsArray.slice(0, 3); // Ensure max 3
        } else if (text.trim().length > 0) { // If API returned nothing specific or only "general-topic" which got filtered
            return ["general-topic"];
        }
    }
    return []; // Default to empty array if no keywords or error
}


// --- gRPC Service Method ---
const processText = async (call, callback) => { // Made async
    const { text_id, text } = call.request;
    console.log(`[ContentProcessorService] Received text to process (ID: ${text_id}): "${text ? text.substring(0, 70) : 'undefined'}..."`);

    if (!text || text.trim() === "") {
        console.warn(`[ContentProcessorService] Text is empty for ID: ${text_id}`);
        return callback(null, {
            text_id: text_id,
            sentiment: "NEUTRAL", // Default for empty text
            suggested_keywords: [], // Default for empty text
            error_message: "Text cannot be empty."
        });
    }

    let sentiment = "NEUTRAL"; // Default sentiment
    let suggested_keywords = []; // Default keywords

    try {
        // Get sentiment from OpenRouter API
        const apiSentiment = await getSentimentFromAPI(text);
        if (apiSentiment) {
            sentiment = apiSentiment;
        } else {
            console.warn(`[ContentProcessorService] Failed to get valid sentiment from API for ID ${text_id}. Using default: NEUTRAL.`);
            // sentiment remains "NEUTRAL"
        }

        // Get keywords from OpenRouter API
        const apiKeywords = await getKeywordsFromAPI(text);
        if (apiKeywords && apiKeywords.length > 0) {
            suggested_keywords = apiKeywords;
        } else {
            console.warn(`[ContentProcessorService] Failed to get valid keywords from API for ID ${text_id} or no keywords found. Using default or 'general-topic'.`);
            if (text.trim().length > 0 && suggested_keywords.length === 0) { // If API returned nothing useful, but text exists
                suggested_keywords = ["general-topic"];
            }
        }

    } catch (error) {
        console.error(`[ContentProcessorService] Unexpected error during API processing for ID ${text_id}:`, error);
        // Keep default sentiment and keywords in case of unexpected errors
        // Optionally, you could set an error_message in the response here
        // response.error_message = "Internal processing error with AI service.";
    }


    const response = {
        text_id: text_id,
        sentiment: sentiment,
        suggested_keywords: suggested_keywords
        // error_message: undefined // Or set if there was a non-fatal error you want to communicate
    };

    console.log(`[ContentProcessorService] Processing complete for ID ${text_id}: `, response);
    callback(null, response);
};

module.exports = { processText };










/*

const processText = (call, callback) => {
    const { text_id, text } = call.request;
    console.log(`[ContentProcessorService] Received text to process (ID: ${text_id}): "${text}"`);

    if (!text || text.trim() === "") {
        return callback(null, {
            text_id: text_id,
            error_message: "Text cannot be empty."
        });
    }

    // Simulation d'analyse de sentiment
    const lowerText = text.toLowerCase(); 
    let sentiment = "NEUTRAL";

    const positiveKeywords = ["happy", "great", "good", "excellent", "wonderful", "amazing","fantastic", "joyful", "love", "like", "pleased", "delighted","superb", "awesome", "nice", "fine", "perfect", "positive","celebrate", "enjoy", "glad", "lucky", "fortunate", "success","triumph", "beautiful", "lovely", "charming", "kind", "helpful","brilliant", "excited", "enthusiastic", "hopeful", "grateful", "appreciate"
];
    const negativeKeywords = ["sad", "bad", "terrible", "awful", "horrible", "hate", "dislike","angry", "upset", "miserable", "poor", "unfortunately", "negative","fail", "lose", "loss", "problem", "issue", "trouble", "difficult","pain", "hurt", "suffer", "fear", "anxious", "worried", "scared","ugly", "nasty", "dreadful", "annoyed", "frustrated", "disappointed","ashamed", "guilty", "regret", "boring", "stressful"
];

    if (positiveKeywords.some(keyword => lowerText.includes(keyword))) {
        sentiment = "POSITIVE";
    }
    
    else if (negativeKeywords.some(keyword => lowerText.includes(keyword))) {
        sentiment = "NEGATIVE";
    }

   

    // Simulation de suggestion de mots-clés
  const words = text.toLowerCase().replace(/[^\w\s'-]/gi, '').split(/\s+/).filter(word => word.length > 0);
    const suggested_keywords = []; 
    
    if (words.includes("product") || words.includes("products") || words.includes("buy") || words.includes("sell") || words.includes("order") || words.includes("shop") || words.includes("store")) {
        if (!suggested_keywords.includes("commerce")) { // Évite les doublons
            suggested_keywords.push("commerce");
        }
    }
    if (words.includes("service") || words.includes("services") || words.includes("support") || words.includes("help") || words.includes("feedback") || words.includes("customer")) {
        if (!suggested_keywords.includes("customer-experience")) {
            suggested_keywords.push("customer-experience");
        }
    }
    if (words.includes("app") || words.includes("software") || words.includes("tech") || words.includes("digital") || words.includes("online")) {
        if (!suggested_keywords.includes("technology")) {
            suggested_keywords.push("technology");
        }
    }
    if (words.includes("marketing") || words.includes("campaign") || words.includes("social") || words.includes("media") || words.includes("content")) {
        if (!suggested_keywords.includes("marketing-content")) {
            suggested_keywords.push("marketing-content");
        }
    }
    if (words.length > 5 && words.length <= 15) { 
        if (!suggested_keywords.includes("summary-info")) {
            suggested_keywords.push("summary-info");
        }
    } else if (words.length > 15) { 
        if (!suggested_keywords.includes("detailed-content")) {
            suggested_keywords.push("detailed-content");
        }
    }
    if (suggested_keywords.length === 0 && text.trim().length > 0) {
        suggested_keywords.push("general-topic");
    }

    const response = {
        text_id: text_id,
        sentiment: sentiment,
        suggested_keywords: suggested_keywords
    };
    console.log(`[ContentProcessorService] Processing complete: `, response);
    callback(null, response);
};

module.exports = { processText };
*/
