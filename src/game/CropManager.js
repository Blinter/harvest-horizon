/**
 * @file CropManager.js
 * @description Manages crop lifecycle and state within a Phaser scene in the
 * Harvest Horizon game.
 * @module CropManager
 */

import { EventBus } from './EventBus.js';
import { calculateCropStageInfo } from '../../src/library/cropUtils.js';
import { getCropData } from '../../src/library/gameData.js';
import {
  _calculateNextStageTimestamp,
} from '../../src/library/cropUtilsHelper.js';
// eslint-disable-next-line no-unused-vars -- Used in JSDoc types
import { CropState } from './types/CropState.js';

/**
 * Manages creation, update, tracking, and removal of crop objects and sprites.
 *
 * Works closely with the Phaser scene for sprite management.
 * @class CropManager
 */
export class CropManager {
  /**
   * Creates a CropManager instance.
   * @param {Phaser.Scene} scene - The Phaser scene this manager belongs to.
   *   Must provide methods like `getCropSprite`, `setCropTexture`, etc.
   * @throws {Error} If the scene is undefined.
   */
  constructor(scene) {
    /**
     * @property {Phaser.Scene} scene
     * The associated Phaser scene instance.
     */
    this.scene = scene;
    if (!this.scene) {
      throw new Error('Scene undefined');
    }
    /**
     * @property {Map<number, Map<number, CropState>>} crops
     * Stores crop data, keyed first by x-coordinate, then by y-coordinate.
     * The value is the crop object containing its state and type data.
     */
    this.crops = new Map();
    /**
     * @property {Map<string, Phaser.Time.TimerEvent>} growthTimers
     * Stores references to growth timer events for each crop, keyed by "x,y".
     * (Note: Currently seems unused, cleanup logic exists but planting/updating
     * doesn't add timers).
     */
    this.growthTimers = new Map();
  }

  // --- Private Helper Methods ---

  /**
   * Emits the current state of all managed crops.
   * Constructs a new map keyed by "x,y" strings for the event payload.
   * @private
   */
  _emitCropStatesUpdate() {
    const cropStatesMap = new Map();
    this.crops.forEach((yMap, x) => {
      yMap.forEach((cropState, y) => {
        const key = `${x},${y}`;
        // Ensure we emit a copy of the state
        cropStatesMap.set(key, { ...cropState });
      });
    });
    // Debugging: Crop States Update
    // console.debug('[CropManager] Emitting crop-states-updated:',
    //   cropStatesMap);
    EventBus.emit('crop-states-updated', cropStatesMap);
  }

  /**
   * Validates the essential input for planting a crop.
   * @private
   * @param {string} cropType - The type identifier of the crop.
   * @param {number} [cropLevel=1] - The level of the crop. Defaults to 1.
   * @throws {Error} If the scene or cropType is undefined.
   * @throws {Error} If cropLevel is undefined.
   * @throws {Error} If crop data cannot be found for the type/level.
   */
  _validatePlantCropInput(cropType, cropLevel = 1) {
    if (!this.scene) {
      throw new Error('Scene is undefined in CropManager');
    }
    if (!cropType) {
      throw new Error('Crop Type cannot be undefined for planting');
    }
    // Ensure cropLevel has a valid value, even if default is used.
    if (cropLevel === undefined ||
      cropLevel === null) {
      throw new Error('Crop Level cannot be undefined for planting');
    }
    if (!getCropData(cropType, cropLevel)) {
      throw new Error(`Crop Type ${cropType} at Level ${cropLevel} not ` +
        `found in getCropData`
      );
    }
  }

  /**
   * Prepares the data object for a new crop, including defaults and
   * calculating the next stage time.
   * @param {string} cropType - The type identifier of the crop.
   * @param {number} [cropPlantedAt] - Optional specific plant time (defaults
   *   to Date.now()).
   * @param {number} [cropLevel=1] - The level of the crop. Defaults to 1.
   * @returns {CropState | null} The prepared crop data object, or null if
   *   calculation fails.
   * @private
   */
  _prepareCropData(
    cropType,
    cropPlantedAt,
    cropLevel = 1, // Default to 1 if not provided
  ) {
    // Debugging: Crop Data
    // console.debug(
    //   `[CropManager _prepareCropData] Preparing crop data for ` +
    //   `cropType: ${cropType}, cropPlantedAt: ${cropPlantedAt}, ` +
    //   `cropLevel: ${cropLevel}`
    // );

    // Calculate current stage and next stage time based on plantTime and level
    const { cropNextStage, cropStage } = calculateCropStageInfo(
      cropType,
      cropPlantedAt,
      cropLevel
    );

    // Clean prop and make sure baseCropData is not overwritten
    const cropState = {
      cropStage,
      cropNextStage,
      cropType,
      cropPlantedAt,
      cropLevel, // Store the actual level used
    };

    if (isNaN(cropStage) || isNaN(cropNextStage)) {
      console.warn(
        `[CropManager _prepareCropData] Invalid crop stage or next stage: ` +
        `cropStage: ${cropStage}, cropNextStage: ${cropNextStage}`
      );
      return null;
    }
    // Debugging: Crop Data
    // console.debug(`[CropManager _prepareCropData]`, cropState);
    return cropState;
  }

