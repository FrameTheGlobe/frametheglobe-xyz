import { describe, expect, it } from 'vitest';
import { REGION_LABELS, SOURCES } from '@/lib/sources';

describe('sources integrity', () => {
  it('uses unique source IDs', () => {
    const ids = SOURCES.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has valid URL + region label coverage', () => {
    for (const source of SOURCES) {
      expect(source.url.startsWith('http://') || source.url.startsWith('https://')).toBe(true);
      expect(REGION_LABELS[source.region]).toBeTruthy();
    }
  });
});

