
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

/**
 * Performs a deep security analysis using Gemini.
 */
export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';
    
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

    const prompt = `Act as an elite Cybersecurity Forensic Analyst specializing in anti-phishing (Quishing).
    
    TASK: Deconstruct and analyze this QR code for malicious intent, deceptive routing, or structural anomalies.
    
    DATA CONTENT: "${content || 'Captured via Image (Perform Visual Forensics)'}"

    CRITICAL ANALYSIS CRITERIA:
    1. URL Reputation: Check if the domain is a known phishing host, uses typosquatting, or leverages deceptive subdomains.
    2. Redirection Chain: Detect URL shorteners (bit.ly, tinyurl) or multi-hop redirects.
    3. Structural Forensics: If an image is provided, inspect the QR pattern for tampering or unusual encodings.
    4. Contextual Risk: Is the content typical? (e.g., unexpected app download prompts, credential harvesting).

    SCORING POLICY (STRICT):
    - 0%: ONLY for clearly benign, well-known, and verified content (e.g., google.com, official government portals).
    - 5-20% (LOW RISK): Default for unknown domains, unusual string lengths, random character sets, or non-URL data that lacks clear context.
    - 21-70% (SUSPICIOUS): Shortened URLs, multi-hop redirects, unverified subdomains, or domains with low trust scores.
    - 71-100% (MALICIOUS): Confirmed phishing, malware signatures, or high-confidence malicious routing.
    
    DETERMINISTIC RULE: If any weak indicator exists (e.g., obscure domain, unusual length), you MUST assign a non-zero risk score. Do not collapse local uncertainty to 0%. Be decisive.
    
    All probability values (malicious, fake, authentic) must sum to exactly 100.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: content?.includes('://') || (content && content.length > 5) ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER, description: "Threat score from 0-100" },
            riskLevel: { type: Type.STRING, description: "SAFE, SUSPICIOUS, or MALICIOUS" },
            explanation: { type: Type.STRING, description: "Detailed security breakdown" },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of safety actions" 
            },
            originalContent: { type: Type.STRING, description: "The content found in the QR" },
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
          required: ["riskScore", "riskLevel", "explanation", "recommendations", "originalContent", "probabilities"]
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty analysis result.");
    }
    
    return processResponse(response, content || "Extracted QR Data");
  } catch (error: any) {
    console.error("Forensic analysis failed:", error);
    return getErrorResult(content || "Unknown Data", error.message);
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({
          title: chunk.web.title || "Threat Intelligence",
          uri: chunk.web.uri
        });
      }
    });
  }

  try {
    const result = JSON.parse(response.text.trim());
    return { 
      ...result, 
      originalContent: result.originalContent || defaultContent,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined
    };
  } catch (e) {
    return getErrorResult(defaultContent, "Response Parse Error");
  }
}

function getErrorResult(content: string, errorType: string): AnalysisResult {
  return {
    riskScore: 10, // Default to a non-zero "Unknown" risk on system error
    riskLevel: RiskLevel.SUSPICIOUS, 
    explanation: `SYSTEM NOTICE: Forensic scan interrupted by a processing error (${errorType}). Content remains unverified. Extreme caution is advised as the system could not rule out threats.`,
    recommendations: [
      "Check your network connection and try again",
      "Do not open the link if you do not recognize the sender",
      "Manually inspect the URL for subtle typos (typosquatting)",
      "If this is a payment request, verify via a separate official channel"
    ],
    originalContent: content,
    probabilities: { malicious: 10, fake: 10, authentic: 80 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General QR security'}. User Query: "${message}"`,
      config: {
        systemInstruction: "You are QRShield Guardian, a world-class cybersecurity expert. Provide actionable, technical, yet accessible advice on QR code safety and quishing. Be direct and concise."
      }
    });
    return response.text || "I was unable to process your request. Please try again.";
  } catch (err) {
    return "Cybersecurity modules are temporarily offline. Please stay alert.";
  }
}
