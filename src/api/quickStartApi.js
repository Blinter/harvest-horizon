import axios from 'axios';
import { QUICK_START_ENDPOINT } from '../utils/apiEndpoints'; // Correct path
import { handleError } from '../utils/errorHandler'; // Correct path

/**
 * @file src/api/quickStartApi.js
 * @description API client functions for the quick start feature.
 * @module api/quickStartApi
 */

/**
 * Initiates a quick start session by creating a temporary user, character,
 * and map on the backend.
 *
 * @async
 * @function quickStartGame
 * @returns {Promise<object|null>} A promise that resolves with an object 
 *   containing the temporary user details, JWT token, character ID, 
 *   and map ID on success, or null on failure after error handling.
 *   Example: `{ user: {...}, token: '...', characterId: '...', mapId: '...' }`
 * @throws {Error} Re-throws the error if `handleError` is configured 
 *   to do so (default is false).
 */
export const quickStartGame = async () => {
  // For logging
  // const timestamp = new Date().toISOString(); 
  // console.debug(
  //   `[${timestamp}] [quickStartApi] ` +
  //   `Attempting Quick Start. Endpoint:`,
  //   QUICK_START_ENDPOINT
  // );

  try {
    // Debug when quick start is attempted
    // console.debug(`[${timestamp}] [quickStartApi] Sending POST request...`);
    const response = await axios.post(QUICK_START_ENDPOINT);
    // Debug when quick start is successful
    // console.debug(`[${timestamp}] [quickStartApi] POST request successful. Response data:`, response.data);
    // { user, token, characterId, mapId } in response.data
    return response.data;
  } catch (error) {
    // Debug when quick start fails
    // console.error(
    //   `[${timestamp}] [quickStartApi] Error caught in quickStartGame:`,
    //   error
    // );
    // Use the centralized error handler
    handleError(error, {
      context: 'quickStartGame API Request',
      // Optional: add specific callback or configure rethrow if needed
      // rethrow: true, // Uncomment if the calling component needs to catch it
    });
    // Re-throw the error so interceptors or calling code can see it
    throw error;
  }
};
