/**
 * @file Character-Specific Inventory Route
 * @module server/routes/character/inventory
 * @description Provides API routes related to inventory for a specific
 *   character. This router handles retrieving inventory data associated with
 *   a character ID provided in the URL parameters. It assumes necessary
 *   authentication and authorization middleware (like checking character
 *   ownership) has been applied by a parent router. Mounted at
 *   `/api/character/:characterId/inventory`.
 */
import express from 'express';
// Middleware is applied in the parent router, removed here:
// import { authenticateJWT, ensureCharacterOwnership } from '../../middleware/auth.js';
import Inventory from '../../models/inventory.js';

const router = express.Router({ mergeParams: true }); // Enable params merging

router.use(express.json());

/**
 * Route to get the inventory for the specific character (:characterId from
 * params).
 * Requires authentication and character ownership (handled by parent router).
 * Uses Inventory.getByCharacterId to fetch the inventory data.
 * Mounted at GET /
 *
 * @name GET /
 * @function
 * @memberof module:server/routes/character/inventory
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 * @returns {object} 200 - JSON object with inventory and coins:
 *   `{ inventory: [...], coins: number }`
 * @returns {object} 400 - Bad request (invalid character ID format).
 * @returns {object} 401 - Unauthorized.
 * @returns {object} 403 - Forbidden (user does not own this character -
 * handled by middleware).
 * @returns {object} 404 - Not found (inventory not found for this
 *   character).
 * @returns {object} 500 - Internal server error.
 */
router.get('/', async (req, res, next) => {
  // ensureCharacterOwnership is already applied before this route
  try {
    const { characterId } = req.params; // Get from merged params
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [DEBUG] [CharacterInventoryRoutes]: GET / route hit ` +
      `for characterId: ${characterId}.`
    );

    // Fetch inventory and wallet data using the updated model method
    const { inventory, coins } = await Inventory.getByCharacterId(characterId);

    const timestamp2 = new Date().toISOString();
    console.debug(
      `[${timestamp2}] [DEBUG] [CharacterInventoryRoutes]: Inventory and ` +
      `wallet retrieved successfully for ${characterId}.`
    );

    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterInventoryRoutes.get',
      message: 'Inventory and coins retrieved successfully',
      context: {
        inventory: JSON.stringify(inventory.items),
        coins,
      },
    });
    return res.json({ inventory, coins });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error(
      `[${errorTimestamp}] [ERROR] [CharacterInventoryRoutes]: ` +
      `Error in GET / route for character ${req.params.characterId}: ` +
      `${err.message}`,
      err
    );
    return next(err);
  }
});

export default router;
