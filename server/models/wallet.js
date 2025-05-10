/**
 * @file Wallet data access logic.
 * @module server/models/wallet
 * @description Functions for interacting with the Wallet collection in
 *   MongoDB.
 */

import mongoose from 'mongoose';
import Wallet from '../database/mongo/walletSchema.js';

// --- Utility Functions ---

/**
 * Processes a transaction by attempting to deduct a cost from a wallet.
 * Ensures sufficient funds before deduction in an atomic operation. Uses
 * descriptive logging for monitoring and debugging.
 *
 * @async
 * @function processTransaction
 * @param {string} walletId - The MongoDB ObjectId string of the wallet.
 * @param {number} cost - The non-negative cost to deduct.
 * @returns {Promise<object>} The updated wallet object if successful.
 * @throws {Error} Throws specific errors for invalid input, wallet not found,
 *   or insufficient funds. Custom error types could be beneficial here for
 *   more granular upstream handling.
 */
export async function processTransaction(walletId, cost) {
  const timestamp = new Date().toISOString();

  // --- Input Validation ---
  if (!mongoose.Types.ObjectId.isValid(walletId)) {
    console.warn(
      `[${timestamp}] [WARN] [processTransaction] ` +
      `Invalid walletId format: ${walletId}`
    );
    // Consider throwing a specific ValidationError
    throw new Error(`Invalid wallet ID format.`);
  }

  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
    console.warn(
      `[${timestamp}] [WARN] [processTransaction] ` +
      `Invalid cost: ${cost} for wallet ${walletId}`
    );
    // Consider throwing a specific ValidationError
    throw new Error(`Invalid cost. Must be a non-negative finite number.`);
  }

  // --- Trivial Case Handling ---
  if (cost === 0) {
    console.info(
      `[${timestamp}] [INFO] [processTransaction] ` +
      `Cost is zero, no transaction needed for wallet ${walletId}`
    );
    // Find and return the current wallet state without modification.
    const currentWallet = await Wallet.findById(walletId).lean();
    if (!currentWallet) {
      console.warn(
        `[${timestamp}] [WARN] [processTransaction] ` +
        `Wallet not found for zero cost check: ${walletId}`
      );
      // Consider throwing a specific NotFoundError
      throw new Error(`Wallet not found.`);
    }
    return currentWallet;
  }

  console.debug(
    `[${timestamp}] [DEBUG] [processTransaction] ` +
    `Attempting transaction on wallet ${walletId} for cost ${cost}`
  );

  // --- Atomic Update ---
  try {
    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        _id: walletId,
        coins: { $gte: cost }, // Condition: Sufficient funds
      },
      {
        $inc: { coins: -cost }, // Action: Decrement coins
      },
      {
        new: true, // Return the modified document
        runValidators: true, // Ensure schema validation rules pass
        lean: true, // Return a plain JS object
      }
    );

    // --- Handle Update Outcome ---
    if (!updatedWallet) {
      // If null, the find condition failed (either not found or
      // insufficient funds).
      // Check if the wallet exists to differentiate the cause.
      const walletExists = await Wallet.findById(walletId, '_id coins').lean();
      if (walletExists) {
        // Wallet exists, so funds were insufficient.
        console.warn(
          `[${timestamp}] [WARN] [processTransaction] ` +
          `Insufficient funds for wallet ${walletId}. ` +
          `Current: ${walletExists.coins}, ` +
          `Required: ${cost}.`
        );
        // Consider throwing a specific InsufficientFundsError
        throw new Error(
          `Insufficient funds. ` +
          `Required: ${cost}, ` +
          `Available: ${walletExists.coins}`
        );
      } else {
        // Wallet does not exist.
        console.warn(
          `[${timestamp}] [WARN] [processTransaction] ` +
          `Wallet not found: ${walletId}`
        );
        // Consider throwing a specific NotFoundError
        throw new Error(`Wallet not found.`);
      }
    }

    console.info(
      `[${timestamp}] [INFO] [processTransaction]`,
      `Transaction successful for wallet ${walletId}. ` +
      `Cost: ${cost}. New balance: ${updatedWallet.coins}`
    );

    return updatedWallet; // Return the updated wallet object
  } catch (error) {
    // Re-throw specific operational errors
    if (
      error.message.startsWith('Insufficient funds') ||
      error.message === 'Wallet not found.' ||
      error.message.startsWith('Invalid')
    ) {
      throw error;
    }
    // Log unexpected errors and throw a generic server error
    console.error(
      `[${timestamp}] [ERROR] [processTransaction] ` +
      `Unexpected error during transaction for wallet ${walletId}:`,
      error
    );
    // Consider throwing a generic InternalServerError
    throw new Error(`Server error during transaction processing.`);
  }
}

