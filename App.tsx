
import React, { useState, useRef } from 'react';
import { QRState, RiskLevel } from './types';
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
    } catch (err) {
      setState(prev => ({ ...prev, error: "Security Analysis failed to complete.", loading: false }));
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
          // Automatic immediate analysis after processing the file
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
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div onClick={resetState} className="flex items-center space-x-3 cursor-pointer group">
            <div className="bg-blue-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <i className="fas fa-shield-alt text-white"></i>
            </div>
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              QRShield
            </span>
          </div>
          <button onClick={resetState} className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800">
            <i className="fas fa-home text-xl"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        {state.view === 'home' && (
          <div className="space-y-16 py-10 animate-in fade-in zoom-in-95 duration-700">
            <div className="space-y-4 text-center">
              <h1 className="text-6xl font-black leading-tight tracking-tighter">
                Scan with <br/><span className="text-blue-500 italic">Certainty.</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-md mx-auto">
                Next-generation security powered by Automated Intelligence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))} 
                className="p-10 bg-slate-800/50 rounded-[2.5rem] border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 transition-all group shadow-xl"
              >
                <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-camera text-3xl text-blue-500"></i>
                </div>
                <h3 className="text-2xl font-bold">Start Scanning</h3>
                <p className="text-slate-500 mt-2">Use live device camera</p>
              </button>

              <label className="p-10 bg-slate-800/50 rounded-[2.5rem] border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 transition-all group cursor-pointer shadow-xl">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="bg-emerald-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <i className="fas fa-image text-3xl text-emerald-500"></i>
                </div>
                <h3 className="text-2xl font-bold">Upload Code</h3>
                <p className="text-slate-500 mt-2">Analyze static images</p>
              </label>
            </div>

            {/* How it works Section */}
            <div className="pt-16 border-t border-slate-800/50">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">How it works</h2>
                <div className="h-1 w-20 bg-blue-600 mx-auto rounded-full"></div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    icon: "fa-qrcode",
                    title: "1. Capture",
                    desc: "Scan a live QR code or upload an image from your device."
                  },
                  {
                    icon: "fa-brain",
                    title: "2. Analyze",
                    desc: "Our AI inspects the URL, structure, and metadata for hidden threats."
                  },
                  {
                    icon: "fa-chart-pie",
                    title: "3. Assess",
                    desc: "Get instant probability scores for malicious intent and fake patterns."
                  },
                  {
                    icon: "fa-shield-heart",
                    title: "4. Protect",
                    desc: "Receive clear recommendations and actionable safety steps."
                  }
                ].map((step, idx) => (
                  <div key={idx} className="bg-slate-800/30 p-6 rounded-3xl border border-slate-800 hover:bg-slate-800/50 transition-colors group">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <i className={`fas ${step.icon} text-blue-500 text-xl`}></i>
                    </div>
                    <h4 className="font-bold text-lg mb-2">{step.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
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
          <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-microscope text-blue-500 animate-pulse"></i>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Calculating threat possibilities...</h2>
            </div>
          </div>
        )}

        {state.error && (
          <div className="text-center py-20 animate-in zoom-in">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <i className="fas fa-exclamation-circle text-3xl text-rose-500"></i>
            </div>
            <h2 className="text-2xl font-bold mb-4">{state.error}</h2>
            <button onClick={resetState} className="px-10 py-4 bg-blue-600 rounded-2xl font-bold">Try Again</button>
          </div>
        )}

        {state.view === 'result' && state.analysis && !state.loading && !state.error && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
              
              <div className="md:col-span-2 space-y-6">
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 shadow-inner">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Probability Breakdown</h4>
                  {state.analysis.probabilities && (
                    <div className="space-y-4">
                      {[
                        { label: 'Malicious Intent', value: state.analysis.probabilities.malicious, color: 'bg-rose-500' },
                        { label: 'Fake / Pseudo Pattern', value: state.analysis.probabilities.fake, color: 'bg-amber-500' },
                        { label: 'Official / Authentic', value: state.analysis.probabilities.authentic, color: 'bg-emerald-500' }
                      ].map((item, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs font-bold mb-1.5 px-1">
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
                  )}
                </div>

                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Expert Assessment</h4>
                  <p className="text-slate-200 leading-relaxed font-medium text-lg italic">"{state.analysis.explanation}"</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 p-8 rounded-[2rem] border border-slate-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center space-x-3">
                <i className="fas fa-list-check text-blue-400"></i>
                <span>Security Recommendations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {state.analysis.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start space-x-3 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 group hover:border-blue-500/30 transition-colors">
                    <i className="fas fa-shield-halved text-blue-500 mt-1"></i>
                    <span className="text-slate-300 text-sm leading-snug">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={resetState} className="w-full py-6 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold border border-slate-700 shadow-2xl transition-all">
              Initiate New Analysis
            </button>
          </div>
        )}
      </main>

      <footer className="py-12 text-center text-slate-600 text-[10px] font-bold border-t border-slate-800/30">
        <p>© 2024 QRShield Security Lab • Automated Intelligent Scanning</p>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;
