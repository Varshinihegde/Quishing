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
  // Initialize AI with the key from environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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

    const data = JSON.parse(response.text || "{}");
    
    // Mapping raw response to our internal types
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
    console.error("Forensic Engine Error:", error);
    return {
      riskScore: 100,
      riskLevel: RiskLevel.CRITICAL,
      explanation: "The forensic engine encountered a critical error or the API key is invalid.",
      recommendations: ["Do not visit the URL", "Report this QR code to security teams"],
      originalContent: content || "Unknown",
      probabilities: { malicious: 100, fake: 100, authentic: 0 }
    };
  }
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Query: "${message}". Context: ${context || 'General security help'}.`,
      config: { systemInstruction: "You are the QRShield Guardian Assistant. Keep answers short and safety-focused." }
    });
    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (err) {
    return "The assistant is currently offline.";
  }
}