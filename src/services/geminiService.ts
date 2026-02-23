import { GoogleGenAI, Type, Modality, ThinkingLevel, VideoGenerationReferenceType } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
};

export const geminiService = {
  // Code Editing & Refactoring
  async editCode(code: string, instruction: string, filename: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          text: `You are BearAI, an expert code assistant. 
          Edit the provided code based on the user's instruction.
          Return ONLY the complete updated code. 
          Do not include markdown code blocks or explanations.
          
          Filename: ${filename}
          Language: ${filename.split('.').pop()}
          
          Current Code:
          ${code}
          
          Instruction: ${instruction}`
        }
      ],
      config: {
        temperature: 0.2,
      }
    });
    return response.text?.replace(/```[a-z]*\n?|```/gi, '').trim() || code;
  },

  // Chatbot with Search Grounding
  async chat(message: string, history: any[] = []) {
    const ai = getAI();
    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: "You are BearAI, a helpful technical assistant. Use Google Search to provide accurate, up-to-date information when needed.",
        tools: [{ googleSearch: {} }]
      }
    });
    const response = await chat.sendMessage({ message });
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  },

  // Image Generation (Nano Banana Pro)
  async generateImage(prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K") {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ text: prompt }],
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: imageSize as any
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated");
  },

  // Video Generation (Veo)
  async generateVideo(prompt: string, aspectRatio: "16:9" | "9:16" = "16:9") {
    const ai = getAI();
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");
    
    const response = await fetch(downloadLink, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! }
    });
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  // Image Analysis
  async analyzeImage(imageBuffer: string, prompt: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: imageBuffer.split(',')[1], mimeType: "image/png" } },
            { text: prompt }
          ]
        }
      ]
    });
    return response.text;
  },

  // Live API (Voice)
  connectLive(callbacks: any) {
    const ai = getAI();
    return ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are BearAI, a helpful technical assistant. You are talking to a developer. Be concise and helpful.",
      },
    });
  }
};
