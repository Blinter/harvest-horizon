import { handleError } from './errorHandler.js';

/**
 * @file testHelpers.js
 * @module testHelpers
 * @description Provides utility functions exposed on the window object
 *   (`window.__HH`) for simulating errors during development and testing.
 *   These helpers should only be initialized in non-production
 *   environments.
 */

/**
 * Exposes error simulation functions on the global `window.__HH` object.
 *
 * Functions added:
 * - `simulateError(message, errorType, options)`: Simulates calling the
 *   `handleError` utility with a specified error type and message.
 * - `simulateUncaughtException(message)`: Throws an error asynchronously
 *   to simulate an uncaught exception.
 * - `simulateUnhandledRejection(message)`: Creates a rejected promise
 *   that is not handled, simulating an unhandled promise rejection.
 *
 * This function does nothing if `process.env.NODE_ENV` is 'production'.
 *
 * @function exposeErrorHandlingForTesting
 * @returns {void}
 */
export const exposeErrorHandlingForTesting = () => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (!window.__HH) {
    window.__HH = {};
  }

  window.__HH.simulateError = (message, errorType = 'Error', options = {}) => {
    console.warn('Simulating error for testing purposes:', message);

    let error;
    switch (errorType) {
      case 'TypeError':
        error = new TypeError(message);
        break;
      case 'ReferenceError':
        error = new ReferenceError(message);
        break;
      case 'SyntaxError':
        error = new SyntaxError(message);
        break;
      case 'RangeError':
        error = new RangeError(message);
        break;
      default:
        error = new Error(message);
    }

    const defaultOptions = {
      context: 'Simulated Error',
      captureStack: true,
      rethrow: false,
    };

    return handleError(error, { ...defaultOptions, ...options });
  };

  window.__HH.simulateUncaughtException = (message) => {
    console.warn('Simulating uncaught exception for testing purposes');
    setTimeout(() => {
      throw new Error(message || 'Simulated uncaught exception');
    }, 0);
  };

  window.__HH.simulateUnhandledRejection = (message) => {
    console.warn('Simulating unhandled promise rejection for testing purposes');
    const promise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || 'Simulated unhandled rejection'));
      }, 0);
    });

    promise.then((_value) => { });
  };
};

/**
 * Default export containing the testing utility initialization
 * function.
 *
 * @type {{exposeErrorHandlingForTesting: function(): void}}
 */
export default {
  exposeErrorHandlingForTesting,
};
