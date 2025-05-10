/**
 * @file Mongoose schema definition for Characters.
 * @module server/database/mongo/characterSchema
 * @description Defines the structure for character documents in MongoDB,
 *   including fields for name, level, experience, skills, attributes,
 *   and equipment. Also includes a middleware hook to cascade deletes
 *   to related documents (Inventory, Wallet, Map, StatusLog).
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for character data.
 *
 * @typedef {object} CharacterSchema Represents a character in the game.
 * @property {string} name Character's name (required, trimmed).
 *   *Note: Uniqueness is enforced per user at the application level.*
 * @property {number} level Character's level (default: 1, min: 1).
 * @property {number} experience Character's current experience points
 *   (default: 0).
 * @property {Map<string, number>} skills Map of skill names to skill
 *   levels (default: {'wheatLevel': 1}).
 * @property {object} attributes Object containing character attributes.
 * @property {number} attributes.agility Agility attribute (default: 5).
 * @property {Map<string, string>} equipment Map of equipment slots to
 *   item IDs (default: empty).
 * @property {Date} createdAt Timestamp of document creation
 *   (managed by Mongoose).
 * @property {Date} updatedAt Timestamp of last document update
 *   (managed by Mongoose).
 * @property {boolean} favorite_character Tracks if this is the user's
 *   favorite character (default: false).
 * @property {boolean} favorite_character.index Index for potential
 *   lookups based on favorite status.
 */
export const characterSchema = new mongoose.Schema(
  {
    /**
     * Character's name.
     * @type {string}
     * @required
     * @trim
     */
    name: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * Character's level.
     * @type {number}
     * @default 1
     * @min 1
     */
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    /**
     * Character's current experience points.
     * @type {number}
     * @default 0
     */
    experience: {
      type: Number,
      default: 0,
    },
    /**
     * Map of skill names to skill levels.
     * Default includes 'wheatLevel' at 1.
     * @type {object}
     * @default {'wheatLevel': 1}
     */
    skills: {
      type: Map,
      of: Number,
      default: {
        'wheatLevel': 1,
      },
    },
    /**
     * Object containing character attributes.
     */
    attributes: {
      /**
       * Agility attribute.
       * @type {number}
       * @default 5
       */
      agility: {
        type: Number,
        default: 5,
      },
    },
    /**
     * Map of equipment slots (e.g., 'hand', 'head') to item IDs.
     * @type {object}
     * @default {}
     */
    equipment: {
      type: Map,
      of: String,
      default: {},
    },
    // Added: Track if this is the user's favorite character
    /**
     * Indicates if this is the user's preferred character.
     * Indexed for faster lookups if needed.
     * @type {boolean}
     * @default false
     * @index
     */
    favorite_character: {
      type: Boolean,
      default: false,
      index: true, // Index for potential lookups based on favorite status
    },
  },
  {
    /** Add `createdAt` and `updatedAt` timestamps */
    timestamps: true,
  }
);

/**
 * Mongoose middleware (post hook) for `findOneAndDelete`.
 * When a Character document is deleted, this hook automatically deletes
 * the associated Inventory, Wallet, Map, and StatusLog documents to
 * maintain data integrity.
 *
 * @function findOneAndDeleteMiddleware
 * @param {mongoose.Document} doc The deleted character document.
 * @listens Character.findOneAndDelete
 * @async
 */
characterSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const Inventory = mongoose.model('Inventory');
    const Wallet = mongoose.model('Wallet');
    const MapModel = mongoose.model('Map');
    const StatusLog = mongoose.model('StatusLog');

    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'characterSchema.post.findOneAndDelete',
        message: `Attempting cascading delete for Character ${doc._id}...`,
      });
      await Promise.all([
        Inventory.findOneAndDelete({ characterId: doc._id }),
        Wallet.findOneAndDelete({ characterId: doc._id }),
        MapModel.findOneAndDelete({ characterId: doc._id }),
        StatusLog.findOneAndDelete({ characterId: doc._id }),
      ]);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'characterSchema.post.findOneAndDelete',
        message: `Cascading delete successful for Character ${doc._id}.`,
      });
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'characterSchema.post.findOneAndDelete',
        message:
          `Error during cascading delete for Character ${doc._id}. ` +
          `Related documents might remain.`,
        context: {
          characterId: doc._id,
          error: error.message,
          stack: error.stack,
        },
      });
    }
  }
});

/**
 * Mongoose model for the Character schema.
 * Represents the 'characters' collection in MongoDB.
 *
 * @type {object}
 */
export default mongoose.model('Character', characterSchema);
