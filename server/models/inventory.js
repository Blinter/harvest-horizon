/**
 * @file Inventory Model
 * @module server/models/inventory
 * @description Defines the Inventory class for managing character
 *   inventories and related transactions (buying/selling items) involving
 *   the character's wallet and the market, using MongoDB transactions for
 *   atomicity.
 */
import mongoose from 'mongoose';
import { convertToObjectId } from '../database/dbMongo.js';
import { characterSchema } from '../database/mongo/characterSchema.js';
import { inventorySchema } from '../database/mongo/inventorySchema.js';
import { walletSchema } from '../database/mongo/walletSchema.js';
import { marketSchema } from '../database/mongo/marketSchema.js';
import {
  BadRequestError,
  ExpressError,
  NotFoundError,
} from '../expressError.js';
const characterModel = mongoose.model('Character', characterSchema);
const inventoryModel = mongoose.model('Inventory', inventorySchema);
const walletModel = mongoose.model('Wallet', walletSchema);
const marketModel = mongoose.model('Market', marketSchema);

/**
 * Provides static methods for managing character inventories and market
 * interactions. Handles buying and selling items, ensuring atomicity
 * through Mongoose sessions.
 *
 * @class Inventory
 */
class Inventory {
  /**
   * Handles the purchase of items for a character.
   * - Validates input.
   * - Finds character inventory, wallet, and market item data.
   * - Validates sufficient funds.
   * - Processes the transaction (updates wallet and inventory) within a
   *   Mongoose session.
   *
   * @static
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character making the purchase.
   * @param {string} itemType - The type/category of the item being
   *   purchased.
   * @param {string} itemName - The specific name of the item being purchased.
   * @param {number} quantity - The number of items to purchase.
   * @returns {Promise<{success: boolean, message: string}>} Success object
   *   with message.
   * @throws {BadRequestError} If input is invalid or funds are insufficient.
   * @throws {ExpressError} If database lookups or transaction processing
   *   fails.
   */
  static async buyItems(characterId, itemType, itemName, quantity) {
    if (
      [characterId, itemType, itemName, quantity].some((v) => v === undefined)
    ) {
      throw new BadRequestError(
        `characterId, itemType, itemName, or quantity undefined.`,
        characterId,
        itemType,
        itemName,
        quantity
      );
    }

    if (isNaN(quantity))
      throw new BadRequestError('Quantity is not a number.', quantity);

    try {
      this.validateInput(characterId, itemType, itemName, quantity);
      const characterIdFixed = convertToObjectId(characterId);

      const [inventory, wallet] = await Promise.all([
        this.findInventory(characterIdFixed),
        this.findWallet(characterIdFixed),
      ]);

      const marketItem = await this.findMarketItem(itemType, itemName);

      this.validatePurchase(wallet, marketItem, quantity);

      const processed = await this.processTransaction(
        wallet,
        inventory,
        marketItem,
        quantity
      );

      if (!processed) {
        throw new ExpressError(`Buy transaction processing failed.`, 500);
      }

      return {
        success: true,
        message: `${quantity} ${itemType}(s) purchased successfully.`,
      };
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `InventoryModel.buyItems`,
        message: `Buy operation failed: ${error.message}`,
        context: {
          characterId,
          itemType,
          itemName,
          quantity,
          error,
        },
      });
      throw new ExpressError(
        `Buy operation failed: ${error.message}`,
        error instanceof BadRequestError ? 400 : 500
      );
    }
  }

  /**
   * Handles the selling of items from a character's inventory.
   * - Validates input.
   * - Finds character inventory, wallet, and market item data.
   * - Validates sufficient item quantity in inventory.
   * - Updates inventory and wallet.
   *
   * @static
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character selling items.
   * @param {string} itemType - The type/category of the item being sold.
   * @param {string} itemName - The specific name of the item being sold.
   * @param {number} quantity - The number of items to sell.
   * @returns {Promise<{success: boolean, message: string}>} Success object
   *   with message.
   * @throws {BadRequestError} If input is invalid or item quantity is
   *   insufficient.
   * @throws {ExpressError} If database lookups or transaction processing
   *   fails.
   */
  static async sellItems(characterId, itemType, itemName, quantity) {
    console.log('sellItems called with:', characterId, itemType, itemName, quantity);
    if (
      [characterId, itemType, itemName, quantity].some((v) => v === undefined)
    ) {
      throw new BadRequestError(
        `characterId, itemType, itemName, or quantity undefined.`,
        characterId,
        itemType,
        itemName,
        quantity
      );
    }

    if (isNaN(quantity))
      throw new BadRequestError(`Quantity is not a number.`, quantity);

    try {
      this.validateInput(characterId, itemType, itemName, quantity);

      const characterIdFixed = convertToObjectId(characterId);

      const [inventory, wallet] = await Promise.all([
        this.findInventory(characterIdFixed),
        this.findWallet(characterIdFixed),
      ]);

      if (!wallet) {
        throw new ExpressError(
          `Wallet not found for character: ${characterId}`,
          404
        );
      }
      if (!inventory)
        throw new ExpressError(
          `Inventory not found for character: ${characterId}`,
          404
        );

      const itemIndex = inventory.items.findIndex(
        (item) => item.itemType === itemType && item.itemName === itemName
      );

      // --- Enhanced Logging Start ---
      const availableQuantity = itemIndex !== -1 ? inventory.items[itemIndex].quantity : 0;
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.sellItems',
        message: 'Checking item availability before throwing error.',
        context: {
          characterId: characterIdFixed.toString(),
          itemType,
          itemName,
          requestedQuantity: quantity,
          foundItemIndex: itemIndex,
          actualAvailableQuantity: availableQuantity,
        },
      });
      // --- Enhanced Logging End ---

      if (itemIndex === -1 || inventory.items[itemIndex].quantity < quantity) {
        throw new BadRequestError(`Insufficient items in inventory`);
      }

      // Fetch the market item being sold
      const marketItem = await this.findMarketItem(itemType, itemName);

      // Validate the sale can proceed (checks wallet, market item)
      this.validateSale(wallet, marketItem, quantity);

      // Calculate earnings based directly on the market item's price
      const totalEarnings = marketItem.currentPrice * quantity;

      // Log the calculation
      console.debug(
        `[${new Date().toISOString()}] [Inventory.sellItems] Standard ` +
        `sell calculation: ${marketItem.currentPrice} * ${quantity} = ` +
        `${totalEarnings}`
      );

      // Validate calculated earnings (simple check)
      if (isNaN(totalEarnings) || totalEarnings < 0) {
        console.error(
          `[${new Date().toISOString()}] [Inventory.sellItems] Invalid ` +
          `calculated earnings: ${totalEarnings}`
        );
        throw new ExpressError(`Error calculating item sell value.`, 500);
      }

      // --- Modification Start: Keep item entry even if quantity becomes 0 ---
      // Always update the quantity, even if it becomes 0.
      inventory.items[itemIndex].quantity -= quantity;
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.sellItems',
        message: 'Updated item quantity after selling.',
        context: {
          characterId: characterIdFixed.toString(),
          itemType,
          itemName,
          soldQuantity: quantity,
          newQuantity: inventory.items[itemIndex].quantity,
        },
      });
      // --- Modification End ---

      await inventory.save();

      wallet.coins += totalEarnings;

      await wallet.save();

      return {
        success: true,
        message: `${quantity} (${itemType}) ${itemName}(s) sold successfully.`,
      };
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `InventoryModel.sellItems`,
        message: `Sell operation failed: ${error.message}`,
        context: {
          characterId,
          itemType,
          itemName,
          quantity,
          error,
        },
      });
      throw new ExpressError(
        `Sell operation failed: ${error.message}`,
        error instanceof BadRequestError ? 400 : 500
      );
    }
  }

  /**
   * Validates common input parameters for buy/sell operations.
   *
   * @static
   * @private
   * @param {any} characterId - Character ID.
   * @param {any} itemType - Item type.
   * @param {any} itemName - Item name.
   * @param {any} quantity - Quantity.
   * @throws {BadRequestError} If any parameter is undefined or quantity is
   *   not a positive number.
   */
  static validateInput(characterId, itemType, itemName, quantity) {
    if (
      [characterId, itemType, itemName, quantity].some((v) => v === undefined)
    ) {
      throw new BadRequestError(
        `characterId, itemType, itemName, or quantity undefined.`,
        characterId,
        itemType,
        itemName,
        quantity
      );
    }
    if (isNaN(quantity))
      throw new BadRequestError(`Quantity is not a number.`, quantity);
  }

  /**
   * Finds a character document by ID.
   * Note: This method seems unused currently.
   *
   * @static
   * @private
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - Character ID.
   * @param {object} [options={}] - Mongoose query options (e.g.,
   *   `{ session }`).
   * @returns {Promise<mongoose.Document>} The character document.
   * @throws {BadRequestError} If characterId is undefined or character not
   *   found.
   */
  static async findCharacter(characterId, options = {}) {
    if (characterId === undefined) {
      throw new BadRequestError(`characterId undefined.`, characterId);
    }

    const character = await characterModel
      .findById(characterId)
      .session(options.session || null);

    if (character === undefined) {
      throw new BadRequestError(`Character not found with ID: ${characterId}`);
    }

    return character;
  }

  /**
   * Finds an inventory document by character ID.
   *
   * @static
   * @private
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - Character ID.
   * @param {object} [options={}] - Mongoose query options (e.g.,
   *   `{ session }`).
   * @returns {Promise<mongoose.Document>} The inventory document.
   * @throws {BadRequestError} If characterId is undefined.
   * @throws {NotFoundError} If inventory is not found.
   */
  static async findInventory(characterId, options = {}) {
    if (characterId === undefined) {
      throw new BadRequestError(`characterId undefined.`, characterId);
    }

    const inventory = await inventoryModel
      .findOne({ characterId })
      .session(options.session || null);

    if (inventory === undefined) {
      throw new BadRequestError(
        `Inventory not found for character: ${characterId}`
      );
    }

    return inventory;
  }

  /**
   * Finds a wallet document by character ID.
   *
   * @static
   * @private
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - Character ID.
   * @param {object} [options={}] - Mongoose query options (e.g.,
   *   `{ session }`).
   * @returns {Promise<mongoose.Document>} The wallet document.
   * @throws {BadRequestError} If characterId is undefined.
   * @throws {NotFoundError} If wallet is not found.
   */
  static async findWallet(characterId, options = {}) {
    if (characterId === undefined) {
      throw new BadRequestError(`characterId undefined.`, characterId);
    }

    const wallet = await walletModel
      .findOne({ characterId })
      .session(options.session || null);

    if (wallet === undefined) {
      throw new BadRequestError(
        `Wallet not found for character: ${characterId}`
      );
    }

    return wallet;
  }

  /**
   * Finds a market item document based on item type and name.
   *
   * @static
   * @private
   * @async
   * @param {string} itemType - Item type.
   * @param {string} itemName - Item name.
   * @returns {Promise<mongoose.Document>} The market item document.
   * @throws {BadRequestError} If itemType or itemName are undefined, or if
   *   the item is not found in the market.
   */
  static async findMarketItem(itemType, itemName) {
    if (itemType === undefined || itemName === undefined) {
      throw new BadRequestError(
        `itemType, or itemName undefined.`,
        itemType,
        itemName
      );
    }
    const marketItem = await marketModel.findOne({
      itemType,
      itemName,
    });
    if (marketItem === undefined) {
      throw new BadRequestError(
        `Item not available in the market: 
        Type ${itemType}, 
        Item Name: ${itemName}`
      );
    }
    return marketItem;
  }

  /**
   * Validates if a purchase can proceed based on wallet funds and item cost.
   *
   * @static
   * @private
   * @param {mongoose.Document} wallet - The character's wallet document.
   * @param {mongoose.Document} marketItem - The market item document.
   * @param {number} quantity - The quantity being purchased.
   * @throws {BadRequestError} If wallet or market item is missing, quantity
   *   is invalid, or if funds are insufficient.
   */
  static validatePurchase(wallet, marketItem, quantity) {
    if (!wallet || !marketItem) {
      throw new BadRequestError(
        `wallet, marketItem, or quantity undefined.`,
        wallet,
        marketItem,
        quantity
      );
    }

    if (isNaN(quantity))
      throw new BadRequestError(`Quantity is not a number`, quantity);

    const totalPrice = marketItem.currentPrice * quantity;
    if (wallet.coins < totalPrice) {
      throw new BadRequestError(
        `Insufficient funds, you have`,
        wallet.coins,
        `vs. required`,
        totalPrice
      );
    }
  }

  /**
   * Validates if a sale can proceed. Checks for wallet existence.
   * Needs enhancement for more specific sale rules (e.g., is the item
   * sellable?).
   *
   * @static
   * @private
   * @param {mongoose.Document} wallet - The character's wallet document.
   * @param {mongoose.Document} marketItem - The market item document.
   * @param {number} quantity - The quantity being sold.
   * @throws {BadRequestError} If wallet information is missing.
   */
  static validateSale(wallet, marketItem, quantity) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: `InventoryModel.validateSale`,
      message: `Validating sale transaction`,
      context: {
        walletId: wallet._id,
        marketItemId: marketItem?._id,
        quantity,
      },
    });
    if (!wallet) {
      throw new BadRequestError(
        `Wallet information is missing for sale validation.`
      );
    }
    // Add more specific sale validation if needed (e.g., is the item sellable?)
  }

  /**
   * Processes the buy transaction. Updates the wallet (decreases coins)
   * and inventory (adds/updates item). Assumes validation has passed.
   *
   * @static
   * @private
   * @async
   * @param {mongoose.Document} wallet - The wallet document to update.
   * @param {mongoose.Document} inventory - The inventory document to update.
   * @param {mongoose.Document} marketItem - The market item being purchased.
   * @param {number} quantity - The quantity being purchased. Must be > 0.
   * @returns {Promise<boolean>} `true` if processing is successful.
   * @throws {BadRequestError} If input parameters are invalid, quantity is
   *   not positive, total price calculation is invalid, or funds are
   *   insufficient (double-check).
   * @throws {ExpressError} If saving wallet or inventory fails.
   */
  static async processTransaction(wallet, inventory, marketItem, quantity) {
    if ([wallet, inventory, marketItem, quantity].some((v) => !v)) {
      throw new BadRequestError(
        `processTransaction called with undefined parameters.`
      );
    }
    if (isNaN(quantity) || quantity <= 0) {
      throw new BadRequestError(`Quantity must be a positive number`);
    }

    const totalPrice = marketItem.currentPrice * quantity;
    if (totalPrice <= 0 && marketItem.currentPrice > 0) {
      throw new BadRequestError(`Calculated total price is zero or negative.`);
    }
    if (wallet.coins < totalPrice) {
      throw new BadRequestError(
        `Insufficient funds detected during transaction processing.`
      );
    }

    wallet.coins -= totalPrice;
    await wallet.save();

    const existingItem = inventory.items.find(
      (item) =>
        item.itemType === marketItem.itemType &&
        item.itemName === marketItem.itemName
    );

    if (existingItem !== undefined) {
      existingItem.quantity += quantity;
    } else {
      inventory.items.push({
        itemType: marketItem.itemType,
        itemName: marketItem.itemName,
        quantity: quantity,
      });
    }

    await inventory.save();

    return true;
  }

  /**
   * Retrieves the inventory document and wallet coins for a specific
   * character.
   *
   * @static
   * @async
   * @param {string|mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character.
   * @returns {Promise<{ inventory: object, coins: number }>} A promise
   *   resolving to an object containing the inventory (as a plain object)
   *   and the number of coins in the wallet.
   * @throws {BadRequestError} If the character ID format is invalid.
   * @throws {NotFoundError} If the inventory or wallet is not found for the
   *   given character ID.
   * @throws {ExpressError} If an unexpected database error occurs during
   *   lookup.
   */
  static async getByCharacterId(characterId) {
    const timestamp = new Date().toISOString();
    let characterIdObj;
    try {
      characterIdObj = convertToObjectId(characterId);
    } catch {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.getByCharacterId]: ` +
        `Invalid characterId format: ${characterId}`
      );
      throw new BadRequestError(`Invalid character ID format: ${characterId}`);
    }

    console.debug({
      timestamp,
      service: 'InventoryModel.getByCharacterId',
      message: `Attempting to fetch inventory and wallet for character ID ${characterIdObj}...`,
    });

    try {
      // Fetch inventory and wallet concurrently
      const [inventory, wallet] = await Promise.all([
        inventoryModel
          .findOne({ characterId: characterIdObj })
          .lean(),
        walletModel
          .findOne({ characterId: characterIdObj })
          .select('coins')
          .lean(),
      ]);

      if (!inventory) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.getByCharacterId',
          message: `Inventory not found for character ID ${characterIdObj}.`,
        });
        throw new NotFoundError(
          `Inventory not found for character ID: ${characterIdObj}`
        );
      }
      if (!wallet) {
        // This case might indicate a data consistency issue if an inventory exists without a wallet
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.getByCharacterId',
          message: `Wallet not found for character ID ${characterIdObj}.`,
        });
        throw new NotFoundError(
          `Wallet not found for character ID: ${characterIdObj}`
        );
      }

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.getByCharacterId',
        message: `Inventory and wallet retrieved successfully for ${characterIdObj}.`,
      });

      // --- LOGGING: Log the exact data being returned ---
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.getByCharacterId',
        message: `Data being returned for character ${characterIdObj}.`,
        context: { inventory, coins: wallet?.coins }, // Log the final structure
      });
      // --- END LOGGING ---

      // Return both inventory and coins
      return { inventory, coins: wallet.coins };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      // Handle unexpected errors
      console.error({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.getByCharacterId',
        message: 'Database error fetching inventory/wallet.',
        context: { characterId: characterIdObj, error: error.message },
        stack: error.stack,
      });
      throw new ExpressError(
        `Failed to retrieve inventory/wallet: ${error.message}`,
        500
      );
    }
  }

  /**
   * Retrieves the quantity of a specific item in a character's inventory.
   *
   * @static
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character.
   * @param {string} itemType - The type/category of the item (e.g., 'seed').
   * @param {string} itemName - The specific name of the item (e.g., 'wheat').
   * @returns {Promise<number>} A promise resolving to the quantity of the item
   *   found, or 0 if the inventory doesn't exist, is empty, or the specific
   *   item is not found within the inventory.
   * @throws {BadRequestError} If the character ID format is invalid.
   * @throws {ExpressError} If an unexpected database error occurs during
   *   lookup.
   */
  static async getItemQuantity(characterId, itemType, itemName) {
    const timestamp = new Date().toISOString();
    let characterIdObj;
    try {
      characterIdObj = convertToObjectId(characterId);
    } catch {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.getItemQuantity]: ` +
        `Invalid characterId format: ${characterId}`
      );
      throw new BadRequestError(`Invalid character ID format: ${characterId}`);
    }

    console.debug({
      timestamp,
      service: 'InventoryModel.getItemQuantity',
      message: `Attempting to fetch item quantity for character ID ${characterIdObj}...`,
      context: { itemType, itemName },
    });

    try {
      // Find the inventory, only selecting the 'items' field for efficiency
      const inventory = await inventoryModel
        .findOne({ characterId: characterIdObj })
        .select('items')
        .lean();

      // If inventory doesn't exist, the character has 0 of the item
      if (!inventory || !inventory.items) {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.getItemQuantity',
          message: `Inventory not found or empty for character ID ${characterIdObj}. Returning 0.`,
        });
        return 0;
      }

      // Find the specific item within the inventory's items array
      const targetItem = inventory.items.find(item =>
        item.itemType === itemType &&
        item.itemName === itemName
      );

      // If the item isn't found in the array, the quantity is 0
      if (!targetItem) {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.getItemQuantity',
          message:
            `Item (${itemType}, ${itemName}) not found in inventory for ` +
            `${characterIdObj}. Returning 0.`,
        });
        return 0;
      }

      // Return the quantity of the found item
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.getItemQuantity',
        message:
          `Item (${itemType}, ${itemName}) found for ${characterIdObj}. ` +
          `Quantity: ${JSON.stringify(targetItem.quantity)}.`,
      });
      return targetItem.quantity;

    } catch (error) {
      // Re-throw known errors (though none are explicitly thrown within the try block here)
      if (error instanceof BadRequestError) {
        throw error;
      }
      // Handle unexpected database errors
      console.error({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.getItemQuantity',
        message: 'Database error fetching item quantity.',
        context: { characterId: characterIdObj, itemType, itemName, error: error.message },
        stack: error.stack,
      });
      // We might want to throw a more specific error or a generic one
      throw new ExpressError(
        `Failed to retrieve item quantity: ${error.message}`,
        500
      );
    }
  }

  /**
   * Deducts a specified quantity of an item from a character's inventory.
   * This operation finds the inventory, validates the item and quantity,
   * updates the item's quantity (keeping the item slot even if quantity
   * reaches 0), and saves the inventory.
   *
   * @static
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character.
   * @param {string} itemType - The type/category of the item (e.g., 'seed').
   * @param {string} itemName - The specific name of the item (e.g., 'wheat').
   * @param {number} quantity - The positive quantity of the item to deduct.
   * @returns {Promise<void>} Resolves if deduction is successful.
   * @throws {BadRequestError} If characterId, itemType, itemName are missing,
   *   if quantity is invalid (not a positive number), if the character ID
   *   format is invalid, if the item is not found in the inventory, or if the
   *   quantity available is insufficient.
   * @throws {NotFoundError} If the inventory document itself is not found for
   *   the character.
   * @throws {ExpressError} If an unexpected database error occurs during
   *   lookup or update.
   */
  static async deductItem(characterId, itemType, itemName, quantity) {
    const timestamp = new Date().toISOString();
    // --- Input Validation --- //
    if ([characterId, itemType, itemName].some((v) => v === undefined || v === null)) {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.deductItem]: ` +
        `Missing required parameters (characterId, itemType, itemName).`
      );
      throw new BadRequestError('Missing required parameters for item deduction.');
    }
    if (isNaN(quantity) || quantity <= 0) {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.deductItem]: ` +
        `Invalid quantity: ${quantity}. Must be a positive number.`
      );
      throw new BadRequestError('Quantity must be a positive number.');
    }

    let characterIdObj;
    try {
      characterIdObj = convertToObjectId(characterId);
    } catch {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.deductItem]: ` +
        `Invalid characterId format: ${characterId}`
      );
      throw new BadRequestError(`Invalid character ID format: ${characterId}`);
    }

    console.debug({
      timestamp,
      service: 'InventoryModel.deductItem',
      message:
        `Attempting to deduct item for character ID ${characterIdObj}...`,
      context: { itemType, itemName, quantity },
    });

    try {
      // Find the inventory
      const inventory = await inventoryModel
        .findOne({ characterId: characterIdObj });

      if (!inventory || !inventory.items) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.deductItem',
          message: `Inventory not found or empty for character ${characterIdObj}. Cannot deduct item.`,
        });
        // Throw error because the item cannot be deducted if inventory doesn't 
        // exist
        throw new NotFoundError(
          `Inventory not found for character ${characterIdObj}.`
        );
      }

      // Find the index of the item to deduct
      const itemIndex = inventory.items.findIndex(
        (item) => item.itemType === itemType && item.itemName === itemName
      );

      // Check if item exists
      if (itemIndex === -1) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.deductItem',
          message: `Item (${itemType}, ${itemName}) not found in inventory for ${characterIdObj}.`,
        });
        throw new BadRequestError(
          `Item (${itemType}, ${itemName}) not found in inventory.`
        );
      }

      const currentQuantity = inventory.items[itemIndex].quantity;

      // Check if sufficient quantity exists
      if (currentQuantity < quantity) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.deductItem',
          message: `Insufficient quantity for item (${itemType}, ${itemName}) for ${characterIdObj}.`,
          context: { required: quantity, available: currentQuantity },
        });
        throw new BadRequestError(
          `Insufficient quantity for ${itemName}. ` +
          `Required: ${quantity}, ` +
          `Available: ${JSON.stringify(currentQuantity)}.`
        );
      }

      // --- Modification Start: Keep item entry even if quantity becomes 0 ---
      // Always update the quantity, even if it results in 0.
      inventory.items[itemIndex].quantity -= quantity;
      const newQuantity = inventory.items[itemIndex].quantity;
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.deductItem',
        message: `Updated quantity for item (${itemType}, ${itemName}) for ${characterIdObj}.`,
        context: { deducted: quantity, newQuantity: newQuantity },
      });
      // --- Modification End ---

      // Save the updated inventory
      await inventory.save();

      console.info({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.deductItem',
        message: `Successfully deducted ${quantity} of (${itemType}, ${itemName}) for ${characterIdObj}.`,
      });

    } catch (error) {
      // Re-throw known errors (BadRequestError, NotFoundError)
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      // Handle unexpected database errors
      console.error({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.deductItem',
        message: 'Database error during item deduction.',
        context: { characterId: characterIdObj, itemType, itemName, quantity, error: error.message },
        stack: error.stack,
      });
      throw new ExpressError(
        `Database error deducting item: ${error.message}`,
        500
      );
    }
  }

  /**
   * Adds a specified quantity of one or more items to a character's
   * inventory. Iterates through the provided items, updating quantities for
   * existing items or adding new item entries if they don't exist. Skips
   * items with invalid (non-positive) quantities.
   *
   * @static
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character.
   * @param {Array<{itemType: string, itemName: string, quantity: number}>}
   *   itemsToAdd - An array of objects, each specifying an item type, name,
   *   and the positive quantity to add.
   * @returns {Promise<void>} Resolves if the addition process completes
   *   (even if some individual items were skipped due to invalid quantity).
   * @throws {BadRequestError} If characterId is missing, itemsToAdd is not a
   *   non-empty array, or if the character ID format is invalid.
   * @throws {NotFoundError} If the inventory is not found for the character.
   * @throws {ExpressError} If an unexpected database error occurs during
   *   lookup or update.
   */
  static async addItems(characterId, itemsToAdd) {
    const timestamp = new Date().toISOString();
    // --- Input Validation --- //
    if (!characterId ||
      !Array.isArray(itemsToAdd) ||
      itemsToAdd.length === 0) {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.addItems]: ` +
        `Missing or invalid required parameters ` +
        `(characterId, itemsToAdd array).`
      );
      throw new BadRequestError(
        'Missing or invalid parameters for item addition.'
      );
    }

    let characterIdObj;
    try {
      characterIdObj = convertToObjectId(characterId);
    } catch {
      console.error(
        `[${timestamp}] [ERROR] [InventoryModel.addItems]: ` +
        `Invalid characterId format: ${characterId}`
      );
      throw new BadRequestError(`Invalid character ID format: ${characterId}`);
    }

    console.debug({
      timestamp,
      service: 'InventoryModel.addItems',
      message:
        `Attempting to add ${itemsToAdd.length} item types for ` +
        `character ID ${characterIdObj}...`,
      context: { items: itemsToAdd }, // Log items for debugging
    });

    try {
      // Find the inventory
      const inventory = await inventoryModel.findOne({ characterId: characterIdObj });

      if (!inventory) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.addItems',
          message:
            `Inventory not found for character ${characterIdObj}. ` +
            `Cannot add items.`,
        });
        throw new NotFoundError(
          `Inventory not found for character ${characterIdObj}.`
        );
      }

      let itemsUpdatedCount = 0;
      let itemsAddedCount = 0;

      // Iterate through each item to add/update
      for (const itemToAdd of itemsToAdd) {
        const { itemType, itemName, quantity } = itemToAdd;

        // Validate individual item quantity
        if (isNaN(quantity) || quantity <= 0) {
          console.warn(
            `[${timestamp}] [InventoryModel.addItems]: ` +
            `Skipping item with invalid quantity (${quantity}): ` +
            `${itemType} - ${itemName}`
          );
          continue; // Skip this item if quantity is invalid
        }

        const existingItemIndex = inventory.items.findIndex(item =>
          item.itemType === itemType &&
          item.itemName === itemName
        );

        if (existingItemIndex !== -1) {
          // Item exists, increase quantity
          inventory.items[existingItemIndex].quantity += quantity;
          itemsUpdatedCount++;
          console.debug({
            timestamp: new Date().toISOString(),
            service: 'InventoryModel.addItems',
            message:
              `Increased quantity for existing item (${itemType}, ${itemName}) ` +
              `for ${characterIdObj}.`,
            context: { added: quantity, newQuantity: inventory.items[existingItemIndex].quantity },
          });
        } else {
          // Item does not exist, add new item entry
          // TODO: Check inventory capacity before adding?
          inventory.items.push({
            itemType,
            itemName,
            quantity,
          });
          itemsAddedCount++;
          console.debug({
            timestamp: new Date().toISOString(),
            service: 'InventoryModel.addItems',
            message:
              `Added new item (${itemType}, ${itemName}, qty: ${quantity}) ` +
              `to inventory for ${characterIdObj}.`,
          });
        }
      }

      // Save the updated inventory only if changes were made
      if (itemsUpdatedCount > 0 || itemsAddedCount > 0) {
        await inventory.save();
        console.info({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.addItems',
          message:
            `Successfully processed item additions for ${characterIdObj}. ` +
            `Updated: ${itemsUpdatedCount}, Added: ${itemsAddedCount}.`,
        });
      } else {
        console.info({
          timestamp: new Date().toISOString(),
          service: 'InventoryModel.addItems',
          message:
            `No valid items to add or update for ${characterIdObj}.`,
        });
      }

    } catch (error) {
      // Re-throw known errors
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      // Handle unexpected database errors
      console.error({
        timestamp: new Date().toISOString(),
        service: 'InventoryModel.addItems',
        message: 'Database error during item addition.',
        context: { characterId: characterIdObj, itemsToAdd, error: error.message },
        stack: error.stack,
      });
      throw new ExpressError(
        `Database error adding items: ${error.message}`,
        500
      );
    }
  }

  /**
   * Checks if a character possesses a sufficient quantity of a specific seed
   * type in their inventory.
   *
   * @static
   * @async
   * @param {string | mongoose.Types.ObjectId} characterId - The MongoDB
   *   ObjectId of the character.
   * @param {string} cropType - The name of the crop, used as the `itemName`
   *   for the seed lookup (e.g., 'wheat'). The `itemType` is assumed to be
   *   'seed'.
   * @param {number} requiredSeeds - The number of seeds required for the check.
   * @returns {Promise<{sufficient: boolean, available: number}>} An object
   *   indicating whether the quantity is sufficient (`sufficient`: true/false)
   *   and the actual quantity available (`available`: number).
   * @throws {BadRequestError} If the character ID format is invalid (from
   *   `getItemQuantity`).
   * @throws {ExpressError} If a database error occurs during lookup (from
   *   `getItemQuantity`).
   */
  static async hasEnoughSeeds(
    characterId,
    cropType,
    requiredSeeds
  ) {
    const seedItemType = 'seed';
    const availableSeeds = await Inventory.getItemQuantity(
      characterId,
      seedItemType,
      cropType
    );
    return {
      sufficient: availableSeeds >= requiredSeeds,
      available: availableSeeds,
    };
  }
}

export default Inventory;
