
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

    const prompt = `Act as QRShield, a cybersecurity analysis system specialized in detecting QR-code–based phishing (Quishing) risks.

SYSTEM CONSTRAINTS (MANDATORY):
- You MUST NOT return the same risk percentage for different QR inputs unless the decoded content is identical.
- You MUST NOT use default, midpoint, or placeholder values (such as 50%).
- Every output MUST be derived from explicit, explainable signals found in the QR content or metadata.
- If no strong malicious signal is found, you MUST return a LOW or MODERATE score, not a neutral midpoint.
- The analysis MUST be deterministic: the same QR input always produces the same output.
- If the QR content is unknown, obscure, or lacks clear trust signals, assign a baseline non-zero risk (e.g., 5-15%).

TASK:
Analyze the QR code and compute a COMPOSITE RISK PERCENTAGE (0–100) representing how likely the QR code is unsafe or exploitable in a Quishing context.

RISK SCORING MODEL (START FROM 0% AND ADD):

URL & STRUCTURE SIGNALS:
- URL shortener or QR-redirect service (scan.page, bit.ly, tinyurl): +30%
- Third-party QR hosting platform hiding final destination: +20%
- Long or complex URL (>70 characters): +10%
- Randomized or obfuscated path/query strings: +15%
- IP address instead of domain: +25%

CONTENT & INTENT SIGNALS:
- Login, credential, or verification request: +30%
- Urgency or pressure language: +20%
- Financial action or payment prompt: +20%

TRUST REDUCTION SIGNALS (SUBTRACT):
- HTTPS with well-known trusted domain: −20%
- Standard UPI payment QR (upi://pay): −30%
- Official brand domain with no redirection: −25%

CLASSIFICATION LOGIC:
- 0–15% → LOW
- 16–40% → MODERATE
- 41–70% → SUSPICIOUS
- 71–100% → HIGH / CRITICAL

SPECIAL RULE: If the QR code uses a legitimate but commonly abused QR service AND obscures the final destination, classify it as SUSPICIOUS even if no malware is detected.

DATA CONTENT: "${content || 'Captured via Image (Perform Visual Forensics)'}"`;

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
            risk_percentage: { type: Type.NUMBER, description: "Composite risk score (0-100)" },
            risk_level: { type: Type.STRING, description: "LOW, MODERATE, SUSPICIOUS, HIGH, or CRITICAL" },
            expert_assessment: { type: Type.STRING, description: "Professional cybersecurity analyst report" },
            recommended_actions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Actionable safety advice" 
            },
            originalContent: { type: Type.STRING, description: "The content found in the QR" },
            probability_breakdown: {
              type: Type.OBJECT,
              properties: {
                malicious_intent: { type: Type.NUMBER },
                fake_or_pseudo_pattern: { type: Type.NUMBER },
                official_or_authentic: { type: Type.NUMBER }
              },
              required: ["malicious_intent", "fake_or_pseudo_pattern", "official_or_authentic"]
            }
          },
          required: ["risk_percentage", "risk_level", "expert_assessment", "recommended_actions", "originalContent", "probability_breakdown"]
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
    const raw = JSON.parse(response.text.trim());
    return { 
      riskScore: raw.risk_percentage,
      riskLevel: raw.risk_level as RiskLevel,
      explanation: raw.expert_assessment,
      recommendations: raw.recommended_actions,
      originalContent: raw.originalContent || defaultContent,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
      probabilities: {
        malicious: raw.probability_breakdown.malicious_intent,
        fake: raw.probability_breakdown.fake_or_pseudo_pattern,
        authentic: raw.probability_breakdown.official_or_authentic
      }
    };
  } catch (e) {
    return getErrorResult(defaultContent, "Response Parse Error");
  }
}

function getErrorResult(content: string, errorType: string): AnalysisResult {
  return {
    riskScore: 15,
    riskLevel: RiskLevel.MODERATE, 
    explanation: `SYSTEM NOTICE: Forensic scan interrupted by a processing error (${errorType}). Content remains unverified. The lack of a confirmed trust signature requires assigning a MODERATE risk level until re-scanned.`,
    recommendations: [
      "Check your network connection and try again",
      "Manually inspect the URL for subtle typos (typosquatting)",
      "If this is a payment request, verify via a separate official channel"
    ],
    originalContent: content,
    probabilities: { malicious: 15, fake: 15, authentic: 70 }
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
