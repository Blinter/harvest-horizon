/**
 * @file Mongoose schema definition for Market Listings.
 * @module server/database/mongo/marketSchema
 * @description Defines the structure for market listing documents in MongoDB,
 *   representing items available for purchase.
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for market listing data. This defines the structure used to
 * represent items available for purchase or sale in the game's market system.
 * Each document corresponds to a specific type of item with its associated
 * pricing and metadata.
 *
 * @typedef {object} MarketSchema Represents a market listing in the database.
 * @property {string} itemName The specific name of the item being sold (e.g.,
 *   'wheat', 'unlock'). This is a required field and serves as a key
 *   identifier for the item within its type.
 * @property {string} itemType The category of the item. Valid types include
 *   'crop', 'seed', or 'mapTile'. This field is required and constrained by an
 *   enum.
 * @property {number} currentPrice The current selling or buying price of the
 *   item in the specified currency. Must be a non-negative number. Required.
 * @property {Date} lastUpdated Timestamp indicating the last time the item's
 *   price or details were updated. Defaults to the time of the update
 *   operation.
 * @property {string} currency The currency used for the transaction price.
 *   Currently, only 'coins' is supported. This field is required and
 *   constrained by an enum.
 * @property {boolean} isPurchasable Indicates if the item can be bought by
 *   players from the market. Defaults to true. Some items, like harvested
 *   crops sold *to* the market, might have a price but not be purchasable
 *   *from* the market.
 * @property {Date} createdAt Timestamp automatically managed by Mongoose,
 *   recording when the document was first created.
 * @property {Date} updatedAt Timestamp automatically managed by Mongoose,
 *   recording the time of the last update to the document.
 */
export const marketSchema = new mongoose.Schema(
  {
    /**
     * The specific, unique name identifying the item being listed in the
     * market (e.g., 'wheat', 'corn_seeds', 'grassland_tile'). Used in
     * conjunction with `itemType` for lookup.
     * @type {string}
     * @required
     */
    itemName: {
      type: String,
      required: true,
    },
    /**
     * The general category or type of the item. This helps differentiate
     * between items like harvested goods ('crop'), planting materials
     * ('seed'), or terrain modifications ('mapTile').
     * @type {string}
     * @enum {string} ['crop', 'seed', 'mapTile']
     * @required
     */
    itemType: {
      type: String,
      enum: ['crop', 'seed', 'mapTile'], // Define allowed item types
      required: true,
    },
    /**
     * The current price associated with the item. For purchasable items, this
     * is the cost to buy. For non-purchasable items (like crops sold by
     * players), this represents the sell value. Must be zero or greater.
     * @type {number}
     * @required
     * @min 0
     */
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    /**
     * Records the date and time when the `currentPrice` or other market
     * details of this item were last modified. Useful for tracking price
     * fluctuations or updates.
     * @type {Date}
     * @default Date.now
     */
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    /**
     * Specifies the type of currency used for the `currentPrice`. Currently
     * restricted to 'coins', but designed to potentially support other
     * currencies in the future.
     * @type {string}
     * @enum {string} ['coins']
     * @required
     */
    currency: {
      type: String,
      enum: ['coins'], // Define allowed currencies
      required: true,
    },
    /**
     * Determines whether players can actively purchase this item from the
     * market interface. If `false`, the item might still have a price listed
     * (representing its sell value) but won't be available for buying.
     * Defaults to `true`.
     * @type {boolean}
     * @default true
     */
    isPurchasable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

/**
 * Mongoose model compiled from the `marketSchema`. Provides an interface for
 * interacting with the 'Market' collection in MongoDB, enabling CRUD
 * operations (Create, Read, Update, Delete) for market listing documents.
 *
 * @type {object}
 */
export default mongoose.model('Market', marketSchema);
