/**
 * @file
 * @fileoverview Setup configuration for Vitest tests.
 * @module setupTests
 *
 * This file contains configurations and extensions for the Vitest testing
 * environment.
 *
 * It imports the necessary testing libraries and sets up global mocks and
 * configurations to ensure consistent behavior across all test suites.
 *
 * The primary configuration includes setting up Jest DOM matchers for
 * React component testing, which enables assertions like
 * `toBeInTheDocument()` and `toHaveStyle()`.
 */

/* global global */

// Import testing library extensions
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createCanvas } from 'canvas';

// Mock canvas for Phaser
global.HTMLCanvasElement.prototype.getContext = function () {
  return createCanvas(300, 150).getContext('2d');
};

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window properties that Phaser needs
global.window.focus = () => { };
global.window.HTMLCanvasElement = global.HTMLCanvasElement;

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Set up any global mocks or configurations here

// Add TextEncoder and TextDecoder to global scope
if (typeof global.TextEncoder === 'undefined') {
  try {
    // Use Node.js util module for TextEncoder in ESM
    const { TextEncoder } = await import('util');
    global.TextEncoder = TextEncoder;
  } catch (err) {
    console.warn('Could not import TextEncoder from util:', err);
  }
}

if (typeof global.TextDecoder === 'undefined') {
  try {
    // Use Node.js util module for TextDecoder in ESM
    const { TextDecoder } = await import('util');
    global.TextDecoder = TextDecoder;
  } catch (err) {
    console.warn('Could not import TextDecoder from util:', err);
  }
}
