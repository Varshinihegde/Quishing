
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

/**
 * Performs a deep security analysis using Gemini 3 Pro.
 * The API key is obtained exclusively from process.env.API_KEY.
 */
export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  try {
    // Instantiate inside the function to ensure up-to-date environment access
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY_MISSING");
    }

    const ai = new GoogleGenAI({ apiKey });
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

    const prompt = `Act as a senior Cybersecurity Analyst. Inspect this QR code data for Quishing (QR Phishing).
    Content: "${content || 'Captured via Image'}"

    Detect:
    1. Phishing attempts (Quishing).
    2. Malicious URL redirection or obfuscation.
    3. Structural abnormalities in the QR pattern that suggest tampering.
    
    STRICT JSON OUTPUT REQUIRED. Do not include markdown code blocks.
    Return riskScore (0-100), riskLevel (SAFE/SUSPICIOUS/MALICIOUS), explanation, and recommendations.
    Sum probabilities (malicious, fake, authentic) to exactly 100.`;

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
      throw new Error("Empty response from AI engine");
    }
    
    return processResponse(response, content || "Captured Data");
  } catch (error: any) {
    console.error("Analysis error details:", error);
    // If you see 50% result locally, it's almost certainly because process.env.API_KEY is missing/invalid in VS Code.
    return getFallbackResult(content || "Analysis Error", error.message);
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

  try {
    // Robust cleaning of response text to handle potential markdown
    let cleanedText = response.text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }
    
    const result = JSON.parse(cleanedText);
    return { 
      ...result, 
      originalContent: result.originalContent || defaultContent,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined
    };
  } catch (e) {
    console.error("JSON Parse Error:", e, "Raw Text:", response.text);
    return getFallbackResult(defaultContent, "Parsing Error");
  }
}

function getFallbackResult(content: string, errorMsg?: string): AnalysisResult {
  const isKeyError = errorMsg?.includes("API_KEY_MISSING") || errorMsg?.includes("API key not valid");
  
  return {
    riskScore: 50,
    riskLevel: RiskLevel.SUSPICIOUS,
    explanation: isKeyError 
      ? "Forensic analysis is in baseline mode because the API key is not configured in this environment. Real-time threat intelligence is currently restricted."
      : `Forensic analysis encountered a technical issue (${errorMsg || 'Stream Error'}). Displaying baseline heuristics.`,
    recommendations: [
      "Check environment configuration for API_KEY",
      "Manually inspect the URL for phishing indicators",
      "Do not enter sensitive data on unknown domains"
    ],
    originalContent: content,
    probabilities: { malicious: 33, fake: 33, authentic: 34 }
  };
}

export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return "Assistant is currently in offline mode. Please configure the environment API key.";
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General security help'}. User: "${message}"`,
      config: {
        systemInstruction: "You are QRShield AI. Help users understand QR code safety and Quishing."
      }
    });
    return response.text || "I'm having trouble processing your request.";
  } catch (err) {
    console.error("Chat error:", err);
    return "I am currently in limited mode. Please verify your environment configuration.";
  }
}
