import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, ProbabilityMap } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic AI. You specialize in Quishing (QR Phishing) detection.
Your goal is to perform deep-packet inspection of QR payloads. 

SCORING CRITERIA:
1. MALICIOUS INTENT: Flags URLs with obfuscation, suspicious TLDs, or known phishing paths.
2. FAKE PATTERN: Flags dynamic QR redirectors (e.g., qrco.de, me-qr.com, bit.ly) which are "cloaked".
3. AUTHENTICITY: Credits verified root domains (google.com, microsoft.com, etc.).

Strictly output JSON according to the schema provided.`;

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  // Obtain the key from the environment. 
  // NOTE: If this fails, it usually means the .env isn't being loaded or the key is malformed.
  const apiKey = process.env.API_KEY?.trim();
  
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error("API_KEY_MISSING: Please ensure the .env file has your valid key.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview';

  try {
    let parts: any[] = [];
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

    const result = await ai.models.generateContent({
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

    const responseText = result.text;
    if (!responseText) {
      throw new Error("Empty response from AI engine.");
    }

    const data = JSON.parse(responseText);
    
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
    // Rethrow with a cleaner message for the UI
    const errorMessage = error.message || "Unknown error";
    throw new Error(`Forensic Analysis Failed: ${errorMessage}`);
  }
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  const apiKey = process.env.API_KEY?.trim();
  if (!apiKey) return "API Key missing. Cannot initialize assistant.";

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Query: "${message}". Context: ${context || 'General security help'}.`,
      config: { systemInstruction: "You are the QRShield Guardian Assistant. Keep answers short and safety-focused." }
    });
    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (err: any) {
    return `Assistant Offline: ${err.message || "Connection Error"}`;
  }
}