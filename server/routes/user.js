/**
 * @file User Routes
 * @module server/routes/user
 * @description Provides API routes for user-related actions, including fetching
 *   user data, managing characters associated with the user, and updating
 *   user profile information.
 */
import express from 'express';
import jsonschema from 'jsonschema';
import {
  UnauthorizedError,
  BadRequestError,
  ExpressError,
} from '../expressError.js';

import jwt from 'jsonwebtoken';

import {
  authenticateJWT,
  ensureLoggedIn,
  ensureCorrectUser,
  ensureCharacterOwnershipFromBody,
} from '../middleware/auth.js';

import { SECRET_KEY } from '../constants/config.js';
import Character from '../models/character.js';
import User from '../models/user.js';

import {
  userDeleteCharacterSchema,
  userFavoriteCharacterSchema,
  userCharacterChangeNameSchema,
  userPasswordForgotSchema,
  userUpdateSchema,
} from '../library/schemaHelpers.js';

const router = express.Router();

router.use(express.json());

/**
 * Route for getting user details by username.
 * Requires authentication and authorization (`authenticateJWT` and
 * `ensureCorrectUser`).
 *
 * @name GET /:username
 * @function
 * @memberof module:server/routes/user
 * @param {string} path Express path with `:username` parameter.
 * @param {callback[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureCorrectUser`.
 * @returns {object} 200 JSON object representing the user.
 * @returns {object} 401 Unauthorized (token invalid or insufficient
 *   permissions).
 * @returns {object} 404 Not Found (user not found).
 * @returns {object} 500 Internal server error.
 */
router.get(
  '/:id',
  [authenticateJWT, ensureCorrectUser],
  async (req, res, next) => {
    const requestedId = req.params.id;
    const endpoint = `/api/user/${requestedId}`;
    const loggedInUsername = res.locals.user?.username;
    const loggedInUserId = res.locals.user?.userId;

    // Validate ID parameter
    if (isNaN(Number(requestedId))) {
      return next(
        new BadRequestError(`Invalid User ID format: ${requestedId}`)
      );
    }

    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] START GET ${endpoint} - ` +
      `Requester: '${loggedInUsername || 'Unknown'}' (ID: ${loggedInUserId})`
    );

    try {
      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Fetching details for ` +
        `user ID: '${requestedId}'`
      );

      const user = await User.getById(requestedId);

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Successfully fetched ` +
        `details for user ID '${requestedId}'. Responding.`
      );
      return res.status(200).json({ user });
    } catch (err) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Failed to get user ID ` +
        `'${requestedId}'. Error: ${err.status || 'N/A'} - ${err.message}`
      );
      return next(err);
    }
  }
);

/**
 * Route for deleting one of the logged-in user's characters.
 * Requires authentication and character ownership (from body).
 * Validates request body against `userDeleteCharacterSchema`.
 * Calls `Character.remove` to delete the character from both PG and Mongo.
 *
 * @name POST /userDeleteCharacter
 * @function
 * @memberof module:server/routes/user
 * @param {string} path Express path.
 * @param {callback[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureCharacterOwnershipFromBody`.
 * @returns {object} 200 JSON object indicating deleted character ID:
 *   `{ Deleted: string }`.
 * @returns {object} 400 Bad request (validation error).
 * @returns {object} 401 Unauthorized.
 * @returns {object} 404 Not Found (character not found or doesn't
 *   belong to user).
 * @returns {object} 500 Internal server error.
 */
