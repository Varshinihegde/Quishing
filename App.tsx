
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
        error: "Security Analysis failed to initialize. Please check your network connection and try again.", 
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
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
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

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        {state.view === 'home' && (
          <div className="space-y-16 py-10 animate-in fade-in zoom-in-95 duration-700">
            <div className="space-y-6 text-center">
              <h1 className="text-6xl md:text-7xl font-black leading-tight tracking-tighter">
                Smart Analysis. <br/>
                <span className="text-blue-500">Zero Trust.</span>
              </h1>
              <p className="text-slate-400 text-xl max-w-lg mx-auto leading-relaxed">
                Identify phishing patterns and malicious redirects hidden within QR codes using advanced AI forensics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))} 
                className="p-10 bg-slate-800/40 rounded-[2.5rem] border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/60 transition-all group shadow-xl flex flex-col items-center"
              >
                <div className="bg-blue-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ring-4 ring-blue-500/5">
                  <i className="fas fa-camera text-4xl text-blue-500"></i>
                </div>
                <h3 className="text-2xl font-black">Live Scanner</h3>
                <p className="text-slate-500 mt-2 font-medium">Analyze codes in real-time</p>
              </button>

              <label className="p-10 bg-slate-800/40 rounded-[2.5rem] border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/60 transition-all group cursor-pointer shadow-xl flex flex-col items-center text-center">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="bg-emerald-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ring-4 ring-emerald-500/5">
                  <i className="fas fa-image text-4xl text-emerald-500"></i>
                </div>
                <h3 className="text-2xl font-black">Upload Code</h3>
                <p className="text-slate-500 mt-2 font-medium">Verify saved images or screenshots</p>
              </label>
            </div>

            <section className="pt-16 border-t border-slate-800/50">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-black mb-3">Threat Detection Engine</h2>
                <div className="h-1.5 w-20 bg-blue-600 mx-auto rounded-full"></div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: "fa-search", title: "Forensics", desc: "Dissects the QR pattern for tampering indicators." },
                  { icon: "fa-link", title: "URL Scrutiny", desc: "Follows redirects safely to identify phishing." },
                  { icon: "fa-shield-virus", title: "Risk Level", desc: "Provides concrete security scores and levels." },
                  { icon: "fa-user-graduate", title: "Advice", desc: "Actionable steps to keep your data protected." }
                ].map((step, idx) => (
                  <div key={idx} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-800 hover:bg-slate-800/50 transition-all group">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                      <i className={`fas ${step.icon} text-blue-500 text-xl`}></i>
                    </div>
                    <h4 className="font-bold text-lg mb-2">{step.title}</h4>
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
          <div className="flex flex-col items-center justify-center py-40 space-y-8 animate-in fade-in">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-microscope text-blue-500 text-xl animate-pulse"></i>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Forensic Inspection...</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Connecting to Security Cloud</p>
            </div>
          </div>
        )}

        {state.error && (
          <div className="text-center py-20 animate-in zoom-in max-w-md mx-auto">
            <div className="w-20 h-20 bg-rose-500/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 ring-4 ring-rose-500/5">
              <i className="fas fa-circle-xmark text-3xl text-rose-500"></i>
            </div>
            <h2 className="text-3xl font-black mb-4">Analysis Blocked</h2>
            <div className="bg-slate-800/50 p-6 rounded-2xl mb-8 border border-slate-700 text-center">
               <p className="text-slate-300 leading-relaxed font-medium">
                 {state.error}
               </p>
            </div>
            <button onClick={resetState} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20">
              Return to Safety
            </button>
          </div>
        )}

        {state.view === 'result' && state.analysis && !state.loading && !state.error && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
              
              <div className="md:col-span-2 space-y-6">
                <div className="bg-slate-800/40 p-8 rounded-[2rem] border border-slate-700/50 shadow-inner">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Security Probability</h4>
                  <div className="space-y-6">
                    {[
                      { label: 'Phishing Pattern', value: state.analysis.probabilities.malicious, color: 'bg-rose-500' },
                      { label: 'Identity Risk', value: state.analysis.probabilities.fake, color: 'bg-amber-500' },
                      { label: 'Verified Integrity', value: state.analysis.probabilities.authentic, color: 'bg-emerald-500' }
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-black mb-2 px-1">
                          <span className="text-slate-400">{item.label}</span>
                          <span>{item.value}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                          <div 
                            className={`h-full ${item.color} transition-all duration-1000 ease-out`}
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 p-8 rounded-[2rem] border border-slate-700/50">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Forensic Assessment</h4>
                  <p className="text-slate-200 leading-relaxed font-bold text-xl italic leading-snug">
                    "{state.analysis.explanation}"
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 p-10 rounded-[2.5rem] border border-slate-700/50">
              <h3 className="text-2xl font-black mb-8 flex items-center space-x-4">
                <i className="fas fa-list-check text-blue-500"></i>
                <span>Actionable Steps</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {state.analysis.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start space-x-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 group hover:border-blue-500/30 transition-all hover:scale-[1.02]">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                       <i className="fas fa-shield-halved text-blue-500 text-sm"></i>
                    </div>
                    <span className="text-slate-300 font-medium leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={resetState} className="w-full py-6 bg-slate-800 hover:bg-slate-700 text-white rounded-[1.5rem] font-black text-xl border border-slate-700 shadow-2xl transition-all">
              Initiate New Scan
            </button>
          </div>
        )}
      </main>

      <footer className="py-12 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] border-t border-slate-800/30">
        <p>© 2024 QRShield Intelligence • Safe QR Protocols</p>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;
