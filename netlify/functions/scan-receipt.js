import { GoogleGenAI } from '@google/genai';

export const handler = async (event, context) => {
  // Handle CORS Preflight OPTIONS requests cleanly
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Gemini Key' }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // =========================================================================
    // PIPELINE ROUTE A: AI Custom Recipe Generator (Flexible & Synced Schema)
    // =========================================================================
    if (bodyData && bodyData.customPrompt) {
      const optimizedPrompt = `${bodyData.customPrompt} 
      Select a highly cohesive, delicious subset of 3 to 6 matching ingredients from your available stocks to build a dish. 
      Ensure every single element listed in your ingredients array output is explicitly used and referenced within your structural steps.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: optimizedPrompt,
        config: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              recipeName: { type: "STRING" },
              prepTime: { type: "STRING" },
              ingredients: { type: "ARRAY", items: { type: "STRING" } }, // Strict ingredient alignment node
              steps: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["recipeName", "prepTime", "ingredients", "steps"]
          }
        }
      });

      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        },
        body: response.text
      };
    }

    // =========================================================================
    // PIPELINE ROUTE B: Optical Receipt Vision Processing
    // =========================================================================
    if (!bodyData || !bodyData.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image or custom prompt payload' }) };
    }
    
    // Clean up base64 metadata headers if present
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    const visionPrompt = `Analyze this grocery receipt image. Identify the merchant store name and list all purchased food items. Decode any industrial or store shorthand descriptions into clean, plain English singular ingredient names (e.g., change "LNTL RNGS SOUR CRM" to "Lentils", "CREMR OAT BRWN SGR" to "Oat Milk"). Return the clean food item names strictly as a JSON array of strings, like this: ["Item1", "Item2"]. Do not include conversational markdown text outside the array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [visionPrompt, imagePart],
      config: { temperature: 0.1 }
    });

    const returnedText = response.text.trim();
    
    // Bulletproof array extraction using RegEx
    const arrayRegex = /\[([\s\S]*?)\]/;
    const match = returnedText.match(arrayRegex);

    if (!match) {
      return { 
        statusCode: 422, 
        body: JSON.stringify({ error: "Could not isolate a structural JSON array from vision response." }) 
      };
    }

    const cleanIngredients = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({ success: true, added: cleanIngredients }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Backend microservice pipeline crash: ${error.message}` }),
    };
  }
};