/**
 * Finds a wallet associated with a specific character ID.
 *
 * @async
 * @function findWalletByCharacterId
 * @param {string} characterId - The MongoDB ObjectId string of the character.
 * @returns {Promise<object|null>} The wallet object (as a plain JS object) if
 *   found, otherwise null.
 * @throws {Error} Throws an error if characterId is invalid or on database
 *   error.
 */
export async function findWalletByCharacterId(characterId) {
  const timestamp = new Date().toISOString();

  if (!mongoose.Types.ObjectId.isValid(characterId)) {
    console.warn(
      `[${timestamp}] [WARN] [findWalletByCharacterId] ` +
      `Invalid characterId format: ${characterId}`
    );
    throw new Error(`Invalid character ID format.`);
  }

  try {
    console.debug(
      `[${timestamp}] [DEBUG] [findWalletByCharacterId] ` +
      `Querying for wallet with characterId: ${characterId}`
    );
    // Use lean() to get a plain JS object instead of a Mongoose document
    const wallet = await Wallet.findOne({ characterId }).lean();

    if (!wallet) {
      console.info(
        `[${timestamp}] [INFO] [findWalletByCharacterId] ` +
        `Wallet not found for characterId: ${characterId}`
      );
    } else {
      console.info(
        `[${timestamp}] [INFO] [findWalletByCharacterId] ` +
        `Wallet found for characterId: ${characterId}`
      );
    }
    return wallet; // Returns the plain JS object or null
  } catch (error) {
    console.error(
      `[${timestamp}] [ERROR] [findWalletByCharacterId] ` +
      `Database error finding wallet for characterId ${characterId}:`,
      error
    );
    // Consider throwing a generic InternalServerError
    throw new Error(`Server error finding wallet.`);
  }
}

/**
 * Adjusts the coin balance of a specific wallet by a given amount. Ensures
 * the balance does not drop below zero. Uses atomic operations.
 *
 * @async
 * @function adjustWalletBalance
 * @param {string} walletId - The MongoDB ObjectId string of the wallet.
 * @param {number} changeAmount - The amount to add (positive) or subtract
 *   (negative). Must be a finite number.
 * @returns {Promise<object>} The updated wallet object (as a plain JS object).
 * @throws {Error} Throws specific errors for invalid input, wallet not found,
 *   adjustment resulting in negative balance, or database errors.
 */
