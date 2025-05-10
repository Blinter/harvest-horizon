/**
 * @file RentManager.js
 * @description Manages rent due timers and state within a Phaser scene.
 * @module RentManager
 */

import { EventBus } from './EventBus.js';
// eslint-disable-next-line no-unused-vars -- Used in JSDoc types
import { TileRentState } from './types/TileRentState.js';

/**
 * Manages tracking of rent due dates for tiles using Phaser timers.
 * Emits an event when a tile's rent becomes due.
 * @class RentManager
 */
export class RentManager {
  /**
   * Creates a RentManager instance.
   * @param {Phaser.Scene} scene - The Phaser scene this manager belongs to.
   * @throws {Error} If the scene is undefined.
   */
  constructor(scene) {
    /**
     * @property {Phaser.Scene} scene
     * The associated Phaser scene instance.
     */
    this.scene = scene;
    if (!this.scene) {
      throw new Error('[RentManager] Scene is undefined during construction.');
    }

    /**
     * @property {Map<string, TileRentState>} tileRentStates
     * Stores rent state for tiles, keyed by "x,y".
     * Includes nextRentDue timestamp and the associated timer event.
     */
    this.tileRentStates = new Map();
  }

  // --- Private Helper Methods ---

  /**
   * Callback function executed when a rent timer expires.
   * Checks if rent is still applicable and emits the 'rent-due' event.
   * @private
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   */
  _handleRentTimerExpiration(x, y) {
    const key = `${x},${y}`;
    const rentState = this.tileRentStates.get(key);

    // Timer fired, remove it from the state map *before* checks
    if (rentState) {
      rentState.timer = null; // Clear the timer reference from the state
    } else {
      // Should not happen if timer exists, but safety check
      console.warn(
        `[RentManager] Timer expired for non-existent rent state at ` +
        `(${x},${y}).`
      );
      return;
    }

    // Check if rent is actually due (could have been paid early)
    // Note: This check might be redundant if addOrUpdateTile always clears
    // the timer on payment. However, it's a good safety measure.
    const currentTime = Date.now();
    if (rentState.nextRentDue &&
      currentTime >= new Date(rentState.nextRentDue).getTime()) {
      // Debugging: Rent Due
      // console.debug(
      //   `[RentManager] Rent timer expired for ` +
      //   `(${x},${y}). Emitting 'rent-due'.`
      // );
      EventBus.emit('rent-due', { x, y, nextRentDue: rentState.nextRentDue });
    } else {
      // Debugging: Rent Paid Early or Invalid State
      // console.debug(
      //   `[RentManager] Rent timer expired for (${x},${y}), ` +
      //   `but rent is not currently due (paid early or state invalid). ` +
      //   `Next due: ${rentState.nextRentDue}`
      // );
    }
  }

  /**
   * Clears any existing Phaser timer associated with a tile.
   * @private
   * @param {string} key - The "x,y" key for the tile.
   */
  _clearExistingTimer(key) {
    if (this.tileRentStates.has(key)) {
      const state = this.tileRentStates.get(key);
      if (state.timer) {
        state.timer.remove(false); // remove(false) prevents the callback from firing
        state.timer = null; // Clear the reference
        // Debugging: Timer Cleared
        // console.debug(`[RentManager] Cleared existing rent timer for key: ${key}`);
      }
    }
  }

  /**
   * Emits the current rent states via the EventBus.
   * @private
   */
  _emitRentStatesUpdate() {
    // Convert Map to a plain object or array if needed for React state,
    // although Map might be usable directly depending on React 
    // version/handling.
    // Let's send the Map directly for now.
    EventBus.emit('rent-states-updated', new Map(this.tileRentStates));
  }

  // --- Public Methods ---

  /**
   * Loads initial rent states from an array of tile data.
   * Clears existing states and timers before loading.
   * Schedules timers for tiles with future rent due dates.
   * @param {Array<object>} tileDataArray - An array of tile data objects,
   *   each expected to have x, y, and potentially properties.nextRentDue.
   */
  load(tileDataArray) {
    const logPrefix = '[RentManager load]';
    // Keep for debugging
    // console.debug(
    //   `${logPrefix} Loading initial rent states ` +
    //   `for ${tileDataArray.length} tiles.`
    // );

    // 1. Clear existing state and timers
    this.tileRentStates.forEach((state) => {
      if (state.timer) {
        state.timer.remove(false);
      }
    });
    this.tileRentStates.clear();

    // 2. Process each tile in the input array
    tileDataArray.forEach(tile => {
      if (!tile || typeof tile.x !== 'number' || typeof tile.y !== 'number') {
        console.warn(`${logPrefix} Skipping invalid tile data entry:`, tile);
        return; // Skip this entry
      }

      const key = `${tile.x},${tile.y}`;
      const nextRentDue = tile.properties?.nextRentDue; // Safely access nested property

      // --- Validate and Parse nextRentDue ---
      let nextRentDueTimestamp = null;
      if (nextRentDue) {
        const parsedDate = new Date(nextRentDue);
        if (!isNaN(parsedDate.getTime())) {
          nextRentDueTimestamp = parsedDate.getTime();
        } else {
          // Don't warn for every tile during bulk load, maybe log once?
          // console.warn(`${logPrefix} (${key}) Invalid nextRentDue:`, nextRentDue);
        }
      }
      // --------------------------------------

      // Create the state entry (timer is null initially)
      const newState = {
        nextRentDue: nextRentDueTimestamp,
        timer: null,
      };
      this.tileRentStates.set(key, newState);

      // Schedule a timer only if nextRentDue is valid and in the future
      if (nextRentDueTimestamp) {
        const delay = nextRentDueTimestamp - Date.now();
        if (delay > 0) {
          newState.timer = this.scene.time.addEvent({
            delay: delay,
            callback: this._handleRentTimerExpiration,
            callbackScope: this,
            args: [tile.x, tile.y],
          });
          // Debugging: Timer Scheduled during load
          // console.debug(`${logPrefix} (${key}) Scheduled timer in ${delay}ms.`);
        } else {
          // Debugging: Rent past due during load
          // console.debug(`${logPrefix} (${key}) Rent due date is past or now. No future timer.`);
          // Rent due dates in the past during initial load will be handled
          // by other game logic or UI elements based on the initial state.
          // We don't need to emit 'rent-due' directly here.
        }
      }
    }); // End of forEach loop

    // 3. Emit a single update event after processing all tiles
    this._emitRentStatesUpdate();
    // Keep for debugging
    // console.debug(
    //   `${logPrefix} Finished loading ` +
    //   `${this.tileRentStates.size} rent states.`
    // );
  }