  /**
   * Private helper to delete crop state and timer.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {CropState | null} The removed crop state object, or null if
   *   none found.
   * @private
   */
  _deleteCropState(x, y) {
    const crop = this.getCrop(x, y);
    if (!crop) {
      return null; // Nothing to delete
    }

    // Remove crop data from the map
    this.getOrCreateRow(x).delete(y);
    if (this.getOrCreateRow(x).size === 0) this.crops.delete(x);

    // --- Cancel and remove associated growth timer --- //
    const key = `${x},${y}`;
    if (this.growthTimers.has(key)) {
      this.growthTimers.get(key)?.remove(); // remove() is the correct method
      this.growthTimers.delete(key);
      // Debugging: Crop Data
      // console.debug(`[CropManager _deleteCropState] Removed ` + 
      //   `growth timer for (${x}, ${y}).`
      // );
    }

    // Emit state update AFTER removing the crop
    this._emitCropStatesUpdate();

    return crop; // Return the object that was removed
  }

  /**
   * Schedules the next growth stage update for a crop using a Phaser timer.
   * @private
   * @param {number} x - The x-coordinate of the crop.
   * @param {number} y - The y-coordinate of the crop.
   * @param {CropState} crop - The crop data object, must include
   *   cropNextStage.
   */
  _scheduleNextGrowth(x, y, crop) {
    const key = `${x},${y}`;

    // Clear existing timer for this key, if any
    if (this.growthTimers.has(key)) {
      this.growthTimers.get(key)?.remove();
      this.growthTimers.delete(key);
    }

    // Check if the crop has a next stage timestamp (must be a number)
    if (crop.cropNextStage && typeof crop.cropNextStage === 'number') {
      const delay = crop.cropNextStage - Date.now();

      // Only schedule if the next stage is in the future
      if (delay > 0) {
        const timer = this.scene.time.addEvent({
          delay: delay,
          callback: this._advanceCropStage,
          callbackScope: this,
          args: [x, y],
        });
        this.growthTimers.set(key, timer);
        // Debugging: Crop Data
        // console.debug(
        //   `[CropManager _scheduleNextGrowth] Scheduled growth for ` +
        //   `(${x},${y}) in ${delay}ms.`
        // );
      } else {
        // If delay is <= 0, the crop should ideally advance immediately.
        console.warn(
          `[CropManager _scheduleNextGrowth] Crop at (${x},${y}) ` +
          `next stage was in the past or now. Delay: ${delay}. ` +
          `Consider immediate advancement.`
        );
        // Optionally trigger advancement immediately:
        // this._advanceCropStage(x, y);
      }
    } else {
      // Crop is at final stage or has invalid next stage
      // Debugging: Crop Data
      // console.debug(
      //   `[CropManager _scheduleNextGrowth] Crop at (${x},${y}) ` +
      //   `is at final stage or has no next stage time. crop:`,
      //   crop
      // );
    }
  }