export async function adjustWalletBalance(walletId, changeAmount) {
  const timestamp = new Date().toISOString();

  // --- Input Validation ---
  if (!mongoose.Types.ObjectId.isValid(walletId)) {
    console.warn(
      `[${timestamp}] [WARN] [adjustWalletBalance] ` +
      `Invalid walletId format: ${walletId}`
    );
    throw new Error(`Invalid wallet ID format.`);
  }

  if (typeof changeAmount !== 'number' || !Number.isFinite(changeAmount)) {
    console.warn(
      `[${timestamp}] [WARN] [adjustWalletBalance] ` +
      `Invalid changeAmount: ${changeAmount} for wallet ${walletId}`
    );
    throw new Error(`Invalid changeAmount. Must be a finite number.`);
  }

  // --- Trivial Case Handling ---
  if (changeAmount === 0) {
    console.info(
      `[${timestamp}] [INFO] [adjustWalletBalance] ` +
      `changeAmount is zero, no update needed for wallet ${walletId}`
    );
    const currentWallet = await Wallet.findById(walletId).lean();
    if (!currentWallet) {
      console.warn(
        `[${timestamp}] [WARN] [adjustWalletBalance] ` +
        `Wallet not found for zero change check: ${walletId}`
      );
      throw new Error(`Wallet not found.`);
    }
    return currentWallet;
  }

  console.debug(
    `[${timestamp}] [DEBUG] [adjustWalletBalance] ` +
    `Attempting to adjust wallet ${walletId} by ${changeAmount}`
  );

  // --- Atomic Update and Validation ---
  try {
    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        _id: walletId,
        // Ensure coins + changeAmount >= 0 using $expr for complex condition
        $expr: {
          $gte: [{ $add: ['$coins', changeAmount] }, 0],
        },
      },
      {
        $inc: { coins: changeAmount }, // Atomically increment/decrement
      },
      {
        new: true, // Return the modified document
        runValidators: true, // Run schema validators (e.g., min: 0 on coins)
        lean: true, // Return a plain JS object
      }
    );

    // --- Handle Update Outcome ---
    if (!updatedWallet) {
      // Find condition failed (not found or would result in negative balance).
      const walletExists = await Wallet.findById(walletId, '_id coins').lean();
      if (walletExists) {
        // Wallet exists, so the adjustment would lead to negative coins.
        console.warn(
          `[${timestamp}] [WARN] [adjustWalletBalance] ` +
          `Adjustment failed for wallet ${walletId} ` +
          `(change: ${changeAmount}). Would result in ` +
          `negative balance. Current coins: ${walletExists.coins}`
        );
        // Consider throwing a specific InvalidOperationError or similar
        throw new Error(
          `Insufficient funds or invalid adjustment. Cannot adjust` +
          ` coins by ${changeAmount}. ` +
          `Current coins: ${walletExists.coins}`
        );
      } else {
        // Wallet doesn't exist.
        console.warn(
          `[${timestamp}] [WARN] [adjustWalletBalance] 
                    Wallet not found: ${walletId}`
        );
        throw new Error(`Wallet not found.`);
      }
    }

    console.info(
      `[${timestamp}] [INFO] [adjustWalletBalance] 
            Wallet ${walletId} adjusted by ${changeAmount}. 
            New balance: ${updatedWallet.coins}`
    );
    return updatedWallet;
  } catch (error) {
    // Re-throw specific operational errors
    if (
      error.message.startsWith('Insufficient funds') ||
      error.message === 'Wallet not found.' ||
      error.message.startsWith('Invalid')
    ) {
      throw error;
    }
    // Handle Mongoose validation errors specifically
    if (error.name === 'ValidationError') {
      console.warn(
        `[${timestamp}] [WARN] [adjustWalletBalance] ` +
        `Validation error for wallet ${walletId}:`,
        error.errors
      );
      // You might want to simplify the error message before throwing
      throw new Error(`Validation error: ${error.message}`);
    }
    // Log unexpected errors and throw a generic server error
    console.error(
      `[${timestamp}] [ERROR] [adjustWalletBalance] ` +
      `Unexpected error adjusting wallet ${walletId}:`,
      error
    );
    throw new Error(`Server error adjusting wallet balance.`);
  }
}

/**
 * Fetches a wallet by character ID.
 *
 * @static
 * @async
 * @param {string} characterId - The MongoDB ObjectId of the character.
 * @returns {Promise<object|null>} - The wallet or null if not found.
 * @throws {Error} Throws an error if characterId is invalid or on database
 *   error.
 */
export async function getWalletByCharacterId(characterId) {
  const timestamp = new Date().toISOString();

  if (!mongoose.Types.ObjectId.isValid(characterId)) {
    console.warn(
      `[${timestamp}] [WARN] [getWalletByCharacterId] ` +
      `Invalid characterId format: ${characterId}`
    );
    throw new Error(`Invalid character ID format.`);
  }

  try {
    console.debug(
      `[${timestamp}] [DEBUG] [getWalletByCharacterId] ` +
      `Querying for wallet with characterId: ${characterId}`
    );
    // Use lean() to get a plain JS object instead of a Mongoose document
    const wallet = await Wallet.findOne({ characterId }).lean();

    if (!wallet) {
      console.info(
        `[${timestamp}] [INFO] [getWalletByCharacterId] ` +
        `Wallet not found for characterId: ${characterId}`
      );
    } else {
      console.info(
        `[${timestamp}] [INFO] [getWalletByCharacterId] ` +
        `Wallet found for characterId: ${characterId}`
      );
    }
    return wallet; // Returns the plain JS object or null
  } catch (error) {
    console.error(
      `[${timestamp}] [ERROR] [getWalletByCharacterId] ` +
      `Database error finding wallet for characterId ${characterId}:`,
      error
    );
    // Consider throwing a generic InternalServerError
    throw new Error(`Server error finding wallet.`);
  }
}
