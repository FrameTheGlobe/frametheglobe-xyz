export type FlashBriefPayload = {
  brief: string; generatedAt: string;
  generatedBy: 'groq-ai' | 'algorithmic';
  storiesAnalysed: number; topThemes: string[];
};
