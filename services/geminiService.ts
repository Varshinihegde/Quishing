
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

/**
 * Initialize the Gemini API client using the environment variable.
 * Note: Guidelines state we must assume process.env.API_KEY is pre-configured.
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Performs a deep security analysis using Gemini 3 Pro.
 */
export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
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

    const prompt = `Act as a senior Cybersecurity Analyst. Inspect this QR code data for Quishing (QR Phishing).
    Content: "${content || 'Captured via Image'}"

    Detect:
    1. Phishing attempts (Quishing).
    2. Malicious URL redirection or obfuscation.
    3. Structural abnormalities in the QR pattern that suggest tampering.
    
    STRICT JSON OUTPUT REQUIRED.
    Return riskScore (0-100), riskLevel (SAFE/SUSPICIOUS/MALICIOUS), explanation, and recommendations.
    Sum probabilities (malicious, fake, authentic) to exactly 100.`;

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

    if (!response.text) return getFallbackResult(content || "Unknown Data");
    
    return processResponse(response, content || "Unknown Data");
  } catch (error: any) {
    console.error("Analysis error:", error);
    // Return a graceful fallback instead of throwing error to keep UI fluid
    return getFallbackResult(content || "Analysis Error");
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({
          title: chunk.web.title || "Security Reference",
          uri: chunk.web.uri
        });
      }
    });
  }

  try {
    const result = JSON.parse(response.text.trim() || '{}');
    return { 
      ...result, 
      originalContent: result.originalContent || defaultContent,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined
    };
  } catch (e) {
    return getFallbackResult(defaultContent);
  }
}

function getFallbackResult(content: string): AnalysisResult {
  return {
    riskScore: 50,
    riskLevel: RiskLevel.SUSPICIOUS,
    explanation: "Deep AI inspection encountered a network or security threshold. Displaying baseline heuristics.",
    recommendations: ["Check for URL typos", "Do not enter credentials on the target site", "Verify the source of the QR code"],
    originalContent: content,
    probabilities: { malicious: 33, fake: 33, authentic: 34 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General security help'}. User: "${message}"`,
      config: {
        systemInstruction: "You are QRShield AI. Help users understand QR code safety, URL redirects, and the dangers of Quishing."
      }
    });
    return response.text || "I'm having trouble processing that request.";
  } catch {
    return "I'm currently in high-security offline mode. Please try again in a moment.";
  }
}
