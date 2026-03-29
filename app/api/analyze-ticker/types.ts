export type TickerCategory = 'oil' | 'metals' | 'commodities';
export type TickerClickPayload = {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; currency: string; unit: string; category: TickerCategory;
};
export type TickerAnalysisResult = { analysis: string; source: 'groq-ai' | 'algorithmic' };
