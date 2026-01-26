
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

/**
 * World-class initialization logic:
 * We only instantiate the SDK inside the service calls. This prevents the 
 * entire application module from failing to load if process.env.API_KEY is 
 * temporarily unavailable or incorrectly formatted in the environment.
 */
function getAI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

export async function analyzeQRContent(content: string): Promise<AnalysisResult> {
  try {
    const ai = getAI();
    const model = 'gemini-3-flash-preview';
    
    const response = await ai.models.generateContent({
      model,
      contents: `You are a high-level cybersecurity analyst specializing in "Quishing" (QR Phishing). 
      Analyze the following decoded QR content: "${content}"

      STRICT CATEGORIZATION RULES:
      1. TRANSIT TOKENS: If the content is a long alphanumeric hash/token without a URL (e.g., used in Namma Metro, IRCTC, or flight boarding passes), mark as SAFE.
      2. OFFICIAL DOMAINS: If it is a clear official domain (e.g., .gov, .edu, or major banks), mark as SAFE.
      3. SUSPICIOUS: Mark as SUSPICIOUS if it uses URL shorteners (bit.ly, t.co) or unfamiliar TLDs.
      4. MALICIOUS: Mark as MALICIOUS if it leads to known phishing patterns, IP addresses, or typo-squatted domains.

      Return a JSON object with:
      - riskScore: 0 (Safe) to 100 (Critical)
      - riskLevel: SAFE, SUSPICIOUS, or MALICIOUS
      - explanation: A clear, professional security assessment.
      - recommendations: 3 specific steps for the user.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            riskLevel: { type: Type.STRING, enum: Object.values(RiskLevel) },
            explanation: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["riskScore", "riskLevel", "explanation", "recommendations"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return { ...result, originalContent: content };

  } catch (error: any) {
    console.error("AI Analysis Engine Fallback:", error.message);
    
    // Fallback response for offline/error states
    return {
      riskScore: 0,
      riskLevel: RiskLevel.SUSPICIOUS,
      explanation: error.message === "MISSING_API_KEY" 
        ? "AI Security analysis is currently in 'Local-Only' mode because the API key is not configured. Please inspect the content manually."
        : "The AI analysis engine is temporarily unreachable. Using local heuristics for safety check.",
      recommendations: [
        "Verify the domain name manually for spelling errors",
        "Only proceed if you generated this QR code yourself",
        "Check if the source of the QR code is a trusted physical location"
      ],
      originalContent: content
    };
  }
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `The user just scanned this QR content: "${context || 'None'}". Now they are asking: "${message}"`,
      config: {
        systemInstruction: "You are QRShield Assistant. Your goal is to educate users on QR security and phishing prevention. Be concise, professional, and helpful."
      }
    });
    return response.text || "I'm sorry, I'm having trouble processing that request.";
  } catch {
    return "I am currently in standby mode. Please ensure the API key is configured to enable AI conversation.";
  }
}
