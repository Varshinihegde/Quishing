
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

/**
 * Safely retrieves the API key from the environment.
 */
function getApiKey(): string {
  // Try to get from process.env (standard)
  try {
    const key = process.env.API_KEY;
    if (key && key !== "undefined" && key !== "") return key;
  } catch (e) {}

  // Try window global if process is missing (some ESM environments)
  const win = window as any;
  if (win.process?.env?.API_KEY) return win.process.env.API_KEY;
  
  return "";
}

function getAI() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
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
  let ai;
  try {
    ai = getAI();
  } catch (e: any) {
    throw new Error("API connection failed. Please ensure your API key is configured in your environment.");
  }

  try {
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

    if (!response.text) {
      return getFallbackResult(content || "Visual Data Captured");
    }

    return processResponse(response, content || "Visual Data Captured");
  } catch (error: any) {
    console.error("Analysis failed:", error);
    const errorMsg = error.message || "";
    
    // Check for "Requested entity was not found" which usually means the project needs re-linking/billing
    if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("404")) {
      throw new Error("RESELECT_KEY");
    }

    if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("API key")) {
      throw new Error("Invalid API Credentials. Please check your setup.");
    }
    
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
    explanation: "Security verification reached a safe limit. Content should be manually reviewed as a precaution.",
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
        systemInstruction: "You are the QRShield Security Expert. Assist users with QR safety inquiries."
      }
    });
    return response.text || "I encountered an error processing your query.";
  } catch {
    return "Chat is currently offline. Please ensure the system is configured.";
  }
}
