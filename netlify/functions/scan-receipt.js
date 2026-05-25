import { GoogleGenAI } from '@google/genai';

export const handler = async (event, context) => {
  // Enforce cors preflight requirements
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

    // PIPELINE ROUTE A: AI Custom Recipe Generator (Flexible & Curated)
    if (bodyData && bodyData.customPrompt) {
      const optimizedPrompt = `${bodyData.customPrompt} 
      CRITICAL INSTRUCTIONS: You do NOT have to use every single ingredient listed if they do not pair well together. 
      Select a highly cohesive, delicious subset of 3 to 6 of the best matching ingredients to build an elite vegetarian dish. 
      Return ONLY a raw structural JSON object with keys "recipeName", "prepTime", and a "steps" array. 
      Do not include markdown triple backtick formatting wrapper blocks.`;

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
              steps: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["recipeName", "prepTime", "steps"]
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

    // PIPELINE ROUTE B: Optical Receipt Vision Processing
    if (!bodyData || !bodyData.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image or custom prompt payload' }) };
    }
    
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    const prompt = `Analyze this grocery receipt image. Identify the merchant store name and list all purchased food items. Decode any industrial shorthand flags into clean, plain English singular ingredient tokens. Return the clean food item names strictly as a JSON array of strings: ["Item1", "Item2"]. Do not include markdown code block formatting ticks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: { temperature: 0.1 }
    });

    const returnedText = response.text.trim();
    const arrayRegex = /\[([\s\S]*?)\]/;
    const match = returnedText.match(arrayRegex);

    if (!match) {
      return { statusCode: 422, body: JSON.stringify({ error: "Could not isolate JSON array from vision response." }) };
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
      body: JSON.stringify({ error: `Backend pipeline crash: ${error.message}` }),
    };
  }
};