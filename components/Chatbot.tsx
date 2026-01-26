
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getChatbotResponse } from '../services/geminiService';
import { ChatMessage } from '../types';

export interface ChatbotHandle {
  sendMessage: (msg: string, context?: string) => void;
  open: () => void;
}

const Chatbot = forwardRef<ChatbotHandle>((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I am QRShield AI. How can I help you stay safe today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentContextRef = useRef<string | undefined>(undefined);

  useImperativeHandle(ref, () => ({
    sendMessage: (msg: string, context?: string) => {
      setIsOpen(true);
      currentContextRef.current = context;
      handleSend(msg);
    },
    open: () => setIsOpen(true)
  }));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (overrideMsg?: string) => {
    const userMsg = (overrideMsg || input).trim();
    if (!userMsg) return;

    if (!overrideMsg) setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const response = await getChatbotResponse(userMsg, currentContextRef.current);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting to my brain. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-slate-800 w-80 sm:w-96 h-[500px] rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-blue-600 p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <i className="fas fa-robot text-white"></i>
              </div>
              <span className="text-white font-bold">QRShield Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors p-1">
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-500/20' 
                    : 'bg-slate-700 text-slate-100 rounded-bl-none border border-slate-600'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-700 p-3 rounded-2xl rounded-bl-none animate-pulse border border-slate-600">
                  <div className="flex space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-700 bg-slate-800/80 backdrop-blur-sm">
            <div className="flex space-x-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                className="flex-1 bg-slate-900 text-slate-100 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700 transition-all"
              />
              <button 
                onClick={() => handleSend()}
                disabled={isTyping || !input.trim()}
                className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center text-white text-3xl hover:bg-blue-500 hover:scale-110 transition-all border border-blue-400/30"
        >
          <i className="fas fa-comment-dots"></i>
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 border-2 border-slate-900"></span>
          </span>
        </button>
      )}
    </div>
  );
});

export default Chatbot;
