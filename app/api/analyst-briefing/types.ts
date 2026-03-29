export type BriefingResult = {
  marketSummary: string; conflictAlignment: string; riskAssessment: string;
  watchpoints: string[]; riskScore: number;
  riskLabel: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  generatedBy: 'groq-ai' | 'algorithmic'; generatedAt: string;
};
