
import React, { useState, useRef } from 'react';
import { QRState } from './types';
import { performDeepAnalysis } from './services/geminiService';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import Chatbot, { ChatbotHandle } from './components/Chatbot';
import jsQR from 'jsqr';

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
      setState(prev => ({ 
        ...prev, 
        error: "The forensic engine encountered a critical disruption. Check your connection or API configuration.", 
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-emerald-600/5 rounded-full blur-[100px]"></div>
      </div>

      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div onClick={resetState} className="flex items-center space-x-3 cursor-pointer group">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all">
              <i className="fas fa-shield-halved text-white text-xl"></i>
            </div>
            <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              QR<span className="text-blue-500">Shield</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => chatbotRef.current?.open()}
              className="text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest bg-slate-900 px-4 py-2 rounded-full border border-slate-800"
            >
              System Help
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {state.view === 'home' && (
          <div className="text-center space-y-16 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span>Gemini 3 Flash Powered Forensics</span>
              </div>
              <h1 className="text-5xl sm:text-8xl font-black tracking-tighter leading-[0.9] text-white">
                Defend Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-700">Digital Identity.</span>
              </h1>
              <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                Analyze QR codes with real-time threat intelligence. We detect phishing, 
                malicious redirects, and deceptive patterns instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))}
                className="group p-10 bg-slate-900 hover:bg-slate-800 rounded-[3rem] transition-all border border-slate-800 hover:border-blue-500/50 shadow-2xl text-left relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-600/20">
                    <i className="fas fa-camera text-2xl text-white"></i>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Live Analysis</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Use your camera to scan physical QR codes with AI-driven overlay detection.</p>
                </div>
              </button>

              <label className="group p-10 bg-slate-900 hover:bg-slate-800 rounded-[3rem] transition-all border border-slate-800 hover:border-emerald-500/50 shadow-2xl cursor-pointer text-left relative overflow-hidden">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-600/20">
                    <i className="fas fa-file-import text-2xl text-white"></i>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Image Forensics</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Upload screenshots or photos for deep inspection of embedded URLs and metadata.</p>
                </div>
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
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {state.loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-search-nodes text-blue-500 animate-pulse text-2xl"></i>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">Processing Threat Vector...</h3>
                  <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Accessing Google Cloud Intelligence</p>
                </div>
              </div>
            ) : state.error ? (
              <div className="p-12 bg-rose-500/5 border border-rose-500/20 rounded-[3rem] text-center max-w-lg mx-auto">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-triangle-exclamation text-rose-500 text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Core Engine Error</h3>
                <p className="text-slate-400 mb-8 leading-relaxed">{state.error}</p>
                <button onClick={resetState} className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all">Return to Command Center</button>
              </div>
            ) : state.analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-6">
                  <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
                  
                  {state.base64Image && (
                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-[2rem]">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-4">Optical Artifact</span>
                      <div className="rounded-2xl overflow-hidden border border-slate-800">
                        <img src={state.base64Image} alt="Scan Artifact" className="w-full h-auto brightness-90 contrast-125" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-8">
                  <section className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800/50 backdrop-blur-sm">
                    <h3 className="text-xl font-bold mb-6 flex items-center space-x-3">
                      <i className="fas fa-terminal text-blue-500"></i>
                      <span>Forensic Summary</span>
                    </h3>
                    <p className="text-slate-300 leading-relaxed mb-8">{state.analysis.explanation}</p>
                    
                    <div className="p-5 bg-black/40 rounded-2xl border border-slate-800 font-mono text-xs break-all relative group">
                      <span className="text-slate-600 block mb-2 uppercase tracking-tighter">Decoded Payload</span>
                      <span className="text-blue-400/90">{state.analysis.originalContent}</span>
                    </div>
                  </section>

                  <section className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800/50 backdrop-blur-sm">
                    <h3 className="text-xl font-bold mb-6 flex items-center space-x-3">
                      <i className="fas fa-list-check text-emerald-500"></i>
                      <span>Security Protocols</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {state.analysis.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start space-x-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                          <i className="fas fa-check-circle text-emerald-500 mt-1 text-sm"></i>
                          <span className="text-sm text-slate-300 leading-tight">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {state.analysis.groundingSources && (
                    <section className="bg-blue-600/5 p-8 rounded-[2.5rem] border border-blue-500/10">
                      <h3 className="text-xl font-bold mb-6 flex items-center space-x-3">
                        <i className="fas fa-satellite text-blue-400"></i>
                        <span>Threat Intel Feed</span>
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {state.analysis.groundingSources.map((source, i) => (
                          <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 transition-all flex items-center space-x-3 group"
                          >
                            <span>{source.title}</span>
                            <i className="fas fa-arrow-up-right-from-square text-[10px] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="flex justify-center pt-6">
                    <button 
                      onClick={resetState}
                      className="px-12 py-4 bg-white text-black hover:bg-slate-200 rounded-full font-black transition-all transform hover:scale-105 active:scale-95"
                    >
                      New Security Scan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-24 border-t border-slate-800/50 bg-slate-950 py-16 px-6 relative z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center space-x-3">
            <i className="fas fa-shield-halved text-2xl"></i>
            <span className="font-black tracking-tighter text-xl">QRShield</span>
          </div>
          <div className="text-center md:text-left">
            <p className="text-sm font-medium">Empowering users against Quishing since 2024</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] mt-1">Enterprise Grade Forensics Engine</p>
          </div>
          <div className="flex space-x-6">
            <i className="fab fa-github text-xl hover:text-white cursor-pointer transition-colors"></i>
            <i className="fab fa-linkedin text-xl hover:text-white cursor-pointer transition-colors"></i>
          </div>
        </div>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;
