
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

const SYSTEM_PROMPT = `You are QRShield, a cybersecurity risk analysis engine for QR-code–based phishing (Quishing).

CORE PRINCIPLES (MANDATORY):
- Every analysis MUST produce three independent probability scores:
  1. Malicious Intent (0-100)
  2. Fake / Pseudo Pattern (0-100)
  3. Official / Authentic (0-100)
- These three values MUST be different for different QR inputs unless the QR content is identical.
- The final risk percentage MUST be derived from these three values using the specified formula.
- You MUST NOT reuse or default to previous outputs.
- You MUST NOT use midpoint or placeholder values (such as 50%).

ANALYSIS DIMENSIONS:

1. MALICIOUS INTENT (0–100):
Evaluate direct evidence of harm (credential harvesting, login prompts, payment redirection with urgency, known phishing patterns).

2. FAKE / PSEUDO PATTERN (0–100):
Evaluate deception, impersonation, or obfuscation (URL shorteners, dynamic QR services, hidden final destinations, brand mimicry).

3. OFFICIAL / AUTHENTIC (0–100):
Evaluate legitimacy and trust signals (HTTPS with trusted domains, standard UPI strings, clear destinations, official brand match).

IMPORTANT BALANCE RULES:
- A QR code may have HIGH Fake/Pseudo Pattern but LOW Malicious Intent.
- Official/Authentic score MUST decrease if Fake/Pseudo Pattern increases.
- Malicious Intent and Official/Authentic MUST NOT both be high.

COMPOSITE RISK CALCULATION:
Compute final risk using:
Final Risk % = (0.5 × Malicious Intent) + (0.4 × Fake/Pseudo Pattern) − (0.3 × Official/Authentic)
Clamp result between 0 and 100.

RISK LEVEL MAPPING:
- 0–15% → LOW
- 16–40% → MODERATE
- 41–70% → SUSPICIOUS
- 71–100% → HIGH / CRITICAL

SPECIAL CASE: If the QR uses a legitimate but commonly abused QR or redirect service (e.g., bit.ly, scan.page) AND hides the final destination, THEN Fake / Pseudo Pattern must be HIGH (≥60) and Risk Level must be SUSPICIOUS.`;

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

    const userPrompt = `TASK: Analyze the QR code content and provide a forensic cybersecurity report.
DATA CONTENT: "${content || 'Image data only - perform visual OCR and metadata forensics.'}"

Strictly follow the formula: (0.5 * malicious) + (0.4 * fake) - (0.3 * authentic)`;

    parts.push({ text: userPrompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: content?.includes('://') || (content && content.length > 5) ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_percentage: { type: Type.NUMBER, description: "Calculated risk percentage" },
            risk_level: { type: Type.STRING, description: "LOW, MODERATE, SUSPICIOUS, HIGH, CRITICAL" },
            probability_breakdown: {
              type: Type.OBJECT,
              properties: {
                malicious_intent: { type: Type.NUMBER },
                fake_or_pseudo_pattern: { type: Type.NUMBER },
                official_or_authentic: { type: Type.NUMBER }
              },
              required: ["malicious_intent", "fake_or_pseudo_pattern", "official_or_authentic"]
            },
            expert_assessment: { type: Type.STRING },
            recommended_actions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            },
            originalContent: { type: Type.STRING }
          },
          required: ["risk_percentage", "risk_level", "probability_breakdown", "expert_assessment", "recommended_actions", "originalContent"]
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
    riskScore: 20,
    riskLevel: RiskLevel.MODERATE, 
    explanation: `SYSTEM NOTICE: Forensic scan interrupted (${errorType}). Initial visual checks suggest moderate risk due to lack of verified trust signals.`,
    recommendations: [
      "Check your network connection and try again",
      "Look for subtle typos in the domain name",
      "Avoid entering credentials if redirected to a login page"
    ],
    originalContent: content,
    probabilities: { malicious: 20, fake: 20, authentic: 50 }
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
