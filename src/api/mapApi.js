/**
 * @file mapApi.js
 * API service functions for interacting with map endpoints.
 * @module api/mapApi
 */
import axios from 'axios';
import { handleError } from '../utils/errorHandler.js';
import {
  CHARACTER_ENDPOINT,
  MAP_CHANGE_NAME_ENDPOINT,
  MAP_FAVORITE_ENDPOINT,
  MAPS_BY_CHARACTER_ENDPOINT_TEMPLATE,
  MAP_CREATE_ENDPOINT_TEMPLATE,
  MAP_DELETE_ENDPOINT_TEMPLATE,
  MAP_PAY_RENT_ENDPOINT_TEMPLATE
} from '../utils/apiEndpoints.js';

/**
 * Fetches all maps for a specific character.
 * Requires a valid JWT token.
 * @async
 * @function getMapsByCharacterId
 * @param {string} characterId - The MongoDB ID of the character.
 * @returns {Promise<Array<object>>} Resolves to an array of map objects.
 * @throws {Error} If request fails or characterId is invalid.
 */
export const getMapsByCharacterId = async (characterId) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error('Invalid character ID provided.');
    handleError(error, { context: 'getMapsByCharacterIdValidation' });
    throw error;
  }
  try {
    // Replace placeholder with actual endpoint generation if template exists
    const endpoint = MAPS_BY_CHARACTER_ENDPOINT_TEMPLATE
      ? MAPS_BY_CHARACTER_ENDPOINT_TEMPLATE.replace(
        '{characterId}',
        characterId
      )
      : `${CHARACTER_ENDPOINT}/${characterId}/maps`; // Fallback guess

    const response = await axios.get(endpoint);
    // Adjust return based on API response structure (e.g., response.data.maps)
    return response.data?.maps || response.data || [];
  } catch (error) {
    handleError(error, {
      context: 'getMapsByCharacterIdApiCall',
      payload: { characterId },
      onError: (handledError) =>
        console.error(
          `[${new Date().toISOString()}] [ERROR] [mapApi]: ` +
          `Error fetching maps for ${characterId}:`,
          handledError
        ),
    });
    throw error;
  }
};

/**
 * Creates a new map for a specific character.
 * Requires a valid JWT token.
 * @async
 * @function createMapForCharacter
 * @param {string} characterId - The MongoDB ID of the character.
 * @param {object.<string, any>} [initialMapData={}] - Optional initial data for
 *   the map.
 * @returns {Promise<object>} Resolves to the newly created map object.
 * @throws {Error} If request fails or characterId is invalid.
 */
export const createMapForCharacter = async (
  characterId,
  initialMapData = {}
) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error('Invalid character ID provided.');
    handleError(error, { context: 'createMapForCharacterValidation' });
    throw error;
  }
  try {
    const endpoint = MAP_CREATE_ENDPOINT_TEMPLATE
      ? MAP_CREATE_ENDPOINT_TEMPLATE.replace('{characterId}', characterId)
      : `${CHARACTER_ENDPOINT}/${characterId}/maps`; // Fallback guess

    const response = await axios.post(endpoint, initialMapData);
    return response.data;
  } catch (error) {
    handleError(error, {
      context: 'createMapForCharacterApiCall',
      payload: { characterId, initialMapData },
      onError: (handledError) =>
        console.error(
          `[${new Date().toISOString()}] [ERROR] [mapApi]: ` +
          `Error creating map for ${characterId}:`,
          handledError
        ),
    });
    throw error;
  }
};

/**
 * Updates the nickname for a specific map.
 * Uses the /api/character/mapChangeName endpoint.
 * Requires a valid JWT token.
 * @async
 * @function updateMapNickname
 * @param {string} mapId - The ID of the map.
 * @param {string} newNickname - The new nickname to set.
 * @returns {Promise<object>} Resolves to the updated map object.
 * @throws {Error} If request fails or parameters are invalid.
 */
