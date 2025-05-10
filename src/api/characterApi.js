/**
 * @file characterApi.js
 * API service functions for interacting with character endpoints.
 * Provides methods for fetching, creating, updating, favoriting, and deleting
 * user characters via the backend API.
 * @module api/characterApi
 */
import axios from 'axios';
import { handleError } from '../utils/errorHandler.js';
import {
  CHARACTER_ENDPOINT,
  USER_CHARACTER_CHANGE_NAME_ENDPOINT,
  USER_FAVORITE_CHARACTER_ENDPOINT,
  USER_DELETE_CHARACTER_ENDPOINT,
} from '../utils/apiEndpoints.js';

/**
 * Fetches all characters associated with the currently authenticated user.
 * Makes a GET request to the character endpoint.
 *
 * @async
 * @returns {Promise<Array<object>>} A promise that resolves to an array of
 *   character objects belonging to the user. Returns an empty array if no
 *   characters are found or on error before re-throwing.
 * @throws {Error} Rethrows any error encountered during the API request,
 *   after logging the error details.
 */
export const getCharacters = async () => {
  try {
    const response = await axios.get(CHARACTER_ENDPOINT);
    return response.data.characters || [];
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error.response?.data || error.message;
    console.error(
      `[${timestamp}] [ERROR] [characterApi]: Error in getCharacters:`,
      errorMessage,
      error
    );
    throw error;
  }
};

/**
 * Updates the nickname for a specific character belonging to the user.
 * Performs input validation before making a POST request.
 *
 * @async
 * @param {string} characterId - The unique identifier of the character whose
 *   nickname is to be updated. Must be a non-empty string.
 * @param {string} newNickname - The desired new nickname for the character.
 *   Must be a non-empty string.
 * @returns {Promise<object>} A promise that resolves to the API response
 *   object, typically indicating success or containing updated character data.
 * @throws {Error} Throws an error if `characterId` or `newNickname` are
 *   invalid (e.g., not strings, empty). Rethrows any error from the API
 *   request after logging.
 */
export const updateCharacterNickname = async (characterId, newNickname) => {
  if (
    typeof characterId !== 'string' ||
    !characterId.trim() ||
    typeof newNickname !== 'string' ||
    !newNickname.trim()
  ) {
    const error = new Error('Invalid character ID or new nickname provided.');
    handleError(error, { context: 'updateCharacterNicknameValidation' });
    throw error;
  }

  try {
    const payload = { characterId, newNickName: newNickname };
    const response = await axios.post(
      USER_CHARACTER_CHANGE_NAME_ENDPOINT,
      payload
    );
    return response.data;
  } catch (error) {
    const timestamp = new Date().toISOString();
    handleError(error, {
      context: 'updateCharacterNicknameApiCall',
      payload: { characterId, newNickName: newNickname },
      endpoint: USER_CHARACTER_CHANGE_NAME_ENDPOINT,
      onError: (handledError) =>
        console.error(
          `[${timestamp}] [ERROR] [characterApi]: ` +
          `Failed updateCharacterNickname for ${characterId}: `,
          handledError
        ),
    });
    throw error;
  }
};

/**
 * Creates a new character for the authenticated user.
 * Optionally accepts initial data for the character. Makes a POST request.
 *
 * @async
 * @param {object.<string, any>} [initialData={}] - An optional object
 *   containing initial data for the new character (e.g., name, appearance).
 *   Defaults to an empty object if not provided.
 * @returns {Promise<object>} A promise that resolves to the newly created
 *   character object as returned by the API.
 * @throws {Error} Rethrows any error encountered during the API request after
 *   logging the error details.
 */
export const createCharacter = async (initialData = {}) => {
  try {
    const response = await axios.post(CHARACTER_ENDPOINT, initialData);
    return response.data;
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] [ERROR] [characterApi]: Error in createCharacter:`,
      error.response?.data || error.message
    );
    throw error;
  }
};

/**
 * Sets or unsets a specific character as the user's favorite.
 * Performs input validation before making a POST request.
 *
 * @async
 * @param {string} characterId - The unique identifier of the character to
 *   favorite or unfavorite. Must be a non-empty string.
 * @param {boolean} favoriteState - The desired favorite state: `true` to set
 *   as favorite, `false` to remove favorite status. Must be a boolean.
 * @returns {Promise<object>} A promise that resolves to the API response
 *   object, typically confirming the change or providing updated data.
 * @throws {Error} Throws an error if `characterId` is invalid (not a
 *   non-empty string) or if `favoriteState` is not a boolean. Rethrows any
 *   error from the API request after logging.
 */
export const setFavoriteCharacter = async (characterId, favoriteState) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error('Invalid character ID provided.');
    handleError(error, { context: 'setFavoriteCharacterValidation' });
    throw error;
  }
  if (typeof favoriteState !== 'boolean') {
    const error = new Error(
      'Invalid favoriteState provided (must be boolean).'
    );
    handleError(error, {
      context: 'setFavoriteCharacterValidation',
      payload: { characterId, favoriteState },
    });
    throw error;
  }

  try {
    const endpoint = USER_FAVORITE_CHARACTER_ENDPOINT;
    const response = await axios.post(endpoint, { characterId, favoriteState });
    return response.data;
  } catch (error) {
    handleError(error, {
      context: 'setFavoriteCharacterApiCall',
      payload: { characterId, favoriteState },
      endpoint: USER_FAVORITE_CHARACTER_ENDPOINT,
      onError: (handledError) => {
        const timestamp = new Date().toISOString();
        console.error(
          `[${timestamp}] [ERROR] [characterApi]: ` +
          `Failed setFavoriteCharacter for ${characterId}:`,
          handledError
        );
      },
    });
    throw error;
  }
};

/**
 * Deletes a specific character belonging to the authenticated user.
 * Performs input validation before making a POST request.
 *
 * @async
 * @param {string} characterId - The unique identifier of the character to be
 *   deleted. Must be a non-empty string.
 * @returns {Promise<object>} A promise that resolves to the API response
 *   object, typically confirming the deletion.
 * @throws {Error} Throws an error if `characterId` is invalid (not a
 *   non-empty string). Rethrows any error from the API request after logging.
 */
export const deleteCharacter = async (characterId) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error('Invalid character ID provided for deletion.');
    handleError(error, { context: 'deleteCharacterValidation' });
    throw error;
  }

  try {
    const endpoint = USER_DELETE_CHARACTER_ENDPOINT;
    const response = await axios.post(endpoint, { characterId });
    return response.data;
  } catch (error) {
    const timestamp = new Date().toISOString();
    const endpoint = USER_DELETE_CHARACTER_ENDPOINT;
    handleError(error, {
      context: 'deleteCharacterApiCall',
      payload: { characterId },
      endpoint: endpoint,
      onError: (handledError) =>
        console.error(
          `[${timestamp}] [ERROR] [characterApi]: ` +
          `Failed POST ${endpoint} for ${characterId}: `,
          handledError
        ),
    });
    throw error;
  }
};
