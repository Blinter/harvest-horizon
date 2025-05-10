/**
 * @file TileRentState.js
 * @description Defines the type for storing rent state information for a tile.
 * @module types/TileRentState
 */

// eslint-disable-next-line no-unused-vars
import Phaser from 'phaser';
/**
 * Represents the rent-related state tracked for a single tile. This includes
 * when the next rent payment is due and a reference to the timer managing that
 * event.
 *
 * @typedef {object} TileRentState
 * @property {number | null} nextRentDue - The timestamp (milliseconds since
 *   epoch) when rent is next due for this tile. Null if rent is not applicable
 *   or not currently scheduled.
 * @property {Phaser.Time.TimerEvent | null} timer - A reference to the active
 *   Phaser timer event scheduled to fire when rent becomes due. Null if no
 *   timer is currently active for this tile.
 */

export const TileRentState = {};
