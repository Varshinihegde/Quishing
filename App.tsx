
import React, { useState, useRef, useEffect } from 'react';
import { QRState, RiskLevel } from './types';
import { performDeepAnalysis } from './services/geminiService';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import Chatbot, { ChatbotHandle } from './components/Chatbot';
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

  // Check for API key presence to handle local vs preview environment
  useEffect(() => {
    const checkKey = async () => {
      const win = window as any;
      
      // If process.env.API_KEY exists (preview or local .env), we are good
      if (typeof process !== 'undefined' && process.env?.API_KEY) {
        setHasKey(true);
        return;
      }

      // Check if we are in the AI Studio environment
      if (win.aistudio?.hasSelectedApiKey) {
        const selected = await win.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // If not in AI Studio and no process.env, we show the setup screen
        // In local VS Code dev, this prompts the user to either set the key or use AI Studio
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    const win = window as any;
    if (win.aistudio?.openSelectKey) {
      await win.aistudio.openSelectKey();
      setHasKey(true);
    } else {
      alert("Please set your API_KEY environment variable in VS Code or run this in a Gemini-compatible environment.");
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
      if (err.message === "RESELECT_KEY") {
        setHasKey(false);
        resetState();
      } else {
        setState(prev => ({ 
          ...prev, 
          error: err.message || "Connection failed.", 
          loading: false 
        }));
      }
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

  // If key is definitely missing, show the professional setup screen
  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-[2.5rem] border border-slate-700 p-12 text-center shadow-2xl space-y-10 animate-in fade-in zoom-in-95">
          <div className="w-24 h-24 bg-blue-600/10 rounded-[2rem] flex items-center justify-center mx-auto ring-4 ring-blue-500/5">
            <i className="fas fa-key text-4xl text-blue-500"></i>
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black tracking-tight">Configuration Needed</h2>
            <p className="text-slate-400 leading-relaxed text-lg">
              QRShield requires a paid API key to perform advanced quishing detection.
            </p>
          </div>
          <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700/50 text-left space-y-3">
            <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Environment Instructions</p>
            <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
              <li>In VS Code: Set <code className="text-blue-400">process.env.API_KEY</code></li>
              <li>In Preview: Use the button below to select a project</li>
            </ul>
          </div>
          <button 
            onClick={handleOpenKeyDialog}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-blue-500/30"
          >
            Connect API Key
          </button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-slate-500 hover:text-blue-400 text-sm font-bold transition-colors">
            Learn about API Billing <i className="fas fa-external-link-alt ml-1"></i>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-8 py-5 flex items-center justify-between">
          <div onClick={resetState} className="flex items-center space-x-4 cursor-pointer group">
            <div className="bg-blue-600 p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/20">
              <i className="fas fa-shield-alt text-white text-xl"></i>
            </div>
            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-500 to-emerald-400">
              QRShield
            </span>
          </div>
          <button onClick={resetState} className="text-slate-400 hover:text-white transition-all w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-800">
            <i className="fas fa-home text-xl"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-8 py-12">
        {state.view === 'home' && (
          <div className="space-y-20 animate-in fade-in zoom-in-95 duration-700">
            <div className="space-y-6 text-center">
              <h1 className="text-7xl font-black leading-[1.1] tracking-tighter">
                Stop Quishing. <br/>
                <span className="text-blue-500">Scan Securely.</span>
              </h1>
              <p className="text-slate-400 text-xl max-w-lg mx-auto leading-relaxed">
                Advanced AI-powered QR analysis designed to identify malicious patterns before you click.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))} 
                className="p-12 bg-slate-800/40 rounded-[3rem] border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/60 transition-all group shadow-2xl flex flex-col items-center"
              >
                <div className="bg-blue-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ring-4 ring-blue-500/5">
                  <i className="fas fa-camera text-4xl text-blue-500"></i>
                </div>
                <h3 className="text-3xl font-black">Live Scanner</h3>
                <p className="text-slate-500 mt-3 font-medium">Scan using device camera</p>
              </button>

              <label className="p-12 bg-slate-800/40 rounded-[3rem] border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/60 transition-all group cursor-pointer shadow-2xl flex flex-col items-center">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="bg-emerald-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ring-4 ring-emerald-500/5">
                  <i className="fas fa-image text-4xl text-emerald-500"></i>
                </div>
                <h3 className="text-3xl font-black">Upload Image</h3>
                <p className="text-slate-500 mt-3 font-medium">Verify saved QR codes</p>
              </label>
            </div>

            {/* How it works Section */}
            <section className="pt-20 border-t border-slate-800/50">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-black mb-4 tracking-tight">How it works</h2>
                <div className="h-1.5 w-24 bg-blue-600 mx-auto rounded-full"></div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { icon: "fa-qrcode", title: "Capture", desc: "Instantly scan or upload any QR code image." },
                  { icon: "fa-brain", title: "Analyze", desc: "Our AI dissects URLs, redirects, and metadata." },
                  { icon: "fa-chart-pie", title: "Assess", desc: "Get deep probability scores for various risks." },
                  { icon: "fa-shield-heart", title: "Protect", desc: "Receive real-time expert safety advice." }
                ].map((step, idx) => (
                  <div key={idx} className="bg-slate-800/20 p-8 rounded-[2rem] border border-slate-800 hover:bg-slate-800/40 transition-all group">
                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600/10 transition-colors">
                      <i className={`fas ${step.icon} text-blue-500 text-2xl`}></i>
                    </div>
                    <h4 className="font-black text-xl mb-3">{step.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {state.view === 'scan' && (
          <Scanner 
            onScan={(c) => runAnalysis(c, null)} 
            onDeepScan={(b) => runAnalysis(null, b)} 
            onCancel={resetState} 
          />
        )}

        {state.loading && (
          <div className="flex flex-col items-center justify-center py-40 space-y-10 animate-in fade-in">
            <div className="relative">
              <div className="w-24 h-24 border-8 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-microscope text-blue-500 text-2xl animate-pulse"></i>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black">AI Forensic Analysis...</h2>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Checking global threat databases</p>
            </div>
          </div>
        )}

        {state.error && (
          <div className="text-center py-24 animate-in zoom-in max-w-md mx-auto space-y-8">
            <div className="w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mx-auto ring-4 ring-rose-500/5">
              <i className="fas fa-exclamation-triangle text-4xl text-rose-500"></i>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black">Scan Interrupted</h2>
              <p className="text-slate-400 leading-relaxed font-medium">{state.error}</p>
            </div>
            <button onClick={resetState} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-lg transition-all shadow-xl shadow-blue-500/20">
              Try Again
            </button>
          </div>
        )}

        {state.view === 'result' && state.analysis && !state.loading && !state.error && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
              
              <div className="md:col-span-2 space-y-8">
                <div className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-700/50 shadow-inner">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Probability Matrix</h4>
                  <div className="space-y-6">
                    {[
                      { label: 'Phishing Intent', value: state.analysis.probabilities.malicious, color: 'bg-rose-500' },
                      { label: 'Structural Fake', value: state.analysis.probabilities.fake, color: 'bg-amber-500' },
                      { label: 'Standard Integrity', value: state.analysis.probabilities.authentic, color: 'bg-emerald-500' }
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm font-black mb-2 px-1">
                          <span className="text-slate-400">{item.label}</span>
                          <span>{item.value}%</span>
                        </div>
                        <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                          <div 
                            className={`h-full ${item.color} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-700/50">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Security Assessment</h4>
                  <p className="text-slate-100 leading-relaxed font-bold text-xl italic leading-snug">
                    "{state.analysis.explanation}"
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 p-10 rounded-[3rem] border border-slate-700/50">
              <h3 className="text-2xl font-black mb-8 flex items-center space-x-4">
                <i className="fas fa-list-check text-blue-500"></i>
                <span>Actionable Recommendations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {state.analysis.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start space-x-4 bg-slate-900/60 p-6 rounded-[1.5rem] border border-slate-800 group hover:border-blue-500/30 transition-all hover:scale-[1.02]">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                       <i className="fas fa-shield-halved text-blue-500 text-sm"></i>
                    </div>
                    <span className="text-slate-300 font-medium leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={resetState} className="w-full py-6 bg-slate-800 hover:bg-slate-700 text-white rounded-[2rem] font-black text-xl border border-slate-700 shadow-2xl transition-all">
              Scan Another Code
            </button>
          </div>
        )}
      </main>

      <footer className="py-12 text-center text-slate-600 text-xs font-black uppercase tracking-[0.2em] border-t border-slate-800/30">
        <p>© 2024 QRShield Lab • Advanced Intelligent Scanning</p>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;
