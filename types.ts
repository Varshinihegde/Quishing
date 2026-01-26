
export enum RiskLevel {
  SAFE = 'SAFE',
  SUSPICIOUS = 'SUSPICIOUS',
  MALICIOUS = 'MALICIOUS'
}

export interface AnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  explanation: string;
  recommendations: string[];
  originalContent: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QRState {
  view: 'home' | 'scan' | 'upload' | 'result';
  decodedContent: string | null;
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}
