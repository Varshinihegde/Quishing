
import React from 'react';
import { RiskLevel } from '../types';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score, level }) => {
  const getColors = () => {
    switch(level) {
      case RiskLevel.SAFE: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/20';
      case RiskLevel.SUSPICIOUS: return 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/20';
      case RiskLevel.MALICIOUS: return 'text-rose-400 border-rose-500/30 bg-rose-500/10 shadow-rose-500/20';
      default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10 shadow-slate-500/20';
    }
  };

  const colors = getColors();

  return (
    <div className={`p-8 rounded-3xl border text-center shadow-lg transition-all transform hover:scale-[1.02] ${colors}`}>
      <div className="relative inline-block mb-4">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="opacity-20"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * score) / 100}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold">{score}%</span>
          <span className="text-sm font-medium opacity-70 uppercase tracking-widest">Risk</span>
        </div>
      </div>
      <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">{level}</h3>
      <p className="text-sm opacity-80">Security Assessment Score</p>
    </div>
  );
};

export default RiskGauge;
