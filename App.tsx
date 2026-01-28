import React, { useState, useRef } from 'react';
import { QRState, RiskLevel } from './types';
import { performDeepAnalysis } from './services/geminiService';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import Chatbot, { ChatbotHandle } from './components/Chatbot';
import ProbabilityBreakdown from './components/ProbabilityBreakdown';
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
        error: "Forensic failure. Verify API connection.", 
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neural Link Active</span>
             </div>
             <button 
                onClick={() => chatbotRef.current?.open()}
                className="text-slate-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest bg-slate-900 px-5 py-2 rounded-full border border-slate-800"
              >
                Help
              </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        {state.view === 'home' && (
          <div className="text-center space-y-16 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                <i className="fas fa-fingerprint animate-pulse"></i>
                <span>Neural Quishing Forensic Engine v3.2</span>
              </div>
              <h1 className="text-6xl sm:text-8xl font-black tracking-tighter leading-none">
                Stop Fraud. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Scan Smart.</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
                Analyze QR codes for malicious intent, hidden redirects, and phishing patterns.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))}
                className="group relative p-12 bg-slate-900/50 hover:bg-slate-900 rounded-[2.5rem] border border-slate-800 transition-all hover:border-blue-500/50 text-left overflow-hidden shadow-2xl"
              >
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/20">
                  <i className="fas fa-camera text-2xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Camera Audit</h3>
                <p className="text-slate-500 text-sm">Real-time scan for physical QR code verification.</p>
              </button>

              <label className="group relative p-12 bg-slate-900/50 hover:bg-slate-900 rounded-[2.5rem] border border-slate-800 transition-all hover:border-emerald-500/50 cursor-pointer text-left overflow-hidden shadow-2xl">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-600/20">
                  <i className="fas fa-upload text-2xl text-white"></i>
                </div>
                <h3 className="text-2xl font-bold mb-2 uppercase tracking-tight">Upload Evidence</h3>
                <p className="text-slate-500 text-sm">Analyze images or screenshots for hidden threats.</p>
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {state.loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-10">
                <div className="relative">
                  <div className="w-32 h-32 border-[4px] border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-microchip text-blue-500 text-3xl animate-pulse"></i>
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Running Diagnostics...</h3>
                  <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.4em]">Heuristic Threat Verification</p>
                </div>
              </div>
            ) : state.error ? (
              <div className="max-w-md mx-auto p-12 bg-rose-500/5 border border-rose-500/20 rounded-[3rem] text-center shadow-2xl">
                <i className="fas fa-plug-circle-exclamation text-rose-500 text-5xl mb-6"></i>
                <h3 className="text-2xl font-bold text-white mb-2">Analysis Failed</h3>
                <p className="text-slate-400 mb-8 leading-relaxed">{state.error}</p>
                <button onClick={resetState} className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all border border-slate-700">Go Back</button>
              </div>
            ) : state.analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-6">
                  <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
                  <div className="p-8 bg-slate-900/50 border border-slate-800/50 rounded-[2.5rem] backdrop-blur-sm shadow-xl">
                    <ProbabilityBreakdown probabilities={state.analysis.probabilities} />
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-slate-900/40 p-10 rounded-[3rem] border border-slate-800/50 backdrop-blur-md shadow-2xl">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center space-x-3 text-blue-400">
                      <i className="fas fa-file-waveform"></i>
                      <span>Forensic Log</span>
                    </h3>
                    <p className={`leading-relaxed mb-10 text-lg font-medium ${state.analysis.riskLevel === RiskLevel.CRITICAL ? 'text-rose-400' : 'text-slate-300'}`}>
                      {state.analysis.explanation}
                    </p>
                    
                    <div className="p-6 bg-black/40 rounded-2xl border border-slate-800/50 group">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Payload Data</span>
                        <i className="fas fa-code text-slate-700 text-xs"></i>
                      </div>
                      <p className="font-mono text-xs text-blue-400/80 break-all leading-relaxed">{state.analysis.originalContent}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/40 p-10 rounded-[3rem] border border-slate-800/50 shadow-2xl">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center space-x-3 text-emerald-400">
                      <i className="fas fa-user-shield"></i>
                      <span>Safety Protocol</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {state.analysis.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start space-x-4 p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                          <i className="fas fa-shield-halved text-emerald-500/50 mt-1"></i>
                          <span className="text-sm text-slate-300 font-bold leading-relaxed">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 flex justify-center">
                    <button 
                      onClick={resetState}
                      className="px-16 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-lg transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-blue-600/30 uppercase tracking-widest"
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

      <footer className="mt-20 border-t border-slate-900 bg-slate-950/80 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10 opacity-20 hover:opacity-100 transition-opacity">
          <div className="flex items-center space-x-3">
            <i className="fas fa-shield-halved text-3xl"></i>
            <span className="font-black text-2xl tracking-tighter uppercase italic">QRShield</span>
          </div>
          <p className="text-[10px] font-black tracking-[0.5em] uppercase text-center">Neural Quishing Detection Engine v3.2</p>
        </div>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;