  /**
   * Adds or updates the rent state for a specific tile.
   * Clears any existing timer and schedules a new one if nextRentDue is valid
   * and in the future.
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   * @param {string | number | Date | null} nextRentDue - The timestamp when
   *   rent is next due. Can be a string, number (ms), Date object, or 
   * null/undefined.
   */
  addOrUpdateTile(x, y, nextRentDue) {
    const key = `${x},${y}`;
    const logPrefix = `[RentManager addOrUpdateTile (${key})]`;

    // --- Validate and Parse nextRentDue ---
    let nextRentDueTimestamp = null;
    if (nextRentDue) {
      const parsedDate = new Date(nextRentDue);
      if (!isNaN(parsedDate.getTime())) {
        nextRentDueTimestamp = parsedDate.getTime();
      } else {
        console.warn(
          `${logPrefix} Invalid nextRentDue value received:`,
          nextRentDue
        );
        // If invalid, treat as if rent is not applicable for timer scheduling
      }
    }
    // --------------------------------------

    // Clear any existing timer for this tile *before* updating state
    this._clearExistingTimer(key);

    // Update or create the state entry
    const newState = {
      nextRentDue: nextRentDueTimestamp, // Store as timestamp number or null
      timer: null, // Initialize timer as null
    };
    this.tileRentStates.set(key, newState);

    // Schedule a new timer only if nextRentDue is valid and in the future
    if (nextRentDueTimestamp) {
      const delay = nextRentDueTimestamp - Date.now();

      if (delay > 0) {
        const timer = this.scene.time.addEvent({
          delay: delay,
          callback: this._handleRentTimerExpiration,
          callbackScope: this,
          args: [x, y],
        });
        newState.timer = timer; // Store the new timer reference
        // Debugging: Timer Scheduled
        // console.debug(
        //   `${logPrefix} Scheduled rent timer in ${delay}ms ` +
        //   `for timestamp ${nextRentDueTimestamp}.`
        // );
      } else {
        // Rent is already past due or due now. Timer callback will handle emit.
        // We can optionally emit immediately if we want instant feedback
        // upon receiving a past-due date. Let's rely on the timer for 
        // consistency for now.
        // console.debug(
        //   `${logPrefix} Rent due date is in the past or now ` +
        //   `(delay: ${delay}ms). No future timer scheduled.`
        // );
        // Optionally, trigger the check immediately if past due
        this._handleRentTimerExpiration(x, y);
      }
    } else {
      // Debugging: No Due Date
      // console.debug(`${logPrefix} No valid future rent due date provided. No timer scheduled.`);
    }

    // Emit state update after changes
    this._emitRentStatesUpdate();
  }

  /**
   * Removes the rent state and cancels any timer for a specific tile.
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   */
  removeTile(x, y) {
    const key = `${x},${y}`;
    this._clearExistingTimer(key); // Ensure timer is cleared first
    const deleted = this.tileRentStates.delete(key);
    if (deleted) {
      console.debug(`[RentManager removeTile] Removed rent state for (${x},${y}).`);
      // Emit state update after changes
      this._emitRentStatesUpdate();
    }
  }

  /**
   * Retrieves the stored rent due timestamp for a tile.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {number | null} The next rent due timestamp (ms since epoch),
   *   or null if not tracked or no date set.
   */
  getRentDueDate(x, y) {
    const key = `${x},${y}`;
    const state = this.tileRentStates.get(key);
    return state ? state.nextRentDue : null;
  }

  /**
   * Cleans up all active timers and clears the state map.
   * Should be called when the scene shuts down.
   */
  destroy() {
    // Leave for rent GC debugging
    // console.info('[RentManager] Destroying...');
    this.tileRentStates.forEach((state, _key) => {
      if (state.timer) {
        state.timer.remove(false); // remove(false) prevents callback
      }
    });
    this.tileRentStates.clear();
    this.scene = null; // Release scene reference
    // Emit a final empty state update on destroy
    this._emitRentStatesUpdate();
  }
}
