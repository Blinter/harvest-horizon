/**
 * @file Character Action Routes
 * @module server/routes/character
 * @description Provides API routes for character-specific actions like
 *   inventory management (buying/selling items) and map management.
 *
 *   All routes require JWT authentication.
 */
import express from 'express';
import jsonschema from 'jsonschema';
import {
  authenticateJWT,
  ensureCharacterOwnership,
  ensureCharacterOwnershipFromBody,
  ensureMapOwnershipFromBody,
} from '../middleware/auth.js';
import schemas from '../utils/schemaLoader.js';

import Inventory from '../models/inventory.js';
import Map from '../models/map.js';
import Character from '../models/character.js';

import { BadRequestError, UnauthorizedError } from '../expressError.js';

// Import sub-routers
import characterMapsRouter from './character/maps.js';
import characterInventoryRouter from './character/inventory.js';

const router = express.Router();

router.use(express.json());

/**
 * Retrieves all characters associated with the authenticated user.
 * Requires JWT authentication. Calls the `Character.getAllForUser` model
 * method to fetch data.
 *
 * @name GET /
 * @function
 * @memberof module:server/routes/character
 * @param {string} path - Express route path (`/api/character`).
 * @param {express.RequestHandler[]} middleware - Array of Express middleware,
 *   including `authenticateJWT`.
 * @param {express.Request} req - Express request object.
 * @param {express.Response} res - Express response object. Contains user
 *   payload in `res.locals.user` after `authenticateJWT`.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response containing the characters or
 *   calls `next` with an error.
 * @route GET /api/character
 * @authentication Requires valid JWT in Authorization header. The token payload
 *   should contain `userId` (or `pgId`).
 * @response {200} Success - Returns `{ characters: Character[] }` where
 *   `Character` represents the combined PG and Mongo character data.
 * @response {401} Unauthorized - Authentication failed or user identifier
 *   missing/invalid in the token.
 * @response {400} Bad Request - Invalid user ID format detected (before model
 *   call).
 * @response {500} Internal Server Error - Unexpected error during processing.
 */
router.get('/', authenticateJWT, async (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userPayload = res.locals.user;

  // Determine the correct user identifier (PG ID)
  const userId = userPayload?.userId || userPayload?.pgId;

  console.debug({
    timestamp: timestamp,
    service: 'GET /api/character (Route Handler)',
    message: `Attempting to retrieve all characters for user...`,
    context: { userIdFromToken: userId, payload: userPayload },
  });

  if (userId === undefined || userId === null) {
    console.error({
      timestamp: timestamp,
      service: 'GET /api/character (Route Handler)',
      message:
        `Get all characters failed: User identifier (userId or pgId) ` +
        `missing from token.`,
      context: { payload: userPayload }, // Log the payload for debugging
    });
    return next(
      new UnauthorizedError(
        `Authentication required or user identifier missing.`
      )
    );
  }

  // Validate userId format (basic check)
  // Model should handle robust validation
  if (isNaN(Number(userId))) {
    console.error({
      timestamp: timestamp,
      service: 'GET /api/character (Route Handler)',
      message: `Get all characters failed: Invalid User ID format (${userId}).`,
    });
    return next(new BadRequestError(`Invalid User ID format.`));
  }
  const numericUserId = Number(userId);

  try {
    console.debug({
      timestamp: timestamp,
      service: 'GET /api/character (Route Handler)',
      message:
        `Calling Character.getAllForUser for user ID ${numericUserId}...`,
    });
    // Directly call the model method which handles PG query and Mongo fetching
    const combinedCharacters = await Character.getAllForUser(numericUserId);

    console.info({
      timestamp: timestamp,
      service: 'GET /api/character (Route Handler)',
      message:
        `Finished Character.getAllForUser call for user ID ` +
        `${numericUserId}.`,
      context: { finalCount: combinedCharacters.length },
    });

    return res.json({ characters: combinedCharacters });
  } catch (err) {
    console.error({
      timestamp: timestamp,
      service: 'GET /api/character (Route Handler)',
      message: `Error retrieving characters for user ID...`,
      context: { userId: numericUserId, error: err.message, stack: err.stack },
    });
    // Pass error to Express error handler
    // Let the model's error type (e.g., BadRequestError, ExpressError) pass through
    return next(err);
  }
});

