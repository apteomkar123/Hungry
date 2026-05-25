import { GoogleGenAI } from '@google/genai';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Gemini Key' }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Safely unpack the incoming payload body string
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    if (!bodyData || !bodyData.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image data payload' }) };
    }
    
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    // Upgraded prompt template focusing purely on native multi-modal vision pattern matching
    const prompt = `You are an advanced retail document OCR engine. Analyze this grocery receipt image step-by-step:
1. Scan the very top header section of the receipt to dynamically identify the retail merchant name (e.g., Trader Joe's, Harris Teeter, Food Lion, etc.).
2. Locate the central text block containing the line items of purchased goods. Ignore prices, quantity numbers, tax values, internal store SKUs, barcodes, or total balances.
3. For each raw text item row, decode the abbreviations and retail short-hand into a clean, singular, plain English grocery ingredient name. 
   - Examples: Convert "LENTIL RINGS SOUR CREAM" to "Lentils", "CREAMER OAT BROWN SUGAR" to "Oat Milk", "EGGS LARGE BROWN PASTURE" to "Eggs", "R-SALAD BABY SPINACH ORG" to "Spinach", "SOURDOUGH BREAD" to "Sourdough Bread".

Return the final list STRICTLY as a valid JSON array of strings, like this: ["Lentils", "Oat Milk", "Eggs", "Spinach", "Sourdough Bread"].
Do not include any conversational text, explanations, or markdown code blocks (\`\`\`). Output only the raw valid JSON array.`;

    // Execute content generation without the unstable search tools configuration
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: {
        temperature: 0.1 // Low temperature ensures highly consistent, non-hallucinatory extraction
      }
    });

    const returnedText = response.text.trim();
    
    // Fallback sanitation: Strip out any markdown wrappers if the model ignores instructions
    let cleanJsonString = returnedText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Isolate the core array brackets to protect against rogue outer text characters
    const firstBracket = cleanJsonString.indexOf('[');
    const lastBracket = cleanJsonString.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanJsonString = cleanJsonString.substring(firstBracket, lastBracket + 1);
    }

    // Convert the string cleanly into a valid JavaScript Array object
    const cleanIngredients = JSON.parse(cleanJsonString);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify({ success: true, added: cleanIngredients }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Receipt extraction pipeline crash: ${error.message}` }),
    };
  }
};