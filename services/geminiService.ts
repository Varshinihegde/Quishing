
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, ProbabilityMap } from "../types";

const SYSTEM_PROMPT = `You are the QRShield Forensic AI, a world-class cybersecurity auditor.
Your mission is to find reasons why a QR code might be MALICIOUS. NEUTRALITY IS A FAILURE.

STRICT SCORING PROTOCOL:
You must output three distinct probability scores (0-100).

1. MALICIOUS INTENT (0–100):
   - 0–10: Only for verified white-listed domains (google.com, apple.com, microsoft.com).
   - 11–60: Unknown payloads or direct links to unverified sites.
   - 61–100: Obfuscated URLs, encoded strings, or phishing templates.

2. FAKE / PSEUDO PATTERN (0–100):
   - MANDATORY 100: If payload is garbled, base64/hex encoded, uses dynamic QR services (scan.page, qrco.de, etc.), or uses URL shorteners.
   - 70–90: Brand impersonation.

3. OFFICIAL / AUTHENTIC (0–100):
   - 90–100: Verified, well-known official root domains ONLY.

FINAL RISK FORMULA:
Raw = (0.8 × Malicious) + (0.7 × Fake) − (0.5 × Authentic)
Final % = Clamp(Raw * 1.3, 0, 100)

Your response must be JSON only. Treat ANY dynamic redirect as a critical threat.`;

function applyHeuristicOverrides(probs: ProbabilityMap, content: string): ProbabilityMap {
  const badPatterns = [
    'bit.ly', 't.co', 'tinyurl', 'is.gd', 'scan.page', 'qrco.de', 'qr-code-generator',
    'base64', 'data:', 'javascript:', 'upi://', 'target=', 'redirect=', 'login'
  ];
  
  const contentLower = content.toLowerCase();
  const hasBadPattern = badPatterns.some(p => contentLower.includes(p));
  
  if (hasBadPattern) {
    return {
      malicious: Math.max(probs.malicious, 85),
      fake: 100,
      authentic: Math.min(probs.authentic, 5)
    };
  }
  return probs;
}

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
      parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
    }

    const payload = content || "HIDDEN_IMAGE_DATA";
    parts.push({ text: `FORENSIC ANALYSIS REQUEST:
PAYLOAD: "${payload}"
INSTRUCTION: Evaluate for quishing. Dynamic redirects are high-risk.` });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
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
    console.error("Analysis failed:", error);
    return {
      riskScore: 100,
      riskLevel: RiskLevel.CRITICAL,
      explanation: `FORENSIC ENGINE ERROR: ${error.message || "Unknown Failure"}. As a security precaution, this payload is classified as CRITICAL until manual verification.`,
      recommendations: ["DO NOT OPEN", "Report to security team", "Wipe browser cache"],
      originalContent: content || "Artifact corrupted",
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
    explanation: raw.expert_assessment || "Automated scan complete.",
    recommendations: raw.recommended_actions || ["Stay vigilant."],
    originalContent: defaultContent,
    probabilities: probs
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General'}. Query: "${message}"`,
      config: { systemInstruction: "You are the QRShield Guardian." }
    });
    return response.text || "No response.";
  } catch (err) {
    return "Service error.";
  }
}