/**
 * Handles the purchase of items for a specific character.
 * Requires JWT authentication and validation that the authenticated user owns
 * the character specified in the request body. Validates the request body
 * against the `characterItemsBuySchema`. Calls the `Inventory.buyItems` model
 * method to process the purchase, checking funds and updating
 * inventory/currency.
 *
 * @name POST /buyItems
 * @function
 * @memberof module:server/routes/character
 * @param {string} path - Express route path (`/api/character/buyItems`).
 * @param {express.RequestHandler[]} middleware - Array of Express middleware,
 *   including `authenticateJWT` and `ensureCharacterOwnershipFromBody`.
 * @param {express.Request} req - Express request object containing purchase
 *   details in the body.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with purchase result or calls
 *   `next` with an error.
 * @route POST /api/character/buyItems
 * @authentication Requires valid JWT and character ownership via body.
 * @body {{
 *   characterId: string,
 *   itemType: string,
 *   itemName: string,
 *   quantity: number
 * }} PurchaseDetails - The details of the item purchase.
 * @response {200} Success - Returns the result from `Inventory.buyItems`,
 *   typically `{ success: true, message: string }`.
 * @response {400} Bad Request - Invalid request body (schema validation
 *   failed), insufficient funds, or other business logic error from model.
 * @response {401} Unauthorized - Authentication failed or character ownership
 *   validation failed.
 * @response {500} Internal Server Error - Unexpected error during processing.
 */
