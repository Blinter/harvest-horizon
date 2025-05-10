/**
 * @file CropState.js
 * @description Defines the structure for representing the state of a crop
 *   within the game. This includes its growth stage, type, planting time,
 *   and level.
 *
 * @module game/types/CropState
 */

/**
 * Represents the dynamic state of a single crop planted on a tile.
 *
 * @typedef {object} CropState
 * @property {number} cropStage - The current growth stage number of the
 *   crop (e.g., 0 for seeded, 1 for sprouting, etc.). Managed
 *   client-side.
 * @property {number} cropNextStage - The timestamp indicating when the crop
 *   is expected to advance to the next growth stage. Managed
 *   client-side.
 * @property {string} cropType - The identifier string for the type of crop
 *   planted (e.g., 'wheat', 'corn'). Determined at planting.
 *   Synchronized with the server.
 * @property {number} cropPlantedAt - The server timestamp (milliseconds
 *   since epoch) when the crop was initially planted. Used by the
 *   client to calculate initial growth state. Synchronized with the
 *   server.
 * @property {number} cropLevel - The quality level or tier of the crop,
 *   potentially influencing yield or value. Synchronized with the
 *   server.
 */

// Export empty objects to make the imports work
// These are just type definitions, not actual implementations
export const CropState = {};