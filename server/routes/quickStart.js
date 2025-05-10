/**
 * @file Quick Start Route
 * @module server/routes/quickStart
 * @description Defines the API route for initiating a quick start session.
 *   Creates a temporary user, character, and map, and returns credentials.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import Character from '../models/character.js';
import Map from '../models/map.js';
import {
  SECRET_KEY,
  BCRYPT_WORK_FACTOR,
  QUICK_START_TTL_SECONDS,
  QUICK_START_TEMP_PG_EMAIL_PREFIX
} from '../constants/config.js';
import { query, connect } from '../database/dbPostgres.js'; // Keep for PG query
import { convertToObjectId } from '../database/dbMongo.js';
import { ExpressError } from '../expressError.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateRefreshToken } from '../utils/tokenService.js';
import RefreshTokenStore from '../utils/refreshTokenStore.js';

const router = express.Router();

/**
 * Creates the temporary PostgreSQL user record. Hashes a generated password
 * and inserts the temporary user details.
 *
 * @private
 * @async
 * @function _createTemporaryPgUser
 * @returns {Promise<{pgUserId: number, tempUsername: string}>} Resolves with
 *   the new PostgreSQL user ID and the generated temporary username.
 * @throws {Error} If password hashing or PostgreSQL insert fails.
 */
async function _createTemporaryPgUser() {
  const timestamp = new Date().toISOString();
  // Generate & Hash Password
  const tempPassword = crypto.randomBytes(16).toString('hex');
  let tempPasswordHash;
  try {
    tempPasswordHash = await bcrypt.hash(
      tempPassword,
      BCRYPT_WORK_FACTOR || 12
    );
  } catch (hashError) {
    console.error(
      `[${timestamp}][ERROR][_createTemporaryPgUser] Failed to hash ` +
      `password: ${hashError.message}`
    );
    throw new Error('Failed to prepare temporary user data.');
  }

  // Insert into farm_users (PG)
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const tempUsername = `${QUICK_START_TEMP_PG_EMAIL_PREFIX}${uniqueSuffix}`;
  const tempEmail =
    `${QUICK_START_TEMP_PG_EMAIL_PREFIX}` +
    `${uniqueSuffix}` +
    `@temporary.local`;
  const insertPgUserQuery =
    `INSERT INTO
        farm_users (username, password_hash, email)
      VALUES
        ($1, $2, $3)
      RETURNING
        id;`;
  await connect();
  const pgResult = await query(insertPgUserQuery, [
    tempUsername,
    tempPasswordHash,
    tempEmail
  ]);
  if (pgResult.rows.length === 0 || !pgResult.rows[0].id) {
    throw new Error('Failed to insert temporary user into PostgreSQL.');
  }
  const pgUserId = pgResult.rows[0].id;
  console.debug(
    `[${timestamp}][DEBUG][_createTemporaryPgUser] PG user created: ${pgUserId}`
  );
  return { pgUserId, tempUsername };
}

/**
 * Creates the character (Mongo docs + PG link) using the Character model.
 * Assumes Character.createNewCharacterForUser handles internal linking.
 *
 * @private
 * @async
 * @function _createQuickStartCharacter
 * @param {number} pgUserId - The PostgreSQL User ID.
 * @returns {Promise<Object>} The MongoDB ObjectId of the new character.
 * @throws {Error} If character creation fails or model returns unexpected
 *   data.
 */
async function _createQuickStartCharacter(pgUserId) {
  const timestamp = new Date().toISOString();
  console.debug(
    `[${timestamp}][DEBUG][_createQuickStartCharacter] Calling ` +
    `Character.createNewCharacterForUser for PG User ${pgUserId}...`
  );
  const characterData = await Character.createNewCharacterForUser(pgUserId, undefined);
  if (!characterData?.character_id) {
    throw new Error('Character creation method failed to return expected data.');
  }
  // Ensure convertToObjectId is imported and correctly converts the string ID
  const newCharacterMongoId = convertToObjectId(characterData.character_id);
  console.debug(
    `[${timestamp}][DEBUG][_createQuickStartCharacter] Character created: ` +
    `${newCharacterMongoId}`
  );
  return newCharacterMongoId;
}

/**
 * Creates the map (Mongo doc) using the Map model.
 *
 * @async
 * @function _createQuickStartMap
 * @param {Object} newCharacterMongoId - The MongoDB Character ObjectId.
 * @returns {Promise<Object>} The MongoDB ObjectId of the new map.
 * @throws {Error} If map creation fails or model returns unexpected data.
 */
async function _createQuickStartMap(newCharacterMongoId) {
  const timestamp = new Date().toISOString();
  console.debug(
    `[${timestamp}][DEBUG][_createQuickStartMap] Calling Map.create for ` +
    `Character ${newCharacterMongoId}...`
  );
  const newMap = await Map.create({ characterId: newCharacterMongoId });
  if (!newMap?._id) {
    throw new Error('Map creation method failed to return expected data.');
  }
  const newMapMongoId = newMap._id;
  console.debug(
    `[${timestamp}][DEBUG][_createQuickStartMap] Map created: ${newMapMongoId}`
  );
  return newMapMongoId;
}