router.post(
  '/buyItems',
  authenticateJWT,
  ensureCharacterOwnershipFromBody,
  async (req, res, next) => {
    if (!req.body) throw new BadRequestError('No data sent');
    try {
      const validator = jsonschema.validate(
        req.body,
        schemas.characterItemsBuy
      );

      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }

      const { characterId, itemType, itemName, quantity } = req.body;

      const result = await Inventory.buyItems(
        characterId,
        itemType,
        itemName,
        quantity
      );

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Handles the sale of items from a specific character's inventory.
 * Requires JWT authentication and validation that the authenticated user owns
 * the character specified in the request body. Validates the request body
 * against the `characterItemsSellSchema`. Calls the `Inventory.sellItems`
 * model method to process the sale, checking item availability and updating
 * inventory/currency.
 *
 * @name POST /sellItems
 * @function
 * @memberof module:server/routes/character
 * @param {string} path - Express route path (`/api/character/sellItems`).
 * @param {express.RequestHandler[]} middleware - Array of Express middleware,
 *   including `authenticateJWT` and `ensureCharacterOwnershipFromBody`.
 * @param {express.Request} req - Express request object containing sale
 *   details in the body.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with sale result or calls
 *   `next` with an error.
 * @route POST /api/character/sellItems
 * @authentication Requires valid JWT and character ownership via body.
 * @body {{
 *   characterId: string,
 *   itemType: string,
 *   itemName: string,
 *   quantity: number
 * }} SaleDetails - The details of the item sale.
 * @response {200} Success - Returns the result from `Inventory.sellItems`,
 *   typically `{ success: true, message: string }`.
 * @response {400} Bad Request - Invalid request body (schema validation
 *   failed), insufficient items in inventory, or other business logic error
 *   from the model.
 * @response {401} Unauthorized - Authentication failed or character ownership
 *   validation failed.
 * @response {500} Internal Server Error - Unexpected error during processing.
 */
router.post(
  '/sellItems',
  authenticateJWT,
  ensureCharacterOwnershipFromBody,
  async (req, res, next) => {
    if (!req.body) throw new BadRequestError('No data sent');

    try {
      const validator = jsonschema.validate(
        req.body,
        schemas.characterItemsSell
      );

      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }

      const { characterId, itemType, itemName, quantity } = req.body;

      const result = await Inventory.sellItems(
        characterId,
        itemType,
        itemName,
        quantity
      );

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Changes the nickname of a specific map owned by the character.
 * Requires JWT authentication and validation that the authenticated user owns
 * the map (via the character specified in the request body). Validates the
 * request body against the `characterMapChangeNameSchema`. Calls the
 * `Map.changeName` model method to update the map's nickname.
 *
 * @name POST /mapChangeName
 * @function
 * @memberof module:server/routes/character
 * @param {string} path - Express route path (`/api/character/mapChangeName`).
 * @param {express.RequestHandler[]} middleware - Array of Express middleware,
 *   including `authenticateJWT` and `ensureMapOwnershipFromBody`.
 * @param {express.Request} req - Express request object containing the map ID
 *   and new nickname.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the updated Map document
 *   or calls `next` with an error.
 * @route POST /api/character/mapChangeName
 * @authentication Requires valid JWT and map ownership via body.
 * @body {{mapId: string, newNickName: string}} MapNicknameUpdate - The map ID
 *   and the desired new nickname.
 * @response {200} Success - Returns the updated Map document object from the
 *   database.
 * @response {400} Bad Request - Invalid request body (schema validation
 *   failed).
 * @response {401} Unauthorized - Authentication failed or map ownership
 *   validation failed.
 * @response {404} Not Found - The specified `mapId` does not exist or is not
 *   accessible to the user.
 * @response {500} Internal Server Error - Unexpected error during processing.
 */
router.post(
  '/mapChangeName',
  authenticateJWT,
  ensureMapOwnershipFromBody,
  async (req, res, next) => {
    if (!req.body) throw new BadRequestError('No data sent');

    try {
      const validator = jsonschema.validate(
        req.body,
        schemas.characterMapChangeName
      );

      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }

      const { mapId, newNickName } = req.body;

      const result = await Map.changeName(mapId, newNickName);

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Marks a specific map owned by the character as their favorite map.
 * Requires JWT authentication and validation that the authenticated user owns
 * the map specified in the request body. Validates the request body against the
 * `characterMapFavoriteSchema`. Calls the `Map.favorite` model method to update
 * the map's favorite status and potentially unfavorite other maps for the
 * same character.
 *
 * @name POST /mapFavorite
 * @function
 * @memberof module:server/routes/character
 * @param {string} path - Express route path (`/api/character/mapFavorite`).
 * @param {express.RequestHandler[]} middleware - Array of Express middleware,
 *   including `authenticateJWT` and `ensureMapOwnershipFromBody`.
 * @param {express.Request} req - Express request object containing the map ID.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response confirming the favorite
 *   update or calls `next` with an error.
 * @route POST /api/character/mapFavorite
 * @authentication Requires valid JWT and map ownership via body.
 * @body {{mapId: string}} MapFavoriteUpdate - The ID of the map to mark as
 *   favorite.
 * @response {200} Success - Returns an object containing the ID of the map
 *   that was successfully marked as favorite (e.g., `{ mapId: string }`).
 * @response {400} Bad Request - Invalid request body (schema validation
 *   failed).
 * @response {401} Unauthorized - Authentication failed or map ownership
 *   validation failed.
 * @response {404} Not Found - The specified `mapId` does not exist or is not
 *   accessible to the user.
 * @response {500} Internal Server Error - Unexpected error during processing.
 */
router.post(
  '/mapFavorite',
  authenticateJWT,
  ensureMapOwnershipFromBody,
  async (req, res, next) => {
    if (!req.body) throw new BadRequestError('No data sent');

    try {
      const validator = jsonschema.validate(
        req.body,
        schemas.characterMapFavorite
      );

      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }

      const { mapId } = req.body;

      const result = await Map.favorite(mapId);

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Creates a new character for the authenticated user.
 * Requires JWT authentication. Extracts user ID from the token. Validates the
 * optional character name provided in the body against `characterCreateSchema`.
 * Calls `Character.createNewCharacterForUser` model method, which handles
 * creation in both PG and MongoDB, generating a default name if needed.
 *
 * @name POST /
 * @function
 * @memberof module:server/routes/character
 * @param {string} path - Express route path (`/api/character`).
 * @param {express.RequestHandler[]} middleware - Array of Express middleware,
 *   including `authenticateJWT`.
 * @param {express.Request} req - Express request object. May contain an
 *   optional `characterName` in the body.
 * @param {express.Response} res - Express response object. User payload is
 *   expected in `res.locals.user`.
 * @param {express.NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the new character data
 *   or calls `next` with an error.
 * @route POST /api/character
 * @authentication Requires valid JWT in Authorization header. Token payload
 *   must contain `userId`.
 * @body {{characterName?: string}} [CharacterCreationOptions] - An optional
 *   name for the new character.
 * @response {201} Created - Returns the newly created character data object,
 *   including details from both PG (`pg_id`) and MongoDB (`_id`, `name`).
 * @response {400} Bad Request - Invalid user ID format in token, or invalid
 *   `characterName` (schema validation failed).
 * @response {401} Unauthorized - Authentication failed (invalid/missing token
 *   or `userId`).
 * @response {500} Internal Server Error - Unexpected error during character
 *   creation in the model.
 */
router.post('/', authenticateJWT, async (req, res, next) => {
  try {
    // 1. Authentication & User ID extraction
    if (!res.locals.user?.userId) {
      throw new UnauthorizedError(`Invalid or missing authentication token.`);
    }
    const userIdString = res.locals.user.userId;
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [DEBUG] [CharacterRoutes]: Received POST request ` +
      `to /api/characters. User ID: ${userIdString}`
    );

    // 2. User ID Validation
    const userId = parseInt(userIdString, 10);
    if (isNaN(userId)) {
      throw new BadRequestError(`Invalid user ID format in token.`);
    }

    // 3. Request Body Validation (Character Name)
    const validator = jsonschema.validate(req.body, schemas.characterCreate);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs.join(', '));
    }
    // Extract optional characterName from validated body
    const { characterName } = req.body;

    // 4. Call the Model Method to Handle Creation Logic
    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [CharacterRoutes]: ` +
      `Calling Character.createNewCharacterForUser...`,
      { userId, characterNameProvided: !!characterName }
    );
    const newCharacterData = await Character.createNewCharacterForUser(
      userId,
      characterName // Pass undefined if not provided
    );

    // 5. Send Response
    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [CharacterRoutes]: ` +
      `Character creation successful. Returning data.`,
      { pgId: newCharacterData.pg_id, name: newCharacterData.name }
    );
    return res.status(201).json(newCharacterData);
  } catch (err) {
    // Log the specific error from the model or validation
    console.error(
      `[${new Date().toISOString()}] [ERROR] [CharacterRoutes]: ` +
      `Error during POST / character creation: ${err.message}`,
      {
        name: err.name,
        status: err.status,
        stack: err.stack?.split('\n')?.[1]?.trim(), // Log first line of stack
      }
    );
    // Pass error to the central error handler
    return next(err);
  }
});

// --- Character-Specific Sub-Routers --- //

// Apply character ownership middleware *before* mounting sub-routers that need it
router.use(
  '/:characterId/maps',
  authenticateJWT, // Ensure user is logged in
  ensureCharacterOwnership, // Ensure user owns the character ID in the path
  characterMapsRouter
);

router.use(
  '/:characterId/inventory',
  authenticateJWT, // Ensure user is logged in
  ensureCharacterOwnership, // Ensure user owns the character ID in the path
  characterInventoryRouter
);

export default router;
