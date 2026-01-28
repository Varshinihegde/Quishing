
import React from 'react';
import { ProbabilityMap } from '../types';

interface ProbabilityBreakdownProps {
  probabilities: ProbabilityMap;
}

const ProbabilityBreakdown: React.FC<ProbabilityBreakdownProps> = ({ probabilities }) => {
  const metrics = [
    { 
      label: 'Malicious Intent', 
      value: probabilities.malicious, 
      color: 'bg-rose-500', 
      icon: 'fa-skull-crossbones',
      desc: 'Harmful payloads or phishing intent'
    },
    { 
      label: 'Fake / Pseudo Pattern', 
      value: probabilities.fake, 
      color: 'bg-amber-500', 
      icon: 'fa-mask',
      desc: 'Deceptive domains or obfuscated redirects'
    },
    { 
      label: 'Official / Authentic', 
      value: probabilities.authentic, 
      color: 'bg-emerald-500', 
      icon: 'fa-certificate',
      desc: 'Trust signals and verified origin signatures'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Forensic Vector Analysis</h3>
        <div className="text-[10px] font-bold text-blue-500/60 flex items-center space-x-1">
          <i className="fas fa-check-circle"></i>
          <span>Delta-30 Verified</span>
        </div>
      </div>
      
      {metrics.map((m, i) => (
        <div key={i} className="group relative">
          <div className="flex justify-between items-end mb-2">
            <div className="flex items-center space-x-2">
              <div className={`w-1.5 h-1.5 rounded-full ${m.color} shadow-lg shadow-${m.color}/50`}></div>
              <span className="text-xs font-black uppercase tracking-tight text-slate-300">{m.label}</span>
            </div>
            <span className="text-sm font-mono font-black text-slate-200">{m.value}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/30 p-0.5">
            <div 
              className={`h-full ${m.color} rounded-full transition-all duration-1000 ease-out`} 
              style={{ width: `${m.value}%` }}
            ></div>
          </div>
          <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
             <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg shadow-xl">
                <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{m.desc}</p>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProbabilityBreakdown;
