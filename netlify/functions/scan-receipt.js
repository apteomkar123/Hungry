import { GoogleGenAI } from '@google/genai';

export const handler = async (event, context) => {
  // Enforce explicit POST routing rules
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Gemini Key' }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Parse the incoming Base64 image payload safely
    const bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    if (!bodyData || !bodyData.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image string data' }) };
    }
    
    let rawBase64 = bodyData.image.includes(',') ? bodyData.image.split(',')[1] : bodyData.image;

    const imagePart = {
      inlineData: {
        data: rawBase64,
        mimeType: "image/jpeg"
      },
    };

    // A clean, context-driven prompt that mimics human spatial understanding
    const prompt = `You are an expert retail document OCR parser. Analyze this raw grocery receipt image step-by-step:
1. Look at the very top header section of the slip to dynamically locate and identify the retail store name (such as Trader Joe's, Harris Teeter, Walmart, etc.).
2. Locate the central transactional block listing the purchased goods. For each line item, read the text description, ignoring prices, discounts, tax data, or total balances.
3. For each raw item text description, use your integrated Google Search tool to cross-reference the abbreviation with the identified store brand. Resolve it into a clean, plain English, singular grocery ingredient name (e.g., if the line says "LENTIL RINGS SOUR CREAM", resolve it to "Lentils"; change "CRUNCHY PEANUT BUTTER TOY" to "Peanut Butter"; change "R-SALAD BABY SPINACH ORG" to "Spinach").

Return the final ingredients list STRICTLY as a raw JSON array of strings, like this: ["Lentils", "Croissants", "Spinach", "Sourdough Bread"]. 
Do not include any chat commentary, reasoning, or markdown format code block ticks (\`\`\`). Output only the raw valid JSON array text.`;

    // Execute content generation using a safe, fallback-insulated text model config
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: {
        tools: [{ googleSearch: {} }], // Keeps real-time web grounding fully functional
        temperature: 0.2
      }
    });

    const returnedText = response.text.trim();
    
    // Clean out any rogue markdown wrappers that may slip past the prompt instructions
    let cleanJsonString = returnedText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Defensive parsing: Extract only the array portion if text slipped in around it
    const firstBracket = cleanJsonString.indexOf('[');
    const lastBracket = cleanJsonString.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanJsonString = cleanJsonString.substring(firstBracket, lastBracket + 1);
    }

    // Convert the verified text block into a structural JSON array
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
      body: JSON.stringify({ error: `Dynamic receipt extraction failed: ${error.message}` }),
    };
  }
};