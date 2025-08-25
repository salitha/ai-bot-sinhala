
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import type { SearchResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const chat: Chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: 'You are a helpful bilingual assistant fluent in both English and Sinhala. Your name is "Sahaya". Be concise and friendly.',
  },
});

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    return "I'm sorry, I encountered an error. Please try again.";
  }
};

export const searchWithGemini = async (query: string): Promise<{ text: string; results: SearchResult[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
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
    
    return { text, results };
  } catch (error) {
    console.error("Error searching with Gemini:", error);
    return { text: "I'm sorry, I couldn't perform the search.", results: [] };
  }
};

export const generateImageWithGemini = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    return null;
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    return null;
  }
};
