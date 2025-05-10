/**
 * @file Market Model
 * @module server/models/market
 * @description Defines the Market class for interacting with market data in
 *   MongoDB.
 */
import mongoose from 'mongoose';
import { marketSchema } from '../database/mongo/marketSchema.js';
import { ExpressError } from '../expressError.js';

const marketModel = mongoose.model('Market', marketSchema);

/**
 * Provides static methods for accessing and manipulating market data stored
 * in the MongoDB collection. This class acts as an interface between the
 * application logic and the raw database operations for market items.
 *
 * @class Market
 */
class Market {
  /**
   * Retrieves all market items currently stored in the database. Returns
   * plain JavaScript objects instead of Mongoose documents for better
   * performance when only reading data.
   *
   * @static
   * @async
   * @returns {Promise<Array<object>>} A promise that resolves to an array
   *   of market item documents. Each document is a plain JavaScript object.
   * @throws {ExpressError} If there's an underlying database error during
   *   the fetch operation. Includes the original database error in the
   *   details property.
   */
  static async getAllItems() {
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [DEBUG] [MarketModel]: `,
      'Fetching ALL market items from DB.'
    );
    try {
      // Use .lean() for plain JS objects
      const items = await marketModel.find({}).lean();

      const timestamp2 = new Date().toISOString();
      console.debug(
        `[${timestamp2}] [DEBUG] [MarketModel]: ` +
        `Found ${items.length} market items in DB.`
      );
      return items;
    } catch (dbErr) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [ERROR] [MarketModel]: 
        Database error fetching market items:`,
        dbErr
      );
      // Throw a generic error to be handled by the route
      throw new ExpressError(`Database error retrieving market items.`, 500, {
        error: dbErr,
      });
    }
  }

  /**
   * Finds a single market item by its unique MongoDB ObjectId. Validates the
   * ID format before querying the database. Returns null if no item matches
   * the provided ID.
   *
   * @static
   * @async
   * @param {string} id - The MongoDB ObjectId string of the item to find.
   * @returns {Promise<object|null>} A promise that resolves to the item
   *   document (as a plain JS object) if found, otherwise null.
   * @throws {ExpressError} If the provided ID string is not a valid MongoDB
   *   ObjectId format (status 400), or if a database error occurs during
   *   the query (status 500).
   */
  static async findById(id) {
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [DEBUG] [MarketModel]: 
      Fetching market item by ID: ${id}`
    );
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const errorTimestamp = new Date().toISOString();
      console.warn(
        `[${errorTimestamp}] [WARN] [MarketModel]: 
        Invalid ObjectId format: ${id}`
      );
      throw new ExpressError(`Invalid item ID format.`, 400);
    }
    try {
      const item = await marketModel.findById(id).lean();
      if (!item) {
        const notFoundTimestamp = new Date().toISOString();
        console.info(
          `[${notFoundTimestamp}] [INFO] [MarketModel]: 
          Market item not found for ID: ${id}`
        );
        return null; // Or throw a 404 error if preferred
      }
      const foundTimestamp = new Date().toISOString();
      console.debug(
        `[${foundTimestamp}] [DEBUG] [MarketModel]: 
        Found market item for ID: ${id}`
      );
      return item;
    } catch (dbErr) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [ERROR] [MarketModel]: 
        Database error fetching item by ID ${id}:`,
        dbErr
      );
      throw new ExpressError(`Database error retrieving item ${id}.`, 500, {
        error: dbErr,
      });
    }
  }

  /**
   * Finds a specific market item based on its type and name. This allows
   * querying for items without knowing their MongoDB ObjectId.
   *
   * @static
   * @async
   * @param {string} _itemType - The category or type of the item (e.g.,
   *   'seed', 'crop').
   * @param {string} _itemName - The specific name of the item (e.g.,
   *   'Carrot Seed', 'Wheat').
   * @returns {Promise<object|null>} A promise that resolves to the item
   *   document if found, otherwise null.
   * @throws {ExpressError} If there's an error during the database query.
   */
  static async findItem(_itemType, _itemName) {
    // ... existing code ...
  }

  /**
   * Creates a new market item document in the database. Validates the
   * provided item data against the market schema before insertion.
   *
   * @static
   * @async
   * @param {object} _itemData - An object containing the data for the new
   *   item. Expected properties include `itemName`, `itemType`,
   *   `currentPrice`, and `currency`.
   * @returns {Promise<object>} A promise that resolves to the newly created
   *   item document as stored in the database.
   * @throws {ExpressError} If the provided `_itemData` fails schema
   *   validation or if a database error occurs during insertion.
   */
  static async createItem(_itemData) {
    // ... existing code ...
  }

  /**
   * Updates an existing market item identified by its MongoDB ObjectId.
   * Applies the provided updates to the document.
   *
   * @static
   * @async
   * @param {string} _id - The MongoDB ObjectId of the market item to update.
   * @param {object} _updates - An object containing the fields to update and
   *   their new values (e.g., `{ currentPrice: 150 }`).
   * @returns {Promise<object|null>} A promise that resolves to the updated
   *   item document if found and updated, otherwise null.
   * @throws {ExpressError} If the provided ID is invalid, if the updates fail
   *   schema validation, or if a database error occurs.
   */
  static async updateItem(_id, _updates) {
    // ... existing code ...
  }

  /**
   * Deletes a market item from the database using its MongoDB ObjectId.
   *
   * @static
   * @async
   * @param {string} _id - The MongoDB ObjectId of the item to delete.
   * @returns {Promise<object|null>} A promise that resolves to the deleted
   *   item document if found and deleted, otherwise null.
   * @throws {ExpressError} If the provided ID is invalid or if a database
   *   error occurs during deletion.
   */
  static async deleteItem(_id) {
    // ... existing code ...
  }
}

export default Market;
