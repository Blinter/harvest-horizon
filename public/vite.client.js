/**
 * @file Custom Vite client configuration for handling WebSocket connection
 *   issues.
 * @module public/vite.client
 *
 * This file enhances Vite's Hot Module Replacement (HMR) WebSocket
 * functionality by adding custom error handling and automatic reconnection
 * capabilities. It overrides the browser's WebSocket constructor to add
 * robust error handling and connection recovery logic specifically for
 * Vite HMR connections.
 */

/**
 * Immediately invoked function expression that patches Vite's HMR
 * WebSocket implementation with enhanced error handling and reconnection logic.
 *
 * @function patchViteHMR
 * @private
 */
(function patchViteHMR() {
  // Wait for the window object to be available
  if (typeof window === 'undefined') return;

  // Store the original WebSocket class
  const OriginalWebSocket = window.WebSocket;

  /**
   * Custom WebSocket constructor that wraps the native WebSocket with enhanced
   * error handling and reconnection capabilities for Vite HMR connections.
   *
   * @param {string} url - The WebSocket endpoint URL.
   * @param {(string|string[])} protocols - WebSocket protocols.
   * @returns {WebSocket} Enhanced WebSocket instance.
   */
  window.WebSocket = function CustomWebSocket(url, protocols) {
    // Check if this is a Vite HMR WebSocket
    const isViteHMR = url.includes('/__vite_hmr') || url.includes('/__hmr');

    // Create the WebSocket using the original constructor
    const ws = new OriginalWebSocket(url, protocols);

    if (isViteHMR) {
      console.info(`[Vite HMR] Creating WebSocket connection to ${url}`);

      // Add custom error handling
      const originalOnError = ws.onerror;
      /**
       * Enhanced error handler for WebSocket connections.
       *
       * @param {Event} event - Error event object.
       */
      ws.onerror = function (event) {
        console.error(`[Vite HMR] WebSocket error with ${url}:`, event);

        // Try to set up automatic reconnection
        setTimeout(() => {
          console.info('[Vite HMR] Attempting to reconnect...');
          // Attempt to reconnect via Vite's client
          if (window.__vite_connect) {
            window.__vite_connect();
          }
        }, 3000);

        // Call original handler if it exists
        if (originalOnError) originalOnError.call(this, event);
      };

      // Monitor close events
      const originalOnClose = ws.onclose;
      /**
       * Enhanced close handler for WebSocket connections.
       *
       * @param {CloseEvent} event - Close event object.
       */
      ws.onclose = function (event) {
        console.info(
          `[Vite HMR] WebSocket closed with code ${event.code}: ${event.reason}`
        );

        // Try to set up automatic reconnection
        setTimeout(() => {
          console.info('[Vite HMR] Attempting to reconnect after close...');
          // Attempt to reconnect via Vite's client
          if (window.__vite_connect) {
            window.__vite_connect();
          }
        }, 3000);

        // Call original handler if it exists
        if (originalOnClose) originalOnClose.call(this, event);
      };
    }

    return ws;
  };

  // Preserve prototype chain
  window.WebSocket.prototype = OriginalWebSocket.prototype;

  /**
   * Helper function added to the window object to manually trigger
   * HMR WebSocket reconnection.
   *
   * @returns {boolean} True if reconnection was attempted, false otherwise.
   */
  window.__hmr_reconnect = function () {
    if (window.__vite_connect) {
      console.info('[Vite HMR] Manual reconnection triggered');
      window.__vite_connect();
      return true;
    }
    console.warn('[Vite HMR] Cannot reconnect: __vite_connect not found');
    return false;
  };

  console.info('[Vite HMR] Enhanced WebSocket handling enabled');
})();

/**
 * Default export object for ESM compatibility.
 *
 * @type {Object}
 * @property {Function} setup - Initialization function.
 */
export default {
  /**
   * Setup function that gets called when the module is imported.
   * Currently just logs initialization message.
   */
  setup() {
    console.info('Custom Vite client initialized');
  },
};
