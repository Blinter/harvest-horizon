/**
 * @file src/test/setup.js
 * @description Global setup for Vitest tests. Imports testing library
 *              extensions (e.g., jest-dom) and mocks essential browser APIs
 *              (matchMedia, IntersectionObserver, ResizeObserver) and the
 *              Phaser library. This ensures tests run correctly in a Node.js
 *              environment where these APIs are absent. Also suppresses
 *              specific console error messages related to React updates
 *              outside `act()` during test execution.
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver
const mockResizeObserver = vi.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.ResizeObserver = mockResizeObserver;

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Game: vi.fn(),
    Scene: vi.fn(),
    AUTO: 'AUTO',
    Scale: {
      RESIZE: 'RESIZE',
      FIT: 'FIT',
    },
    Physics: {
      ARCADE: 'ARCADE',
      Arcade: {
        Sprite: vi.fn(),
      },
    },
    GameObjects: {
      Sprite: vi.fn(),
      Container: vi.fn(),
      Text: vi.fn(),
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          UP: 'UP',
          DOWN: 'DOWN',
          LEFT: 'LEFT',
          RIGHT: 'RIGHT',
          SPACE: 'SPACE',
        },
      },
    },
  },
}));

// Suppress console errors during tests
const originalError = console.error;
console.error = (...args) => {
  if (
    /Warning.*not wrapped in act/.test(args[0]) ||
    /Warning.*Cannot update a component/.test(args[0])
  ) {
    return;
  }
  originalError.call(console, ...args);
};
