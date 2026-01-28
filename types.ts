
export enum RiskLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  SUSPICIOUS = 'SUSPICIOUS',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ProbabilityMap {
  malicious: number;
  fake: number;
  authentic: number;
}

export interface AnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  explanation: string;
  recommendations: string[];
  originalContent: string;
  groundingSources?: GroundingSource[];
  probabilities: ProbabilityMap;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QRState {
  view: 'home' | 'scan' | 'result';
  decodedContent: string | null;
  base64Image: string | null;
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}
