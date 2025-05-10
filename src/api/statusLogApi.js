/**
 * @file src/api/statusLogApi.js
 * API client functions for interacting with character status log
 * endpoints.
 * @module api/statusLogApi
 */
import axios from 'axios'; // Use axios directly
import { handleError } from '../utils/errorHandler.js';
import { getStatusLogsEndpoint } from '../utils/apiEndpoints.js';

/**
 * Fetches the most recent status log entries for a specific
 * character.
 *
 * @async
 * @function getCharacterStatusLogs
 * @param {string} characterId - The MongoDB ID of the character.
 * @returns {Promise<Array<object>>} A promise that resolves to an
 *   array of status log entry objects.
 * @throws {Error} Throws an error if the API request fails.
 */
export const getCharacterStatusLogs = async (characterId) => {
  if (!characterId) {
    // Use handleError for consistency, even for simple validation errors
    const error = new Error('Character ID is required to fetch status logs.');
    handleError(error, { context: 'getCharacterStatusLogsValidation' });
    throw error;
  }
  try {
    // Prepend BASE_URL to the endpoint
    const endpoint = getStatusLogsEndpoint(characterId);
    // Use axios.get instead of api.get
    const response = await axios.get(endpoint);

    // Return the array of logs, or an empty array if none exist
    return response.data?.statusLogs || [];
  } catch (error) {
    const timestamp = new Date().toISOString();
    handleError(error, {
      context: 'getCharacterStatusLogsApiCall', // Renamed context for clarity

      // Ensure BASE_URL is included here too
      payload: { characterId },
      endpoint: getStatusLogsEndpoint(characterId),
      onError: (handledError) =>
        console.error(
          `[${timestamp}] [ERROR] [statusLogApi]: Failed ` +
          `getCharacterStatusLogs for ${characterId}: `,
          handledError
        ),
    });
    throw error;
  }
};
