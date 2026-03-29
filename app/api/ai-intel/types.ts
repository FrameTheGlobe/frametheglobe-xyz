// Shared types for the ai-intel API route — imported by components and the route proxy.

export type ThreatLevel = 'CRIT' | 'ELEV' | 'HIGH' | 'NORM' | 'UNKN';

export type Theater = {
  id: string; name: string; level: ThreatLevel; summary: string;
  airOps: number; groundAssets: number; navalAssets: number;
  recentEvents: number; trend: 'escalating' | 'stable' | 'de-escalating';
};

export type CountryInstability = {
  country: string; flag: string; score: number;
  unrest: number; conflict: number; sanctions: number; infoWarfare: number;
  delta: number; trend: 'up' | 'stable' | 'down';
};

export type Forecast = {
  id: string;
  category: 'Conflict' | 'Market' | 'Supply Chain' | 'Political' | 'Military' | 'Cyber' | 'Infra';
  title: string; probability: number; horizon: '24h' | '7d' | '30d';
  confidence: 'High' | 'Medium' | 'Low'; basis: string;
};

export type SigintItem = {
  title: string; sourceName: string; region: string; pubDate: string; link: string;
};

export type AIIntelPayload = {
  generatedAt: string; totalStoriesAnalysed: number;
  generatedBy: 'groq-ai' | 'algorithmic';
  strategicRisk: {
    score: number; label: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
    trend: 'Rising' | 'Stable' | 'Declining'; deltaPoints: number;
    primaryDrivers: string[]; analystNote: string;
  };
  theaters: Theater[]; instability: CountryInstability[];
  forecasts: Forecast[];
  insights: { worldBrief: string; focalPoints: string };
  sigint: SigintItem[];
  diplomaticStatus: { actor: string; status: string; detail: string; color: string }[];
  economicWarfare: { label: string; value: string; detail: string; trend: 'rising' | 'stable' | 'easing' }[];
};
