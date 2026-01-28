
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic Engine. Your mission is to identify "Quishing" (QR Phishing).

MANDATORY SCORING PROTOCOL:
You must provide three probability scores (0-100) and follow these constraints:

1. MALICIOUS INTENT (0–100):
   - 0–25: No direct harm evidence.
   - 26–55: Suspicious (unusual payload).
   - 56+: High-confidence phishing/malware.

2. FAKE / PSEUDO PATTERN (0–100):
   - MANDATORY >= 50: If redirectors (bit.ly, tinyurl, etc.), hidden destinations, or brand mimicking occurs.
   - 60–85: Dynamic QR platforms or look-alike domains.
   - < 20: Only for verified, direct, clean URLs.

3. OFFICIAL / AUTHENTIC (0–100):
   - > 70: Direct official domains (e.g., apple.com, bankofamerica.com) or standard UPI.
   - < 40: Third-party or indirect intermediaries.
   - < 35: MANDATORY if Fake/Pseudo Pattern is > 60.

STRICT DIMENSIONAL CONSTRAINT:
Flat or clustered values (e.g., 45, 50, 55) are FORBIDDEN. At least one score MUST differ from the others by 30 points or more.

RISK FORMULA:
Risk % = (0.5 × Malicious Intent) + (0.4 × Fake/Pseudo Pattern) − (0.3 × Official/Authentic)
Clamped 0-100.

You must respond ONLY in JSON format. The assessment must be highly technical.`;

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  // Debug check for local environment
  if (!process.env.API_KEY) {
    return getErrorResult(content || "Unknown", "API_KEY_MISSING");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    const userPrompt = `FORENSIC REQUEST:
INPUT: "${content || 'IMAGE_ONLY'}"
GOAL: Detect Quishing. Apply (0.5*M + 0.4*F - 0.3*A). 
DIMENSIONAL_SEPARATION: Ensure a 30-point delta between at least one score.`;

    parts.push({ text: userPrompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_percentage: { type: Type.NUMBER },
            risk_level: { type: Type.STRING },
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
            recommended_actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            originalContent: { type: Type.STRING }
          },
          required: ["risk_percentage", "risk_level", "probability_breakdown", "expert_assessment", "recommended_actions", "originalContent"]
        }
      }
    });

    return processResponse(response, content || "Extracted Payload");
  } catch (error: any) {
    console.error("Forensic analysis failed:", error);
    return getErrorResult(content || "System Fault", error.message || "Unknown error");
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({
          title: chunk.web.title || "External Intelligence",
          uri: chunk.web.uri
        });
      }
    });
  }

  const raw = JSON.parse(response.text || "{}");
  const m = raw.probability_breakdown?.malicious_intent || 0;
  const f = raw.probability_breakdown?.fake_or_pseudo_pattern || 0;
  const a = raw.probability_breakdown?.official_or_authentic || 0;
  
  // Re-verify formula locally to ensure absolute consistency
  const score = Math.max(0, Math.min(100, (0.5 * m) + (0.4 * f) - (0.3 * a)));

  return { 
    riskScore: Math.round(score),
    riskLevel: (raw.risk_level || RiskLevel.MODERATE) as RiskLevel,
    explanation: raw.expert_assessment || "No detailed assessment available.",
    recommendations: raw.recommended_actions || ["Exercise extreme caution."],
    originalContent: raw.originalContent || defaultContent,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
    probabilities: { malicious: m, fake: f, authentic: a }
  };
}

function getErrorResult(content: string, errorType: string): AnalysisResult {
  const isKeyError = errorType.includes("API_KEY_MISSING");
  
  return {
    riskScore: isKeyError ? 0 : 50,
    riskLevel: isKeyError ? RiskLevel.LOW : RiskLevel.SUSPICIOUS, 
    explanation: isKeyError 
      ? "SYSTEM ERROR: API Key is missing in your local VS Code environment. Create a .env file or set your API_KEY to enable analysis."
      : `FORENSIC TIMEOUT: ${errorType}. Treat this payload as high-risk until verified.`,
    recommendations: [
      "Check your environment variables (.env)",
      "Move project out of OneDrive to prevent file locks",
      "Do not scan QR codes until the engine is connected"
    ],
    originalContent: content,
    probabilities: { malicious: 0, fake: 0, authentic: 0 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General'}. User: "${message}"`,
      config: {
        systemInstruction: "You are the QRShield Guardian. Assist with security questions."
      }
    });
    return response.text || "Assistant offline.";
  } catch (err) {
    return "The assistant module requires a valid API key to function.";
  }
}
