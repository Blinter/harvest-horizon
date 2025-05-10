/**
 * @file General Map Routes
 * @module server/routes/maps
 * @description Provides API routes for general map actions not tied to a
 *   specific character path parameter (e.g., deleting by map ID).
 *   Mounted at `/api/maps`.
 */
import express from 'express';
import { authenticateJWT, ensureMapOwnership } from '../middleware/auth.js';
import Map from '../models/map.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError
} from '../expressError.js';
import {
  getWalletByCharacterId,
  processTransaction
} from '../models/wallet.js';

const router = express.Router();

router.use(express.json());

/**
 * Route to delete a specific map by its ID.
 * Requires authentication and map ownership (checked via mapId).
 *
 * @name DELETE /:mapId
 * @function
 * @memberof module:server/routes/maps
 * @param {string} path - Express path with mapId parameter.
 * @param {callback} middleware - Express middleware stack.
 * @returns {object} 200 - Success message:
 *   `{ message: 'Map deleted successfully' }`
 * @returns {object} 400/401/403/404/500 - Errors.
 */
router.delete(
  '/:mapId', // Path relative to the mounted router (/api/maps)
  authenticateJWT,
  // Ensures the authenticated user owns the map specified by :mapId
  ensureMapOwnership,
  async (req, res, next) => {
    const { mapId } = req.params;
    const timestamp = new Date().toISOString();

    console.debug(
      `[${timestamp}] [DEBUG] [MapsRoutes]: DELETE /${mapId} route hit.`
    );

    try {
      // Basic validation for mapId (more robust validation in model)
      if (!mapId || typeof mapId !== 'string') {
        throw new BadRequestError('Invalid or missing map ID.');
      }

      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Calling Map.delete for map ID: ${mapId}`
      );

      await Map.delete(mapId);

      const timestamp2 = new Date().toISOString();
      console.info(
        `[${timestamp2}] [INFO] [MapsRoutes]: Map deleted successfully: ` +
        `${mapId}`
      );

      return res.json({ message: 'Map deleted successfully' });
    } catch (err) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [ERROR] [MapsRoutes]: ` +
        `Error in DELETE /${mapId} route: ${err.message}`,
        { error: err, stack: err.stack }
      );
      return next(err);
    }
  }
);

/**
 * Route to pay rent for all eligible leased tiles on a specific map.
 * Requires authentication and map ownership. Calculates cost based on eligible
 * tiles, deducts from wallet, and updates tile properties.
 *
 * @name PATCH /:mapId
 * @function
 * @memberof module:server/routes/maps
 * @param {string} path - Express path with mapId parameter. This route handles
 *   rent payment, distinct from the DELETE route above.
 * @param {callback} middleware - Express middleware stack, including
 *   authentication and ownership checks.
 * @returns {object} 200 - Success message indicating the number of tiles for
 *   which rent was paid and the new wallet balance:
 *   `{ message: 'Rent paid successfully for X tiles.', newBalance: Y,
 *   updatedTileCount: X }`
 *   If no tiles required payment, returns:
 *   `{ message: 'No tiles currently require rent payment.',
 *   updatedTileCount: 0 }`
 * @returns {object} 400 - Bad Request (e.g., invalid map ID format - though
 *   checked earlier in middleware).
 * @returns {object} 401 - Unauthorized (JWT invalid or missing).
 * @returns {object} 403 - Forbidden (User does not own map, or insufficient
 *   funds).
 * @returns {object} 404 - Not Found (Map or Wallet not found).
 * @returns {object} 500 - Internal Server Error.
 */
router.patch(
  '/:mapId',
  authenticateJWT,
  ensureMapOwnership,
  async (req, res, next) => {
    const { mapId } = req.params;
    // Get characterId from the authenticated user
    const { characterId } = req.user;
    const timestamp = new Date().toISOString();

    console.debug(
      `[${timestamp}] [DEBUG] [MapsRoutes]: PATCH ` +
      `/${mapId} route hit ` +
      `by char ${characterId}.`
    );

    try {
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Entering pay-rent try block for map ${mapId}.`
      );

      // 1. Call Map model method to identify eligible tiles and calculate cost
      // This method will need to be created in Map.js
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Calling Map.payRentForMap with mapId: ${mapId}, characterId: ${characterId}`
      );
      const { updatedTileCount, totalCost } = await Map.payRentForMap(
        mapId,
        characterId // Pass characterId for potential future use/logging
      );
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Map.payRentForMap returned: updatedTileCount=${updatedTileCount}, ` +
        `totalCost=${totalCost}`
      );

      if (updatedTileCount === 0) {
        console.info(
          `[${new Date().toISOString()}] [INFO] [MapsRoutes]: No tiles ` +
          `eligible for rent payment found for map ${mapId}.`
        );
        return res.json({
          message: 'No tiles currently require rent payment.',
          updatedTileCount: 0
        });
      }

      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `${updatedTileCount} tiles eligible for rent on map ${mapId}. ` +
        `Total cost: ${totalCost}`
      );

      // 2. Check Wallet Balance & Deduct Cost
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Calling getWalletByCharacterId for char ${characterId}`
      );
      const wallet = await getWalletByCharacterId(characterId);
      const walletInfo = wallet
        ? `ID ${wallet._id}, Coins ${wallet.coins}`
        : 'Not Found';
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Wallet fetched: ${walletInfo}`
      );

      if (!wallet) {
        // This should ideally not happen if the character exists, but safety check
        throw new NotFoundError(`Wallet not found for character ${characterId}.`);
      }

      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Checking balance. Required: ${totalCost}, Available: ${wallet.coins}`
      );
      if (wallet.coins < totalCost) {
        throw new ForbiddenError(
          `Insufficient funds. Required: ${totalCost}, Available: ${wallet.coins}`
        );
      }

      // 3. Process Transaction
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `Calling processTransaction for wallet ${wallet._id} with amount ${totalCost}`
      );
      // Note: Map.payRentForMap should have already updated the tiles.
      // If processTransaction fails, we have an inconsistency (tiles updated,
      // but cost not paid). This is a limitation without proper transactions.
      // A more robust solution might involve a two-phase commit or reverting
      // the map changes if payment fails, but that adds complexity.
      const updatedWallet = await processTransaction(wallet._id, totalCost);
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [MapsRoutes]: ` +
        `processTransaction returned. New balance: ${updatedWallet?.coins}`
      );

      const timestamp2 = new Date().toISOString();
      console.info(
        `[${timestamp2}] [INFO] [MapsRoutes]: Rent paid successfully for ` +
        `${updatedTileCount} tiles on map ${mapId} by char ${characterId}. ` +
        `Cost: ${totalCost}. New balance: ${updatedWallet.coins}`
      );

      return res.json({
        message: `Rent paid successfully for ${updatedTileCount} tiles.`,
        newBalance: updatedWallet.coins,
        updatedTileCount: updatedTileCount,
      });

    } catch (err) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [ERROR] [MapsRoutes]: Error in PATCH ` +
        `/${mapId} route: ${err.message}`,
        { error: err, stack: err.stack } // Log full error details
      );
      // Pass specific error types for correct status codes
      return next(err);
    }
  }
);

export default router;
