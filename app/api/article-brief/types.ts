export type ArticleBriefPayload = {
  brief: string;
  significance: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MONITOR';
  generatedBy: 'groq-ai' | 'algorithmic';
};
