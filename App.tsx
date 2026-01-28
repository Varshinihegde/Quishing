import React, { useState, useRef } from 'react';
import { QRState, RiskLevel } from './types';
import { performDeepAnalysis } from './services/geminiService';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import Chatbot, { ChatbotHandle } from './components/Chatbot';
import ProbabilityBreakdown from './components/ProbabilityBreakdown';
import jsQR from 'jsqr';

// Main Application Component
const App: React.FC = () => {
  const chatbotRef = useRef<ChatbotHandle>(null);
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
      console.error("App Analysis Error:", err);
      setState(prev => ({ 
        ...prev, 
        error: err.message || "Forensic failure. Verify your configuration.", 
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

  const isAuthError = state.error?.includes("UNAUTHORIZED") || state.error?.includes("API_KEY");

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
             <button 
                onClick={resetState}
                className="text-slate-400 hover:text-white transition-colors"
             >
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
                Shielding your digital life from quishing (QR phishing) and malicious payloads using advanced forensic AI.
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
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {state.loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-microchip text-blue-500 text-2xl animate-pulse"></i>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold uppercase tracking-widest text-white mb-1">Analyzing Signal...</h3>
                  <p className="text-slate-500 text-sm font-mono italic">Extracting telemetry from QR payload</p>
                </div>
              </div>
            ) : state.error ? (
              <div className="bg-rose-500/5 border border-rose-500/20 p-12 rounded-[2.5rem] text-center max-w-2xl mx-auto shadow-2xl">
                <div className="bg-rose-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-exclamation-triangle text-rose-500 text-3xl"></i>
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-4 italic">Forensic Alert</h2>
                <div className="bg-black/40 rounded-2xl p-6 border border-slate-800 mb-8 text-left">
                   <pre className="text-rose-400 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                     {state.error}
                   </pre>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={resetState} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all border border-slate-700 uppercase tracking-widest text-xs">
                    Return to Terminal
                  </button>
                  {isAuthError && (
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all uppercase tracking-widest text-xs flex items-center justify-center space-x-2"
                    >
                      <i className="fas fa-external-link-alt"></i>
                      <span>Get New Key</span>
                    </a>
                  )}
                </div>
              </div>
            ) : state.analysis && (
              <div className="grid lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-6">
                  <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
                  
                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl">
                    <ProbabilityBreakdown probabilities={state.analysis.probabilities} />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 italic flex items-center">
                        <i className="fas fa-file-contract mr-2"></i> Payload Signature
                      </h4>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-xs break-all text-blue-400 shadow-inner">
                        {state.decodedContent || "No text decoded (Image extraction only)"}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 italic flex items-center">
                        <i className="fas fa-microscope mr-2"></i> AI Forensic Summary
                      </h4>
                      <p className="text-slate-200 leading-relaxed font-medium italic">
                        "{state.analysis.explanation}"
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 italic flex items-center">
                        <i className="fas fa-shield-virus mr-2"></i> Security Recommendations
                      </h4>
                      <ul className="space-y-3">
                        {state.analysis.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start space-x-3 text-sm text-slate-400">
                            <i className="fas fa-chevron-right text-blue-500 mt-1 text-[10px]"></i>
                            <span className="font-medium">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => chatbotRef.current?.sendMessage("Tell me more about this risk analysis.", JSON.stringify(state.analysis))}
                      className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 py-4 rounded-2xl text-blue-400 font-bold transition-all flex items-center justify-center space-x-2"
                    >
                      <i className="fas fa-brain"></i>
                      <span>Ask AI Assistant</span>
                    </button>
                    <button 
                      onClick={resetState}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl text-white font-bold transition-all"
                    >
                      New Scan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 py-8 px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs font-bold uppercase tracking-widest">
          <p>© 2024 QRShield Forensic Core</p>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-blue-500 transition-colors">Privacy Protocol</a>
            <a href="#" className="hover:text-blue-500 transition-colors">Neural Link Help</a>
            <a href="#" className="hover:text-blue-500 transition-colors italic text-blue-500/50">SECURED BY AI</a>
          </div>
        </div>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;