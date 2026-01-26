
import React, { useState, useRef } from 'react';
import { QRState, RiskLevel } from './types';
import { analyzeQRContent } from './services/geminiService';
import Layout from './components/Layout';
import Scanner from './components/Scanner';
import RiskGauge from './components/RiskGauge';
import Chatbot, { ChatbotHandle } from './components/Chatbot';
import jsQR from 'jsqr';

const App: React.FC = () => {
  const chatbotRef = useRef<ChatbotHandle>(null);
  const [state, setState] = useState<QRState>({
    view: 'home',
    decodedContent: null,
    analysis: null,
    loading: false,
    error: null,
  });

  const resetState = () => {
    setState({
      view: 'home',
      decodedContent: null,
      analysis: null,
      loading: false,
      error: null,
    });
  };

  const processQRData = async (content: string) => {
    setState(prev => ({ ...prev, loading: true, decodedContent: content, view: 'result', error: null }));
    try {
      const result = await analyzeQRContent(content);
      setState(prev => ({ ...prev, analysis: result, loading: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || "An error occurred during analysis", loading: false }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState(prev => ({ ...prev, loading: true, view: 'upload', error: null }));

    const reader = new FileReader();
    reader.onload = (event) => {
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
          if (code) {
            processQRData(code.data);
          } else {
            setState(prev => ({ ...prev, error: "No valid QR code found in this image. Please ensure the QR is clear and not obstructed.", loading: false }));
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Clear the input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleAskAssistant = () => {
    if (state.analysis && state.decodedContent) {
      const prompt = `I just analyzed this QR content which was marked as ${state.analysis.riskLevel} with a score of ${state.analysis.riskScore}%. Can you explain why it was given this rating? The content is: "${state.decodedContent}"`;
      chatbotRef.current?.sendMessage(prompt, state.decodedContent);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col font-sans bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div onClick={resetState} className="flex items-center space-x-2 cursor-pointer group">
            <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-500 transition-all">
              <i className="fas fa-shield-alt text-white text-xl"></i>
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              QRShield
            </span>
          </div>
          <nav>
            <button onClick={resetState} className="text-slate-400 hover:text-white transition-colors flex items-center space-x-2 font-medium">
              <i className="fas fa-home"></i>
              <span className="hidden sm:inline">Home</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {state.view === 'home' && (
          <div className="max-w-2xl mx-auto space-y-12 py-8 animate-in fade-in duration-700">
            <div className="text-center space-y-4">
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
                Scan QR Codes <br />
                <span className="text-blue-500">Securely</span>
              </h1>
              <p className="text-xl text-slate-400 max-w-lg mx-auto">
                Instantly identify phishing links and malicious payloads hidden in QR codes using our advanced security engine.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button 
                onClick={() => setState(prev => ({ ...prev, view: 'scan' }))}
                className="group relative flex flex-col items-center justify-center p-8 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700 rounded-3xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
              >
                <div className="mb-4 w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-300">
                  <i className="fas fa-camera text-3xl text-blue-500 group-hover:text-white"></i>
                </div>
                <h3 className="text-xl font-bold">Live Scan</h3>
                <p className="text-sm text-slate-400 mt-2 text-center">Use your camera to detect risks in real-time</p>
              </button>

              <label className="group relative flex flex-col items-center justify-center p-8 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700 rounded-3xl transition-all cursor-pointer hover:scale-[1.02] active:scale-95 shadow-xl">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="mb-4 w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:scale-110 transition-all duration-300">
                  <i className="fas fa-upload text-3xl text-emerald-500 group-hover:text-white"></i>
                </div>
                <h3 className="text-xl font-bold">Upload Image</h3>
                <p className="text-sm text-slate-400 mt-2 text-center">Analyze a photo or screenshot from your device</p>
              </label>
            </div>

            <div className="bg-slate-800/20 border border-slate-700/50 p-6 rounded-3xl">
               <div className="flex items-center space-x-3 text-slate-400 mb-6">
                 <div className="bg-slate-700/50 p-2 rounded-lg">
                   <i className="fas fa-info-circle"></i>
                 </div>
                 <span className="font-bold uppercase text-xs tracking-widest">Our Security Protocol</span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
                  <div className="space-y-2">
                    <div className="font-bold text-slate-100 flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                      <span>Extraction</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">Our engine isolates and decodes the digital payload within the QR matrix.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="font-bold text-slate-100 flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px]">2</span>
                      <span>Intelligence</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">Gemini AI evaluates domains, redirection paths, and deceptive intent patterns.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="font-bold text-slate-100 flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px]">3</span>
                      <span>Verdict</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">Get a clear safety rating and recommended actions before you click anything.</p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {(state.view === 'scan' || state.view === 'upload') && state.loading === false && state.error === null && (
          <div className="animate-in zoom-in-95 duration-300 py-8">
             <div className="text-center mb-10">
                <h2 className="text-3xl font-bold mb-2">Ready to Scan</h2>
                <p className="text-slate-400">Position the QR code within the highlighted area</p>
             </div>
             {state.view === 'scan' ? (
               <Scanner onScan={processQRData} onCancel={resetState} />
             ) : (
               <div className="flex flex-col items-center py-20">
                 <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
               </div>
             )}
          </div>
        )}

        {state.loading && (
          <div className="flex flex-col items-center justify-center py-24 animate-in fade-in">
            <div className="relative mb-10">
               <div className="w-28 h-28 rounded-full border-4 border-slate-800"></div>
               <div className="absolute inset-0 w-28 h-28 rounded-full border-t-4 border-blue-500 animate-spin"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600/10 p-4 rounded-2xl">
                 <i className="fas fa-shield-virus text-4xl text-blue-500"></i>
               </div>
            </div>
            <h2 className="text-3xl font-bold">Security Analysis</h2>
            <p className="text-slate-400 mt-3 font-medium">Scanning for quishing threats and malicious intent...</p>
          </div>
        )}

        {state.error && (
          <div className="max-w-md mx-auto text-center py-20 animate-in slide-in-from-top-8">
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
              <i className="fas fa-exclamation-triangle text-4xl text-rose-500"></i>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-white">Process Interrupted</h2>
            <p className="text-slate-400 mb-10 leading-relaxed">{state.error}</p>
            <button 
              onClick={resetState}
              className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95"
            >
              Back to Home
            </button>
          </div>
        )}

        {state.view === 'result' && state.analysis && !state.loading && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1">
                <RiskGauge score={state.analysis.riskScore} level={state.analysis.riskLevel} />
              </div>
              
              <div className="md:col-span-2 space-y-6">
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                  <div className="flex items-center space-x-2 mb-4 text-slate-400">
                    <i className="fas fa-code text-xs"></i>
                    <h3 className="uppercase text-[10px] font-bold tracking-[0.2em]">Decoded Content</h3>
                  </div>
                  <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 font-mono text-xs break-all text-blue-400 leading-relaxed">
                    {state.decodedContent}
                  </div>
                </div>

                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                  <div className="flex items-center space-x-2 mb-4 text-slate-400">
                    <i className="fas fa-magnifying-glass text-xs"></i>
                    <h3 className="uppercase text-[10px] font-bold tracking-[0.2em]">AI Intelligence Report</h3>
                  </div>
                  <p className="text-slate-200 leading-relaxed text-sm">
                    {state.analysis.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center space-x-3">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <i className="fas fa-shield-check text-blue-500 text-sm"></i>
                </div>
                <span>Recommended Safety Steps</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {state.analysis.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start space-x-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="mt-1 w-6 h-6 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-check text-emerald-500 text-[10px]"></i>
                    </div>
                    <span className="text-slate-300 text-sm leading-relaxed">{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={resetState}
                className="flex-1 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 shadow-lg active:scale-95"
              >
                <i className="fas fa-redo-alt"></i>
                <span>Scan Another QR</span>
              </button>
              <button 
                onClick={handleAskAssistant}
                className="flex-1 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 shadow-xl shadow-blue-600/20 active:scale-95"
              >
                <i className="fas fa-comment-dots"></i>
                <span>Discuss with AI</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/50 py-10 text-center text-slate-500 text-xs">
        <div className="max-w-4xl mx-auto px-4">
          <p className="mb-2">© 2024 QRShield Security Analyzer • Powered by Gemini AI</p>
          <p className="text-slate-600">Built for proactive quishing protection and cybersecurity awareness.</p>
        </div>
      </footer>

      <Chatbot ref={chatbotRef} />
    </div>
  );
};

export default App;
