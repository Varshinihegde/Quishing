
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function analyzeQRContent(content: string): Promise<AnalysisResult> {
  const model = 'gemini-3-flash-preview';
  
  const response = await ai.models.generateContent({
    model,
    contents: `You are a cybersecurity expert evaluating QR code content for threats.
    
    CONTENT TO ANALYZE: "${content}"

    INSTRUCTIONS:
    1. CATEGORIZE the data:
       - Is it a URL? (e.g., https://...)
       - Is it an Alphanumeric Token? (e.g., A1B2-C3D4... common in transit tickets like Namma Metro, IRCTC, or airport check-ins)
       - Is it contact info (VCard) or plain text?

    2. ASSESSMENT CRITERIA:
       - ALPHANUMERIC TOKENS: If the content is just a random-looking string, hash, or UUID (no URL), it is almost certainly a ticket or internal ID. Score: 0-2 (SAFE).
       - OFFICIAL DOMAINS: If it is a URL to a known official service (metro, government, large bank), and NOT a typo (e.g., 'google.com' is safe, 'g00gle.com' is malicious), it is SAFE.
       - QUISHING THREATS: Mark as MALICIOUS/SUSPICIOUS only if there is a clear deceptive URL (URL shorteners like bit.ly/suspicious, IP-based URLs, or fake login portals).

    3. CASE STUDY - NAMMA METRO:
       Metro ticket QRs often contain long, high-entropy tokens. These are strictly SAFE. Do not flag them as suspicious just because they look 'complex'.

    4. OUTPUT: Provide riskScore (0-100), riskLevel (SAFE, SUSPICIOUS, MALICIOUS), a concise explanation, and 3-4 specific recommendations.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskScore: { type: Type.NUMBER, description: "A score from 0 to 100" },
          riskLevel: { type: Type.STRING, enum: Object.values(RiskLevel) },
          explanation: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["riskScore", "riskLevel", "explanation", "recommendations"]
      }
    }
  });

  try {
    const text = response.text || '{}';
    const result = JSON.parse(text);
    return {
      ...result,
      originalContent: content
    };
  } catch (error) {
    console.error("Failed to parse analysis result", error);
    // Fallback if AI fails or returns invalid JSON
    return {
      riskScore: 50,
      riskLevel: RiskLevel.SUSPICIOUS,
      explanation: "Analysis engine encountered an error. Proceed with caution as we could not verify this content automatically.",
      recommendations: ["Do not open any links", "Verify the source of the QR", "Manually inspect the content string"],
      originalContent: content
    };
  }
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  const model = 'gemini-3-flash-preview';
  const systemInstruction = `You are "QRShield AI", a cybersecurity assistant.
  - Help users understand Quishing (QR Phishing).
  - If context is provided, explain the safety of that specific QR content.
  - Be reassuring about safe transit codes (like Namma Metro).
  - Keep answers short and professional.`;

  const response = await ai.models.generateContent({
    model,
    contents: `Context of last scan: ${context || 'None'}. User question: ${message}`,
    config: {
      systemInstruction,
    }
  });

  return response.text || "I'm sorry, I couldn't process that request.";
}
