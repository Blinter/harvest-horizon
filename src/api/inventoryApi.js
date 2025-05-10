/**
 * @file inventoryApi.js
 * API service functions for interacting with inventory and market endpoints.
 * @module api/inventoryApi
 */
import axios from 'axios';
import { handleError } from '../utils/errorHandler.js';
import {
  MARKET_ENDPOINT,
  getCharacterInventoryUrl,
  CHARACTER_SELL_ITEMS_ENDPOINT,
  CHARACTER_BUY_ITEMS_ENDPOINT,
} from '../utils/apiEndpoints.js';

// --- Inventory & Market API Functions ---

/**
 * Fetches the inventory for a specific character.
 * Requires a valid JWT token.
 * References: GET /api/character/:characterId/inventory
 * (Backend endpoint required)
 * @async
 * @function getCharacterInventory
 * @param {string} characterId - The ID of the character whose inventory to
 *   fetch.
 * @returns {Promise<object>} A promise that resolves to the character's
 *   inventory data (including inventory array and coins).
 * @throws {Error} If the request fails or the provided characterId is
 *   invalid.
 */
export const getCharacterInventory = async (characterId) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error(
      'Invalid character ID provided for inventory fetch.'
    );
    handleError(error, { context: 'getCharacterInventoryValidation' });
    throw error;
  }

  try {
    // This endpoint needs to exist in the backend
    // (e.g., in server/routes/character.js)
    const endpoint = getCharacterInventoryUrl(characterId);

    const response = await axios.get(endpoint);

    // Return the whole data object { inventory, coins }
    return response.data;
  } catch (error) {
    const timestamp = new Date().toISOString();
    handleError(error, {
      context: 'getCharacterInventoryApiCall',
      payload: { characterId },
      endpoint: getCharacterInventoryUrl(characterId),
      onError: (handledError) =>
        console.error(
          `[${timestamp}] [ERROR] [inventoryApi]: ` +
          `Failed getCharacterInventory for ${characterId}: `,
          handledError
        ),
    });
    throw error;
  }
};

/**
 * Fetches all available items from the market.
 * References: GET /api/market
 * @async
 * @function getMarketItems
 * @returns {Promise<Array<object>>} A promise resolving to an array of
 *   market item objects.
 * @throws {Error} If the API request fails.
 */
export const getMarketItems = async () => {
  try {
    // This endpoint needs to exist in the backend
    const endpoint = MARKET_ENDPOINT;

    const response = await axios.get(endpoint);

    return response.data || []; // Ensure an array is returned
  } catch (error) {
    const timestamp = new Date().toISOString();
    handleError(error, {
      context: 'getMarketItemsApiCall',
      endpoint: MARKET_ENDPOINT,
      onError: (handledError) => {
        console.error(
          `[${timestamp}] [ERROR] [inventoryApi]: Failed getMarketItems: `,
          handledError
        );
      },
    });
    throw error;
  }
};

/**
 * Sells an item from the character's inventory.
 * Requires a valid JWT token.
 * References: POST /api/character/:characterId/inventory/sell
 * (Backend endpoint required)
 * @async
 * @function sellCharacterItem
 * @param {string} characterId - The ID of the character selling the item.
 * @param {string} itemName - The name of the item to sell.
 * @param {string} itemType - The type category of the item to sell.
 * @param {number} quantity - The quantity of the item to sell (must be > 0).
 * @returns {Promise<object>} A promise resolving to the API response, which
 *   typically includes the updated inventory and coin count.
 * @throws {Error} If the request fails or if any input parameters are
 *   invalid (e.g., non-positive quantity).
 */
export const sellCharacterItem = async (
  characterId,
  itemName,
  itemType,
  quantity
) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error('Invalid character ID provided for selling.');
    handleError(error, { context: 'sellCharacterItemValidation' });
    throw error;
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    const error = new Error('Invalid quantity provided for selling.');
    handleError(error, {
      context: 'sellCharacterItemValidation',
      payload: { characterId, itemName, itemType, quantity },
    });
    throw error;
  }

  try {
    // Use the static endpoint constant
    const endpoint = CHARACTER_SELL_ITEMS_ENDPOINT;
    const payload = { characterId, itemName, itemType, quantity };

    const response = await axios.post(endpoint, payload);

    return response.data;
  } catch (error) {
    const timestamp = new Date().toISOString();
    handleError(error, {
      context: 'sellCharacterItemApiCall',
      payload: { characterId, itemName, itemType, quantity },
      endpoint: CHARACTER_SELL_ITEMS_ENDPOINT,
      onError: (handledError) => {
        console.error(
          `[${timestamp}] [ERROR] [inventoryApi]: Failed sellCharacterItem: `,
          handledError
        );
      },
    });
    throw error;
  }
};

/**
 * Buys an item from the market for a character.
 * Requires a valid JWT token.
 * References: POST /api/character/:characterId/inventory/buy
 * (Backend endpoint required)
 * @async
 * @function buyCharacterItem
 * @param {string} characterId - The ID of the character buying the item.
 * @param {string} marketItemId - The unique identifier of the market listing
 *   being purchased.
 * @param {string} itemName - The name of the item being bought.
 * @param {string} itemType - The type category of the item to buy.
 * @param {number} quantity - The quantity of the item to buy (must be > 0).
 * @returns {Promise<object>} A promise resolving to the API response, likely
 *   containing updated inventory and coin information.
 * @throws {Error} If the request fails or any parameters are invalid (e.g.,
 *   missing marketItemId, non-positive quantity).
 */
export const buyCharacterItem = async (
  characterId,
  marketItemId,
  itemName,
  itemType,
  quantity
) => {
  if (typeof characterId !== 'string' || !characterId.trim()) {
    const error = new Error('Invalid character ID provided for buying.');
    handleError(error, { context: 'buyCharacterItemValidation' });
    throw error;
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    const error = new Error('Invalid quantity provided for buying.');
    handleError(error, {
      context: 'buyCharacterItemValidation',
      payload: { characterId, marketItemId, itemName, itemType, quantity },
    });
    throw error;
  }
  if (typeof marketItemId !== 'string' || !marketItemId.trim()) {
    const error = new Error('Invalid market item ID provided for buying.');
    handleError(error, { context: 'buyCharacterItemValidation' });
    throw error;
  }

  try {
    // Use the static endpoint constant
    const endpoint = CHARACTER_BUY_ITEMS_ENDPOINT;
    // Construct payload *without* marketItemId for this specific endpoint
    const payload = { characterId, itemName, itemType, quantity };

    const response = await axios.post(endpoint, payload);

    return response.data;
  } catch (error) {
    const timestamp = new Date().toISOString();
    handleError(error, {
      context: 'buyCharacterItemApiCall',
      payload: { characterId, marketItemId, itemName, itemType, quantity },
      endpoint: CHARACTER_BUY_ITEMS_ENDPOINT,
      onError: (handledError) => {
        console.error(
          `[${timestamp}] [ERROR] [inventoryApi]: Failed buyCharacterItem: `,
          handledError
        );
      },
    });
    throw error;
  }
};
