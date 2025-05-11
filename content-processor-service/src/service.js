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