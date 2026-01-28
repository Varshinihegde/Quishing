
import React from 'react';
import { RiskLevel } from '../types';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score, level }) => {
  const getColors = () => {
    switch(level) {
      case RiskLevel.LOW: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/20';
      case RiskLevel.MODERATE: return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10 shadow-cyan-500/20';
      case RiskLevel.SUSPICIOUS: return 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/20';
      case RiskLevel.HIGH: return 'text-orange-500 border-orange-500/40 bg-orange-500/10 shadow-orange-500/30';
      case RiskLevel.CRITICAL: return 'text-rose-500 border-rose-500/50 bg-rose-500/20 shadow-rose-500/40 animate-pulse';
      default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10 shadow-slate-500/20';
    }
  };

  const colors = getColors();

  return (
    <div className={`p-8 rounded-[2.5rem] border-2 text-center shadow-2xl transition-all duration-1000 ${colors}`}>
      <div className="relative inline-block mb-4">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="14"
            fill="transparent"
            className="opacity-10"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="14"
            fill="transparent"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * score) / 100}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black tracking-tighter">{score}%</span>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Risk Index</span>
        </div>
      </div>
      <h3 className="text-3xl font-black uppercase tracking-tighter mb-1 italic">{level}</h3>
      <div className="w-12 h-1 bg-current mx-auto rounded-full opacity-30 mt-2 mb-1"></div>
      <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Forensic Classification</p>
    </div>
  );
};

export default RiskGauge;
