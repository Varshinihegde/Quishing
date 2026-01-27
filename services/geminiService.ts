
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

/**
 * Safely retrieves the API key. In browsers, 'process' might be undefined.
 */
function getApiKey(): string {
  try {
    // Standard environment variable check
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}

  // Fallback for ESM/Browser globals
  const win = window as any;
  if (win.process?.env?.API_KEY) return win.process.env.API_KEY;
  
  return "";
}

function getAI() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Performs a deep security analysis using Gemini 3 Pro.
 */
export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  let ai;
  try {
    ai = getAI();
  } catch (e: any) {
    throw new Error("RESELECT_KEY");
  }

  try {
    const model = 'gemini-3-pro-preview';
    let parts: any[] = [];
    
    if (base64Image) {
      const base64Data = base64Image.split(',')[1] || base64Image;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        }
      });
    }

    const prompt = `Act as a senior Cybersecurity Analyst. Inspect this QR code data.
    Content: "${content || 'Captured via Image'}"

    Detect:
    1. Phishing attempts (Quishing).
    2. Malicious URL redirection.
    3. Structural abnormalities in the QR pattern.
    
    STRICT JSON OUTPUT REQUIRED.
    Explain if it's malicious, fake/unoriginal, or authentic.
    Sum probabilities to 100.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            riskLevel: { type: Type.STRING, enum: Object.values(RiskLevel) },
            explanation: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            originalContent: { type: Type.STRING },
            probabilities: {
              type: Type.OBJECT,
              properties: {
                malicious: { type: Type.NUMBER },
                fake: { type: Type.NUMBER },
                authentic: { type: Type.NUMBER }
              },
              required: ["malicious", "fake", "authentic"]
            }
          },
          required: ["riskScore", "riskLevel", "explanation", "recommendations", "probabilities", "originalContent"]
        }
      }
    });

    if (!response.text) return getFallbackResult(content || "Unknown");
    
    return processResponse(response, content || "Unknown");
  } catch (error: any) {
    console.error("Analysis error details:", error);
    const msg = error.message || "";
    if (msg.includes("401") || msg.includes("403") || msg.includes("API key") || msg.includes("not found")) {
      throw new Error("RESELECT_KEY");
    }
    return getFallbackResult(content || "Scan Error");
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({
          title: chunk.web.title || "Reference",
          uri: chunk.web.uri
        });
      }
    });
  }

  const result = JSON.parse(response.text || '{}');
  return { 
    ...result, 
    originalContent: result.originalContent || defaultContent,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined
  };
}

function getFallbackResult(content: string): AnalysisResult {
  return {
    riskScore: 50,
    riskLevel: RiskLevel.SUSPICIOUS,
    explanation: "Standard analysis threshold reached. Manual verification recommended.",
    recommendations: ["Don't click suspicious links", "Verify sender identity", "Check for URL typos"],
    originalContent: content,
    probabilities: { malicious: 33, fake: 33, authentic: 34 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General security'}. User: "${message}"`,
      config: {
        systemInstruction: "You are QRShield AI. Help with security questions."
      }
    });
    return response.text || "I'm having trouble thinking right now.";
  } catch {
    return "I am currently disconnected. Please verify your API setup.";
  }
}
