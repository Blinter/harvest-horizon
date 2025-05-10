/**
 * @file Mongoose schema definition for Wallets.
 * @module server/database/mongo/walletSchema
 * @description Defines the structure for wallet documents in MongoDB, linked
 *   to a Character document, primarily storing currency.
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for character wallets.
 *
 * @typedef {object} WalletSchema
 * @property {mongoose.Types.ObjectId} characterId - Reference to the Character
 *   document (required, unique, indexed).
 * @property {number} coins - Amount of standard currency the character
 *   possesses (default: 0, min: 0).
 * @property {Date} createdAt - Timestamp of document creation (managed by
 *   Mongoose via timestamps).
 * @property {Date} updatedAt - Timestamp of last document update (managed by
 *   Mongoose via timestamps).
 */
export const walletSchema = new mongoose.Schema(
  {
    /**
     * Reference to the owning Character document.
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
     * The amount of standard currency ('coins') the character possesses.
     * @type {number}
     * @default 0
     * @min 0
     */
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Future currencies could be added here, e.g.:
    // premiumCurrency: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

/**
 * Mongoose model for the Wallet schema.
 *
 * @type {mongoose.Model<WalletSchema>}
 */
export default mongoose.model('Wallet', walletSchema);
