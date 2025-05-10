/**
 * @file API routes for managing Wallets.
 * @module server/routes/wallet
 * @description Defines endpoints for fetching and updating wallet
 *   information.
 */

import express from 'express';
import { findWalletByCharacterId } from '../models/wallet.js';
import {
  authenticateJWT,
  ensureCharacterOwnership,
} from '../middleware/auth.js';

const router = express.Router();

// --- Routes ---

/**
 * @route   GET /api/wallets/character/:characterId
 * @desc    Get wallet details for a specific character
 * @access  Private (Requires authentication and character
 *   ownership)
 * @param   {string} characterId - The MongoDB ObjectId of the
 *   character.
 * @returns {object} 200 - The wallet object associated with the
 *   character.
 * @returns {object} 400 - If characterId format is invalid (handled
 *   by model/middleware).
 * @returns {object} 401 - Unauthorized.
 * @returns {object} 403 - Forbidden (access denied).
 * @returns {object} 404 - If wallet or character not found.
 * @returns {object} 500 - Server error.
 */
router.get(
  '/character/:characterId',
  [authenticateJWT, ensureCharacterOwnership],
  async (req, res, next) => {
    const { characterId } = req.params;
    const timestamp = new Date().toISOString();

    try {
      console.debug(
        `[${timestamp}] [DEBUG] [GET /api/wallets/character/:characterId] ` +
        `Calling findWalletByCharacterId for: ${characterId}`
      );

      const wallet = await findWalletByCharacterId(characterId);

      console.info(
        `[${timestamp}] [INFO] [GET /api/wallets/character/:characterId] ` +
        `Wallet found for character: ${characterId}`
      );
      return res.json(wallet);
    } catch (error) {
      console.error(
        `[${timestamp}]` +
        ` [ERROR] [GET /api/wallets/character/:characterId] ` +
        `Error processing request for character ` +
        `${characterId}: ${error.message}`,
        { stack: error.stack }
      );
      return next(error);
    }
  }
);

export default router;