router.post(
  '/userDeleteCharacter',
  [authenticateJWT, ensureCharacterOwnershipFromBody],
  async (req, res, next) => {
    const endpoint = '/api/user/userDeleteCharacter';
    const user = res.locals.user;
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] START POST ${endpoint} - ` +
      `User: '${user?.username || 'Unknown'}'`
    );
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] Request Body:`,
      req.body
    );

    if (!req.body) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Delete character failed: ` +
        `No request body.`
      );
      return next(
        new BadRequestError('Delete character failed: No data provided.')
      );
    }

    try {
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validating request body...`
      );
      const validator = jsonschema.validate(
        req.body,
        userDeleteCharacterSchema
      );
      if (!validator.valid) {
        console.warn(
          `[${new Date().toISOString()}] [UserRoutes] ` +
          `Delete character failed: Validation errors.`
        );
        const errs = validator.errors.map((e) => e.stack);
        return next(new BadRequestError(errs));
      }
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validation passed.`
      );

      const { characterId } = req.body;

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] User '${user.username}' ` +
        `attempting to delete character ID: ${characterId}`
      );
      const result = await Character.remove(characterId, user);

      if (!result?.deletedCharacterId) {
        console.error(
          `[${new Date().toISOString()}] [UserRoutes] Delete character ` +
          `error: Character.remove succeeded but did not return ` +
          `expected ID.`
        );
        return next(
          new ExpressError('Character deletion failed unexpectedly.', 500)
        );
      }

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Character ` +
        `'${result.deletedCharacterId}' deleted successfully by user ` +
        `'${user.username}'. Responding.`
      );
      return res.status(200).json({ Deleted: result.deletedCharacterId });
    } catch (err) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Delete character failed ` +
        `for user '${user?.username}'. Error: ${err.status || 'N/A'} - ` +
        `${err.message}`
      );
      return next(err);
    }
  }
);

/**
 * Route for setting one of the logged-in user's characters as favorite.
 * Requires authentication and character ownership (from body).
 * Validates request body against `userFavoriteCharacterSchema`.
 * Calls `Character.setFavorite` to update the favorite status in Postgres.
 *
 * @name POST /userFavoriteCharacter
 * @function
 * @memberof module:server/routes/user
 * @param {string} path Express path.
 * @param {callback[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureCharacterOwnershipFromBody`.
 * @returns {object} 200 JSON object indicating favorited character ID and
 *   status: `{ Favorited: { characterId: string, favorite: boolean } }`.
 * @returns {object} 400 Bad request (validation error).
 * @returns {object} 401 Unauthorized.
 * @returns {object} 404 Not Found (character not found or doesn't belong
 *   to user).
 * @returns {object} 500 Internal server error.
 */
router.post(
  '/userFavoriteCharacter',
  [authenticateJWT, ensureCharacterOwnershipFromBody],
  async (req, res, next) => {
    const endpoint = '/api/user/userFavoriteCharacter';
    const user = res.locals.user;
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] START POST ${endpoint} - ` +
      `User: '${user?.username || 'Unknown'}'`
    );
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] Request Body:`,
      req.body
    );

    if (!req.body) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Set favorite failed: ` +
        `No request body.`
      );
      return next(
        new BadRequestError('Set favorite character failed: No data provided.')
      );
    }

    try {
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validating request body...`
      );
      const validator = jsonschema.validate(
        req.body,
        userFavoriteCharacterSchema
      );
      if (!validator.valid) {
        console.warn(
          `[${new Date().toISOString()}] [UserRoutes] ` +
          'Set favorite failed: Validation errors.'
        );
        const errs = validator.errors.map((e) => e.stack);
        return next(new BadRequestError(errs));
      }
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] 
        Validation passed.`
      );

      const { characterId, favoriteState } = req.body;
      console.info(
        `[${new Date().toISOString()}] [UserRoutes] ` +
        `User '${user.username}' (ID: ${user.userId}) attempting to set ` +
        `character ID '${characterId}' favorite state to ` +
        `'${favoriteState === undefined ? true : favoriteState}'.`
      );

      const result = await Character.setFavorite(
        characterId,
        user,
        favoriteState
      );

      if (!result?.success || !result?.characterId) {
        console.error(
          `[${new Date().toISOString()}] [UserRoutes] ` +
          'Set favorite error: Character.setFavorite returned ' +
          'unexpected or unsuccessful result:',
          result
        );
        return next(
          new ExpressError(
            'Failed to set character as favorite unexpectedly.',
            500
          )
        );
      }

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] ` +
        `Character '${result.characterId}' successfully set as favorite for ` +
        `user '${user.username}'. Responding.`
      );
      return res.status(200).json({ Favorited: result });
    } catch (err) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] ` +
        `Set favorite failed for user '${user?.username}'. ` +
        `Error: ${err.status || 'N/A'} - ${err.message}`
      );
      return next(err);
    }
  }
);

/**
 * Route for initiating a password reset (forgot password).
 * Requires authentication (verifies user identity via token before proceeding).
 * Validates email from token payload against `userPasswordForgotSchema`.
 * Note: Currently a placeholder, does not implement email sending.
 *
 * @name POST /userPasswordForgot
 * @function
 * @memberof module:server/routes/user
 * @param {string} path Express path.
 * @param {callback[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureLoggedIn`.
 * @returns {object} 200 JSON object indicating process initiated
 *   (placeholder).
 * @returns {object} 400 Bad request (validation error or email missing
 *   in token).
 * @returns {object} 401 Unauthorized.
 * @returns {object} 500 Internal server error.
 */
