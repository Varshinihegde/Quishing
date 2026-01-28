
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
      desc: 'Evidence of direct harm or theft'
    },
    { 
      label: 'Fake / Pseudo Pattern', 
      value: probabilities.fake, 
      color: 'bg-amber-500', 
      icon: 'fa-mask',
      desc: 'Deception and domain masking'
    },
    { 
      label: 'Official / Authentic', 
      value: probabilities.authentic, 
      color: 'bg-emerald-500', 
      icon: 'fa-certificate',
      desc: 'Legitimacy and trust signatures'
    },
  ];

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Probability Vectors</h3>
      {metrics.map((m, i) => (
        <div key={i} className="group">
          <div className="flex justify-between items-end mb-2">
            <div className="flex items-center space-x-2">
              <i className={`fas ${m.icon} text-xs text-slate-400`}></i>
              <span className="text-xs font-bold text-slate-300">{m.label}</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{m.value}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div 
              className={`h-full ${m.color} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`} 
              style={{ width: `${m.value}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity italic">
            {m.desc}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ProbabilityBreakdown;