export const updateMapNickname = async (mapId, newNickname) => {
  if (
    typeof mapId !== 'string' ||
    !mapId.trim() ||
    typeof newNickname !== 'string'
  ) {
    const error = new Error('Invalid map ID or new nickname provided.');
    handleError(error, { context: 'updateMapNicknameValidation' });
    throw error;
  }

  try {
    const payload = { mapId, newNickName: newNickname };
    const endpoint = MAP_CHANGE_NAME_ENDPOINT;

    const response = await axios.post(endpoint, payload);

    return response.data;
  } catch (error) {
    handleError(error, {
      context: 'updateMapNicknameApiCall',
      payload: { mapId, newNickName: newNickname },
      endpoint: MAP_CHANGE_NAME_ENDPOINT,
      onError: (handledError) =>
        console.error(
          `[${new Date().toISOString()}] [ERROR] [mapApi]: ` +
          `Failed updateMapNickname for ${mapId}: `,
          handledError
        ),
    });
    throw error;
  }
};

/**
 * Sets the specified map as the favorite for the associated character.
 * Uses the /api/character/mapFavorite endpoint.
 * Requires a valid JWT token.
 * @async
 * @function setFavoriteMap
 * @param {string} mapId - The ID of the map to set as favorite.
 * @returns {Promise<object>} Resolves to an object confirming the action.
 * @throws {Error} If request fails or mapId is invalid.
 */
export const setFavoriteMap = async (mapId) => {
  if (typeof mapId !== 'string' || !mapId.trim()) {
    const error = new Error('Invalid map ID provided.');
    handleError(error, { context: 'setFavoriteMapValidation' });
    throw error;
  }

  try {
    const payload = { mapId };
    const endpoint = MAP_FAVORITE_ENDPOINT;

    const response = await axios.post(endpoint, payload);

    return response.data;
  } catch (error) {
    handleError(error, {
      context: 'setFavoriteMapApiCall',
      payload: { mapId },
      endpoint: MAP_FAVORITE_ENDPOINT,
      onError: (handledError) => {
        console.error(
          `[${new Date().toISOString()}] [ERROR] [mapApi]: ` +
          `Failed setFavoriteMap for ${mapId}:`,
          handledError
        );
      },
    });
    throw error;
  }
};

/**
 * Deletes a specific map.
 * Requires a valid JWT token.
 * @async
 * @function deleteMap
 * @param {string} mapId - The ID of the map to delete.
 * @returns {Promise<object>} Resolves to an object confirming the deletion.
 * @throws {Error} If request fails or mapId is invalid.
 */
export const deleteMap = async (mapId) => {
  if (typeof mapId !== 'string' || !mapId.trim()) {
    const error = new Error('Invalid map ID provided for deletion.');
    handleError(error, { context: 'deleteMapValidation' });
    throw error;
  }

  let endpoint = ''; // Declare endpoint outside try block
  try {
    endpoint = MAP_DELETE_ENDPOINT_TEMPLATE.replace('{mapId}', mapId);

    const response = await axios.delete(endpoint);

    return response.data;
  } catch (error) {
    handleError(error, {
      context: 'deleteMapApiCall',
      payload: { mapId },
      endpoint: endpoint,
      onError: (handledError) =>
        console.error(
          `[${new Date().toISOString()}] [ERROR] [mapApi]: ` +
          `Failed DELETE map for ${mapId}: `,
          handledError
        ),
    });
    throw error;
  }
};

/**
 * Pays the rent for all eligible leased tiles on a specific map.
 * Requires a valid JWT token.
 * @async
 * @function payMapRent
 * @param {string} mapId - The ID of the map to pay rent for.
 * @returns {Promise<object>} Resolves to an object confirming the payment and
 *   providing the new wallet balance: `{ message: string, newBalance: number,
 *   updatedTileCount: number }`
 * @throws {Error} If the request fails or mapId is invalid.
 */
export const payMapRent = async (mapId) => {
  if (typeof mapId !== 'string' || !mapId.trim()) {
    const error = new Error('Invalid map ID provided for paying rent.');
    handleError(error, { context: 'payMapRentValidation' });
    throw error;
  }

  let endpoint = '';
  try {
    endpoint = MAP_PAY_RENT_ENDPOINT_TEMPLATE.replace('{mapId}', mapId);

    // Make a PATCH request - no payload needed as the mapId identifies the
    // resource
    const response = await axios.patch(endpoint);

    // Return the success message and potentially updated wallet info
    return response.data;
  } catch (error) {
    handleError(error, {
      context: 'payMapRentApiCall',
      payload: { mapId },
      endpoint: endpoint,
      onError: (handledError) =>
        console.error(
          `[${new Date().toISOString()}] [ERROR] [mapApi]: ` +
          `Failed POST pay rent for ${mapId}: `,
          handledError
        ),
    });
    throw error;
  }
};
