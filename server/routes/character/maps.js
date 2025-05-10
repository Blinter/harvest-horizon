/**
 * @file Character-Specific Map Routes
 * @module server/routes/character/maps
 * @description Provides API routes related to maps belonging to a specific
 *   character. Routes require authentication and character ownership, which
 *   are handled by middleware in the parent router
 *   (`server/routes/character.js`). Mounted at
 *   `/api/character/:characterId/maps`.
 */
import express from 'express';
// Middleware is applied in the parent router, removed here:
// import { authenticateJWT, ensureCharacterOwnership } from '../../middleware/auth.js';
import Map from '../../models/map.js';
import { BadRequestError } from '../../expressError.js';

const router = express.Router({ mergeParams: true }); // Enable params merging

router.use(express.json());

/**
 * Route to get all maps for the specific character (`:characterId` from
 * params). Requires authentication and character ownership (handled by
 * parent router). Calls `Map.getAllForCharacter` model method.
 *
 * Mounted at `GET /`
 *
 * @name GET /
 * @function
 * @memberof module:server/routes/character/maps
 * @param {string} path - Express path (`/`).
 * @param {express.RequestHandler} middleware - Express middleware chain.
 * @returns {object} 200 - JSON object: `{ maps: [...] }`. Contains the
 *   list of maps associated with the character.
 * @returns {object} 401 - Unauthorized. JWT missing, invalid, or
 *   character ownership check failed.
 * @returns {object} 404 - Not Found. Character not found, or no maps are
 *   associated with the character.
 * @returns {object} 500 - Internal Server Error. Unexpected server issue.
 */
router.get('/', async (req, res, next) => {
  // ensureCharacterOwnership is already applied before this route
  try {
    const { characterId } = req.params; // Get from merged params
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [DEBUG] [CharacterMapsRoutes]: GET / route hit ` +
      `for characterId: ${characterId}.`
    );

    // Fetch maps using the Map model's static method
    const maps = await Map.getAllForCharacter(characterId);

    const timestamp2 = new Date().toISOString();
    console.debug(
      `[${timestamp2}] [DEBUG] [CharacterMapsRoutes]: ` +
      `Maps retrieved successfully for ${characterId}. Count: ${maps.length}`
    );

    return res.json({ maps });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error(
      `[${errorTimestamp}] [ERROR] [CharacterMapsRoutes]: ` +
      `Error in GET / route for character ${req.params.characterId}: ` +
      `${err.message}`,
      err
    );
    return next(err);
  }
});

/**
 * Route to create a new map for the specific character (`:characterId`
 * from params). Requires authentication and character ownership (handled
 * by parent router). Calls `Map.create` model method using `characterId`
 * and optional data from the request body.
 *
 * Mounted at `POST /`
 *
 * @name POST /
 * @function
 * @memberof module:server/routes/character/maps
 * @param {string} path - Express path (`/`).
 * @param {express.RequestHandler} middleware - Express middleware chain.
 * @param {object} [req.body] - Optional. Provides initial map data,
 *   e.g., `{ mapNickname: 'My Farm' }`.
 * @returns {object} 201 - Created. JSON object representing the newly
 *   created map document.
 * @returns {object} 400 - Bad Request. Invalid `characterId` (though
 *   typically caught by middleware) or malformed request body data.
 * @returns {object} 401 - Unauthorized. JWT missing, invalid, or
 *   character ownership check failed.
 * @returns {object} 404 - Not Found. The specified character was not
 *   found (typically caught by middleware).
 * @returns {object} 500 - Internal Server Error. Unexpected server issue,
 *   e.g., database error during map creation.
 */
router.post('/', async (req, res, next) => {
  // ensureCharacterOwnership is already applied before this route
  const { characterId } = req.params; // Get from merged params
  const clientProvidedData = req.body || {};
  const timestamp = new Date().toISOString();

  console.debug(
    `[${timestamp}] [DEBUG] [CharacterMapsRoutes]: POST / route hit for ` +
    `characterId ${characterId}. Data received:`,
    clientProvidedData
  );

  try {
    // Basic validation for characterId (already done by ensureCharacterOwnership)
    if (!characterId || typeof characterId !== 'string') {
      throw new BadRequestError(
        'Invalid or missing character ID in parameters.'
      );
    }

    const mapCreationData = {
      characterId,
      mapNickname: clientProvidedData.mapNickname,
    };

    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [CharacterMapsRoutes]: ` +
      `Calling Map.create with final data:`,
      mapCreationData
    );

    const newMap = await Map.create(mapCreationData);

    const timestamp2 = new Date().toISOString();
    console.info(
      `[${timestamp2}] [INFO] [CharacterMapsRoutes]: New map created ` +
      `successfully for character ${characterId}. Map ID: ${newMap._id}`
    );

    return res.status(201).json(newMap);
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error(
      `[${errorTimestamp}] [ERROR] [CharacterMapsRoutes]: ` +
      `Error in POST / route for character ${req.params.characterId}: ` +
      `${err.message}`,
      { error: err, stack: err.stack }
    );
    return next(err);
  }
});

export default router;
