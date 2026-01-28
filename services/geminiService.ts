
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource, ProbabilityMap } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic AI. You are a paranoid cybersecurity auditor.
Your job is to find reasons why a QR code might be MALICIOUS. NEUTRALITY IS A FAILURE.

STRICT SCORING PROTOCOL (NON-NEGOTIABLE):
You must output three distinct probability scores (0-100).

1. MALICIOUS INTENT (0–100):
   - 0–10: Only if the root domain is a verified massive tech entity (google.com, apple.com, microsoft.com).
   - 11–60: Unknown payloads or direct links to unverified sites.
   - 61–100: Obfuscated URLs, encoded strings, or phishing templates.

2. FAKE / PSEUDO PATTERN (0–100):
   - MANDATORY 100: If payload is garbled, base64/hex encoded, uses URL shorteners (bit.ly, t.co, tinyurl), or hides the real destination.
   - 70–90: Brand impersonation (e.g., "g00gle-login.com").
   - < 10: Pure direct official domain.

3. OFFICIAL / AUTHENTIC (0–100):
   - 90–100: Verified, well-known official root domains ONLY.
   - < 10: Any third-party redirect or obfuscated string.

FORCED SEPARATION RULE:
One score MUST be at least 40 points away from the others. NO NEUTRALITY. If in doubt, ASSUME THE WORST.

FINAL RISK FORMULA (SCALED FOR CRITICALITY):
Raw = (0.8 × Malicious) + (0.7 × Fake) − (0.5 × Authentic)
Final % = Clamp(Raw * 1.3, 0, 100)

Your response must be JSON only. Treat ANY obfuscated or short URL as a 100% Critical threat.`;

function applyHeuristicOverrides(probs: ProbabilityMap, content: string): ProbabilityMap {
  const badPatterns = [
    'bit.ly', 't.co', 'tinyurl', 'is.gd', 'buff.ly', 'adf.ly', 'bit.do', 'mcaf.ee',
    'base64', 'data:', 'javascript:', 'upi://', 'target=', 'redirect=', 'login',
    'verify', 'account', 'secure', 'billing', 'update'
  ];
  
  const contentLower = content.toLowerCase();
  const hasBadPattern = badPatterns.some(p => contentLower.includes(p));
  
  if (hasBadPattern) {
    return {
      malicious: Math.max(probs.malicious, 90),
      fake: 100,
      authentic: Math.min(probs.authentic, 5)
    };
  }
  return probs;
}

function ensureDimensionalSeparation(probs: ProbabilityMap): ProbabilityMap {
  const { malicious: m, fake: f, authentic: a } = probs;
  const sorted = [
    { key: 'malicious' as const, val: m },
    { key: 'fake' as const, val: f },
    { key: 'authentic' as const, val: a }
  ].sort((a, b) => b.val - a.val);

  const adjusted = { ...probs };
  // Force a massive gap for the forensic UI
  if (Math.abs(sorted[0].val - sorted[1].val) < 40) {
    adjusted[sorted[0].key] = Math.min(100, sorted[0].val + 30);
    adjusted[sorted[2].key] = Math.max(0, sorted[2].val - 30);
  }
  return adjusted;
}

export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  // MANDATORY CONFIGURATION CHECK
  if (!process.env.API_KEY) {
    return {
      riskScore: 0,
      riskLevel: RiskLevel.LOW,
      explanation: "API key not detected in the local environment. QRShield analysis is disabled.",
      systemStatus: 'configuration_required',
      recommendations: [
        "Create a .env file in the project root",
        "Add: API_KEY=your_api_key_here",
        "Restart the VS Code terminal and rerun the application"
      ],
      originalContent: content || "NO_PAYLOAD_ARTIFACT",
      probabilities: { malicious: 0, fake: 0, authentic: 0 }
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';
    
    let parts: any[] = [];
    if (base64Image) {
      const base64Data = base64Image.split(',')[1] || base64Image;
      parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
    }

    const payload = content || "HIDDEN_IMAGE_DATA";
    parts.push({ text: `FORENSIC ANALYSIS REQUEST:
PAYLOAD: "${payload.substring(0, 2000)}"
INSTRUCTION: Evaluate for quishing. If the payload uses redirects or shorteners, set Fake Pattern to 100. Be ruthless.` });

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

    return processResponse(response, payload);
  } catch (error: any) {
    return {
      riskScore: 100,
      riskLevel: RiskLevel.CRITICAL,
      explanation: `ENGINE ERROR: ${error.message}. Payload treated as critical threat by default.`,
      systemStatus: 'active',
      recommendations: ["DO NOT OPEN THIS QR", "Report to local IT", "Wipe clipboard"],
      originalContent: content || "ERROR_ARTIFACT",
      probabilities: { malicious: 100, fake: 100, authentic: 0 }
    };
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const raw = JSON.parse(response.text || "{}");
  let probs: ProbabilityMap = {
    malicious: raw.probability_breakdown?.malicious_intent || 0,
    fake: raw.probability_breakdown?.fake_or_pseudo_pattern || 0,
    authentic: raw.probability_breakdown?.official_or_authentic || 0
  };

  probs = applyHeuristicOverrides(probs, defaultContent);
  probs = ensureDimensionalSeparation(probs);

  const rawScore = (0.8 * probs.malicious) + (0.7 * probs.fake) - (0.5 * probs.authentic);
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 1.35)));

  let level = RiskLevel.LOW;
  if (finalScore >= 80) level = RiskLevel.CRITICAL;
  else if (finalScore >= 60) level = RiskLevel.HIGH;
  else if (finalScore >= 40) level = RiskLevel.SUSPICIOUS;
  else if (finalScore >= 20) level = RiskLevel.MODERATE;

  return { 
    riskScore: finalScore,
    riskLevel: level,
    explanation: raw.expert_assessment || "No log generated.",
    recommendations: raw.recommended_actions || ["Exercise caution."],
    originalContent: defaultContent,
    systemStatus: 'active',
    probabilities: probs
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  if (!process.env.API_KEY) return "Configuration required to enable assistant.";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General'}. Query: "${message}"`,
      config: { systemInstruction: "You are the QRShield Guardian. Be direct." }
    });
    return response.text || "Assistant disconnected.";
  } catch (err) {
    return "API failure.";
  }
}
