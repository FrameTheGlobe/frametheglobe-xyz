import { describe, it, expect } from 'vitest';
import { matchesIranTheater } from './fetcher';

describe('Fetcher Keyword Matching', () => {
  it('should match items containing "iran"', () => {
    const item = { title: 'News from Iran', summary: 'Something happened' };
    expect(matchesIranTheater(item)).toBe(true);
  });

  it('should match items containing regional proxy keywords', () => {
    const item = { title: 'Hezbollah movement', summary: 'In Lebanon' };
    expect(matchesIranTheater(item)).toBe(true);
  });

  it('should NOT match unrelated news', () => {
    const item = { title: 'Local weather report', summary: 'Sunny today' };
    expect(matchesIranTheater(item)).toBe(false);
  });

  it('should match items related to oil sanctions', () => {
    const item = { title: 'Market update', summary: 'Oil sanctions on crude exports' };
    expect(matchesIranTheater(item)).toBe(true);
  });
});
