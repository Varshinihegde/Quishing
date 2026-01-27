
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
      console.error("App layer analysis error:", err);
      setState(prev => ({ 
        ...prev, 
        error: "The security analysis engine could not be reached. Please check your internet connection.", 
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
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 tracking-tight">
              QRShield
            </span>
          </div>
          <button 
            onClick={() => chatbotRef.current?.open()}
            className="text-slate-400 hover:text-white transition-colors flex items-center space-x-2 bg-slate-800/50 px-4 py-2 rounded-lg"
          >
            <i className="fas fa-question-circle text-lg"></i>
            <span className="text-sm font-medium">Help</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        {state.view === 'home' && (
          <div className="text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none">
                Stop <span className="text-blue-500">Quishing</span> <br />
                Before It Starts.
              </h1>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Scan, upload, or analyze QR codes with deep forensic security intelligence. 
                Our AI detects malicious redirects and phishing attempts instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))}
                className="group p-8 bg-blue-600 hover:bg-blue-500 rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-blue-600/20 text-left relative overflow-hidden"
              >
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <i className="fas fa-camera text-4xl mb-6"></i>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Live Camera Scan</h3>
                    <p className="text-blue-100/70 text-sm">Real-time detection with visual markers</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors"></div>
              </button>

              <label className="group p-8 bg-slate-800 hover:bg-slate-700 rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-95 border border-slate-700 cursor-pointer text-left relative overflow-hidden">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <i className="fas fa-file-upload text-4xl mb-6 text-emerald-400"></i>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Upload Image</h3>
                    <p className="text-slate-400 text-sm">Analyze saved photos or screenshots</p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors"></div>
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {state.loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Running Forensic Scan...</h3>
                  <p className="text-slate-400 animate-pulse italic">Gemini AI is inspecting data packets and patterns</p>
                </div>
              </div>
            ) : state.error ? (
              <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-[2.5rem] text-center">
                <i className="fas fa-exclamation-triangle text-4xl text-rose-500 mb-4"></i>
                <h3 className="text-xl font-bold text-rose-500 mb-2">Analysis Failed</h3>
                <p className="text-slate-400 mb-6">{state.error}</p>
                <button onClick={resetState} className="px-8 py-3 bg-slate-800 rounded-xl font-bold hover:bg-slate-700">Try Again</button>
              </div>
            ) : state.analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
                  
                  {state.base64Image && (
                    <div className="mt-6 p-4 bg-slate-800/50 rounded-3xl border border-slate-700 overflow-hidden">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-1">Captured Artifact</p>
                      <img src={state.base64Image} alt="QR Artifact" className="w-full h-auto rounded-xl grayscale hover:grayscale-0 transition-all cursor-zoom-in" />
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <div className="p-8 bg-slate-800/30 rounded-[2.5rem] border border-slate-700/50">
                    <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                      <i className="fas fa-info-circle text-blue-400"></i>
                      <span>Analysis Explanation</span>
                    </h3>
                    <p className="text-slate-300 leading-relaxed">{state.analysis.explanation}</p>
                    
                    <div className="mt-6 p-4 bg-slate-900/50 rounded-2xl border border-slate-700 font-mono text-xs break-all overflow-hidden relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-copy text-slate-500 hover:text-white cursor-pointer"></i>
                      </div>
                      <span className="text-slate-500 block mb-1">RAW CONTENT</span>
                      <span className="text-slate-300">{state.analysis.originalContent}</span>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-800/30 rounded-[2.5rem] border border-slate-700/50">
                    <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                      <i className="fas fa-shield-check text-emerald-400"></i>
                      <span>Recommended Actions</span>
                    </h3>
                    <ul className="space-y-4">
                      {state.analysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start space-x-3 text-slate-300">
                          <div className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></div>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {state.analysis.groundingSources && state.analysis.groundingSources.length > 0 && (
                    <div className="p-8 bg-blue-900/10 rounded-[2.5rem] border border-blue-500/20">
                      <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                        <i className="fas fa-globe text-blue-400"></i>
                        <span>Intelligence Sources</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {state.analysis.groundingSources.map((source, i) => (
                          <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-xs font-bold text-blue-400 transition-all flex items-center space-x-2"
                          >
                            <span>{source.title}</span>
                            <i className="fas fa-external-link-alt text-[10px]"></i>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center pt-4">
                    <button 
                      onClick={resetState}
                      className="px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all flex items-center space-x-3"
                    >
                      <i className="fas fa-undo text-lg"></i>
                      <span>Reset Analysis</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-800 bg-slate-900/50 py-12 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3 grayscale opacity-50">
            <i className="fas fa-shield-alt text-xl text-white"></i>
            <span className="font-bold tracking-tight">QRShield</span>
          </div>
          <p className="text-slate-500 text-sm">Built with Gemini AI • Secure QR Forensics</p>
          <div className="flex space-x-4 text-slate-500">
            <i className="fab fa-github hover:text-white cursor-pointer"></i>
            <i className="fab fa-twitter hover:text-white cursor-pointer"></i>
          </div>
        </div>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;
