'use client';

import { createContext, useContext } from 'react';
import type { TickerCategory } from '@/app/api/analyze-ticker/route';

export type TickerDrawerData = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  currency:      string;
  unit:          string;
  category:      TickerCategory;
  accentColor:   string;
};

type AIAnalysisContextValue = {
  openDrawer:  (data: TickerDrawerData) => void;
  closeDrawer: () => void;
};

export const AIAnalysisContext = createContext<AIAnalysisContextValue>({
  openDrawer:  () => {},
  closeDrawer: () => {},
});

export function useTickerAnalysis() {
  return useContext(AIAnalysisContext);
}
