/**
 * @file Crop Management Utilities.
 * @module server/library/cropManagement
 * @description Provides functions for managing the lifecycle of crops on map
 *   tiles, including planting, growth updates, stage calculation, and
 *   harvesting. Relies on crop data definitions from the client library.
 */

import { totalCropData } from '../../src/library/gameData.js';
import {
  canHarvestCrop
} from '../../src/library/cropUtils.js';

/**
 * Plants a specified crop type on a given tile. Updates the tile's
 * properties: `cropType`, `cropStage`, `cropPlantTime`, `cropLevel`, and
 * calculates the initial `nextStage` time.
 *
 * @function plantCrop
 * @param {object} tile - The map tile object to plant on.
 * @param {string} cropType - The type of crop to plant.
 * @param {number} [level=1] - The level of the crop being planted. Defaults
 *   to 1.
 * @returns {boolean} `true` if planting was successful, `false` otherwise
 *   (e.g., tile occupied, invalid cropType).
 */
export const plantCrop = (tile, cropType, level = 1) => {
  if (tile === undefined || cropType === undefined) {
    console.error('Tile or Crop Type is undefined', tile, cropType);
    return false;
  }

  if (!totalCropData[cropType]?.stages) {
    console.error('Library does not have', cropType, 'defined');
    return false;
  }

  if (tile.cropType != null) {
    console.warn('Debug: Tile already has a crop planted');
    return false;
  }

  tile.cropType = cropType;
  tile.cropStage = 0;
  tile.cropPlantTime = new Date();
  tile.cropLevel = level;

  const firstStageKey = `${cropType}${level}`;
  const firstStageData = totalCropData[cropType].stages[firstStageKey];

  if (firstStageData?.growthTime) {
    tile.nextStage = new Date(Date.now() + firstStageData.growthTime);
    console.debug('Next Stage at', tile.nextStage);
  } else {
    console.warn(`No growth time data found for ${cropType}`);

    tile.nextStage = new Date();
  }

  return true;
};

/**
 * Harvests a crop from a tile, resetting crop-related properties. Checks if
 * the crop exists and is ready for harvest before proceeding.
 *
 * @function harvestCrop
 * @param {object} tile - The map tile object to harvest from.
 * @returns {boolean} `true` if harvest was successful, `false` otherwise
 *   (e.g., no crop, not ready).
 */
export const harvestCrop = (tile) => {
  const cropType = tile.cropType;
  if (!totalCropData[cropType]?.stages) {
    console.error('Library does not have', cropType, 'defined');
    return false;
  }

  if (tile.cropType === null) {
    console.warn('Debug: Tile does not have a crop planted');
    return false;
  }

  if (!canHarvestCrop(tile)) {
    console.warn('Crop not ready for harvest');
    return false;
  }

  const cropStage = tile.cropStage;
  const cropPlantTime = tile.cropPlantTime;
  const cropLevel = tile.cropLevel;

  if (cropType === null) {
    console.debug('Tile has no crop planted');
    return false;
  }

  if (cropStage === null) {
    console.debug('Tile has no crop stage');
    return false;
  }

  if (cropPlantTime === null) {
    console.debug('Tile has no crop plant time');
    return false;
  }

  if (cropLevel === null) {
    console.debug('Tile has no crop level');
    return false;
  }

  tile.cropType = null;
  tile.cropStage = null;
  tile.cropLevel = null;
  tile.cropNextStage = null;
  tile.cropPlantedAt = null;
  tile.cropPlantTime = null;

  return true;
};

/**
 * Updates the growth stage of a crop on a single tile if the `nextStage` time
 * has passed. Calculates the time for the subsequent stage or sets
 * `nextStage` to null if the final stage is reached.
 *
 * @function updateSingleTileCropGrowth
 * @param {object} tile - The map tile object containing the crop to update.
 * @returns {void}
 */
export const updateSingleTileCropGrowth = (tile) => {
  const currentTime = new Date().getTime();

  if (!tile.cropType || !tile.cropPlantTime || !tile.nextStage) {
    console.debug('updateSingleTileCropGrowth Skipped Tile', tile);
    return;
  }

  const cropData = totalCropData[tile.cropType];
  if (!cropData?.stages) {
    console.warn(
      'updateSingleTileCropGrowth Invalid crop data for',
      tile.cropType
    );
    return;
  }

  const currentStageKey = `${tile.cropType}${tile.cropStage + 1}`;
  const currentStageData = cropData.stages[currentStageKey];

  if (!currentStageData) {
    console.warn(
      `No stage data found for ${tile.cropType}, stage ${tile.cropStage + 1}`
    );
    return;
  }

  if (currentTime >= tile.nextStage.getTime()) {
    tile.cropStage++;

    const nextStageKey = `${tile.cropType}${tile.cropStage + 1}`;
    const nextStageData = cropData.stages[nextStageKey];

    if (nextStageData?.growthTime) {
      tile.nextStage = new Date(currentTime + nextStageData.growthTime);
    } else {
      console.debug('Crop has reached final stage.', tile);
      tile.nextStage = null;
    }
  }

  if (tile.cropStage === cropData.size - 1) {
    console.debug('Crop is ready for harvest.', tile);
  }
};

/**
 * Iterates through all tiles provided by a map service and updates crop
 * growth for each tile that has a growing crop. This logic is intended for
 * client-side execution; the server should not call this function directly.
 *
 * @function updateAllTileCropGrowth
 * @param {object} mapService - An object assumed to have a `mapData` property
 *   containing an array of tile objects, and a `socket` property for emitting
 *   updates.
 * @returns {void}
 * @throws {Error} If `mapService.mapData` is not a valid array.
 */
export const updateAllTileCropGrowth = (mapService) => {
  const tiles = mapService.mapData;
  if (!Array.isArray(tiles) || tiles.length === 0)
    throw new Error('mapService Data is not an array');
  const currentTime = new Date().getTime();
  tiles.forEach((tile) => {
    if (tile.cropType === null || tile.nextStage === null) return;

    const cropData =
      totalCropData[tile.cropType].stages[`${tile.cropType}${tile.cropLevel}`];

    const cropGrowthTime = cropData.growthTime;

    if (!cropData) {
      console.error('Invalid crop data for', tile.cropType);
      return;
    }

    let nextStageTime;

    if (typeof tile.nextStage === 'string')
      nextStageTime = new Date(tile.nextStage).getTime();
    else if (tile.nextStage instanceof Date)
      nextStageTime = tile.nextStage.getTime();
    else if (typeof tile.nextStage === 'number') nextStageTime = tile.nextStage;
    else {
      console.warn(
        `Invalid nextStage value for tile at (${tile.x}, ${tile.y}):`,
        tile.nextStage
      );

      tile.nextStageTime =
        currentTime + cropData.frames.length * cropGrowthTime;
      return;
    }

    if (currentTime >= nextStageTime) {
      if (tile.cropStage === cropData.frames.length - 1) {
        console.debug('Crop is ready for harvest.', tile);

        tile.nextStage = null;
        return;
      } else {
        tile.cropStage++;
        tile.nextStage = new Date(currentTime + cropGrowthTime);
        console.debug('Crop reached stage', tile.cropStage, tile.x, tile.y);
      }

      mapService.socket.emit('updateTile', {
        x: tile.x,
        y: tile.y,
        updates: tile,
      });

      mapService.updateTileData(tile.x, tile.y, tile);
    }
  });
};
