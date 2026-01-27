
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

function getAI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Performs a Universal Security Analysis detecting structural authenticity and safety.
 */
export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  try {
    const ai = getAI();
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

    const prompt = `You are a Cybersecurity & Intelligence Specialist. Analyze the provided QR code for both structural authenticity and malicious intent.

    Input Data: "${content || 'Image Capture Only'}"

    STRICT PHRASING RULES:
    1. IF THE CODE IS MALICIOUS: Your explanation MUST start with the exact phrase: "This is a malicious QR code."
    2. IF THE CODE IS FAKE OR UNORIGINAL (but safe): Your explanation MUST start with the exact phrase: "This is not a malicious code, but it is not original and it is fake."
    3. IF THE CODE IS AUTHENTIC AND SAFE: Provide a standard safety confirmation.

    PROBABILITIES (Must sum to 100):
    - 'malicious': Risk percentage of phishing/malware.
    - 'fake': Probability percentage the QR itself is a visual trap, unoriginal, or malformed pattern.
    - 'authentic': Probability percentage this is a legitimate, high-integrity standard code.

    Return JSON with: riskScore (0-100), riskLevel (SAFE/SUSPICIOUS/MALICIOUS), explanation, recommendations (min 3 clear security steps), probabilities object, and originalContent.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            riskLevel: { type: Type.STRING, enum: Object.values(RiskLevel) },
            explanation: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            originalContent: { type: Type.STRING },
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
          required: ["riskScore", "riskLevel", "explanation", "recommendations", "probabilities", "originalContent"]
        }
      }
    });

    return processResponse(response, content || "Visual Data Captured");
  } catch (error) {
    console.error("Analysis failed:", error);
    return getFallbackResult(content || "Analysis Error");
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        groundingSources.push({
          title: chunk.web.title || "Security Reference",
          uri: chunk.web.uri
        });
      }
    });
  }

  const result = JSON.parse(response.text || '{}');
  return { 
    ...result, 
    originalContent: result.originalContent || defaultContent,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined
  };
}

function getFallbackResult(content: string): AnalysisResult {
  return {
    riskScore: 50,
    riskLevel: RiskLevel.SUSPICIOUS,
    explanation: "Security verification timed out. Please review the content manually.",
    recommendations: ["Do not click links if the source is unknown", "Verify the destination URL manually", "Ensure the QR code was provided by a trusted source"],
    originalContent: content,
    probabilities: { malicious: 33, fake: 33, authentic: 34 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'Security analysis'}. User: "${message}"`,
      config: {
        systemInstruction: "You are the QRShield Security Expert. Assist users with QR safety inquiries without using the word forensic."
      }
    });
    return response.text || "I encountered an error processing your query.";
  } catch {
    return "Chat is currently offline.";
  }
}