/**
 * Sets the User (PG) and Map (Mongo) favorites. Assumes relevant static
 * methods exist on User and Map models.
 *
 * @private
 * @async
 * @function _setQuickStartFavorites
 * @param {number} pgUserId - PostgreSQL User ID.
 * @param {string} tempUsername - The generated temporary username.
 * @param {Object} newCharacterMongoId - MongoDB Character ObjectId.
 * @param {Object} newMapMongoId - MongoDB Map ObjectId.
 * @returns {Promise<void>} Completes when favorites are set.
 * @throws {Error} If setting favorites fails in either database.
 */
async function _setQuickStartFavorites(pgUserId, tempUsername, newCharacterMongoId, newMapMongoId) {
  const timestamp = new Date().toISOString();
  console.debug(
    `[${timestamp}][DEBUG][_setQuickStartFavorites] Setting favorites for ` +
    `PG User ${pgUserId}...`
  );

  // Construct the minimal user object needed by Character.setFavorite
  const userForFavorite = {
    userId: pgUserId,
    username: tempUsername // Include username if setFavorite uses it for logging/checks
  };

  // Use Character.setFavorite to update the Mongo Character document
  // Pass the actual ObjectId and the user object
  await Character.setFavorite(newCharacterMongoId, userForFavorite, true);

  // Assumes Map class has this static method to update Mongo
  await Map.favorite(newMapMongoId);
  console.debug(
    `[${timestamp}][DEBUG][_setQuickStartFavorites] Favorites set.`
  );
}

/**
 * @name POST /api/quick-start
 * @function
 * @async
 * @memberof module:server/routes/quickStart
 * @description Creates a temporary user account, a default character linked
 *   to it, a default map for the character, sets both as favorite, and
 *   returns a JWT token for the temporary session. Intended for users
 *   starting without registration.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the session token and
 *   created entity IDs, or throws an error.
 * @throws {ExpressError} If any step in the creation process fails.
 */
router.post('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  let pgUserId; // Keep track for error logging if needed
  let tempUsername; // Keep track for error logging

  console.warn(`[${timestamp}][WARN][quickStart] Executing quick start...`);

  try {
    // Step 1: Create PG User
    const { pgUserId: createdPgUserId, tempUsername: createdTempUsername } =
      await _createTemporaryPgUser();
    pgUserId = createdPgUserId;
    tempUsername = createdTempUsername; // Capture tempUsername

    // Step 2: Create Character
    const newCharacterMongoId = await _createQuickStartCharacter(pgUserId);

    // Step 3: Create Map
    const newMapMongoId = await _createQuickStartMap(newCharacterMongoId);

    // Step 4: Set Favorites
    await _setQuickStartFavorites(pgUserId, tempUsername, newCharacterMongoId, newMapMongoId);

    // Step 5: Generate Tokens
    const payload = {
      id: pgUserId,
      pgId: pgUserId,
      username: tempUsername,
      isTemporary: true
    };
    const accessToken = jwt.sign(
      payload,
      SECRET_KEY,
      { expiresIn: QUICK_START_TTL_SECONDS }
    );
    const refreshToken = generateRefreshToken(payload); // Generate refresh token
    console.debug(`[${timestamp}][DEBUG][quickStart] JWT Access & Refresh Tokens generated.`);

    // Step 5.5: Save Refresh Token
    console.debug(`[${timestamp}][DEBUG][quickStart] Saving refresh token...`);
    await RefreshTokenStore.save(refreshToken, pgUserId);
    console.debug(`[${timestamp}][DEBUG][quickStart] Refresh token saved.`);

    // Step 6: Send Success Response
    const finalCharacterFavoriteStatus = true; // Assuming success from step 4

    console.info(
      `[${timestamp}][INFO][quickStart] Quick start session created ` +
      `successfully for PG user ${pgUserId}.`
    );
    res.status(201).json({
      message: 'Quick start session created successfully.',
      token: accessToken, // Keep 'token' for compatibility if needed
      accessToken: accessToken, // Also add explicitly named accessToken
      refreshToken: refreshToken, // Add refreshToken
      user: {
        id: pgUserId,
        pgId: pgUserId,
        username: tempUsername,
        isTemporary: true,
        favoriteCharacter: finalCharacterFavoriteStatus
          ? newCharacterMongoId.toString()
          : null,
      },
      characterId: newCharacterMongoId,
      mapId: newMapMongoId,
    });

  } catch (error) {
    console.error(
      `[${timestamp}][ERROR][quickStart] Failed to create quick start ` +
      `session: ${error.message}`,
      { pgUserId, username: tempUsername, stack: error.stack }
    );
    throw error instanceof ExpressError ? error :
      new ExpressError('Failed to create quick start session.', 500);
  }
});

export default router;