  /**
   * Advances the growth stage of a crop. Called by the growth timer.
   * @private
   * @param {number} x - The x-coordinate of the crop.
   * @param {number} y - The y-coordinate of the crop.
   */
  _advanceCropStage(x, y) {
    const key = `${x},${y}`;
    const crop = this.getCrop(x, y);

    // Remove the timer that just fired from the map
    this.growthTimers.delete(key);

    if (!crop) {
      console.warn(
        `[CropManager _advanceCropStage] Timer fired for non-existent crop ` +
        `at (${x},${y}).`
      );
      return;
    }

    // --- Check if it's time to advance --- //
    const currentTime = Date.now();
    const timeUntilNextStage = crop.cropNextStage
      ? crop.cropNextStage - currentTime : Infinity;
    const timeTolerance = 300; // Allow timer to fire up to 300ms early

    // Condition 1: Crop is already at final stage
    if (crop.cropNextStage === null) {
      console.warn(
        `[CropManager _advanceCropStage] ` +
        `Timer fired for crop at (${x},${y}) ` +
        `that is already at final stage.`
      );
      return;
    }

    // Condition 2: Timer fired significantly too early
    if (timeUntilNextStage > timeTolerance) {
      // Debugging: Crop Data
      // console.debug(
      //   `[CropManager _advanceCropStage] Timer fired early for crop ` +
      //   `(${x},${y}). Rescheduling in ${timeUntilNextStage}ms.`
      // );
      // Reschedule the timer for the remaining time
      const retryTimer = this.scene.time.addEvent({
        delay: timeUntilNextStage,
        callback: this._advanceCropStage,
        callbackScope: this,
        args: [x, y],
      });
      // Store the new timer reference
      this.growthTimers.set(key, retryTimer);
      return; // Stop processing this call
    }
    // --------------------------------------- //

    // If we reach here, it's time to advance the stage.

    // Get stage data needed for calculating next timestamp
    const stagesData = getCropData(crop.cropType, crop.cropLevel);
    if (!stagesData) {
      console.error(`[CropManager _advanceCropStage] Failed to get ` +
        `stagesData for ${crop.cropType} Lvl ${crop.cropLevel} ` +
        `at (${x},${y}). Cannot advance stage.`
      );
      return;
    }

    // Increment stage
    const newStage = crop.cropStage + 1;

    // Calculate the timestamp for the *next* next stage
    const plantTimeMs = new Date(crop.cropPlantedAt).getTime();
    if (isNaN(plantTimeMs)) {
      console.error(`[CropManager _advanceCropStage] Invalid ` +
        `plantTimeMs for crop at (${x},${y}).`
      );
      return;
    }
    const newNextStageTimestamp = _calculateNextStageTimestamp(
      stagesData,
      newStage,
      plantTimeMs
    );

    // Update crop data in the map (modifying the object reference directly)
    crop.cropStage = newStage;
    crop.cropNextStage = newNextStageTimestamp;

    // Debugging: Crop Data
    // console.debug(
    //   `[CropManager _advanceCropStage] Advanced crop ` +
    //   `at (${x},${y}) to stage ${newStage}. Next stage at: ` +
    //   `${newNextStageTimestamp}.`
    // );

    // Check if this is the final stage (next stage is null)
    if (newNextStageTimestamp === null) {
      // Debugging: Crop Data
      // console.debug(
      //   `[CropManager _advanceCropStage] Crop at (${x},${y}) ` +
      //   `reached final stage. Emitting event.`
      // );
      EventBus.emit('crop-final-stage', { x, y, cropState: { ...crop } });
    } else {
      // Schedule the timer for the *next* stage, if applicable
      this._scheduleNextGrowth(x, y, crop);
    }

    // Emit an event so UI/Renderer can update
    EventBus.emit('crop-stage-updated', {
      x,
      y,
      stage: crop.cropStage,
      nextStage: crop.cropNextStage,
      cropState: { ...crop } // Send a copy of the updated state
    });

    // Emit the full state map update AFTER the individual stage update
    this._emitCropStatesUpdate();
  }

  // --- Public Methods ---

  /**
   * Cleans up resources used by the CropManager.
   *
   * Removes any active growth timers and clears the crop data maps. Nullifies
   * the scene reference.
   */
  destroy() {
    // Leave for crop GC debugging
    // console.info('[CropManager] Destroying...');
    this.growthTimers.forEach((timer) => {
      if (timer) timer.remove(false);
    });
    this.growthTimers.clear();

    this.crops.clear();
    this.growthTimers.clear();

    this.scene = null;
  }

  /**
   * Loads and plants crops based on an array of tile data objects.
   *
   * Used for initializing crops from saved state or presets.
   * @param {object[]} tiles - An array of tile data objects. Each object
   *   should have properties like `x`, `y`, `cropType`, `cropPlantedAt`,
   *   `cropLevel`.
   * @throws {Error} If the tiles array is invalid or empty.
   */
  loadCrops(tiles) {
    if (!Array.isArray(tiles) || tiles?.length === 0)
      throw new Error('Invalid or empty tiles array provided to loadCrops');
    tiles.forEach(tile => {
      if (
        !Object.hasOwn(tile, 'cropType') ||
        !Object.hasOwn(tile, 'cropLevel') ||
        !Object.hasOwn(tile, 'cropPlantedAt') ||
        tile.cropType === null ||
        tile.cropLevel === null ||
        tile.cropPlantedAt === null
      ) {
        // for debugging
        // console.debug('Invalid tile object provided to loadCrops:', tile);
        return;
      }
      // Debugging: Crop Data
      //console.debug('Loading Crop for', tile);
      this.plantCrop(
        tile.x,
        tile.y,
        tile.cropType,
        tile.cropPlantedAt,
        tile.cropLevel,
      );
    });
    // Emit the initial state after loading all crops
    this._emitCropStatesUpdate();
  }

