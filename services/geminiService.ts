
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource, ProbabilityMap } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic AI, a world-class cybersecurity auditor.
Your mission is to find reasons why a QR code might be MALICIOUS. 

STRICT SCORING PROTOCOL (NON-NEGOTIABLE):
You must output three distinct probability scores (0-100).

1. MALICIOUS INTENT (0–100):
   - 0–20: Only if explicitly safe (known official URLs).
   - 21–50: Unknown/Unverifiable payloads.
   - 51–100: Payload contains scripts, exploit strings, or phishing templates.

2. FAKE / PSEUDO PATTERN (0–100):
   - MANDATORY 100: If payload is garbled, base64 encoded, uses shorteners (bit.ly, t.co), or hides the real destination.
   - 60–90: Brand impersonation (e.g., "g00gle.com").
   - < 10: Pure direct official domain.

3. OFFICIAL / AUTHENTIC (0–100):
   - 80–100: Verified, well-known official root domains.
   - < 20: Any third-party redirect or obfuscated string.

FORCED SEPARATION RULE:
One score MUST be at least 30 points away from the others. NO NEUTRALITY. If in doubt, ASSUME THE WORST.

FINAL RISK FORMULA (SCALED):
Raw = (0.6 × Malicious) + (0.5 × Fake) − (0.3 × Authentic)
Final % = Clamp(Raw * 1.1, 0, 100)

Your response must be JSON only. Treat garbled binary data as a CRITICAL threat.`;

/**
 * Ensures the 30-point delta constraint is met mathematically if the AI fails to do so.
 */
function ensureDimensionalSeparation(probs: ProbabilityMap): ProbabilityMap {
  const { malicious: m, fake: f, authentic: a } = probs;
  const diffs = [Math.abs(m - f), Math.abs(m - a), Math.abs(f - a)];
  const maxDiff = Math.max(...diffs);

  if (maxDiff < 30) {
    const sorted = [
      { key: 'malicious' as const, val: m },
      { key: 'fake' as const, val: f },
      { key: 'authentic' as const, val: a }
    ].sort((a, b) => b.val - a.val);

    const adjusted = { ...probs };
    // Force a clear gap for the forensic UI
    adjusted[sorted[0].key] = Math.min(100, sorted[0].val + 20);
    adjusted[sorted[2].key] = Math.max(0, sorted[2].val - 20);
    return adjusted;
  }
  return probs;
}

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  // If API_KEY is missing, we must show the Configuration screen.
  if (!process.env.API_KEY) {
    return getErrorResult(content || "OFFLINE_PAYLOAD", "API_KEY_MISSING");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';
    
    let parts: any[] = [];
    if (base64Image) {
      const base64Data = base64Image.split(',')[1] || base64Image;
      parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
    }

    const userPrompt = `FORENSIC ANALYSIS REQUEST:
PAYLOAD_CONTENT: "${(content || 'IMAGE_DATA').substring(0, 1500)}"
INSTRUCTION: Evaluate for quishing. If the payload looks like gibberish or encoded data, set Fake Pattern to 100 immediately. Apply formula.`;

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

    return processResponse(response, content || "Encoded Payload Artifact");
  } catch (error: any) {
    console.error("Forensic analysis failed:", error);
    return getErrorResult(content || "System Error", error.message || "Engine Error");
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({ title: chunk.web.title || "External Intelligence", uri: chunk.web.uri });
      }
    });
  }

  const raw = JSON.parse(response.text || "{}");
  let probs: ProbabilityMap = {
    malicious: raw.probability_breakdown?.malicious_intent || 0,
    fake: raw.probability_breakdown?.fake_or_pseudo_pattern || 0,
    authentic: raw.probability_breakdown?.official_or_authentic || 0
  };

  // Enforce the 30-point delta rule mathematically
  probs = ensureDimensionalSeparation(probs);

  // Recalculate score locally to ensure 100% reachability and formula adherence
  const rawScore = (0.6 * probs.malicious) + (0.5 * probs.fake) - (0.3 * probs.authentic);
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 1.1)));

  // Determine Level dynamically based on final score
  let level = RiskLevel.LOW;
  if (finalScore > 85) level = RiskLevel.CRITICAL;
  else if (finalScore > 70) level = RiskLevel.HIGH;
  else if (finalScore > 45) level = RiskLevel.SUSPICIOUS;
  else if (finalScore > 20) level = RiskLevel.MODERATE;

  return { 
    riskScore: finalScore,
    riskLevel: level,
    explanation: raw.expert_assessment || "Automated audit logs compiled.",
    recommendations: raw.recommended_actions || ["Exercise extreme caution with this payload."],
    originalContent: raw.originalContent || defaultContent,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
    probabilities: probs
  };
}

function getErrorResult(content: string, errorType: string): AnalysisResult {
  const isKeyError = errorType.includes("API_KEY_MISSING");
  
  return {
    riskScore: isKeyError ? 0 : 95, // Default to CRITICAL for system errors (like rate limits)
    riskLevel: isKeyError ? RiskLevel.LOW : RiskLevel.CRITICAL, 
    explanation: isKeyError 
      ? "FORENSIC ENGINE DISCONNECTED: The API_KEY environment variable is not set in your VS Code environment. Create a .env file locally with API_KEY=your_key to enable real-time detection."
      : `CRITICAL ENGINE FAILURE: ${errorType}. This payload must be treated as a direct threat.`,
    recommendations: isKeyError 
      ? ["Set up your API Key locally", "Review project documentation", "Restart Dev Server"]
      : ["DO NOT OPEN THIS QR", "Report to security team", "Wipe clipboard data"],
    originalContent: content,
    probabilities: isKeyError ? { malicious: 0, fake: 0, authentic: 0 } : { malicious: 90, fake: 100, authentic: 5 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General'}. Query: "${message}"`,
      config: { systemInstruction: "You are the QRShield Guardian. Be direct and technical." }
    });
    return response.text || "Assistant disconnected.";
  } catch (err) {
    return "API Key is required for assistant features.";
  }
}
