
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic Engine. You analyze QR codes for "Quishing" (QR Phishing).

MANDATORY SCORING PROTOCOL:
You must calculate three distinct probability scores (0-100) and use the specified formula for the final risk.

1. MALICIOUS INTENT (0–100):
- 0–25: No direct evidence of harm.
- 26–55: Suspicious behavior (e.g., unusual data format).
- 56+: Strong phishing/malware indicators.

2. FAKE / PSEUDO PATTERN (0–100):
- Must be >= 50: If the QR uses redirects (bit.ly, t.co), hidden destinations, or looks unofficial.
- 60–85: Brand impersonation or dynamic QR services.
- < 20: Only if the QR is clean, direct, and non-obfuscated.

3. OFFICIAL / AUTHENTIC (0–100):
- > 70: Official direct domains (e.g., google.com, paypal.com) or standard UPI formats.
- < 40: Third-party or indirect services.
- < 35: MANDATORY if Fake/Pseudo Pattern is > 60.

STRICT CONSTRAINT:
At least one of these three scores MUST differ by 30 points or more from the others. Flat or clustered values (e.g., 50, 50, 50) are strictly forbidden.

FINAL RISK FORMULA:
Risk % = (0.5 × Malicious Intent) + (0.4 × Fake/Pseudo Pattern) − (0.3 × Official/Authentic)
[Clamp result between 0 and 100]

OUTPUT:
Respond in valid JSON only. The explanation must be forensic and technical.`;

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Pro model required for Google Search grounding and high-fidelity reasoning
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
INPUT_CONTENT: "${content || 'EXAMINE IMAGE FOR OCR/PAYLOAD'}"
CALCULATION_REQ: Apply the (0.5*M + 0.4*F - 0.3*A) formula.
STRICT_SEPARATION: Ensure the 30-point delta constraint is met.`;

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
    return getErrorResult(content || "System Error", error.message);
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
  
  // Calculate final score manually to ensure formula compliance and clamping
  const m = raw.probability_breakdown?.malicious_intent || 0;
  const f = raw.probability_breakdown?.fake_or_pseudo_pattern || 0;
  const a = raw.probability_breakdown?.official_or_authentic || 0;
  const calculatedScore = Math.max(0, Math.min(100, (0.5 * m) + (0.4 * f) - (0.3 * a)));

  return { 
    riskScore: Math.round(calculatedScore),
    riskLevel: (raw.risk_level || RiskLevel.MODERATE) as RiskLevel,
    explanation: raw.expert_assessment || "Forensic log entry missing.",
    recommendations: raw.recommended_actions || ["Follow standard security protocols."],
    originalContent: raw.originalContent || defaultContent,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
    probabilities: {
      malicious: m,
      fake: f,
      authentic: a
    }
  };
}

function getErrorResult(content: string, errorType: string): AnalysisResult {
  return {
    riskScore: 50,
    riskLevel: RiskLevel.SUSPICIOUS, 
    explanation: `Forensic Engine Timeout: ${errorType}. Manual verification required.`,
    recommendations: ["Do not click the URL", "Verify brand identity", "Check for domain typos"],
    originalContent: content,
    probabilities: { malicious: 40, fake: 60, authentic: 10 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General security'}. Query: "${message}"`,
      config: {
        systemInstruction: "You are the QRShield Guardian. Give direct, high-level cybersecurity advice."
      }
    });
    return response.text || "Assistant unavailable.";
  } catch (err) {
    return "Offline.";
  }
}
