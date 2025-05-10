/**
 * @file errorHandler.js
 * @module errorHandler
 * @description Provides centralized error handling utilities for the
 *   application. Includes a function to handle individual errors with context
 *   and options, and a function to set up global handlers for uncaught
 *   exceptions and unhandled promise rejections.
 */

const defaultOptions = {
  context: 'Global',
  onError: null,
  captureStack: true,
  rethrow: false,
};

/**
 * Handles and logs an error with provided context and options.
 *
 * Logs the error using the logger utility. Can optionally capture the stack
 * trace, execute a callback function, and rethrow the error. This function
 * specifically checks for Axios 401 errors to handle session expiration by
 * logging out the user and redirecting to the login page.
 *
 * @function handleError
 * @param {Error} error - The error object to handle.
 * @param {object} [options={}] - Configuration options for handling the
 *   error.
 * @param {string} [options.context='Global'] - Contextual information about
 *   where the error occurred (e.g., 'API Request', 'Component Lifecycle').
 * @param {function(Error, {message: string, context: string}): void}
 *   [options.onError=null] - An optional callback function executed after
 *   logging. Receives the original error and context details.
 * @param {boolean} [options.captureStack=true] - Whether to capture and log
 *   the error's stack trace. Defaults to true.
 * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
 *   after handling. Defaults to false. Useful for allowing higher-level
 *   handlers to catch the error as well.
 * @returns {Error} The original error object, allowing for potential chaining
 *   or further inspection.
 */
export const handleError = (error, options = {}) => {
  const opts = { ...defaultOptions, ...options };

  // Check for Axios 401 Unauthorized error
  if (error.response && error.response.status === 401) {
    console.warn(
      'Session expired or invalid. Logging out and redirecting to login.'
    );

    // Clear tokens from localStorage (adjust keys if different)
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Clear any other relevant session/user data
      // localStorage.removeItem('userData');
    } catch (storageError) {
      console.error(
        'Error clearing local storage during logout:',
        storageError
      );
      // Fallback or further logging might be needed here
    }

    // Display a message to the user (optional, using alert for simplicity)
    // Consider using a more user-friendly notification system if available
    alert('Session expired. Please log in again.');

    // Redirect to login page
    // Using window.location.href causes a full page refresh
    window.location.href = '/login';

    // Prevent further default error handling for 401s handled this way
    return error;
  }

  // Safely access error message, provide fallback
  const errorMessage = error?.message || 'An unknown error occurred';
  const contextMessage = `${opts.context}: ${errorMessage}`;

  // Log using console.error directly as per project guidelines
  const logError = console.error;

  // Log stack trace if available and requested
  if (opts.captureStack && error?.stack) {
    logError(`${contextMessage}\nStack: ${error.stack}`);
  } else {
    logError(contextMessage);
  }

  // Execute onError callback safely
  if (typeof opts.onError === 'function') {
    try {
      // Pass the original error and the formatted message/context
      opts.onError(error, { message: contextMessage, context: opts.context });
    } catch (callbackError) {
      // Safely log error within the callback
      const callbackErrorMessage =
        callbackError?.message || 'Unknown error in error handler callback';
      logError(`Error in error handler callback: ${callbackErrorMessage}`);
    }
  }

  if (opts.rethrow) {
    throw error;
  }

  return error;
};

/**
 * Sets up global error handlers for uncaught exceptions and unhandled promise
 * rejections within the browser environment.
 *
 * Attaches event listeners to the `window` object to catch errors that might
 * otherwise terminate script execution or go unnoticed. These global errors
 * are routed through the `handleError` function for consistent logging and
 * handling.
 *
 * @function setupGlobalErrorHandler
 * @returns {function(): void} A cleanup function that removes the added
 *   global event listeners. This should be called if the application needs
 *   to tear down these handlers (e.g., during component unmounting in SPAs).
 */
export const setupGlobalErrorHandler = () => {
  const handleUncaughtException = (event) => {
    const error = event.error || new Error('Unknown error occurred');
    handleError(error, {
      context: 'Uncaught Exception',
      rethrow: false,
    });

    event.preventDefault();
  };

  const handleUnhandledRejection = (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    handleError(error, {
      context: 'Unhandled Promise Rejection',
      rethrow: false,
    });

    event.preventDefault();
  };

  window.addEventListener('error', handleUncaughtException);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleUncaughtException);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
};

/**
 * Default export containing the primary error handling utility functions.
 * Provides convenient access to `handleError` and `setupGlobalErrorHandler`.
 * Structure: {
 *   handleError: function(error: Error, options?: {context?: string, onError?: function, captureStack?: boolean, rethrow?: boolean}) => Error,
 *   setupGlobalErrorHandler: function() => function
 * }
 *
 * @type {Object}
 */
export default {
  handleError,
  setupGlobalErrorHandler,
};
