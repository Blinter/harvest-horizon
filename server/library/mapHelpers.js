/**
 * @file Map generation and coordinate helper functions.
 * @module server/library/mapHelpers
 *
 * @description Provides utility functions for generating random map data,
 *   random map IDs, and converting between coordinate representations.
 */

import { mapTileProgress } from '../../src/library/gameData.js';

/**
 * Converts a coordinate key string ("x,y") into an array of coordinates.
 *
 * @function keyToCoords
 * @param {string} key - The coordinate key string (e.g., "5,10").
 * @returns {string[]} An array containing [xString, yString]. Note: These are
 *   returned as strings.
 */
export const keyToCoords = (key) => key.split(',');

/**
 * Converts an object with x, y properties into a coordinate key string ("x,y").
 *
 * @function coordsToKey
 * @param {{x: number | string, y: number | string}} coords - An object with x
 *   and y properties.
 * @returns {string} The coordinate key string.
 */
export const coordsToKey = (coords) => `${coords.x},${coords.y}`;

/**
 * Converts separate x and y grid coordinates into a coordinate key string
 *   ("x,y").
 *
 * @function gridToKey
 * @param {number | string} x - The x coordinate.
 * @param {number | string} y - The y coordinate.
 * @returns {string} The coordinate key string.
 */
export const gridToKey = (x, y) => `${x},${y}`;

/**
 * Generates a random string ID potentially useful for unique map identifiers,
 * though UUID might be more robust. The ID is constructed using elements from
 * the `mapTileProgress` array.
 *
 * @function generateRandomMapId
 * @returns {string} A randomly generated string ID.
 * @throws {Error} If `mapTileProgress` is empty.
 */
export const generateRandomMapId = () => {
  if (mapTileProgress.length === 0)
    throw new Error('mapTileProgress is empty');

  const mapId = [];

  const length = Math.floor(Math.random() * 5) + 4;

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * mapTileProgress.length);
    mapId.push(mapTileProgress[randomIndex]);
  }

  return mapId.join('');
};

/**
 * Generates a map data object representing a grid with random tile types.
 *
 * Creates a grid based on the provided width, height, and an additional margin
 * (`maxCoordsLeasable`) for leasable areas. Each tile within the grid is
 * assigned a random type from `mapTileProgress` and initial properties,
 * including whether it's part of the base map or the leasable extension.
 *
 * @function generateRandomMap
 * @param {{width: number, height: number, maxCoordsLeasable: number}} params -
 *   Object containing map dimensions.
 * @param {number} params.width - The core width of the non-leasable map area.
 * @param {number} params.height - The core height of the non-leasable map
 *   area.
 * @param {number} params.maxCoordsLeasable - Additional size added to both
 *   width and height to define the outer boundary for leasable tiles.
 * @returns {Object.<string, object>} A map data object where keys are "x,y"
 *   coordinate strings and values are tile data objects containing `type` and
 *   `properties` (including `base` and `leasable` booleans).
 * @throws {Error} If `width`, `height`, or `maxCoordsLeasable` are undefined in
 *   the params object.
 */
export const generateRandomMap = ({ width, height, maxCoordsLeasable }) => {
  if (
    width === undefined ||
    height === undefined ||
    maxCoordsLeasable === undefined
  )
    throw new Error('width, height, or maxCoordsLeasable undefined');

  let effectiveWidth = Math.max(width, 0);
  let effectiveHeight = Math.max(height, 0);
  let effectiveMaxCoordsLeasable = Math.max(maxCoordsLeasable, 0);

  const mapData = {};

  const maxX = effectiveWidth + effectiveMaxCoordsLeasable;
  const maxY = effectiveHeight + effectiveMaxCoordsLeasable;

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      mapData[`${x},${y}`] = {
        type: mapTileProgress[
          Math.floor(Math.random() * mapTileProgress.length)
        ],
        properties: {
          base:
            x < effectiveWidth &&
            y < effectiveHeight,
          leasable:
            x >= effectiveWidth ||
            y >= effectiveHeight,
        },
      };
    }
  }
  return mapData;
};
