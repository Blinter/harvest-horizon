/**
 * @file src/utils/apiEndpoints.js
 * Centralized API endpoint definitions and helper functions for Harvest
 * Horizon. Provides constants for static API endpoints and functions to
 * generate dynamic endpoint URLs.
 *
 * @module utils/apiEndpoints
 */

// --- Base URL ---

/**
 * The base URL for all API requests. Defaults to '/api' if
 * VITE_API_BASE_URL environment variable is not set.
 *
 * @const {string}
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// --- Static API Endpoint Strings ---

// Character

/**
 * Base endpoint for character-related operations.
 *
 * @const {string}
 */
export const CHARACTER_ENDPOINT = `${BASE_URL}/character`;

/**
 * Endpoint for users to change their character's name.
 *
 * @const {string}
 */
export const USER_CHARACTER_CHANGE_NAME_ENDPOINT =
  `${BASE_URL}/user/userCharacterChangeName`;

/**
 * Endpoint for users to set their favorite character.
 *
 * @const {string}
 */
export const USER_FAVORITE_CHARACTER_ENDPOINT =
  `${BASE_URL}/user/userFavoriteCharacter`;

/**
 * Endpoint for users to delete a character.
 *
 * @const {string}
 */
export const USER_DELETE_CHARACTER_ENDPOINT =
  `${BASE_URL}/user/userDeleteCharacter`;

// Inventory & Market

/**
 * Endpoint for market-related operations (e.g., fetching all items).
 *
 * @const {string}
 */
export const MARKET_ENDPOINT = `${BASE_URL}/market`;

/**
 * Endpoint for characters to sell items from their inventory.
 * Expects characterId in the request payload.
 *
 * @const {string}
 */
export const CHARACTER_SELL_ITEMS_ENDPOINT =
  `${BASE_URL}/character/sellItems`;

/**
 * Endpoint for characters to buy items and add them to their inventory.
 * Expects characterId in the request payload.
 *
 * @const {string}
 */
export const CHARACTER_BUY_ITEMS_ENDPOINT = `${BASE_URL}/character/buyItems`;

// Map Specific Endpoints (related to character actions)

/**
 * Endpoint for changing a map's nickname.
 *
 * @const {string}
 */
export const MAP_CHANGE_NAME_ENDPOINT = `${BASE_URL}/character/mapChangeName`;

/**
 * Endpoint for setting a map as favorite.
 *
 * @const {string}
 */
export const MAP_FAVORITE_ENDPOINT = `${BASE_URL}/character/mapFavorite`;

// --- Endpoint Templates (for mapApi.js) ---

/**
 * Template for the endpoint to get all maps for a character.
 * Replace '{characterId}' with the actual character ID.
 *
 * @const {string}
 */
export const MAPS_BY_CHARACTER_ENDPOINT_TEMPLATE =
  `${BASE_URL}/character/{characterId}/maps`;

/**
 * Template for the endpoint to create a new map for a character.
 * Replace '{characterId}' with the actual character ID.
 *
 * @const {string}
 */
export const MAP_CREATE_ENDPOINT_TEMPLATE =
  `${BASE_URL}/character/{characterId}/maps`;

/**
 * Template for the endpoint to delete a specific map.
 * Replace '{mapId}' with the actual map ID.
 *
 * @const {string}
 */
export const MAP_DELETE_ENDPOINT_TEMPLATE = `${BASE_URL}/maps/{mapId}`;

/**
 * Template for the endpoint to pay rent for a specific map.
 * Replace '{mapId}' with the actual map ID.
 *
 * @const {string}
 */
export const MAP_PAY_RENT_ENDPOINT_TEMPLATE = `${BASE_URL}/maps/{mapId}`;

// Quick Start

/**
 * Endpoint for initiating a quick start session.
 *
 * @const {string}
 */
export const QUICK_START_ENDPOINT = `${BASE_URL}/quick-start`;

// --- Dynamic API Endpoint URL Generators ---

/**
 * Generates the endpoint URL for fetching or modifying details of a
 * specific character.
 *
 * @function getCharacterDetailEndpoint
 * @param {string} characterId - The unique identifier of the character.
 * @returns {string} The character detail endpoint URL (e.g.,
 *   '/api/character/xyz').
 */
export const getCharacterDetailEndpoint = (characterId) =>
  `${CHARACTER_ENDPOINT}/${characterId}`;

/**
 * Generates the endpoint URL for fetching a specific character's inventory.
 *
 * @function getCharacterInventoryUrl
 * @param {string} characterId - The unique identifier of the character.
 * @returns {string} The character inventory endpoint URL (e.g.,
 *   '/api/character/xyz/inventory').
 */
export const getCharacterInventoryUrl = (characterId) =>
  `${BASE_URL}/character/${characterId}/inventory`;

/**
 * Generates the endpoint URL for fetching a specific character's status
 * logs.
 *
 * @function getStatusLogsEndpoint
 * @param {string} characterId - The unique identifier of the character.
 * @returns {string} The status logs endpoint URL (e.g.,
 *   '/api/status-logs/xyz').
 */
export const getStatusLogsEndpoint = (characterId) =>
  `${BASE_URL}/status-logs/${characterId}`;
