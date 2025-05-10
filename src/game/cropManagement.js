/**
 * @file cropManagement.js
 * @description Client-side functions for managing crop actions (planting,
 * harvesting, growth updates) within a Phaser scene context, often
 * interacting with a MapService. Functions are intended to be bound to a
 * Phaser scene instance.
 * @module cropManagement
 */

import {
  mapTileProgress,
  totalCropData,
  isActionAllowed,
} from '../../server/library/gameData.js';

/**
 * Sets up a recurring timer to check and update crop growth status.
 *
 * Requires `this` to be bound to a scene instance with `mapService` and
 * `cropManager` properties. Loads initial crop states from the mapService.
 *
 * @async
 * @this {Phaser.Scene & {
 *   mapService: import('../services/mapService.js').MapService,
 *   cropManager: import('./cropManager.js').CropManager,
 *   time: Phaser.Time.Clock,
 *   mapData: object,
 *   cropGrowthTimer: Phaser.Time.TimerEvent,
 *   updateCropGrowth: function
 * }}
 * @throws {Error} If `this`, `this.mapService`, or `this.cropManager` is not
 *   properly bound or initialized.
 */
export async function setupCropGrowthTimer() {
  if (!this) {
    console.error('Did not bind correctly.', this);
    throw new Error('Check Stack for improper bind', this);
  }
  if (!this.mapService) {
    console.error('Problem with Map Service', this);
    throw new Error('Check Stack from this error', this);
  }
  await this.mapService.getAllMapData();

  if (Object.keys(this.mapData).length === 0) {
    console.warn('Map data not available, cannot set up crop growth timer');
    return;
  }

  if (!this.cropManager) {
    console.error('CropManager is not initialized');
    return;
  }

  try {
    this.cropManager.loadCrops(this.mapService.mapData);
  } catch (error) {
    console.error('Error loading crops:', error);
    return;
  }
  this.cropGrowthTimer = this.time.addEvent({
    delay: 500,
    callback: () => {
      this.updateCropGrowth();
    },
    loop: true,
  });
}

/**
 * Processes the planting of a single crop on a specific tile.
 *
 * Checks tile validity and delegates the actual planting logic to
 * `mapServicePlantCrop`. Checks CropManager to prevent redundant planting.
 * Updates the client-side `CropManager` if successful.
 *
 * Requires `this` to be bound to a scene instance with `mapService` and
 * `cropManager` properties.
 *
 * @param {object} tile - The tile data object where the crop should be
 *   planted. Must have `x` and `y` properties.
 * @param {string} cropType - The type of crop to plant.
 * @param {number} [level=1] - The level or variant of the crop.
 * @returns {boolean} True if planting was initiated successfully, false
 *   otherwise.
 * @this {Phaser.Scene & { mapService:
 *                          import('../services/mapService.js').MapService,
 *                         cropManager: import('./cropManager.js').CropManager
 *                       }}
 * @throws {Error} If `this` or `this.mapService` is not properly bound.
 */
export function processPlantCropForTile(tile, cropType, level = 1) {
  if (!this) {
    console.error('Did not bind correctly.', this);
    throw new Error('Check Stack for improper bind', this);
  }
  if (!this.mapService) {
    console.error('Problem with Map Service', this);
    throw new Error('Check Stack from this error', this);
  }
  if (typeof tile?.x !== 'number' || typeof tile?.y !== 'number') {
    console.warn('[cropManagement] processPlantCropForTile: Invalid tile object received.', tile);
    return false;
  }

  if (this.cropManager?.hasCrop(tile.x, tile.y)) {
    console.warn(
      `[cropManagement] processPlantCropForTile: Crop already exists ` +
      `in CropManager at (${tile.x}, ${tile.y}). Skipping redundant plant.`
    );
    return false;
  }

  if (tile.type !== mapTileProgress.at(4)) {
    console.warn(
      `[cropManagement] processPlantCropForTile: Tile (${tile.x}, ${tile.y}) ` +
      `not ready for planting (type: ${tile?.type}, expected: ${mapTileProgress.at(4)})`
    );
    return false;
  }

  if (this.mapService?.plantCrop(tile, cropType, level)) {
    this.cropManager.plantCrop(tile.x, tile.y, cropType, level);
    console.log(`[cropManagement] processPlantCropForTile: Planting initiated for (${tile.x}, ${tile.y})`);
    return true;
  }

  console.warn(`[cropManagement] processPlantCropForTile: mapServicePlantCrop failed for (${tile.x}, ${tile.y})`);
  return false;
}

