
import React from 'react';
import Chatbot from './Chatbot';

interface LayoutProps {
  children: React.ReactNode;
  onHomeClick: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onHomeClick }) => {
  return (
    <div className="relative min-h-screen flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div 
            onClick={onHomeClick} 
            className="flex items-center space-x-2 cursor-pointer group"
          >
            <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-500 transition-colors">
              <i className="fas fa-shield-alt text-white text-xl"></i>
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              QRShield
            </span>
          </div>
          <nav>
            <button 
              onClick={onHomeClick}
              className="text-slate-400 hover:text-white transition-colors flex items-center space-x-1"
            >
              <i className="fas fa-home"></i>
              <span className="hidden sm:inline">Home</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/50 py-6 text-center text-slate-500 text-sm">
        <p>© 2024 QRShield Security Analyzer • Stay Safe from Quishing</p>
      </footer>

      <Chatbot />
    </div>
  );
};

export default Layout;