  /**
   * Gets or creates the inner Map for a given x-coordinate row.
   * @param {number} x - The x-coordinate.
   * @returns {Map<number, CropState>} The Map storing crops for the given
   *   row.
   * @private
   */
  getOrCreateRow(x) {
    if (!this.crops.has(x))
      this.crops.set(x, new Map());
    return this.crops.get(x);
  }

  /**
   * Checks if a crop exists at the specified coordinates.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {boolean} True if a crop exists, false otherwise.
   */
  hasCrop(x, y) {
    const row = this.crops.get(x);
    return row ? row.has(y) : false;
  }

  /**
   * Retrieves the crop data object for the specified coordinates.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {CropState | undefined} The crop data object, or undefined if no
   *   crop exists.
   */
  getCrop(x, y) {
    const row = this.crops.get(x);
    return row ? row.get(y) : undefined;
  }

  /**
   * Retrieves the crop data for multiple tiles.
   * @param {Array<{x: number, y: number}>} tiles - An array of tile
   *   coordinates.
   * @returns {Array<CropState | null>} An array containing the crop data
   *   object for each corresponding input tile, or null if no crop exists at
   *   that location. Returns empty array if input is invalid.
   */
  getInfoForTiles(tiles) {
    if (!Array.isArray(tiles)) {
      console.warn(
        '[CropManager getInfoForTiles] Invalid input: Expected an array.'
      );
      return [];
    }
    if (tiles.length === 0) {
      return []; // Nothing to get info for
    }

    const results = tiles.map((tile) => {
      if (typeof tile?.x === 'number' && typeof tile?.y === 'number') {
        return this.getCrop(tile.x, tile.y) || null; // Return crop data or null
      } else {
        console.warn(
          `[CropManager getInfoForTiles] Invalid tile coordinate object in ` + `input array:`,
          tile
        );
        return null; // Invalid coordinate object
      }
    });

    return results;
  }

  /**
   * Plants a new crop at the given coordinates.
   *
   * Validates input, calculates initial state, stores crop data,
   * and updates the scene to display the crop sprite.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {string} cropType - The type identifier of the crop (e.g., 'wheat').
   * @param {number} [cropPlantTime] - Optional specific timestamp when the
   *   crop was planted. If not provided, the server likely set it.
   * @param {number} [cropLevel=1] - Optional starting level of the crop.
   *   Defaults to 1 if not specified.
   * @returns {boolean} True if the crop was planted successfully, false
   *   otherwise.
   * @throws {Error} If the scene is invalid.
   * @throws {Error} If the cropType or cropLevel is invalid or data is
   *   missing.
   */
  plantCrop(
    x,
    y,
    cropType,
    cropPlantTime,
    cropLevel = 1, // Default level to 1
  ) {
    this._validatePlantCropInput(cropType, cropLevel);

    if (this.hasCrop(x, y)) {
      // Keep for reload state
      console.warn(`Crop already exists at (${x}, ${y}). Cannot plant again.`);
      return false;
    }

    // Prepare crop data, passing the provided or default cropLevel
    const crop = this._prepareCropData(
      cropType,
      cropPlantTime,
      cropLevel // Pass the level (could be 1 or from loadCrops)
    );

    // Error logged in _prepareCropData
    if (!crop) {
      return false;
    }

    // Store the crop data
    this.getOrCreateRow(x).set(y, crop);

    // Debugging: Crop Data
    // console.debug(
    //   `[CropManager] Planted ${cropType} at (${x}, ${y}) successfully.`
    // );

    // --- Schedule the first growth timer --- //
    this._scheduleNextGrowth(x, y, crop);
    // --------------------------------------- //

    // Emit state update AFTER planting and scheduling
    this._emitCropStatesUpdate();

    return true;
  }

  /**
   * Emits an event to signal that a specific tile might need its data
   * refreshed from the server because its growth time should be up.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   */
  requestCropUpdateCheck(x, y) {
    // EventBus import might be needed if not already present globally
    // Assuming EventBus is globally accessible or imported
    EventBus.emit('request-tile-update', { x, y });
  }