router.post(
  '/userPasswordForgot',
  [authenticateJWT, ensureLoggedIn],
  async (req, res, next) => {
    const endpoint = '/api/user/userPasswordForgot';
    const user = res.locals.user;
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] START POST ${endpoint} - ` +
      `User: '${user?.username || 'Unknown'}'`
    );

    try {
      if (!user?.email) {
        console.warn(
          `[${new Date().toISOString()}] [UserRoutes] Password forgot failed: ` +
          'User email not found in token payload.'
        );
        return next(
          new BadRequestError('User email not found in authentication token.')
        );
      }

      const emailData = { email: user.email };
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validating user email ` +
        `from token: ${user.email}...`
      );
      const validator = jsonschema.validate(
        emailData,
        userPasswordForgotSchema
      );
      if (!validator.valid) {
        console.warn(
          `[${new Date().toISOString()}] [UserRoutes] Password forgot failed:` +
          `Email validation failed (schema).`
        );
        const errs = validator.errors.map((e) => e.stack);
        return next(new BadRequestError(errs));
      }
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validation passed.`
      );

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Password reset initiated ` +
        `for user '${user.username}' (email: ${user.email}). ` +
        'Placeholder response sent.'
      );
      return res.status(200).json({
        message: 'Password reset initiated (Not Implemented)',
        detail:
          'If an account exists for this email, a reset link will be sent.',
      });
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] [UserRoutes] Password forgot failed ` +
        `for user '${user?.username}'. Error: ${err.status || 'N/A'} - ` +
        `${err.message}`
      );
      return next(err);
    }
  }
);

/**
 * Route for updating the logged-in user's details (currently only email).
 * Requires authentication.
 * Validates request body against `userUpdateSchema`.
 * Authenticates the user's current password for verification.
 * Updates the user's email using `User.update`.
 * Generates a new JWT token with the updated user information.
 *
 * @name POST /userUpdate
 * @function
 * @memberof module:server/routes/user
 * @param {string} path Express path.
 * @param {callback[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureLoggedIn`.
 * @returns {object} 200 JSON object containing the new JWT token:
 *   `{ token }`.
 * @returns {object} 400 Bad request (validation error).
 * @returns {object} 401 Unauthorized (authentication failed or
 *   incorrect password).
 * @returns {object} 500 Internal server error.
 */
