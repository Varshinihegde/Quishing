import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic AI. You specialize in Quishing (QR Phishing) detection.
Your goal is to perform deep-packet inspection of QR payloads. 

SCORING CRITERIA:
1. MALICIOUS INTENT: Flags URLs with obfuscation, suspicious TLDs, or known phishing paths.
2. FAKE PATTERN: Flags dynamic QR redirectors (e.g., qrco.de, me-qr.com, bit.ly) which are "cloaked".
3. AUTHENTICITY: Credits verified root domains (google.com, microsoft.com, etc.).

Strictly output JSON according to the schema provided.`;

/**
 * Validates and retrieves the API key from the environment.
 */
function getValidApiKey(): string {
  const key = process.env.API_KEY?.trim();
  
  if (!key) {
    throw new Error("API_KEY_MISSING: No API key found. Please ensure your .env file is configured.");
  }

  // Check if the user accidentally pasted a sentence or instructions into the .env file
  if (key.includes(" ") || key.includes("\n") || key.length > 100) {
    throw new Error("API_KEY_MALFORMED: Your API key appears to contain extra text or spaces. Please check your .env file and ensure it contains ONLY the key string.");
  }

  return key;
}

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  const apiKey = getValidApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-pro-preview';

  try {
    const parts: any[] = [];
    if (base64Image) {
      const base64Data = base64Image.split(',')[1] || base64Image;
      parts.push({ 
        inlineData: { 
          mimeType: 'image/png', 
          data: base64Data 
        } 
      });
    }

    const payloadText = content || "IMAGE_FORENSICS_ONLY";
    parts.push({ 
      text: `Analyze this QR payload for security threats: "${payloadText}". 
      If it is a dynamic redirect (like qrco.de or bit.ly), mark FAKE pattern as 100%.` 
    });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_score: { type: Type.NUMBER },
            risk_level: { type: Type.STRING },
            malicious_score: { type: Type.NUMBER },
            fake_score: { type: Type.NUMBER },
            authentic_score: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["risk_score", "risk_level", "malicious_score", "fake_score", "authentic_score", "explanation", "recommendations"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("The AI core returned an empty signal.");
    const data = JSON.parse(text);
    
    return {
      riskScore: data.risk_score || 0,
      riskLevel: (data.risk_level as RiskLevel) || RiskLevel.LOW,
      explanation: data.explanation || "Analysis complete.",
      recommendations: data.recommendations || ["Proceed with caution."],
      originalContent: payloadText,
      probabilities: {
        malicious: data.malicious_score || 0,
        fake: data.fake_score || 0,
        authentic: data.authentic_score || 0
      }
    };
  } catch (error: any) {
    console.error("Forensic Engine Detailed Error:", error);
    
    // Check for specific API authentication errors
    if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('API_KEY_INVALID')) {
      throw new Error("UNAUTHORIZED: The provided API key is invalid or the model 'gemini-3-pro-preview' is not enabled for your project. Please check AI Studio.");
    }
    
    throw new Error(`Forensic Analysis Failed: ${error.message || "Unknown error"}`);
  }
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const apiKey = getValidApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Query: "${message}". Context: ${context || 'General security help'}.`,
      config: { systemInstruction: "You are the QRShield Guardian Assistant. Keep answers short and safety-focused." }
    });
    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (err: any) {
    if (err.message?.includes('API_KEY')) {
      return "Assistant Offline: Please check your API key configuration in the .env file.";
    }
    return "The assistant is currently experiencing connection issues.";
  }
}