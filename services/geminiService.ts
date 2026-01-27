
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, RiskLevel, GroundingSource } from "../types";

/**
 * Performs a deep security analysis using Gemini.
 */
export async function performDeepAnalysis(
  content: string | null, 
  base64Image: string | null
): Promise<AnalysisResult> {
  try {
    // ALWAYS use the named parameter and direct process.env.API_KEY as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-flash-preview for fast and reliable security analysis.
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

    const prompt = `Act as a senior Cybersecurity Analyst. 
    Analyze this QR code data for security threats, specifically Quishing (QR Phishing).
    
    DATA CONTENT: "${content || 'Captured via Image (Inspection Required)'}"

    INSTRUCTIONS:
    1. Inspect for phishing attempts, malicious redirects, or obfuscated URLs.
    2. Check for structural abnormalities in the QR pattern if an image is provided.
    3. Evaluate the risk level and provide a score.
    
    Ensure all probability values (malicious, fake, authentic) are numbers that sum to exactly 100.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        // Use googleSearch tool for real-time threat intelligence when a URL is present.
        tools: content?.includes('://') ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER, description: "Threat score from 0-100" },
            riskLevel: { type: Type.STRING, description: "SAFE, SUSPICIOUS, or MALICIOUS" },
            explanation: { type: Type.STRING, description: "Detailed security breakdown" },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of safety actions" 
            },
            originalContent: { type: Type.STRING, description: "The content found in the QR" },
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
          required: ["riskScore", "riskLevel", "explanation", "recommendations", "originalContent", "probabilities"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text received from Gemini.");
    }
    
    return processResponse(response, content || "Extracted Data");
  } catch (error: any) {
    console.error("Analysis failure:", error);
    return getFallbackResult(content || "Security Scan", error.message);
  }
}

function processResponse(response: GenerateContentResponse, defaultContent: string): AnalysisResult {
  const groundingSources: GroundingSource[] = [];
  // Extract URLs from groundingChunks as required by the Search Grounding guidelines.
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

  try {
    // Access .text property directly (it's a getter).
    const text = response.text.trim();
    const result = JSON.parse(text);
    
    return { 
      ...result, 
      originalContent: result.originalContent || defaultContent,
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined
    };
  } catch (e) {
    console.error("JSON Parse Error on text:", response.text);
    return getFallbackResult(defaultContent, "Response Formatting Error");
  }
}

function getFallbackResult(content: string, errorType?: string): AnalysisResult {
  return {
    riskScore: 50,
    riskLevel: RiskLevel.SUSPICIOUS,
    explanation: `Forensic engine encountered an interruption (${errorType || 'Unknown Error'}). Using heuristic safety check.`,
    recommendations: [
      "Manually verify the destination URL before clicking",
      "Check for 'typosquatting' (e.g., g00gle.com instead of google.com)",
      "Avoid scanning QR codes from unverified or suspicious physical stickers",
      "Ensure your environment variable API_KEY is correctly set"
    ],
    originalContent: content,
    probabilities: { malicious: 40, fake: 30, authentic: 30 }
  };
}

/**
 * Gets a response from the security chatbot.
 */
export async function getChatbotResponse(message: string, context?: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context || 'General security help'}. User: "${message}"`,
      config: {
        systemInstruction: "You are QRShield AI. Help users understand QR code safety and Quishing. Provide concise, expert cybersecurity advice."
      }
    });
    // Access .text property directly.
    return response.text || "I'm having trouble analyzing that question right now.";
  } catch (err) {
    console.error("Chatbot error:", err);
    return "I'm experiencing high latency in my security modules. Please try again.";
  }
}
