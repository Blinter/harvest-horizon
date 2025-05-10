/**
 * @file Mongoose schema definition for Game Maps.
 * @module server/database/mongo/mapSchema
 * @description Defines the structure for map documents in MongoDB,
 *   representing individual game maps linked to a Character. Includes a
 *   pre-save hook to generate initial tile data.
 */

import mongoose from 'mongoose';
import { generateRandomMap } from '../../library/mapHelpers.js';

/**
 * Mongoose schema for game map data.
 *
 * @typedef {object} MapSchema
 * @property {mongoose.Schema.Types.ObjectId} characterId - Reference to the
 *   owning Character document. Required, indexed.
 * @property {string} mapNickname - User-defined nickname for the map.
 *   Required, unique, default: 'Default Map'.
 * @property {boolean} isFavorite - Flag indicating if this is the
 *   character's favorite/primary map (default: false).
 * @property {number} maxWidth - Maximum width of the map grid (default: 7).
 * @property {number} maxHeight - Maximum height of the map grid (default: 7).
 * @property {number} maxCoordsLeasable - Maximum number of tiles the
 *   character can lease on this map (default: 81).
 * @property {number} leasedTiles - Number of tiles currently leased by the
 *   character (default: 0).
 * @property {number} rentCostPerTile - Cost per tile for rent calculation
 *   (default: 1).
 * @property {Date} nextRentDue - Timestamp when the next rent payment is due
 *   (default: 1 day from creation).
 * @property {number} totalSpent - Total currency spent on this map (e.g.,
 *   leasing tiles) (default: 0).
 * @property {object} debuffs - Object storing active debuffs affecting the
 *   map (default: {}).
 * @property {object} variables - Generic object for storing map-specific
 *   variables (default: {}).
 * @property {object} tiles - Object representing the map grid, where keys
 *   are coordinates (e.g., 'x,y') and values are tile data objects.
 *   Generated on creation if empty.
 * @property {Date} createdAt - Timestamp of document creation (managed by
 *   Mongoose).
 * @property {Date} updatedAt - Timestamp of last document update (managed by
 *   Mongoose).
 */
export const mapSchema = new mongoose.Schema(
  {
    /**
     * Reference to the owning Character document.
     * @type {object}
     * @required
     * @index
     */
    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Character',
      required: true,
      index: true,
    },
    /**
     * User-defined nickname for the map.
     * @type {string}
     * @required
     * @default 'Default Map'
     */
    mapNickname: {
      type: String,
      required: true,
      default: 'Default Map',
    },
    /**
     * Flag indicating if this is the character's favorite/primary map.
     * @type {boolean}
     * @default false
     */
    isFavorite: {
      type: Boolean,
      default: false,
      required: false, // Optional field
    },
    /**
     * Maximum width of the map grid.
     * @type {number}
     * @required
     * @default 7
     */
    maxWidth: {
      type: Number,
      required: true,
      default: 3,
    },
    /**
     * Maximum height of the map grid.
     * @type {number}
     * @required
     * @default 7
     */
    maxHeight: {
      type: Number,
      required: true,
      default: 3,
    },
    /**
     * Maximum number of tiles in area that can be leased.
     * @type {number}
     * @required
     * @default 81
     */
    maxCoordsLeasable: {
      type: Number,
      required: true,
      default: 27,
    },
    /**
     * Number of tiles currently leased by the character.
     * @type {number}
     * @required
     * @default 0
     */
    leasedTiles: {
      type: Number,
      required: true,
      default: 0,
    },
    /**
     * Cost per tile for rent calculation.
     * @type {number}
     * @required
     * @default 1
     */
    rentCostPerTile: {
      type: Number,
      required: true,
      default: 1,
    },
    /**
     * Timestamp when the next rent payment is due. Defaults to one day from
     * creation.
     * @type {Date}
     * @required
     * @default Date.now() + 1 day // Mongoose handles the default via schema
     */
    nextRentDue: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to 1 day from now
    },
    /**
     * Total currency spent on this map (e.g., leasing tiles, speeding
     * crops, paying rent).
     * @type {number}
     * @required
     * @default 0
     */
    totalSpent: {
      type: Number,
      required: true,
      default: 0,
    },
    /**
     * Object storing active debuffs affecting the map.
     * Structure depends on specific debuff implementation.
     * @type {object}
     * @default {}
     */
    debuffs: {
      type: Object,
      required: false,
      default: {},
    },
    /**
     * Generic object for storing map-specific variables or flags.
     * @type {object}
     * @default {}
     */
    variables: {
      type: Object,
      required: false,
      default: {},
    },
    /**
     * Object representing the map grid.
     * Keys are coordinate strings (e.g., "x,y").
     * Values are tile data objects (structure defined elsewhere or
     * implicitly). Generated by pre-save hook if map is new and tiles
     * are empty.
     * @type {object}
     * @required
     * @default {}
     */
    tiles: {
      type: Object,
      required: true,
      default: {},
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt timestamps
);

// Add compound index for characterId and mapNickname uniqueness
mapSchema.index({ characterId: 1, mapNickname: 1 }, { unique: true });

/**
 * Mongoose middleware (pre hook) for `save`.
 * If the document is new (`isNew` is true) and the `tiles` object is
 * empty, it generates the initial map layout using `generateRandomMap`
 * from mapHelpers.
 *
 * @function preSaveHook
 * @param {Function} next - Callback function to continue the save
 *   operation.
 * @listens Map.save
 */
mapSchema.pre('save', function (next) {
  // Only generate tiles if the document is new and tiles are not already set
  if (this.isNew && (!this.tiles || Object.keys(this.tiles).length === 0)) {
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'mapSchema.pre.save',
        message: 'Generating initial map tiles...',
        context: {
          mapNickname: this.mapNickname,
          width: this.maxWidth,
          height: this.maxHeight,
        },
      });
      const mapData = generateRandomMap({
        width: this.maxWidth,
        height: this.maxHeight,
        maxCoordsLeasable: this.maxCoordsLeasable,
      });
      this.tiles = mapData;
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'mapSchema.pre.save',
        message: 'Initial map tiles generated successfully.',
        context: {
          mapNickname: this.mapNickname,
          tileCount: Object.keys(this.tiles).length,
        },
      });
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'mapSchema.pre.save',
        message: 'Error generating initial map tiles.',
        context: {
          mapNickname: this.mapNickname,
          error: error.message,
          stack: error.stack,
        },
      });
      // Pass the error to next() to stop the save operation
      return next(error);
    }
  }
  // If no error occurred or generation wasn't needed,
  // proceed with saving
  next();
});

/**
 * Mongoose model for the Map schema.
 *
 * @type {object}
 */
export default mongoose.model('Map', mapSchema);