  /**
   * Harvests a crop at the specified coordinates.
   *
   * Removes the crop data, associated timer (if any), and instructs the scene
   * to remove the sprite.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {boolean} True if a crop was successfully harvested, false
   *   otherwise.
   */
  harvestCrop(x, y) {
    // Debugging: Crop Data
    // console.debug(
    //   `Attempting harvest at (${x}, ${y}). Crop state:`, this.getCrop(x, y)
    // );

    const removedCrop = this._deleteCropState(x, y);

    if (!removedCrop) {
      console.warn(
        `[CropManager harvestCrop] No crop found at (${x}, ${y}) to harvest.`
      );
      return false; // No crop to harvest
    }

    // Debugging: Crop Data
    // console.debug(`Harvested crop at (${x}, ${y})`);

    // Emit event or return data indicating successful harvest
    EventBus.emit('crop-harvested', {
      x,
      y,
      harvestedCrop: { ...removedCrop }
    }); // Send copy

    // State update is handled within _deleteCropState now
    // this._emitCropStatesUpdate();

    return true; // Indicate successful removal
  }

  /**
   * Removes a crop from the specified coordinates.
   *
   * This is typically called when the server indicates a crop should be removed
   * (e.g., due to clearing rubble, external actions, or receiving null data).
   * It removes the crop data and associated timer, but doesn't trigger harvest
   * events.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {boolean} True if a crop was found and removed, false otherwise.
   */
  removeCrop(x, y) {
    const removedCrop = this._deleteCropState(x, y);
    // State update is handled within _deleteCropState now
    return !!removedCrop; // Return true if something was removed
  }

  /**
   * Updates an existing crop's state based on data received from the server.
   * Recalculates stage, next stage time, and reschedules the growth timer.
   * Assumes the crop already exists at the given coordinates.
   *
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {object} serverUpdates - An object containing the updated
   *   properties from the server (e.g., { cropType, cropPlantedAt,
   *   cropLevel }). Must include `cropPlantedAt`.
   * @returns {boolean} True if the update was successful, false otherwise.
   */
  updateCropFromServer(x, y, serverUpdates) {
    const logPrefix = `[CropManager updateCropFromServer (${x},${y})]`;
    const existingCrop = this.getCrop(x, y);

    if (!existingCrop) {
      console.warn(`${logPrefix} Cannot update: No crop found.`);
      return false;
    }

    // Validate required update fields (similar to _processCropUpdate checks)
    // Only check for cropPlantedAt property
    // Handle SpeedGrow updates
    if (!serverUpdates.cropPlantedAt) {
      console.warn(
        `${logPrefix} Invalid server update data received:`,
        serverUpdates
      );
      return false;
    }

    // 1. Recalculate stage and next stage based on NEW server data
    // We can reuse part of the _prepareCropData logic or call it directly
    // Let's recalculate directly for clarity
    const { cropStage, cropNextStage } = calculateCropStageInfo(
      // Use new or existing values
      serverUpdates.cropType ?? existingCrop.cropType,
      serverUpdates.cropPlantedAt ?? existingCrop.cropPlantedAt,
      serverUpdates.cropLevel ?? existingCrop.cropLevel
    );

    if (isNaN(cropStage) || isNaN(cropNextStage)) {
      console.warn(
        `${logPrefix} Invalid calculated stage/next stage ` +
        `from server data. Stage: ${cropStage}, Next: ${cropNextStage}`
      );
      // Keep existing state? Or revert? For now, log and return false.
      return false;
    }

    // 2. Update the existing crop object IN-PLACE
    if (serverUpdates.cropType) {
      existingCrop.cropType = serverUpdates.cropType;
    }
    if (serverUpdates.cropPlantedAt) {
      existingCrop.cropPlantedAt = serverUpdates.cropPlantedAt;
    }
    if (serverUpdates.cropLevel) {
      existingCrop.cropLevel = serverUpdates.cropLevel;
    }

    existingCrop.cropStage = cropStage;
    existingCrop.cropNextStage = cropNextStage;

    // Debugging: Log Update
    // console.debug(
    //   `${logPrefix} Updated crop state from server:`,
    //   { ...existingCrop } // Log a copy
    // );

    // 3. Reschedule the growth timer based on the new state
    this._scheduleNextGrowth(x, y, existingCrop);

    // 4. Emit an event to notify UI/Renderer of the update
    // Use 'crop-stage-updated' as it reflects the state change? Or a new event?
    // Let's use 'crop-stage-updated' for consistency.
    EventBus.emit('crop-stage-updated', {
      x,
      y,
      stage: existingCrop.cropStage,
      nextStage: existingCrop.cropNextStage,
      cropState: { ...existingCrop } // Send a copy
    });

    // Emit the full state map update AFTER the individual update
    this._emitCropStatesUpdate();

    return true;
  }
}