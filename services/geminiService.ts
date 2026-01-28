
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource, ProbabilityMap } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic AI. Analyze QR payloads for "Quishing" (QR Phishing).

STRICT SCORING PROTOCOL (NON-NEGOTIABLE):
You must output three distinct probability scores (0-100).

1. MALICIOUS INTENT (0–100):
   - 0–25: Clean/No harm.
   - 26–55: Suspicious (unusual data).
   - 56+: Direct phishing/malware markers.

2. FAKE / PSEUDO PATTERN (0–100):
   - SET >= 50: If using URL shorteners (bit.ly, t.co), redirects, or brand mimicry.
   - 60–85: Dynamic QR platforms or look-alike domains.
   - < 20: Verified direct domains only.

3. OFFICIAL / AUTHENTIC (0–100):
   - > 70: Direct official domains (e.g., google.com, apple.com) or standard payment UPI strings.
   - < 40: Third-party intermediaries.
   - < 35: MANDATORY if Fake Pattern > 60.

CRITICAL CONSTRAINT:
At least one score MUST differ from the others by 30 points or more. NEUTRALITY IS FORBIDDEN. If the data is ambiguous, bias the scores to show a clear gap.

FINAL RISK FORMULA:
Risk % = (0.5 × Malicious) + (0.4 × Fake) − (0.3 × Authentic)
[Clamp results 0-100]`;

/**
 * Ensures the 30-point delta constraint is met mathematically if the AI fails to do so.
 */
function ensureDimensionalSeparation(probs: ProbabilityMap): ProbabilityMap {
  const { malicious: m, fake: f, authentic: a } = probs;
  const diffs = [Math.abs(m - f), Math.abs(m - a), Math.abs(f - a)];
  const maxDiff = Math.max(...diffs);

  if (maxDiff < 30) {
    // If scores are too clustered, amplify the highest and dampen the lowest
    const sorted = [
      { key: 'malicious' as const, val: m },
      { key: 'fake' as const, val: f },
      { key: 'authentic' as const, val: a }
    ].sort((a, b) => b.val - a.val);

    const adjusted = { ...probs };
    adjusted[sorted[0].key] = Math.min(100, sorted[0].val + 15);
    adjusted[sorted[2].key] = Math.max(0, sorted[2].val - 15);
    return adjusted;
  }
  return probs;
}

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  if (!process.env.API_KEY) {
    return getErrorResult(content || "Analysis Halted", "API_KEY_MISSING");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';
    
    let parts: any[] = [];
    if (base64Image) {
      const base64Data = base64Image.split(',')[1] || base64Image;
      parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
    }

    const userPrompt = `FORENSIC AUDIT REQUEST:
PAYLOAD: "${(content || 'IMAGE_DATA').substring(0, 1000)}"
TASK: Calculate Risk Level. Apply (0.5*M + 0.4*F - 0.3*A). 
FORCED_SEPARATION: Ensure a 30-point delta exists between at least one vector.`;

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

    return processResponse(response, content || "Encoded Artifact");
  } catch (error: any) {
    return getErrorResult(content || "Scan Failed", error.message || "Engine Error");
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({ title: chunk.web.title || "Threat Intel", uri: chunk.web.uri });
      }
    });
  }

  const raw = JSON.parse(response.text || "{}");
  
  // 1. Extract raw probabilities
  let probs: ProbabilityMap = {
    malicious: raw.probability_breakdown?.malicious_intent || 0,
    fake: raw.probability_breakdown?.fake_or_pseudo_pattern || 0,
    authentic: raw.probability_breakdown?.official_or_authentic || 0
  };

  // 2. FORCE 30-POINT DELTA (Constraint enforcement)
  probs = ensureDimensionalSeparation(probs);

  // 3. RE-CALCULATE SCORE LOCALLY (Absolute Accuracy)
  const score = Math.max(0, Math.min(100, (0.5 * probs.malicious) + (0.4 * probs.fake) - (0.3 * probs.authentic)));

  return { 
    riskScore: Math.round(score),
    riskLevel: (raw.risk_level || RiskLevel.MODERATE) as RiskLevel,
    explanation: raw.expert_assessment || "No detailed forensic log generated.",
    recommendations: raw.recommended_actions || ["Exercise high caution."],
    originalContent: raw.originalContent || defaultContent,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
    probabilities: probs
  };
}

function getErrorResult(content: string, errorType: string): AnalysisResult {
  const isKeyError = errorType.includes("API_KEY_MISSING");
  
  return {
    riskScore: isKeyError ? 0 : 50,
    riskLevel: isKeyError ? RiskLevel.LOW : RiskLevel.SUSPICIOUS, 
    explanation: isKeyError 
      ? "FORENSIC ENGINE OFFLINE: The API_KEY environment variable is not set in your VS Code environment. Create a .env file locally with your key to enable the AI."
      : `FORENSIC DISRUPTION: ${errorType}. Manual verification required.`,
    recommendations: isKeyError 
      ? ["Configure local .env file", "Restart VS Code terminal", "Check API permissions"]
      : ["Check domain spelling", "Don't submit personal info", "Scan again in 60 seconds"],
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
      config: { systemInstruction: "You are the QRShield Guardian. Be brief and expert." }
    });
    return response.text || "Support module offline.";
  } catch (err) {
    return "API Key required for chat functionality.";
  }
}