router.post(
  '/userUpdate',
  [authenticateJWT, ensureLoggedIn],
  async (req, res, next) => {
    const endpoint = '/api/user/userUpdate';
    const user = res.locals.user;
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] START POST ` +
      `${endpoint} - User: '${user?.username || 'Unknown'}'`
    );
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] Request Body:`,
      req.body
    );

    if (!req.body) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] User update failed: ` +
        'No request body.'
      );
      return next(new BadRequestError('User update failed: No data provided.'));
    }
    if (!user?.username) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] User update failed: ` +
        'No authenticated user found in res.locals.'
      );
      return next(
        new UnauthorizedError('Authentication required for user update.')
      );
    }

    try {
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validating request body...`
      );

      const validator = jsonschema.validate(req.body, userUpdateSchema);

      if (!validator.valid) {
        console.warn(
          `[${new Date().toISOString()}] [UserRoutes] User update failed: ` +
          'Validation errors.'
        );
        const errs = validator.errors.map((e) => e.stack);
        return next(new BadRequestError(errs));
      }

      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validation passed.`
      );

      const { password, email } = req.body;

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Verifying current ` +
        `password for user '${user.username}' before update.`
      );
      await User.authenticate(user.username, password);
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Current password verified.`
      );

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Updating user details ` +
        `for '${user.username}'...`
      );
      const updateData = { email };
      const updatedUser = await User.update(user.username, updateData);

      if (!updatedUser) {
        console.error(
          `[${new Date().toISOString()}] [UserRoutes] User update failed ` +
          `unexpectedly for user '${user.username}' ` +
          '(User.update returned null/undefined).'
        );
        return next(new ExpressError('User update failed unexpectedly.', 500));
      }
      console.info(
        `[${new Date().toISOString()}] [UserRoutes] ` +
        `User details updated successfully for '${updatedUser.username}'.`
      );

      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Generating new access ` +
        'token with updated details...'
      );
      const token = jwt.sign(updatedUser, SECRET_KEY);
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] New token generated.`
      );

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] User update complete for ` +
        `'${updatedUser.username}'. Responding with new token.`
      );
      return res.status(200).json({ token });
    } catch (err) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] ` +
        `User update failed for user '${user?.username}'. ` +
        `Error: ${err.status || 'N/A'} - ${err.message}`
      );
      return next(err);
    }
  }
);

/**
 * Route for changing the nickname of one of the logged-in user's characters.
 * Requires authentication and character ownership (from body).
 * Validates request body against `userCharacterChangeNameSchema`.
 * Calls `Character.updateNickname` to update the name in MongoDB
 * after verifying ownership in Postgres.
 *
 * @name POST /userCharacterChangeName
 * @function
 * @memberof module:server/routes/user
 * @param {string} path Express path.
 * @param {callback[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureCharacterOwnershipFromBody`.
 * @returns {object} 200 JSON object representing the updated MongoDB
 *   character document.
 * @returns {object} 400 Bad request (validation error, invalid ID
 *   format).
 * @returns {object} 401 Unauthorized.
 * @returns {object} 403 Forbidden (character doesn't belong to user).
 * @returns {object} 404 Not Found (character not found).
 * @returns {object} 500 Internal server error.
 */
router.post(
  '/userCharacterChangeName',
  [authenticateJWT, ensureCharacterOwnershipFromBody],
  async (req, res, next) => {
    const endpoint = '/api/user/userCharacterChangeName';
    const user = res.locals.user;
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] START POST ${endpoint} - ` +
      `User: '${user?.username || 'Unknown'}'`
    );
    console.debug(
      `[${new Date().toISOString()}] [UserRoutes] Request Body:`,
      req.body
    );

    if (!req.body) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Change nickname failed: ` +
        'No request body.'
      );
      return next(
        new BadRequestError('Change nickname failed: No data provided.')
      );
    }
    if (!user?.userId) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Change nickname failed: ` +
        'User ID not found in token payload.'
      );
      return next(new UnauthorizedError('User ID not found in token.'));
    }

    try {
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validating request body...`
      );

      const validator = jsonschema.validate(
        req.body,
        userCharacterChangeNameSchema // Use direct import
      );

      if (!validator.valid) {
        console.warn(
          `[${new Date().toISOString()}] [UserRoutes] Change nickname failed:` +
          'Validation errors.'
        );
        const errs = validator.errors.map((e) => e.stack);
        return next(new BadRequestError(errs));
      }
      console.debug(
        `[${new Date().toISOString()}] [UserRoutes] Validation passed.`
      );

      const { characterId, newNickName } = req.body;
      const userPgId = user.userId;

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] User ID ${userPgId} ` +
        `('${user.username}') attempting to change nickname for ` +
        `character ID: ${characterId} to '${newNickName}'`
      );

      const updatedCharacter = await Character.updateNickname(
        characterId,
        newNickName,
        userPgId
      );

      console.info(
        `[${new Date().toISOString()}] [UserRoutes] Nickname updated ` +
        `successfully for character ID ${characterId}. Responding.`
      );
      return res.status(200).json({ character: updatedCharacter });
    } catch (err) {
      console.warn(
        `[${new Date().toISOString()}] [UserRoutes] Change nickname failed ` +
        `for user '${user?.username}'. Error: ${err.status || 'N/A'} - ` +
        `${err.message}`
      );
      return next(err);
    }
  }
);

export default router;
