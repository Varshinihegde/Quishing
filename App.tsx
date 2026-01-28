import React, { useState, useRef, useEffect } from 'react';
import { QRState, RiskLevel } from './types';
import { performDeepAnalysis } from './services/geminiService';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import Chatbot, { ChatbotHandle } from './components/Chatbot';
import ProbabilityBreakdown from './components/ProbabilityBreakdown';
import jsQR from 'jsqr';

const App: React.FC = () => {
  const chatbotRef = useRef<ChatbotHandle>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [state, setState] = useState<QRState>({
    view: 'home',
    decodedContent: null,
    base64Image: null,
    analysis: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const apiStored = await (window as any).aistudio?.hasSelectedApiKey();
    const envKey = process.env.API_KEY;
    setHasKey(!!apiStored || (!!envKey && !envKey.includes(' ')));
  };

  const handleOpenKeySelector = async () => {
    try {
      await (window as any).aistudio?.openSelectKey();
      // Assume success and proceed to app
      setHasKey(true);
    } catch (err) {
      console.error("Key selection failed", err);
    }
  };

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

  const runAnalysis = async (content: string | null, base64: string | null) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      view: 'result', 
      decodedContent: content, 
      base64Image: base64, 
      error: null 
    }));
    
    try {
      const result = await performDeepAnalysis(content, base64);
      setState(prev => ({ 
        ...prev, 
        analysis: result, 
        loading: false 
      }));
    } catch (err: any) {
      if (err.message === "KEY_NOT_FOUND" || err.message === "UNAUTHORIZED") {
        setHasKey(false);
      }
      setState(prev => ({ 
        ...prev, 
        error: err.message, 
        loading: false 
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          runAnalysis(code ? code.data : null, base64);
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl text-center space-y-8">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
            <i className="fas fa-link text-white text-3xl"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-tight">
              Neural Core <span className="text-blue-500">Offline</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              The Gemini API key is missing or invalid. Link your neural core to proceed with forensics.
            </p>
          </div>
          <button 
            onClick={handleOpenKeySelector}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-500/20 active:scale-95"
          >
            Link Neural Core
          </button>
          <div className="pt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Requirements</p>
            <p className="text-[10px] text-slate-400">
              Must use a Paid Project API Key. <br />
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-500 underline decoration-blue-500/30">Billing Documentation</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px]"></div>
      </div>

      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div onClick={resetState} className="flex items-center space-x-3 cursor-pointer group">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <i className="fas fa-shield-halved text-white text-xl"></i>
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">
              QR<span className="text-blue-500">Shield</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
             <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-400">Guardian Engine Active</span>
             </div>
             <button onClick={resetState} className="text-slate-400 hover:text-white transition-colors">
                <i className="fas fa-home text-lg"></i>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-6xl mx-auto w-full px-6 py-12">
        {state.view === 'home' && (
          <div className="max-w-3xl mx-auto text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-[0.9]">
                Deep Forensic <br />
                <span className="text-blue-500">QR Inspection</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">
                Shielding your digital life from quishing and malicious payloads using advanced forensic AI.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))}
                className="group relative bg-blue-600 hover:bg-blue-500 p-8 rounded-[2.5rem] transition-all overflow-hidden text-left"
              >
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                  <i className="fas fa-camera text-6xl"></i>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Live Scanner</h3>
                <p className="text-blue-100/70 text-sm font-medium">Use your camera for real-time deep-packet inspection.</p>
              </button>

              <label className="group relative bg-slate-900 hover:bg-slate-800 p-8 rounded-[2.5rem] transition-all border border-slate-800 cursor-pointer text-left">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                  <i className="fas fa-file-upload text-6xl"></i>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Upload Image</h3>
                <p className="text-slate-500 text-sm font-medium">Analyze a QR code from your gallery or files.</p>
              </label>
            </div>
          </div>
        )}

        {state.view === 'scan' && (
          <Scanner 
            onScan={(content) => runAnalysis(content, null)}
            onDeepScan={(base64) => runAnalysis(null, base64)}
            onCancel={resetState}
          />
        )}

        {state.view === 'result' && (
          <div className="max-w-5xl mx-auto space-y-8">
            {state.loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  <i className="fas fa-microchip absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 text-2xl"></i>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold uppercase tracking-widest text-white">Analyzing Signal...</h3>
                  <p className="text-slate-500 text-sm italic">Extracting telemetry from QR payload</p>
                </div>
              </div>
            ) : state.error ? (
              <div className="bg-rose-500/5 border border-rose-500/20 p-12 rounded-[2.5rem] text-center max-w-2xl mx-auto shadow-2xl">
                <i className="fas fa-exclamation-triangle text-rose-500 text-5xl mb-6"></i>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-4">Forensic Alert</h2>
                <p className="text-rose-400 font-mono text-sm mb-8">{state.error}</p>
                <button onClick={resetState} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all">
                  Return to Home
                </button>
              </div>
            ) : state.analysis && (
              <div className="grid lg:grid-cols-12 gap-8 items-start animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="lg:col-span-5 space-y-6">
                  <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl">
                    <ProbabilityBreakdown probabilities={state.analysis.probabilities} />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 italic">Payload Signature</h4>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-xs break-all text-blue-400">
                        {state.decodedContent || "Visual Forensics Only"}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 italic">AI Forensic Summary</h4>
                      <p className="text-slate-200 leading-relaxed font-medium italic">"{state.analysis.explanation}"</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 italic">Security Recommendations</h4>
                      <ul className="space-y-3">
                        {state.analysis.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start space-x-3 text-sm text-slate-400">
                            <i className="fas fa-chevron-right text-blue-500 mt-1 text-[10px]"></i>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => chatbotRef.current?.sendMessage("Clarify this risk assessment.", JSON.stringify(state.analysis))}
                      className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 py-4 rounded-2xl text-blue-400 font-bold transition-all"
                    >
                      Ask AI Assistant
                    </button>
                    <button onClick={resetState} className="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl text-white font-bold transition-all">
                      New Scan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 py-8 px-6 text-center text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">
        © 2024 QRShield Forensic Core • Stay Secure
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;