/**
 * Handles the user action of planting a specific crop type on selected tiles.
 *
 * Filters valid tiles, processes planting for each, updates sprites, and
 * refreshes UI/map.
 *
 * Requires `this` to be bound to a scene instance with necessary properties
 * (`mapService`, `cropManager`, etc.).
 *
 * @param {object[]} tiles - An array of selected tile coordinates ({x, y}).
 * @param {string} cropType - The type of crop to plant.
 * @param {number} [level=1] - The level or variant of the crop.
 * @this {Phaser.Scene & { mapService:
 *                          import('../services/mapService.js').MapService,
 *                         cropManager: import('./cropManager.js').CropManager,
 *                         clearTileInfo: function,
 *                         updateTileSprite: function,
 *                         displayTileInfo: function,
 *                         renderItemMap: function
 *                       }}
 * @throws {Error} If `this` or `this.mapService` is not properly bound.
 */
export function handlePlantCrop(tiles, cropType, level = 1) {
  if (!this) {
    console.error('Did not bind correctly.', this);
    throw new Error('Check Stack for improper bind', this);
  }

  if (!this.mapService) {
    console.error('Problem with Map Service', this);
    throw new Error('Check Stack from this error', this);
  }
  if (
    !tiles ||
    tiles.length === 0 ||
    !cropType ||
    !totalCropData[cropType]?.stages
  ) {
    console.error('Error: undefined (Check) ', tiles, cropType, level);
    return;
  }

  const availableTiles = this.mapService
    .getMultipleTileData(tiles)
    .filter((tile) => !tile.properties.leasable);

  if (!availableTiles) {
    console.error('Error: No available tiles');
    return;
  }

  this.clearTileInfo();

  availableTiles.forEach((tile) => {
    if (!processPlantCropForTile.call(this, tile, cropType, level)) {
      console.debug('Debug: Could not process', tile, cropType, level);
      return;
    }

    this.updateTileSprite(
      tile.x,
      tile.y,
      this.mapService.getTileData(tile.x, tile.y)
    );

    const tileData = this.mapService.getTileData(tile.x, tile.y);

    if (tileData) {
      this.displayTileInfo(tile.x, tile.y, tileData);
    } else {
      console.warn(`No tile data found for (${tile.x}, ${tile.y})`);
    }
  });

  this.renderItemMap();
}

/**
 * Handles the user action of harvesting crops from selected tiles.
 *
 * Filters valid tiles, processes harvesting for each, updates the server
 * (via socket), updates sprites, and refreshes UI/map.
 *
 * Requires `this` to be bound to a scene instance with necessary properties
 * (`mapService`, `processHarvestCropForTile`, etc.).
 *
 * @param {object[]} tiles - An array of selected tile coordinates ({x, y}).
 * @param {string} cropType - The type of crop being harvested (used for
 *   validation).
 * @this {Phaser.Scene & { mapService:
 *                          import('../services/mapService.js').MapService,
 *                         processHarvestCropForTile: function,
 *                         updateTileSprite: function,
 *                         displayTileInfo: function,
 *                         renderItemMap: function,
 *                         clearTileInfo: function
 *                       }}
 * @throws {Error} If `this` or `this.mapService` is not properly bound.
 */
export function handleHarvestCrop(tiles, cropType) {
  console.debug('Harvest Crop');
  if (!this) {
    console.error('Did not bind correctly.', this);
    throw new Error('Check Stack for improper bind', this);
  }
  if (!this.mapService) {
    console.error('Problem with Map Service', this);
    throw new Error('Check Stack from this error', this);
  }
  if (
    !tiles ||
    tiles.length === 0 ||
    !cropType ||
    !totalCropData[cropType]?.stages
  ) {
    console.error(
      `[${new Date().toISOString()}] [ERROR] [cropManagement] ` +
      `handleHarvestCrop: Cannot find crop or invalid data sent ` +
      `to handlePlantCrop`,
      tiles,
      cropType,
      totalCropData
    );
    return;
  }

  // Filter out tiles that are not action allowed
  const availableTiles = this.mapService
    .getMultipleTileData(tiles)
    .filter(tile => isActionAllowed(tile.properties));

  if (!availableTiles) {
    console.error(
      `[${new Date().toISOString()}] [ERROR] [cropManagement] ` +
      `handleHarvestCrop: No available tiles`
    );
    return;
  }

  this.clearTileInfo();

  availableTiles.forEach((tile) => {
    if (!this.processHarvestCropForTile(tile)) return;

    this.mapService.socket.emit('updateTile', {
      x: tile.x,
      y: tile.y,
      updates: tile,
    });

    this.updateTileSprite(
      tile.x,
      tile.y,
      this.mapService.getTileData(tile.x, tile.y)
    );
    const tileData = this.mapService.getTileData(tile.x, tile.y);
    if (tileData) {
      this.displayTileInfo(tile.x, tile.y, tileData);
    } else {
      console.warn(`No tile data found for (${tile.x}, ${tile.y})`);
    }
  });

  this.renderItemMap();
}

