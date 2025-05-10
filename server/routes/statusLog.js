/**
 * @file Status Log Routes
 * @module server/routes/statusLog
 * @description Provides API routes for fetching character status logs with
 *   pagination. All routes require JWT authentication.
 */
import express from 'express';
import jsonschema from 'jsonschema';
import {
  authenticateJWT,
  ensureCharacterOwnership,
} from '../middleware/auth.js';
import StatusLog from '../models/statusLog.js';
import { BadRequestError } from '../expressError.js';
import { statusLogGetSchema } from '../library/schemaHelpers.js';

const router = express.Router();

/**
 * Route for fetching status log entries for a specific character.
 *
 * Requires authentication and character ownership. Finds the StatusLog
 * document associated with the characterId. Returns a limited number of the
 * most recent log entries, paginated.
 *
 * @name GET /:characterId
 * @function
 * @memberof module:server/routes/statusLog
 * @param {string} path Express path with characterId parameter.
 * @param {Function[]} middleware Array of Express middleware, including
 *   `authenticateJWT` and `ensureCharacterOwnership`.
 * @param {object} req Express request object.
 * @param {object} res Express response object.
 * @param {Function} next Express next middleware function.
 * @param {string} req.params.characterId ID of the character whose logs are
 *   requested.
 * @param {number} [req.query.page=1] The page number for pagination (parsed
 *   from query string). Defaults to 1.
 * @param {number} [req.query.limit=25] The number of logs per page (parsed
 *   from query string). Defaults to 25.
 * @returns {void} Sends a JSON response or calls the next error handler.
 * @throws {BadRequestError} If validation fails (invalid character ID, page,
 *   or limit format).
 * @throws {NotFoundError} If the character's status log document is not found.
 * @sideeffects Logs request details, validation failures, fetch results, and
 *   errors. Calls `StatusLog.getPaginatedLogsByCharacterId`.
 *
 * @response {200} Success - Returns pagination info and log entries.
 *   @property {object} body - Response body.
 *   @property {Array<object>} body.statusLogs - Array of status log entries
 *     (sorted descending by timestamp).
 *   @property {number} body.currentPage - The current page number returned.
 *   @property {number} body.totalPages - The total number of pages available.
 *   @property {number} body.totalEntries - The total number of log entries for
 *     the character.
 * @response {400} Bad Request - Invalid input data (e.g., non-numeric page).
 *   @property {object} body - Error details.
 *   @property {string} body.error - Error message indicating validation
 *     failure.
 * @response {401} Unauthorized - Missing or invalid JWT.
 *   @property {object} body - Error details.
 *   @property {string} body.error - Error message (handled by auth
 *     middleware).
 * @response {403} Forbidden - User does not own the character.
 *   @property {object} body - Error details.
 *   @property {string} body.error - Error message (handled by auth
 *     middleware).
 * @response {404} Not Found - Character's status log document not found.
 *   @property {object} body - Error details.
 *   @property {string} body.error - Error message.
 * @response {500} Internal Server Error - Unexpected server error during
 *   database query or processing.
 *   @property {object} body - Error details.
 *   @property {string} body.error - Error message.
 */
router.get(
  '/:characterId',
  [authenticateJWT, ensureCharacterOwnership],
  async (req, res, next) => {
    // --- Combine params and query for validation ---
    const validationData = {
      characterId: req.params.characterId,
      // Parse query params, provide explicit defaults if parsing fails or missing
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 25,
    };

    // --- Input Validation using JSON Schema ---
    const validator = jsonschema.validate(validationData, statusLogGetSchema, {
      // Use defaults from schema if properties are undefined
      useDefaults: true,
    });

    if (!validator.valid) {
      // Map errors, preferring schema messages if available
      const errors = validator.errors.map((e) => {
        return e.schema.errorMessage || e.stack;
      });
      console.warn(
        `[WARN][StatusLogRoute] Validation failed for char ` +
        `${req.params.characterId || 'N/A'}: ${errors.join(', ')}`
      );
      // Combine errors into a single message for the client
      return next(new BadRequestError(errors.join('; ')));
    }

    // --- Validated and Defaulted Values ---
    const { characterId, page, limit } = validator.instance;
    const skip = (page - 1) * limit;

    try {
      // Fetch paginated status logs using the static model method
      const { totalEntries, paginatedEntries } =
        await StatusLog.getPaginatedLogsByCharacterId(characterId, skip, limit);

      // Calculate total pages based on total entries and limit
      // The model method handles the case where the document doesn't exist
      const totalPages = Math.ceil(totalEntries / limit);

      console.debug(
        `[DEBUG][StatusLogRoute] Fetched page ${page}/${totalPages} ` +
        `(${paginatedEntries.length}/${totalEntries} entries) ` +
        `for char ${characterId}`
      );

      // Return the paginated logs and pagination metadata
      return res.json({
        statusLogs: paginatedEntries, // Already sorted descending by model
        currentPage: page,
        totalPages: totalPages,
        totalEntries: totalEntries,
      });
    } catch (error) {
      // Log unexpected errors during the process
      console.error(
        `[ERROR][StatusLogRoute] Fetching logs for char ${characterId} ` +
        `(Page: ${page}, Limit: ${limit}): ${error.message}`,
        { stack: error.stack } // Include stack trace for debugging
      );
      // Pass error to the central error handler
      return next(error);
    }
  }
);

export default router;
