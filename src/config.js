/**
 * @file config.js
 * @module config
 * @description Defines core configuration constants for the Harvest Horizon
 *   application and game logic. Includes API URLs, game parameters (tick rate,
 *   gold, market, inventory, soil), crop details, and default item
 *   definitions.
 */

/**
 * Base URL for the backend API.
 * Reads from the VITE_API_URL environment variable, falling back to
 * localhost.
 * @constant {string} API_URL
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Core game configuration parameters.
 * @constant {object} GAME_CONFIG
 * @property {number} startingGold - Initial gold amount for a new player.
 * @property {object} crops - Configuration for specific crop types.
 * @property {object} crops.wheat - Configuration for wheat.
 * @property {number} crops.wheat.growthTime - Time for wheat to grow (ms).
 * @property {{min: number, max: number}} crops.wheat.harvestYield - Min/max
 *   yield per harvest.
 * @property {string} crops.wheat.seedId - ID of the corresponding seed item.
 * @property {string} crops.wheat.harvestId - ID of the harvested crop item.
 */
export const GAME_CONFIG = {
  startingGold: 100,
  crops: {
    wheat: {
      growthTime: 120000,
      harvestYield: { min: 1, max: 3 },
      seedId: 'wheat_seed',
      harvestId: 'wheat',
    },
  },
};

/**
 * Enum-like object defining different item types used in the game.
 * @constant {object} ITEM_TYPES
 * @property {string} SEED - Item type for seeds.
 * @property {string} CROP - Item type for harvested crops.
 * @property {string} TOOL - Item type for tools.
 * @property {string} CONSUMABLE - Item type for consumable items.
 */
export const ITEM_TYPES = {
  SEED: 'seed',
  CROP: 'crop',
  TOOL: 'tool',
  CONSUMABLE: 'consumable',
};

/**
 * Definitions for default items available in the game.
 * Each key is the item ID, and the value is an object describing the item.
 * @constant {object.<string, {id: string, name: string, description: string,
 *   type: string, price: number, category: string}>} DEFAULT_ITEMS
 */
export const DEFAULT_ITEMS = {
  wheatSeed: {
    id: 'wheatSeed',
    name: 'Wheat Seed',
    description: 'Grows wheat',
    type: ITEM_TYPES.SEED,
    price: 1,
    category: 'seed',
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    description: 'Can be sold in the market',
    type: ITEM_TYPES.CROP,
    price: 2,
    category: 'crop',
  },
  scythe: {
    id: 'scythe',
    name: 'Scythe',
    description: 'Base Tool. Can only be upgraded.',
    type: ITEM_TYPES.TOOL,
    price: -1,
    category: 'tool',
  },
  plantingGloves: {
    id: 'plantingGloves',
    name: 'Planting Gloves',
    description: 'Base Tool. Can only be upgraded.',
    type: ITEM_TYPES.TOOL,
    price: -1,
    category: 'tool',
  },
  rentPaymentVoucher: {
    id: 'rentPaymentVoucher',
    name: 'Pay rent for your farm',
    description: 'Consumable. Allows you to interact with your farm.',
    type: ITEM_TYPES.CONSUMABLE,
    price: 0,
    category: 'consumable',
  },
};
