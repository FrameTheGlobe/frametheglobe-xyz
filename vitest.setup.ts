import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch for all tests globally
global.fetch = vi.fn();

// Mock window.matchMedia if it exists (not provided by jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
