
import React, { useState } from 'react';
import { QRState, RiskLevel, AnalysisResult } from './types';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import ProbabilityBreakdown from './components/ProbabilityBreakdown';
import Layout from './components/Layout';
import { GoogleGenAI, Type } from "@google/genai";
// Added missing jsQR import to resolve compilation error on line 137
import jsQR from 'jsqr';

const App: React.FC = () => {
  const [state, setState] = useState<QRState>({
    view: 'home',
    decodedContent: null,
    base64Image: null,
    analysis: null,
    loading: false,
    error: null,
  });

  const resetState = () => {
    setState({
      view: 'home',
      decodedContent: null,
      base64Image: null,
      analysis: null,
      loading: false,
      error: null,
    });
  };

  const analyzeWithGemini = async (content: string): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a deep security forensic analysis on the following QR code payload: "${content}". 
      Check for: Phishing, typosquatting (brand spoofing), suspicious TLDs, redirectors, malicious scripts, and insecure protocols.`,
      config: {
        systemInstruction: "You are a world-class cybersecurity forensic expert specializing in 'Quishing' (QR Phishing) detection. Analyze payloads for hidden threats. Return strictly valid JSON matching the requested schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: {
              type: Type.NUMBER,
              description: "A score from 0 to 100 indicating the threat level."
            },
            riskLevel: {
              type: Type.STRING,
              description: "Must be one of: LOW, MODERATE, SUSPICIOUS, HIGH, CRITICAL."
            },
            explanation: {
              type: Type.STRING,
              description: "A concise forensic explanation of the findings."
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 actionable security recommendations."
            },
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
          required: ["riskScore", "riskLevel", "explanation", "recommendations", "probabilities"]
        }
      }
    });

    try {
      const data = JSON.parse(response.text || "{}");
      return {
        ...data,
        originalContent: content,
        riskLevel: data.riskLevel as RiskLevel
      };
    } catch (e) {
      throw new Error("Neural output parsing failed. The payload may be malformed.");
    }
  };

  const runAnalysis = async (content: string | null, base64: string | null) => {
    if (!content && !base64) {
      setState(prev => ({ ...prev, error: "No data captured.", view: 'result' }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      view: 'result', 
      decodedContent: content, 
      base64Image: base64, 
      error: null 
    }));

    try {
      // If we only have an image (deep scan), we rely on Gemini to see it or the scanner to have already decoded it
      // For this implementation, we assume the scanner decodes the content string
      if (content) {
        const result = await analyzeWithGemini(content);
        setState(prev => ({ ...prev, analysis: result, loading: false }));
      } else {
        setState(prev => ({ ...prev, loading: false, error: "Decoder failed to extract text from the image." }));
      }
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message || "An unexpected error occurred during AI analysis." 
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // jsQR is now available via import to decode manually uploaded images
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            runAnalysis(code ? code.data : null, base64);
          }
        };
        img.src = base64;
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Layout onHomeClick={resetState}>
      {state.view === 'home' && (
        <div className="space-y-16 py-12 animate-in fade-in duration-1000">
          <div className="text-center space-y-8">
            <div className="flex justify-center mb-4">
               <div className="bg-blue-500/10 border border-blue-500/20 px-5 py-2 rounded-full flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
                    AI-Powered Forensics • Active
                  </span>
               </div>
            </div>
            
            <h2 className="text-8xl font-black text-white tracking-tighter leading-tight italic uppercase drop-shadow-2xl">
              QR <span className="text-blue-600">Shield</span>
            </h2>
            <p className="text-2xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
              Detect quishing, phishing, and malicious redirects using advanced Gemini-powered security forensics.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-10">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))}
                className="group px-14 py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-[2.5rem] font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-600/30 active:scale-95 flex items-center justify-center space-x-4"
              >
                <i className="fas fa-expand text-2xl"></i>
                <span>Start Scanner</span>
              </button>
              
              <div className="relative group inline-block">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <button className="px-14 py-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-[2.5rem] font-black uppercase tracking-widest transition-all border border-slate-700 flex items-center justify-center space-x-4">
                  <i className="fas fa-cloud-upload-alt text-2xl"></i>
                  <span>Upload Asset</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {[
              { icon: 'fa-brain', title: 'Neural Analysis', desc: 'Uses LLM intelligence to spot sophisticated social engineering.' },
              { icon: 'fa-shield-virus', title: 'Quishing Protection', desc: 'Identifies brand spoofing and malicious redirect chains.' },
              { icon: 'fa-microchip', title: 'Dynamic Scoring', desc: 'Provides granular risk assessments based on real-time threat data.' }
            ].map((feature, i) => (
              <div key={i} className="group p-10 bg-slate-800/20 hover:bg-slate-800/30 border border-slate-700/30 rounded-[3rem] text-center space-y-5 transition-all">
                <div className="w-14 h-14 bg-slate-800 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform shadow-xl">
                  <i className={`fas ${feature.icon} text-xl`}></i>
                </div>
                <h4 className="text-base font-black uppercase tracking-tight text-white italic">{feature.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-bold">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.view === 'scan' && (
        <Scanner onScan={(content) => runAnalysis(content, null)} onDeepScan={(base64) => runAnalysis(null, base64)} onCancel={resetState} />
      )}

      {state.view === 'result' && (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
          {state.loading ? (
            <div className="py-40 flex flex-col items-center space-y-12">
              <div className="relative">
                <div className="w-40 h-40 border-[4px] border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <i className="fas fa-brain text-blue-500 text-4xl animate-pulse"></i>
                </div>
              </div>
              <div className="text-center space-y-4">
                <p className="text-4xl font-black text-white italic uppercase tracking-tighter">AI Neural Analysis</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-[0.5em] font-black">Consulting Global Threat Databases</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 space-y-8">
                {state.analysis && (
                  <>
                    <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
                    <div className="bg-slate-900/40 p-10 rounded-[3rem] border border-slate-800 backdrop-blur-xl shadow-2xl">
                      <ProbabilityBreakdown probabilities={state.analysis.probabilities} />
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-7 space-y-8">
                {state.error ? (
                  <div className="bg-rose-500/5 border border-rose-500/20 p-16 rounded-[4rem] text-center shadow-2xl max-w-2xl mx-auto">
                    <div className="bg-rose-500/20 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-10">
                      <i className="fas fa-exclamation-circle text-rose-500 text-4xl"></i>
                    </div>
                    <h3 className="text-4xl font-black text-white italic mb-6 uppercase tracking-tighter">Analysis Failure</h3>
                    <p className="text-slate-400 font-mono text-sm mb-12 leading-relaxed px-8 italic">"{state.error}"</p>
                    <button onClick={resetState} className="w-full py-6 bg-slate-800 hover:bg-slate-700 text-white rounded-3xl font-black uppercase tracking-[0.25em] transition-all border border-slate-700">
                      Abort and Reset
                    </button>
                  </div>
                ) : state.analysis && (
                  <div className="bg-slate-900/40 p-12 rounded-[4rem] border border-slate-800 space-y-12 shadow-2xl backdrop-blur-xl">
                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600 flex items-center">
                        <span className="w-16 h-[1px] bg-slate-800 mr-5"></span>
                        Scanned Bitstream
                      </h4>
                      <div className="bg-slate-950/80 p-8 rounded-[2.5rem] font-mono text-xs text-blue-400 break-all border border-slate-800/80 shadow-inner group relative">
                        {state.decodedContent || "N/A"}
                        <button onClick={() => navigator.clipboard.writeText(state.decodedContent || '')} className="absolute top-4 right-4 text-slate-700 hover:text-blue-500 transition-colors">
                          <i className="fas fa-copy text-sm"></i>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600 flex items-center">
                        <span className="w-16 h-[1px] bg-slate-800 mr-5"></span>
                        Neural Findings
                      </h4>
                      <p className="text-slate-100 text-2xl leading-relaxed font-black italic tracking-tight">
                        "{state.analysis.explanation}"
                      </p>
                    </div>

                    <div className="space-y-8">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600 flex items-center">
                        <span className="w-16 h-[1px] bg-slate-800 mr-5"></span>
                        Security Protocol
                      </h4>
                      <div className="grid gap-4">
                        {state.analysis.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start space-x-6 bg-slate-800/30 p-7 rounded-[2rem] border border-slate-700/20">
                            <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                              <i className="fas fa-shield-check text-sm"></i>
                            </div>
                            <span className="text-base text-slate-300 font-bold leading-relaxed">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-10 border-t border-slate-800">
                       <button onClick={resetState} className="w-full py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs transition-all shadow-2xl shadow-blue-600/30 active:scale-95">
                         Scan Another Code
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </Layout>
  );
};

export default App;
