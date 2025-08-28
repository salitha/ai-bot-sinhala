import { GoogleGenAI, Tool, Type } from "@google/genai";
import type { SearchResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Internal function for web search tool
async function performWebSearch(query: string): Promise<{ summary: string; results: SearchResult[] }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a concise, single-paragraph summary in Sinhala for the query: "${query}"`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const results: SearchResult[] = rawChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        uri: chunk.web.uri,
        title: chunk.web.title,
      }));
    
    return { summary: text, results };
  } catch (error) {
    console.error("Error searching with Gemini:", error);
    return { summary: "මට කණගාටුයි, සෙවීම සිදු කිරීමට නොහැකි විය.", results: [] };
  }
};

// Internal function for image generation tool
async function performImageGeneration(prompt: string): Promise<{ imageUrl?: string; error?: string }> {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return { imageUrl: `data:image/jpeg;base64,${base64ImageBytes}` };
    }
    return { error: "රූපයක් ජනනය කිරීමට නොහැකි විය." };
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    return { error: "රූපය ජනනය කිරීමේදී දෝෂයක් ඇතිවිය." };
  }
};

const tools: Tool[] = [{
  functionDeclarations: [
    {
      name: "searchTheWeb",
      description: "නවතම හෝ නිශ්චිත තොරතුරු සඳහා වෙබය සොයන්න. උදාහරණයක් ලෙස, පුවත්, කාලගුණය, හෝ නිශ්චිත මාතෘකාවක් පිළිබඳ තොරතුරු.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "සෙවිය යුතු මාතෘකාව හෝ ප්‍රශ්නය."
          },
        },
        required: ["query"],
      },
    },
    {
      name: "generateImage",
      description: "ලබා දී ඇති පෙළ විස්තරයක් මත පදනම්ව රූපයක් සාදන්න. 'create', 'make', 'generate', 'draw', 'සාදන්න', 'අඳින්න' වැනි වචන සඳහා මෙය භාවිතා කරන්න.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: "සාදනු ලැබිය යුතු රූපය පිළිබඳ සවිස්තරාත්මක විස්තරයක්."
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "getCurrentTime",
      description: "වත්මන් දේශීය දිනය සහ වේලාව ලබා ගන්න.",
      parameters: { type: Type.OBJECT, properties: {} },
    },
  ],
}];

type AssistantResponse = {
  text?: string;
  imageUrl?: string;
  searchResults?: SearchResult[];
}

// FIX: Replaced deprecated `ai.generativeModel` and `chat.sendMessage` with the current Gemini API standards.
// The new API uses `ai.chats.create` to initialize a chat session and `chat.sendMessage` now
// returns the response directly and expects an object for its payload.
export const getAssistantResponse = async (
  message: string, 
  history: {role: 'user' | 'model', parts: {text: string}[]}[]
): Promise<AssistantResponse> => {
  const chat = ai.chats.create({ 
    model: 'gemini-2.5-flash',
    history,
    config: {
      tools,
      systemInstruction: 'ඔබ "මදු" නම් සිංහල පමණක් කතා කරන කෘත්රීම බුද්ධි සහායකයෙකි. ඔබගේ සියලුම පිළිතුරු සිංහලෙන් විය යුතුය. කෙටියෙන් සහ සුහදශීලීව පිළිතුරු දෙන්න. ඔබ මෙවලම් (tools) භාවිතා කරන විට, පරිශීලකයාට ඔබ කුමක් කරන්නේදැයි දන්වන්න (උදා: "හරි, මම වෙබය සොයන්නම්..."). ඔබගේ මෙවලම් ප්‍රතිදානයන් ද සිංහලෙන් සාරාංශගත කරන්න.',
    }
  });

  const response = await chat.sendMessage({ message });
  
  const functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;

  if (functionCall) {
    let functionResponsePayload;
    // Call the appropriate tool
    if (functionCall.name === 'searchTheWeb') {
        // FIX: Cast function call argument to string to resolve TypeScript error.
        functionResponsePayload = await performWebSearch(functionCall.args.query as string);
    } else if (functionCall.name === 'generateImage') {
        // FIX: Cast function call argument to string to resolve TypeScript error.
        functionResponsePayload = await performImageGeneration(functionCall.args.prompt as string);
    } else if (functionCall.name === 'getCurrentTime') {
        const now = new Date();
        functionResponsePayload = { time: now.toLocaleString('si-LK') };
    } else {
        // Should not happen
        throw new Error(`Unknown function call: ${functionCall.name}`);
    }

    // Send the tool response back to the model
    // FIX: Changed `parts` to `message` to match the expected type for `chat.sendMessage`.
    const result2 = await chat.sendMessage({
      message: [
        {
          functionResponse: {
            name: functionCall.name,
            response: functionResponsePayload,
          },
        },
      ]
    });
    
    const finalResponseText = result2.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    
    const finalResponse: AssistantResponse = { text: finalResponseText };
    
    // Attach tool output to the final response for the UI
    if (functionCall.name === 'searchTheWeb' && 'results' in functionResponsePayload) {
        finalResponse.searchResults = functionResponsePayload.results;
    }
    if (functionCall.name === 'generateImage' && 'imageUrl' in functionResponsePayload) {
        finalResponse.imageUrl = functionResponsePayload.imageUrl;
    }

    return finalResponse;

  } else {
    // No function call, just a text response
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    return { text: text || "මට කණගාටුයි, මට එය තේරුම් ගැනීමට නොහැකි විය." };
  }
};