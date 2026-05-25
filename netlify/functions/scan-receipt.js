import { GoogleGenAI, Type } from '@google/genai';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }; [cite: 29]
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY; [cite: 30]
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Gemini Key' }) }; [cite: 30]
    }

    const ai = new GoogleGenAI({ apiKey }); [cite: 31]
    
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    // Prompt specifically optimized for your highlighted visual rectangles
    const prompt = `Analyze this grocery receipt image using these layout constraints:
1. Isolate the top header area inside the BLUE rectangle to find the store/merchant identity (e.g., "Trader Joe's").
2. Isolate the text lines inside the YELLOW rectangle containing the items purchased (e.g., "LENTIL RINGS SOUR CREAM", "SOURDOUGH BREAD").
3. For each item in that yellow column, extract the underlying food ingredients. Clean up retail noise, quantities, and prices.
4. Cross-reference or use your integrated Google Search tool to ensure vague items match valid grocery staples or ingredients (e.g., resolve "R-SALAD BABY SPINACH ORG" to "Spinach").

Return the final list STRICTLY as a clean JSON array of strings matching this schema, with no markdown code blocks and no conversational text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', [cite: 36]
      contents: [prompt, imagePart], [cite: 36]
      config: {
        tools: [{ googleSearch: {} }], // Maintains live web verification grounding
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of clean, generic ingredient strings.",
          items: {
            type: Type.STRING
          }
        }
      }
    });

    // FIX: Directly parse the text because schema enforcement guarantees it's a pure JSON string
    const cleanIngredients = JSON.parse(response.text.trim());

    return {
      statusCode: 200, [cite: 37]
      headers: { "Content-Type": "application/json" }, [cite: 37]
      body: JSON.stringify({ success: true, added: cleanIngredients }), [cite: 37]
    };
  } catch (error) {
    return {
      statusCode: 500, [cite: 37]
      body: JSON.stringify({ error: `Advanced visual extraction failure: ${error.message}` }), [cite: 37]
    };
  }
};