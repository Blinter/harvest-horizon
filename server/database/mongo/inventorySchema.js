/**
 * @file Mongoose schema definition for Inventories.
 * @module server/database/mongo/inventorySchema
 * @description Defines the structure for inventory documents in MongoDB,
 *   linked to a Character document.
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema definition for player inventories. Represents the items
 * held by a character.
 *
 * @typedef {object} InventorySchemaDef
 * @property {mongoose.Types.ObjectId} characterId Reference to the associated
 *   Character document. Required and indexed for efficient lookups.
 * @property {Date} lastUpdated Timestamp indicating the last time the
 *   inventory was modified. Defaults to the current time.
 * @property {number} capacity The maximum number of distinct item slots this
 *   inventory can hold. Defaults to 10.
 * @property {number} level The current level of the inventory, potentially
 *   affecting capacity or other features. Defaults to 1, minimum value is 1.
 * @property {Array<ItemSubdocument>} items An array containing the items
 *   currently stored in the inventory.
 * @property {Date} createdAt Timestamp automatically managed by Mongoose,
 *   indicating when the document was first created.
 * @property {Date} updatedAt Timestamp automatically managed by Mongoose,
 *   indicating the last time the document was updated.
 */

/**
 * Defines the structure for an individual item within the inventory's items
 * array.
 *
 * @typedef {object} ItemSubdocument
 * @property {string} itemType The general category of the item (e.g., 'crop',
 *   'seed', 'tool'). Required.
 * @property {string} itemName The specific name identifying the item within
 *   its type (e.g., 'wheat', 'watering_can'). Required.
 * @property {number} quantity The number of units of this specific item held.
 *   Must be zero or greater. Required.
 */
export const inventorySchema = new mongoose.Schema({
  /**
   * Reference to the owning Character document. Ensures each inventory is
   * linked to a specific character.
   * @type {mongoose.Schema.Types.ObjectId}
   * @ref Character
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
   * Timestamp of the last inventory update. Used to track modification times.
   * @type {Date}
   * @default Date.now
   */
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  /**
   * Maximum number of distinct item stacks the inventory can hold. Influences
   * how many different types of items can be stored.
   * @type {number}
   * @default 10
   * @min 0 // Technically capacity could be 0, though likely starts > 0
   */
  capacity: {
    type: Number,
    default: 10, // Default capacity
    min: 0,      // Minimum possible capacity
  },
  /**
   * Represents the inventory's level, potentially unlocking higher capacity
   * or other benefits. Starts at level 1.
   * @type {number}
   * @min 1
   * @default 1
   * @required
   */
  level: {
    type: Number,
    min: 1,
    default: 1,
    required: true,
  },
  /**
   * Array storing the actual items in the inventory. Each element represents a
   * stack of a unique item type and name combination.
   * @type {ItemSubdocument[]}
   */
  items: [
    {
      /**
       * The general category of the item (e.g., 'crop', 'seed'). Helps in
       * organizing and filtering items.
       * @type {string}
       * @required
       */
      itemType: {
        type: String,
        required: true,
      },
      /**
       * The specific, unique name of the item (e.g., 'wheat', 'corn_seed').
       * Distinguishes items within the same type.
       * @type {string}
       * @required
       */
      itemName: {
        type: String,
        required: true,
      },
      /**
       * The quantity of this specific item held in the stack. Cannot be
       * negative.
       * @type {number}
       * @min 0
       * @required
       */
      quantity: {
        type: Number,
        min: 0, // Items can have a quantity of 0 (e.g., placeholder)
        required: true,
      },
    },
  ],
});

/**
 * Mongoose pre-save middleware for the inventorySchema.
 * Ensures that within the `items` array, the combination of `itemType` and
 * `itemName` is unique. This prevents duplicate entries for the exact same
 * item (e.g., two separate entries for 'seed'/'wheat').
 *
 * This validation only runs if the `items` array has been modified.
 *
 * @param {Function} next - The callback function to proceed to the next
 *   middleware or save operation. Passes an error if duplicates are found.
 */
inventorySchema.pre('save', function (next) {
  // Only run validation if the items array was modified
  if (!this.isModified('items')) {
    return next();
  }

  const items = this.items;
  const seen = new Set();
  let hasDuplicates = false;

  for (const item of items) {
    // Convert itemType and itemName to strings safely
    const getStringRepresentation = (value) => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      return typeof value === 'object' ?
        JSON.stringify(value) : String(value);
    };

    const itemTypeStr = getStringRepresentation(item.itemType);
    const itemNameStr = getStringRepresentation(item.itemName);
    const key = `${itemTypeStr}:::${itemNameStr}`; // Use a delimiter

    if (seen.has(key)) {
      hasDuplicates = true;
      break;
    }
    seen.add(key);
  }

  if (hasDuplicates) {
    // If duplicates are found, prevent saving by passing an error to next()
    const err = new Error(
      'Inventory validation failed: Duplicate itemType and itemName combination found.'
    );
    // Optionally add more context to the error
    // err.errors = { items: { message: '...' } }; 
    return next(err);
  }

  // If no duplicates, proceed with saving
  next();
});

/**
 * Mongoose model representing the 'Inventory' collection.
 * Provides an interface for CRUD operations on inventory documents, adhering
 * to the defined `inventorySchema`.
 *
 * @type {Object}
 */
export default mongoose.model('Inventory', inventorySchema);
