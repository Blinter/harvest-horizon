/**
 * @file Character Model
 * @module server/models/character
 * @description Defines the Character class for managing character data across
 *   PostgreSQL (relational info) and MongoDB (detailed stats, inventory, etc.).
 *   Handles creation, modification, deletion, and other
 *   character-related actions.
 */

import mongoose from 'mongoose';

import { query, connect } from '../database/dbPostgres.js';
import {
  CHARACTERS_DATABASE,
  MAX_CHARACTERS_PER_USER,
} from '../constants/config.js';

import {
  NotFoundError,
  BadRequestError,
  ExpressError,
  CharacterLimitExceededError,
  DuplicateCharacterNameError,
} from '../expressError.js';

import User from './user.js';

import { characterSchema } from '../database/mongo/characterSchema.js';
import { inventorySchema } from '../database/mongo/inventorySchema.js';
import { walletSchema } from '../database/mongo/walletSchema.js';

import StatusLog from './statusLog.js';

import { convertToObjectId } from '../database/dbMongo.js';
import { generateCharacterName } from '../utils/nameGenerator.js';

const characterModel = mongoose.model('Character', characterSchema);
const inventoryModel = mongoose.model('Inventory', inventorySchema);
const walletModel = mongoose.model('Wallet', walletSchema);

/**
 * Represents a game character, interacting with both PostgreSQL and MongoDB.
 * Provides static methods for character lifecycle management (CRUD) and
 *   specific actions.
 *
 * @class Character
 */
class Character {
  /**
   * Creates a new character, initializing records in both PostgreSQL and
   *   MongoDB.
   *
   * - Verifies the user exists in PostgreSQL.
   * - Creates Character, Wallet, Inventory, and StatusLog documents in MongoDB.
   * - Inserts a corresponding record into the PostgreSQL `characters` table,
   *   linking the user and the MongoDB document IDs.
   *
   * @static
   * @async
   * @param {object} params - Character creation parameters.
   * @param {string} params.username - The username of the owner.
   * @param {string} params.characterName - The desired name for the character.
   * @returns {Promise<object>} A promise resolving to the newly created
   *   PostgreSQL character record.
   * @throws {BadRequestError} If username doesn't exist or parameters are
   *   missing.
   * @throws {ExpressError} If database operations fail.
   */
  static async create({ username, characterName }) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.create',
      message: 'Attempting to create character...',
      context: { username, characterName },
    });
    if (!username || !characterName) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.create',
        message: 'Create failed: Missing username or characterName.',
        context: {
          usernameProvided: !!username,
          nameProvided: !!characterName,
        },
      });
      throw new BadRequestError('Username and character name are required.');
    }

    let user;
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.create',
        message: `Verifying user '${username}' exists...`,
      });
      user = await User.getByUsername(username);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.create',
        message: `User '${username}' verified.`,
        context: { userId: user.id },
      });
    } catch (userErr) {
      if (userErr instanceof NotFoundError) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.create',
          message: 'Create failed: User not found.',
        });
        throw new BadRequestError(`Username doesn't exist: ${username}`);
      } else {
        console.error({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.create',
          message: 'Create failed: Error checking user.',
          context: { error: userErr },
        });
        throw new ExpressError(
          `Error checking user existence: ${userErr.message}`,
          userErr.status || 500
        );
      }
    }

    let character;
    try {
      character = await characterModel.create({
        name: characterName,
      });
    } catch (charErr) {
      throw new ExpressError(
        `Failed to create character: ${charErr.message}`,
        500
      );
    }

    let wallet;
    try {
      wallet = await walletModel.create({
        characterId: character._id,
        coins: 123,
      });
    } catch (walletErr) {
      throw new ExpressError(
        `Failed to create wallet: ${walletErr.message}`,
        500
      );
    }

    let inventory;
    try {
      // Initialize inventory with wheat crops item
      inventory = await inventoryModel.create({
        characterId: character._id,
        items: [
          {
            itemName: 'wheat',
            itemType: 'crop',
            quantity: 2,
          },
        ],
      });
      console.debug(
        `[${new Date().toISOString()}] [CharacterModel] Create: ` +
        `Initial inventory created for ${character._id} with 123 coins.`
      );
    } catch (invErr) {
      console.error(
        `[${new Date().toISOString()}] [CharacterModel] Create: ` +
        `Failed to create initial inventory for ${character._id}.`,
        invErr
      );
      // It's crucial to handle this failure, perhaps by deleting
      // the already created character/wallet? Or throwing a specific error.
      // For now, rethrow a generic error.
      throw new ExpressError(
        `Failed to create inventory: ${invErr.message}`,
        500
      );
    }

    let statusLog;
    try {
      statusLog = await StatusLog.create({
        characterId: character._id,
        entries: [],
      });
    } catch (logErr) {
      throw new ExpressError(
        `Failed to create status log: ${logErr.message}`,
        500
      );
    }

    try {
      // Insert only essential references into PostgreSQL
      const postgresCharacterInsert = await query(
        `INSERT INTO
          ${CHARACTERS_DATABASE}
          (
          character_id,
          inventory_id,
          status_log_id,
          wallet_id,
          user_pg_id)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING
          id, -- PostgreSQL primary key
          character_id,
          user_pg_id`, // Return only relevant PG data
        [
          character._id.toString(),
          inventory._id.toString(),
          statusLog._id.toString(),
          wallet._id.toString(),
          user.id,
        ]
      );
      if (postgresCharacterInsert?.rows?.length === 0) {
        // Attempt cleanup of created Mongo documents before throwing
        console.error(
          `[${new Date().toISOString()}] [CharacterModel] Create: ` +
          `PG character insert failed. Attempting Mongo cleanup...`,
          {
            characterId: character._id,
            inventoryId: inventory._id,
            statusLogId: statusLog._id,
            walletId: wallet._id,
          }
        );
        // Best effort cleanup - consider a more robust saga pattern for production
        await Promise.allSettled([
          characterModel.findByIdAndDelete(character._id),
          inventoryModel.findByIdAndDelete(inventory._id),
          walletModel.findByIdAndDelete(wallet._id),
          StatusLog.findOneAndDelete({ characterId: character._id }),
        ]);
        throw new BadRequestError('PG Character Insert Failed.');
      }

      console.info(
        `[${new Date().toISOString()}] [CharacterModel] Create: ` +
        `Character '${characterName}' created successfully (PG ID: ` +
        `${postgresCharacterInsert.rows[0].id}, Mongo ID: ${character._id}).`
      );
      // Return the PG record containing the link information
      return postgresCharacterInsert.rows[0];
    } catch (pgErr) {
      // Attempt cleanup on PG error as well
      console.error(
        `[${new Date().toISOString()}] [CharacterModel] Create: ` +
        'Error during PG insert. Attempting Mongo cleanup...',
        {
          pgError: pgErr.message,
          characterId: character._id,
          inventoryId: inventory._id,
          statusLogId: statusLog._id,
          walletId: wallet._id,
        }
      );
      await Promise.allSettled([
        characterModel.findByIdAndDelete(character._id),
        inventoryModel.findByIdAndDelete(inventory._id),
        walletModel.findByIdAndDelete(wallet._id),
        StatusLog.findOneAndDelete({ characterId: character._id }),
      ]);
      throw new ExpressError(
        pgErr.message || 'PG character insert failed',
        500
      );
    }
  }

  /**
   * Deletes character-related documents from MongoDB within a transaction.
   * Note: Relies on the Character schema's pre/post hooks for cascade, but
   *   explicit deletion adds robustness.
   *
   * @private
   * @async
   * @param {object} mongoSession - Active Mongoose session.
   * @param {string} idString - Character MongoDB ID string.
   * @returns {Promise<void>} Resolves when deletion is attempted.
   * @throws {ExpressError} For critical database errors during deletion.
   */
  static async _deleteCharacterFromMongo(mongoSession, idString) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel._deleteCharacterFromMongo',
      message: 'Attempting to delete MongoDB documents...',
      context: { characterId: idString },
    });

    try {
      const charDeletion = await characterModel
        .findByIdAndDelete(idString, { session: mongoSession })
        .exec();
      if (!charDeletion) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._deleteCharacterFromMongo',
          message: 'Character document not found for deletion.',
          context: { characterId: idString },
        });
        // Decide if this should be an error or just a log
      } else {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._deleteCharacterFromMongo',
          message: 'Character document deleted.',
          context: { characterId: idString },
        });
      }

      // Also delete associated Inventory, Wallet, and StatusLog documents
      // Use the imported StatusLog model
      const relatedDeletions = await Promise.all([
        inventoryModel
          .findOneAndDelete(
            { characterId: idString },
            { session: mongoSession }
          )
          .exec(),
        walletModel
          .findOneAndDelete(
            { characterId: idString },
            { session: mongoSession }
          )
          .exec(),
        StatusLog.findOneAndDelete(
          { characterId: idString },
          { session: mongoSession }
        ).exec(),
      ]);

      // Optionally log results of related deletions
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._deleteCharacterFromMongo',
        message: 'Related MongoDB documents ' + 'deletion attempted.',
        context: {
          characterId: idString,
          inventoryDeleted: !!relatedDeletions[0],
          walletDeleted: !!relatedDeletions[1],
          statusLogDeleted: !!relatedDeletions[2],
        },
      });
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._deleteCharacterFromMongo',
        message: 'MongoDB document deletion failed.',
        context: { characterId: idString, error: error.message },
        stack: error.stack,
      });
      // Re-throw to be caught by the main remove method
      throw new ExpressError(
        `Failed to delete MongoDB documents for character ${idString}: ` +
        `${error.message}`,
        500
      );
    }
  }

  /**
   * Rolls back the transactions for character removal. Attempts rollback for
   *   both PG and Mongo if sessions/clients are provided and active. Logs
   *   errors during rollback but does not throw.
   *
   * @private
   * @async
   * @param {object | null} pgClient - Active or null PostgreSQL client.
   * @param {object | null} mongoSession - Active or null Mongoose session.
   * @returns {Promise<void>} Resolves after attempting rollbacks.
   */
  static async _rollbackRemovalTransaction(pgClient, mongoSession) {
    if (mongoSession && mongoSession.inTransaction()) {
      try {
        await mongoSession.abortTransaction();
        console.debug('MongoDB transaction aborted.');
      } catch (abortErr) {
        console.error('Error aborting MongoDB transaction:', abortErr);
      }
    }
    if (pgClient) {
      try {
        // Use query to ensure it uses the client's transaction state
        await pgClient.query('ROLLBACK');
        console.debug('PostgreSQL transaction rolled back.');
      } catch (rbErr) {
        // Avoid erroring out here if rollback fails, log instead
        console.error('Error rolling back PostgreSQL transaction:', rbErr);
      }
    }
  }

  /**
   * Cleans up database resources (PG client, Mongo session) after character
   *   removal attempt. Logs errors during cleanup but does not throw.
   *
   * @private
   * @async
   * @param {object | null} pgClient - Active or null PostgreSQL client.
   * @param {object | null} mongoSession - Active or null Mongoose session.
   * @returns {Promise<void>} Resolves after attempting resource cleanup.
   */
  static async _cleanupRemovalResources(pgClient, mongoSession) {
    if (mongoSession) {
      try {
        await mongoSession.endSession();
        console.debug('MongoDB session ended.');
      } catch (endSessionErr) {
        console.error('Error ending MongoDB session:', endSessionErr);
      }
    }
    if (pgClient) {
      pgClient.release();
      console.debug('PostgreSQL client released.');
    }
  }

  /**
   * Handles errors occurring during the character removal process. Logs
   *   contextual information, attempts rollback if necessary (for pre-commit
   *   errors), and throws an appropriate error (`NotFoundError`,
   *   `BadRequestError`, `ExpressError`). Differentiates handling based on
   *   whether the PostgreSQL commit succeeded before the error occurred.
   *
   * @private
   * @static
   * @async
   * @param {Error} error - The caught error object.
   * @param {object} context - Contextual information for logging.
   * @param {string} context.idString - The character ID string.
   * @param {string} context.username - The username.
   * @param {boolean} context.pgCommitted - Whether the PG transaction was
   *   committed before the error.
   * @param {boolean} context.mongoDeletionAttempted - Whether Mongo deletion
   *   was attempted before the error.
   * @param {object | null} context.pgClient - The PG client (used for rollback
   *   if available and pre-commit error).
   * @returns {Promise<void>} Resolves after handling the error (usually by
   *   throwing).
   * @throws {NotFoundError | BadRequestError | ExpressError} Throws the
   *   original or a wrapped error.
   */
  static async _handleRemoveError(
    error,
    { idString, username, pgCommitted, mongoDeletionAttempted, pgClient }
  ) {
    // If the error is the specific one thrown after a successful PG commit
    // but failed Mongo delete, we've already logged it appropriately.
    // We just need to re-throw it.
    if (pgCommitted && mongoDeletionAttempted) {
      // Check if it's the specific ExpressError we threw
      if (
        error instanceof ExpressError &&
        error.status === 500 &&
        error.message.includes('(PG), but failed to remove details (Mongo)')
      ) {
        console.debug('Re-throwing specific Mongo deletion failure error.');
        throw error; // Re-throw the specific error
      }
      // If some other error happened after PG commit, log generally
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove (Error Handler)',
        message: 'Unexpected error after PG commit during Mongo phase.',
        context: { characterId: idString, username, error: error.message },
        stack: error.stack,
      });
      // Still throw the original error, but maybe adjust status/message if needed
      throw error instanceof ExpressError
        ? error
        : new ExpressError(`Post-commit error: ${error.message}`, 500);
    }

    // --- Original error handling logic for errors *before* PG commit ---
    console.error({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.remove (Error Handler - Pre-Commit)',
      message: 'Error during character removal process (before PG commit)..',
      context: {
        characterId: idString,
        username: username,
        pgCommitted: pgCommitted, // Should be false here
        mongoDeletionAttempted: mongoDeletionAttempted, // Should be false here
        error: error.message,
        errorStatus: error.status,
      },
      stack: error.stack,
    });

    // Rollback PG only if the client exists (it should if we are pre-commit)
    if (pgClient) {
      console.debug(
        'Rolling back PostgreSQL transaction due to pre-commit error...'
      );
      await Character._rollbackRemovalTransaction(pgClient, null);
    } else {
      console.warn('Cannot rollback PG transaction, client not available.');
    }

    // Re-throw specific known errors or the original error
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    // If it was a PG error before commit, re-throw as ExpressError
    throw new ExpressError(
      `Failed to remove character: ${error.message}`,
      error.status || 500
    );
  }

  /**
   * Removes a character and associated data from both PostgreSQL and MongoDB.
   *
   * - Deletes related map records from PostgreSQL (within a transaction).
   * - Deletes the character record from PostgreSQL (within a transaction).
   * - If PostgreSQL deletion succeeds, commits the PG transaction.
   * - Then, attempts to delete the corresponding Character, Inventory, Wallet,
   *   and StatusLog documents from MongoDB.
   * - Handles potential inconsistencies if PG commit succeeds but Mongo delete
   *   fails.
   *
   * @static
   * @async
   * @param {string | ObjectId} characterId - The MongoDB ObjectId (or string)
   *   of the character to remove.
   * @param {object} user - The authenticated user object (must contain
   *   `userId` and `username`).
   * @returns {Promise<{ deletedCharacterId: string }>} A promise resolving to
   *   an object containing the ID string of the deleted character.
   * @throws {BadRequestError} If `characterId` or user info is missing/invalid.
   * @throws {NotFoundError} If the character is not found in PostgreSQL for the
   *   given user.
   * @throws {ExpressError} If database operations fail, or if a data
   *   inconsistency occurs (e.g., PG delete OK, Mongo delete fails).
   */
  static async remove(characterId, user) {
    const idString = characterId?.toString(); // Ensure string format
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.remove',
      message: 'Attempting to remove character...',
      context: { characterId: idString, username: user?.username },
    });

    if (!idString) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove',
        message: 'Remove failed: Missing or invalid characterId.',
        context: { characterId },
      });
      throw new BadRequestError('Character ID is required for removal.');
    }
    if (!user?.username || !user.userId) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove',
        message: 'Remove failed: User information missing or invalid.',
        context: { characterId: idString, userProvided: !!user },
      });
      // This case might indicate an issue with authentication middleware
      throw new ExpressError('User authentication data missing.', 500);
    }

    let pgClient = null;
    let pgCommitted = false;
    let mongoDeletionAttempted = false;

    try {
      pgClient = await connect();

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove',
        message:
          `Starting PostgreSQL transaction. MongoDB operations will not be ` +
          `transactional.`,
        context: { characterId: idString, userId: user.userId },
      });
      await pgClient.query('BEGIN');

      // --- Perform Deletions using Helpers ---
      // Delete from PG first within the transaction
      const pgDeletionSuccess = await Character._deleteCharacterFromPostgres(
        pgClient,
        idString,
        user.userId
      );

      // If PG deletion failed (character didn't exist for user),
      // rollback and throw NotFoundError
      if (!pgDeletionSuccess) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.remove',
          message:
            'Character reference not found in PG for user. Rolling back.',
          context: { characterId: idString, userId: user.userId },
        });
        await Character._rollbackRemovalTransaction(pgClient, null);
        throw new NotFoundError(
          `Character with ID ${idString} not found for user ${user.username}.`
        );
      }

      // PG deletion successful, proceed to commit PG transaction
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove',
        message: 'Committing PostgreSQL transaction...',
      });
      await pgClient.query('COMMIT'); // Commit PG changes
      pgCommitted = true; // Flag that PG commit was successful

      // Now, attempt Mongo deletion (outside PG transaction)
      try {
        mongoDeletionAttempted = true;
        await Character._deleteCharacterFromMongo(null, idString);
      } catch (mongoError) {
        // Log the specific error: PG commit succeeded, but Mongo deletion
        // failed.
        console.error({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.remove',
          message:
            'MongoDB deletion failed AFTER PostgreSQL commit. Data inconsistency detected.',
          context: {
            characterId: idString,
            username: user.username,
            mongoError: mongoError.message,
          },
          stack: mongoError.stack,
        });
        // Throw a specific error indicating partial success/failure
        throw new ExpressError(
          `Character reference removed (PG), but failed to remove details (Mongo): ${mongoError.message}`,
          500 // Internal Server Error status for inconsistency
        );
      }
      // --- Deletions Complete ---

      console.info({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove',
        message: `Character (ID: ${idString}) removed successfully.`, // Log ID
        context: { characterId: idString, username: user.username },
      });
      return { deletedCharacterId: idString };
    } catch (error) {
      // Delegate error handling to the helper function
      // Pass pgCommitted flag to the error handler
      await Character._handleRemoveError(error, {
        idString,
        username: user.username,
        pgCommitted, // Pass the commit status
        mongoDeletionAttempted, // Still useful to know if the attempt was made
        pgClient,
      });
    } finally {
      // Cleanup resources using the helper
      await Character._cleanupRemovalResources(pgClient, null);

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.remove',
        message: 'Remove character process finished.',
        context: { characterId: idString },
      });
    }
  }

  /**
   * Updates favorite status in MongoDB for a user's characters. If setting a
   *   character to favorite (`favoriteState = true`), it first unsets the
   *   favorite flag on all other characters belonging to the user before
   *   setting the target character's flag. If unsetting (`favoriteState =
   *   false`), it only updates the target character.
   *
   * @private
   * @static
   * @async
   * @param {string} targetIdString - The target character MongoDB ID string.
   * @param {ObjectId} targetObjectId - The target character MongoDB ObjectId.
   * @param {string[]} allUserCharacterIds - Array of all MongoDB ID strings
   *   for the user's characters.
   * @param {boolean} favoriteState - The desired favorite state (true/false).
   * @returns {Promise<object|null>} - The updated MongoDB document of the
   *   target character (with selected fields like 'name') or null if the target
   *   was not found during the final update.
   * @throws {ExpressError} - If any MongoDB update operation fails.
   */
  static async _updateMongoFavoriteStatus(
    targetIdString,
    targetObjectId,
    allUserCharacterIds,
    favoriteState
  ) {
    // 1. Unset others if setting to true
    if (favoriteState === true) {
      const otherCharacterObjectIds = allUserCharacterIds
        .filter((id) => id !== targetIdString)
        .map(convertToObjectId);

      if (otherCharacterObjectIds.length > 0) {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._updateMongoFavoriteStatus',
          message: `Unsetting favorite flag for ${otherCharacterObjectIds.length} other characters...`,
          context: {
            otherIds: otherCharacterObjectIds.map((id) => id.toString()),
          },
        });
        try {
          await characterModel.updateMany(
            { _id: { $in: otherCharacterObjectIds } },
            { $set: { favorite_character: false } }
          );
        } catch (updateErr) {
          console.error({
            timestamp: new Date().toISOString(),
            service: 'CharacterModel._updateMongoFavoriteStatus',
            message: 'Error unsetting other favorites in MongoDB.',
            context: { error: updateErr.message },
            stack: updateErr.stack,
          });
          throw new ExpressError(
            `Failed to update other favorites: ${updateErr.message}`,
            500
          );
        }
      }
    }

    // 2. Set the target character's favorite status
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel._updateMongoFavoriteStatus',
      message: `Setting favorite status to ${favoriteState} for character ${targetIdString}...`,
    });
    try {
      const updateResult = await characterModel.findOneAndUpdate(
        { _id: targetObjectId },
        { $set: { favorite_character: favoriteState } },
        { new: true, projection: 'name' } // Return name for logging
      );
      return updateResult;
    } catch (updateErr) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._updateMongoFavoriteStatus',
        message: 'Error setting target favorite status in MongoDB.',
        context: { characterId: targetIdString, error: updateErr.message },
        stack: updateErr.stack,
      });
      throw new ExpressError(
        `Failed to set target favorite: ${updateErr.message}`,
        500
      );
    }
  }

  /**
   * Fetches all character MongoDB ID strings for a given user from PostgreSQL.
   *
   * @private
   * @static
   * @async
   * @param {number} userPgId - The PostgreSQL ID of the user.
   * @returns {Promise<string[]>} - An array of character MongoDB ID strings.
   * @throws {ExpressError} - If the database query fails.
   */
  static async _getUserCharacterIdsFromPg(userPgId) {
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel._getUserCharacterIdsFromPg',
      message: `Fetching character IDs for user ${userPgId} from PG...`,
    });
    try {
      const pgResult = await query(
        `SELECT character_id FROM ${CHARACTERS_DATABASE} WHERE user_pg_id = $1`,
        [userPgId]
      );
      const characterIds = pgResult.rows.map((row) => row.character_id);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._getUserCharacterIdsFromPg',
        message: `Found ${characterIds.length} character IDs.`,
        context: { userPgId, count: characterIds.length },
      });
      return characterIds;
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._getUserCharacterIdsFromPg',
        message: 'Error fetching character IDs from PG.',
        context: { userPgId, error: error.message },
        stack: error.stack,
      });
      throw new ExpressError(
        `Database error fetching character IDs: ${error.message}`,
        500
      );
    }
  }

  /**
   * Finds the MongoDB ID (`_id`) of the map marked as `isFavorite` for a given
   *   character.
   *
   * @private
   * @static
   * @async
   * @param {ObjectId} characterObjectId - The MongoDB ObjectId of the character.
   * @returns {Promise<string | null>} - The favorite map ID string, or null if
   *   no favorite map is found or an error occurs during lookup.
   */
  static async _findFavoriteMapIdForCharacter(characterObjectId) {
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel._findFavoriteMapIdForCharacter',
      message: `Finding favorite map ID for ${characterObjectId}...`,
    });
    try {
      const MapModel = mongoose.model('Map');
      const favoriteMap = await MapModel.findOne({
        characterId: characterObjectId,
        isFavorite: true,
      })
        .select('_id')
        .lean();

      if (favoriteMap) {
        const favoriteMapId = favoriteMap._id.toString();
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._findFavoriteMapIdForCharacter',
          message: `Found favorite map ID: ${favoriteMapId}`,
        });
        return favoriteMapId;
      } else {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._findFavoriteMapIdForCharacter',
          message: `No favorite map found for character ${characterObjectId}.`,
        });
        return null;
      }
    } catch (mapError) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._findFavoriteMapIdForCharacter',
        message: `Error fetching favorite map ID for character ${characterObjectId}.`,
        context: { error: mapError.message },
        stack: mapError.stack,
      });
      // Return null on error, as the main operation might still succeed.
      return null;
    }
  }

  /**
   * Sets or unsets a character as the user's favorite in MongoDB. Verifies
   *   ownership via PostgreSQL before proceeding. If setting to favorite,
   *   ensures other characters for the user are unset. Also fetches the ID of
   *   the character's favorite map if being set as favorite.
   *
   * @static
   * @async
   * @param {string | ObjectId} characterId - The MongoDB ObjectId (or string)
   *   of the character.
   * @param {object} user - The authenticated user object (must contain `userId`
   *   and `username`).
   * @param {boolean} [favoriteState=true] - The desired favorite state.
   * @returns {Promise<{
   *   success: boolean,
   *   characterId: string,
   *   characterName: string | null,
   *   favorite: boolean,
   *   favoriteMapId: string | null
   * }>} Result object indicating success, the character's ID and name, the
   *   final favorite state, and the ID of their favorite map (if applicable).
   * @throws {BadRequestError} If `characterId` or user ID is invalid.
   * @throws {NotFoundError} If the character is not found for the user in PG.
   * @throws {ExpressError} If MongoDB updates fail or other database errors
   *   occur, including potential inconsistencies.
   */
  static async setFavorite(characterId, user, favoriteState = true) {
    const idString = characterId?.toString();
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel.setFavorite',
      message: `Attempting to set favorite status to ${favoriteState}...`,
      context: {
        characterId: idString,
        userId: user?.userId,
        state: favoriteState,
      },
    });

    // Validate Inputs
    if (!idString) throw new BadRequestError('Character ID is required.');
    const characterObjectId = convertToObjectId(idString);
    if (!user?.userId)
      throw new ExpressError('Authenticated user ID not found.', 500);
    const userPgId = Number(user.userId);
    if (isNaN(userPgId)) throw new BadRequestError('Invalid User ID format.');

    try {
      // 1. Get user's character IDs & Verify Ownership
      const userCharacterIds =
        await Character._getUserCharacterIdsFromPg(userPgId);
      if (!userCharacterIds.includes(idString)) {
        throw new NotFoundError(
          `Character ${idString} not found for user ${user.username}.`
        );
      }

      // 2. Update MongoDB favorite status (using existing helper)
      const updateResult = await Character._updateMongoFavoriteStatus(
        idString,
        characterObjectId,
        userCharacterIds,
        favoriteState
      );

      // 3. Check MongoDB update result
      if (!updateResult) {
        // Logged inside _updateMongoFavoriteStatus if it fails, throw consistency error
        throw new ExpressError(
          'Database inconsistency during favorite update.',
          500
        );
      }

      // 4. Find favorite map ID if setting to favorite
      let favoriteMapId = null;
      if (favoriteState === true) {
        favoriteMapId =
          await Character._findFavoriteMapIdForCharacter(characterObjectId);
      }

      // 5. Log and Return Success
      const characterName = updateResult.name;
      console.info({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.setFavorite',
        message: `Favorite status set to ${favoriteState} for '${characterName}' (ID: ${idString}).`,
        context: { favoriteMapIdReturned: favoriteMapId },
      });

      return {
        success: true,
        characterName,
        characterId: idString,
        favorite: favoriteState,
        favoriteMapId: favoriteMapId,
      };
    } catch (error) {
      // Handle known errors or wrap unexpected ones
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.setFavorite (Error Handling)',
        message: 'Error setting favorite status.',
        context: {
          characterId: idString,
          userId: user.userId,
          error: error.message,
        },
        stack: error.stack,
      });

      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof ExpressError
      ) {
        throw error; // Re-throw known types
      }
      // Wrap other errors
      throw new ExpressError(`Failed to set favorite: ${error.message}`, 500);
    } finally {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.setFavorite',
        message: 'Set favorite process finished.',
        context: { characterId: idString },
      });
    }
  }

  /**
   * Fetches specified character details from MongoDB for a given ID string.
   *   Handles cases where the character document is not found or a database
   *   error occurs by returning a default object structure with placeholder
   *   values.
   *
   * @private
   * @async
   * @param {string} mongoId - The MongoDB ObjectId string.
   * @param {string} fieldsToSelect - Space-separated string of fields to
   *   select (e.g., 'name level experience').
   * @returns {Promise<object>} Resolves with the selected character data as a
   *   plain object (due to `.lean()`) or a default object structure if the
   *   character isn't found or an error occurs.
   */
  static async _fetchMongoCharacterDetails(mongoId, fieldsToSelect) {
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._fetchMongoCharacterDetails',
        message: `Querying MongoDB for character ${mongoId}...`,
        context: { fields: fieldsToSelect },
      });

      const mongoChar = await characterModel
        .findById(mongoId)
        .select(fieldsToSelect)
        .lean();

      if (mongoChar) {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._fetchMongoCharacterDetails',
          message: `Successfully fetched MongoDB details for ${mongoId}.`,
          context: { mongoId, dataKeys: Object.keys(mongoChar) },
        });
        return mongoChar; // Return fetched data
      } else {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._fetchMongoCharacterDetails',
          message:
            `Character document not found in MongoDB for ID ${mongoId}. ` +
            'Setting defaults.',
        });
        // Return default structure if not found
        return {
          name: '(Not Found)',
          level: null,
          experience: null,
          skills: {},
          attributes: {},
          equipment: {},
          favorite_character: false, // Default favorite status
        };
      }
    } catch (mongoErr) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._fetchMongoCharacterDetails',
        message:
          `Error fetching MongoDB details for character ${mongoId}. ` +
          'Setting defaults.',
        context: { error: mongoErr.message },
      });
      // Return default structure on error
      return {
        name: '(Error)',
        level: null,
        experience: null,
        skills: {},
        attributes: {},
        equipment: {},
        favorite_character: false, // Default favorite status on error
      };
    }
  }

  /**
   * Retrieves all characters associated with a specific user ID. It combines
   *   reference data from PostgreSQL (like `character_id`, `inventory_id`)
   *   with detailed information from MongoDB (like `name`, `level`,
   *   `favorite_character`, `coins` from the wallet, and the ID of the
   *   character's favorite map).
   *
   * @static
   * @async
   * @param {number} userId - The PostgreSQL ID of the user.
   * @returns {Promise<Array<object>>} A promise resolving to an array of
   *   combined character objects. Each object contains PG references, Mongo
   *   details, coins, and favoriteMapId. Returns an empty array if the user has
   *   no characters.
   * @throws {BadRequestError} If the `userId` is invalid or not a number.
   * @throws {ExpressError} If any database query (PostgreSQL or MongoDB) fails
   *   during the retrieval process.
   */
  static async getAllForUser(userId) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.getAllForUser',
      message: 'Attempting to retrieve all characters for user ID...',
    });

    if (userId === undefined || userId === null) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message: 'Get all characters failed: User ID is missing or null.',
      });
      throw new BadRequestError('User ID is required.');
    }
    // Validate userId format (basic check)
    if (isNaN(Number(userId))) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message: `Get all characters failed: Invalid User ID format(${userId}).`,
      });
      throw new BadRequestError('Invalid User ID format.');
    }
    const numericUserId = Number(userId);

    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message:
          'Querying PostgreSQL for characters associated with user ID ' +
          `${numericUserId}...`,
      });
      const result = await query(
        `SELECT
        c.id as pg_id, --PostgreSQL primary key
        c.character_id, --MongoDB ObjectId as string
        c.inventory_id,
          c.status_log_id,
          c.wallet_id
        FROM
          ${CHARACTERS_DATABASE} c
        WHERE
        c.user_pg_id = $1
        ORDER BY
        c.id DESC`,
        [numericUserId]
      );
      const pgCharacters = result.rows;
      console.info({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message:
          `Retrieved ${pgCharacters.length} characters from PG for user ID` +
          `${numericUserId}.`,
        context: { count: pgCharacters.length },
      });

      if (pgCharacters.length === 0) {
        return [];
      }

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message:
          `Fetching MongoDB character, wallet, and favorite map details for ` +
          `${pgCharacters.length} characters...`,
        context: { characterIds: pgCharacters.map((c) => c.character_id) },
      });

      // Define the fields to select from MongoDB
      const mongoFieldsToSelect =
        'name level experience skills attributes equipment favorite_character';

      // Get Map model reference
      const MapModel = mongoose.model('Map');

      const combinedCharacters = await Promise.all(
        pgCharacters.map(async (pgChar) => {
          const mongoId = pgChar.character_id;
          const characterObjectId = convertToObjectId(mongoId); // Ensure ObjectId

          // Fetch Mongo character, wallet, AND favorite map details in parallel
          const [mongoCharData, walletData, favoriteMap] = await Promise.all([
            Character._fetchMongoCharacterDetails(mongoId, mongoFieldsToSelect),
            walletModel
              .findOne({ characterId: mongoId })
              .select('coins')
              .lean(),

            // Find the map marked as favorite for this character
            MapModel.findOne({
              characterId: characterObjectId, // Query using ObjectId
              isFavorite: true,
            })
              .select('_id') // Only need the map's ID
              .lean(), // Use lean for performance
          ]);

          // Combine PG base data, fetched Mongo data, and wallet coins
          return {
            pg_id: pgChar.pg_id,
            character_id: pgChar.character_id,
            inventory_id: pgChar.inventory_id,
            status_log_id: pgChar.status_log_id,
            wallet_id: pgChar.wallet_id,
            ...mongoCharData, // Spread name, level, favorite_character etc.
            // Add coins, default to 0 if wallet not found
            coins: walletData?.coins ?? 0,
            favoriteMapId: favoriteMap?._id?.toString() ?? null,
          };
        })
      );

      console.info({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message:
          'Finished fetching and combining character data for user ID ' +
          `${numericUserId}.`,
        context: { finalCount: combinedCharacters.length },
      });

      return combinedCharacters;
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getAllForUser',
        message: 'Database error retrieving characters for user ID...',
        context: { userId: numericUserId, error: err.message },
      });
      throw new ExpressError(
        `Failed to retrieve characters: ${err.message}`,
        500
      );
    }
  }

  /**
   * Retrieves the MongoDB character ID (`character_id`) of the user's single
   *   favorite character, if one is set. It first finds all character IDs for
   *   the user in PostgreSQL, then queries MongoDB to find which one has
   *   `favorite_character` set to true.
   *
   * @static
   * @async
   * @param {number} userPgId - The PostgreSQL ID of the user.
   * @returns {Promise<string|null>} A promise resolving to the MongoDB ID
   *   string (`character_id`) of the favorite character, or null if no favorite
   *   is set, the user has no characters, or an error occurs during lookup.
   * @throws {BadRequestError} If `userPgId` is invalid or not a number.
   * @throws {ExpressError} If any database query (PostgreSQL or MongoDB) fails.
   */
  static async getFavoriteCharacterIdForUser(userPgId) {
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel.getFavoriteCharacterIdForUser',
      message:
        'Attempting to find favorite character ID for user ID ' +
        `${userPgId}...`,
    });

    if (
      userPgId === undefined ||
      userPgId === null ||
      isNaN(Number(userPgId))
    ) {
      console.error({
        timestamp,
        service: 'CharacterModel.getFavoriteCharacterIdForUser',
        message: 'Get favorite character failed: Invalid or missing user ID.',
        context: { userPgId },
      });
      throw new BadRequestError('Valid numeric user ID is required.');
    }
    const numericUserId = Number(userPgId);

    try {
      // 1. Get all character MongoDB IDs for the user from PostgreSQL
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getFavoriteCharacterIdForUser',
        message: `Querying PG for all character IDs for user ${numericUserId}...`,
      });
      const pgResult = await query(
        `SELECT
          character_id
        FROM
          ${CHARACTERS_DATABASE}
        WHERE
          user_pg_id = $1`,
        [numericUserId]
      );

      const characterIds = pgResult.rows.map((row) => row.character_id);

      if (characterIds.length === 0) {
        console.info({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.getFavoriteCharacterIdForUser',
          message: `No characters found for user ID ${numericUserId}.`,
        });
        return null; // User has no characters
      }

      // 2. Query MongoDB for a character with favorite_character=true among those IDs
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getFavoriteCharacterIdForUser',
        message: `Querying MongoDB for favorite among ${characterIds.length} characters...`,
        context: { characterIds },
      });
      const favoriteChar = await characterModel
        .findOne({
          _id: { $in: characterIds.map(convertToObjectId) }, // Match against user's character ObjectIds
          favorite_character: true,
        })
        .select('_id')
        .lean(); // Select only the ID, use lean for performance

      if (favoriteChar) {
        const favoriteIdString = favoriteChar._id.toString();
        console.info({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.getFavoriteCharacterIdForUser',
          message:
            `Found favorite character ID ${favoriteIdString} for user ID ` +
            `${numericUserId}.`,
        });
        return favoriteIdString; // Return the MongoDB character_id string
      } else {
        console.info({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.getFavoriteCharacterIdForUser',
          message: `No favorite character found for user ID ${numericUserId} in MongoDB.`,
        });
        return null; // No favorite character found
      }
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getFavoriteCharacterIdForUser',
        message: 'Database error retrieving favorite character ID.',
        context: { userPgId: numericUserId, error: err },
      });
      throw new ExpressError(
        `Failed to retrieve favorite character ID: ${err.message} `,
        500
      );
    } finally {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getFavoriteCharacterIdForUser',
        message: 'Get favorite character ID process finished.',
        context: { userPgId },
      });
    }
  }

  /**
   * Retrieves a single character's combined data using its PostgreSQL primary
   *   key (`id`). Fetches reference data from PostgreSQL and detailed
   *   information from MongoDB (including `name`, `level`, `favorite_status`,
   *   `coins` from the wallet).
   *
   * @static
   * @async
   * @param {number} pgId - The PostgreSQL primary key (`id`) of the character.
   * @returns {Promise<object|null>} A promise resolving to the combined
   *   character object, or null if no character is found with that PostgreSQL
   *   ID.
   * @throws {BadRequestError} If `pgId` is invalid or not a number.
   * @throws {ExpressError} If any database query (PostgreSQL or MongoDB) fails.
   */
  static async getCombinedCharacterByPgId(pgId) {
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel.getCombinedCharacterByPgId',
      message: `Attempting to retrieve character for PG ID ${pgId}...`,
    });

    if (pgId === undefined || pgId === null || isNaN(Number(pgId))) {
      console.error({
        timestamp,
        service: 'CharacterModel.getCombinedCharacterByPgId',
        message: 'Get character failed: Invalid or missing PG ID.',
        context: { pgId },
      });
      throw new BadRequestError('Valid numeric PostgreSQL ID is required.');
    }
    const numericPgId = Number(pgId);

    try {
      // 1. Fetch base character data from PostgreSQL
      console.debug({
        timestamp,
        service: 'CharacterModel.getCombinedCharacterByPgId',
        message: `Querying PostgreSQL for character with PG ID ${numericPgId}...`,
      });
      const pgResult = await query(
        `SELECT
          c.id as pg_id,
          c.character_id, --MongoDB ObjectId as string
          c.inventory_id,
          c.status_log_id,
          c.wallet_id
        FROM
          ${CHARACTERS_DATABASE} c
        WHERE
        c.id = $1`,
        [numericPgId]
      );

      if (pgResult.rows.length === 0) {
        console.warn({
          timestamp,
          service: 'CharacterModel.getCombinedCharacterByPgId',
          message: `Character not found in PG for ID ${numericPgId}.`,
        });
        return null; // Character not found
      }

      const pgChar = pgResult.rows[0];
      console.debug({
        timestamp,
        service: 'CharacterModel.getCombinedCharacterByPgId',
        message: `Found character in PG: ${pgChar.character_id} `,
      });

      // 2. Fetch detailed data from MongoDB and Wallet
      const mongoId = pgChar.character_id;
      const mongoFieldsToSelect = `name level experience skills attributes equipment favorite_character`;
      const [mongoCharData, walletData] = await Promise.all([
        Character._fetchMongoCharacterDetails(mongoId, mongoFieldsToSelect),
        walletModel.findOne({ characterId: mongoId }).select('coins').lean(),
      ]);

      // 3. Combine PG base data with fetched/defaulted Mongo data and coins
      const combinedCharacter = {
        pg_id: pgChar.pg_id,
        character_id: pgChar.character_id,
        inventory_id: pgChar.inventory_id,
        status_log_id: pgChar.status_log_id,
        wallet_id: pgChar.wallet_id,
        ...mongoCharData, // Spread the fetched Mongo fields
        coins: walletData?.coins ?? 0, // Add coins, default to 0 if wallet not found
      };

      console.info({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getCombinedCharacterByPgId',
        message: `Successfully fetched and combined character data for PG ID ${numericPgId}.`,
        context: { finalDataKeys: Object.keys(combinedCharacter) },
      });

      return combinedCharacter;
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getCombinedCharacterByPgId',
        message: 'Database error retrieving character by PG ID.',
        context: { pgId: numericPgId, error: err.message, stack: err.stack },
      });
      // Re-throw specific errors if needed, otherwise wrap
      if (err instanceof BadRequestError) throw err;
      throw new ExpressError(
        `Failed to retrieve character by PG ID: ${err.message} `,
        500
      );
    }
  }

  /**
   * Determines a unique character name for a user, handling both user requests
   *   and automatic generation. Checks against the user's existing character
   *   names (case-insensitively).
   *
   * @private
   * @static
   * @async
   * @param {number} numericUserId - The user's PostgreSQL ID.
   * @param {string | null | undefined} requestedName - The name requested by
   *   the user (will be trimmed).
   * @param {Array<object>} existingCharacters - Array of the user's existing
   *   character objects (must contain at least the 'name' property).
   * @returns {Promise<string>} - The determined unique character name.
   * @throws {DuplicateCharacterNameError} - If the `requestedName` is already
   *   taken by the user, or if a unique name cannot be generated after several
   *   attempts.
   */
  static async _determineUniqueCharacterName(
    numericUserId,
    requestedName,
    existingCharacters
  ) {
    const timestamp = new Date().toISOString();
    const trimmedRequestedName = requestedName?.trim();
    const existingNamesLower = existingCharacters.map((char) =>
      char.name.toLowerCase()
    );

    if (trimmedRequestedName) {
      if (existingNamesLower.includes(trimmedRequestedName.toLowerCase())) {
        console.warn({
          timestamp: timestamp,
          service: 'CharacterModel._determineUniqueCharacterName',
          message: 'Duplicate name requested.',
          context: {
            userId: numericUserId,
            requestedName: trimmedRequestedName,
          },
        });
        throw new DuplicateCharacterNameError(
          `A character named "${trimmedRequestedName}"` +
          ` already exists for this user.`
        );
      }
      console.debug({
        timestamp: timestamp,
        service: 'CharacterModel._determineUniqueCharacterName',
        message: `Using validated requested name: ${trimmedRequestedName}`,
      });
      return trimmedRequestedName;
    } else {
      // Generate name and check if it's a duplicate
      let generatedName;
      let attempts = 0;
      const MAX_GEN_ATTEMPTS = 5;

      do {
        generatedName = generateCharacterName();
        attempts++;
      } while (
        existingNamesLower.includes(generatedName.toLowerCase()) &&
        attempts < MAX_GEN_ATTEMPTS
      );

      if (existingNamesLower.includes(generatedName.toLowerCase())) {
        console.warn({
          timestamp: timestamp,
          service: 'CharacterModel._determineUniqueCharacterName',
          message:
            `Generated name "${generatedName}" is still duplicate after ` +
            `${MAX_GEN_ATTEMPTS} attempts. Falling back to default.`,
          context: { userId: numericUserId },
        });
        // Fallback name (consider making it more unique)
        const fallbackName = `New Character ${Date.now()}`;
        if (existingNamesLower.includes(fallbackName.toLowerCase())) {
          throw new DuplicateCharacterNameError(
            `Failed to generate a unique default name. Please try ` +
            `requesting a specific name.`
          );
        }
        return fallbackName;
      } else {
        console.debug({
          timestamp: timestamp,
          service: 'CharacterModel._determineUniqueCharacterName',
          message: `Using generated unique name: ${generatedName}`,
        });
        return generatedName;
      }
    }
  }

  /**
   * Orchestrates the creation of a new character for a user. It performs checks
   *   (user existence, character limit), determines a unique name (handling
   *   duplicates), creates the character records in both PG and Mongo via
   *   `Character.create`, and finally fetches and returns the complete,
   *   combined data for the newly created character.
   *
   * @static
   * @async
   * @param {number} userId - The PostgreSQL ID of the user.
   * @param {string} [requestedName] - Optional name suggested by the user. If
   *   provided and valid/unique, it will be used; otherwise, a name is
   *   generated.
   * @returns {Promise<object>} A promise resolving to the full combined data
   *   object of the newly created character (including PG IDs, Mongo details,
   *   coins, etc.).
   * @throws {BadRequestError} If `userId` is invalid.
   * @throws {NotFoundError} If the user associated with `userId` is not found
   *   in the database.
   * @throws {CharacterLimitExceededError} If the user has reached the maximum
   *   allowed number of characters.
   * @throws {DuplicateCharacterNameError} If `requestedName` is provided but
   *   already exists for the user, or if name generation fails to find a unique
   *   one.
   * @throws {ExpressError} If any underlying database operation (fetching user,
   *   checking characters, creating character, fetching final data) fails.
   */
  static async createNewCharacterForUser(userId, requestedName) {
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel.createNewCharacterForUser',
      message: 'Starting new character creation process...',
      context: { userId, requestedName },
    });

    // 1. Validate User ID
    if (userId === undefined || userId === null || isNaN(Number(userId))) {
      console.error({
        timestamp,
        service: 'CharacterModel.createNewCharacterForUser',
        message: 'Creation failed: Invalid or missing user ID.',
        context: { userId },
      });
      throw new BadRequestError('Valid numeric user ID is required.');
    }
    const numericUserId = Number(userId);

    // 2. Fetch User and Existing Characters (concurrently)
    let user;
    let existingCharacters;
    try {
      [user, existingCharacters] = await Promise.all([
        User.getById(numericUserId),
        Character.getAllForUser(numericUserId),
      ]);
    } catch (err) {
      if (err instanceof NotFoundError) {
        // Specific handling if User.getById fails
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.createNewCharacterForUser',
          message: `Creation failed: User not found for ID ${numericUserId}.`,
        });
        throw new NotFoundError(`User not found for ID ${numericUserId}.`);
      }
      // Handle errors from Character.getAllForUser or other User.getById errors
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.createNewCharacterForUser',
        message: 'Error fetching user or existing characters.',
        context: { userId: numericUserId, error: err.message },
      });
      throw new ExpressError(
        `Failed to retrieve user data or characters: ${err.message}`,
        err.status || 500
      );
    }

    // 3. Check Character Limit
    if (
      existingCharacters &&
      existingCharacters.length >= MAX_CHARACTERS_PER_USER
    ) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.createNewCharacterForUser',
        message: 'Character limit reached.',
        context: {
          userId: numericUserId,
          count: existingCharacters.length,
          limit: MAX_CHARACTERS_PER_USER,
        },
      });
      throw new CharacterLimitExceededError(
        `Character limit(${MAX_CHARACTERS_PER_USER}) reached.`
      );
    }
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.createNewCharacterForUser',
      message: `Character limit check passed for user ${numericUserId}.`,
    });

    // 4. Determine Character Name using the helper
    const characterName = await Character._determineUniqueCharacterName(
      numericUserId,
      requestedName,
      existingCharacters
    );

    // 5. Create the Character (using existing create method)
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.createNewCharacterForUser',
      message: `Calling Character.create for user ${user.username}...`,
      context: { characterName },
    });
    const newCharacterPgRecord = await Character.create({
      username: user.username, // Use username fetched earlier
      characterName,
    });

    // 6. Fetch and return the full combined character data
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.createNewCharacterForUser',
      message: 'Fetching full data for the new character...',
      context: { pgId: newCharacterPgRecord.id },
    });
    const fullCharacterData = await Character.getCombinedCharacterByPgId(
      newCharacterPgRecord.id
    );

    if (!fullCharacterData) {
      // This case should ideally not happen if creation succeeded,
      // but handle defensively
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.createNewCharacterForUser',
        message: 'Failed to fetch full data after creation.',
        context: { pgId: newCharacterPgRecord.id },
      });
      throw new ExpressError(
        'Failed to retrieve created character details post-creation.',
        500
      );
    }

    console.info({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel.createNewCharacterForUser',
      message: 'Character created and full data retrieved successfully.',
      context: { pgId: fullCharacterData.pg_id, name: fullCharacterData.name },
    });
    return fullCharacterData;
  }

  /**
   * Helper method to delete a character reference from the PostgreSQL
   *   database, specifically targeting a row matching both the character's
   *   MongoDB ID and the user's PostgreSQL ID. Assumes it runs within an
   *   existing transaction managed by the caller.
   *
   * @static
   * @async
   * @private
   * @param {object} pgClient - The active PostgreSQL client connection obtained
   *   from the connection pool, expected to be part of a transaction.
   * @param {string} characterId - The MongoDB ObjectId string of the character
   *   reference to delete.
   * @param {number} userPgId - The PostgreSQL ID of the user expected to own
   *   the character.
   * @returns {Promise<boolean>} A promise resolving to `true` if exactly one
   *   row was deleted, `false` otherwise (indicating the character reference
   *   was not found for that user).
   * @throws {ExpressError} If required parameters are missing or if the
   *   database deletion query fails unexpectedly.
   */
  static async _deleteCharacterFromPostgres(pgClient, characterId, userPgId) {
    if (!pgClient || !characterId || userPgId === undefined) {
      // Check userPgId against undefined explicitly
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._deleteCharacterFromPostgres',
        message: 'Missing required parameters for PG deletion.',
        context: {
          characterId,
          userPgId,
          pgClientProvided: !!pgClient,
        },
      });
      throw new ExpressError(
        'Internal error: Invalid parameters for PG character deletion.',
        500
      );
    }

    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel._deleteCharacterFromPostgres',
      message: `Attempting to delete character reference from PostgreSQL...`,
      context: { characterId, userPgId },
    });

    try {
      // Only delete, no need to return columns anymore
      const result = await pgClient.query(
        `DELETE FROM 
          ${CHARACTERS_DATABASE}
        WHERE
          character_id = $1
        AND
          user_pg_id = $2`,
        [characterId, userPgId]
      );

      const deleted = result.rowCount > 0;

      if (!deleted) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._deleteCharacterFromPostgres',
          message:
            `Character reference not found in PostgreSQL for deletion, ` +
            `or did not belong to user.`,
          context: { characterId, userPgId },
        });
        // If not found, it might have been deleted already, or never existed
        // for the user.
        // In the context of the remove() method, this might indicate an issue,
        // but the function itself shouldn't throw NotFoundError here, let the
        // caller decide.
      } else {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel._deleteCharacterFromPostgres',
          message: 'Character reference deleted successfully from PostgreSQL.',
          context: { characterId, userPgId },
        });
      }
      // Return boolean indicating if deletion occurred
      return deleted;
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._deleteCharacterFromPostgres',
        message: 'Failed to delete character reference from PostgreSQL.',
        context: { characterId, userPgId, error: error.message },
        stack: error.stack, // Include stack trace for debugging
      });
      // Don't throw NotFoundError, let the main `remove` function handle that
      // logic based on whether PG or Mongo deletions succeed.
      throw new ExpressError(
        `Database error during PostgreSQL character deletion: ${error.message} `,
        500
      );
    }
  }

  /**
   * Validates input parameters for a nickname update operation. Checks if ID
   *   and nickname are provided and if the nickname is a non-empty string.
   *
   * @private
   * @static
   * @param {string|null|undefined} idString - The character ID as a string.
   * @param {string|null|undefined} trimmedNickname - The trimmed nickname.
   * @throws {BadRequestError} If validation fails (missing ID/nickname, or
   *   nickname is empty).
   */
  static _validateNicknameInputs(idString, trimmedNickname) {
    if (!idString || !trimmedNickname) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._validateNicknameInputs',
        message:
          'Validation failed: Missing required parameters (ID or Nickname).',
        context: { characterId: idString, newNickname: trimmedNickname },
      });
      throw new BadRequestError('Character ID and new nickname are required.');
    }
    // Add check for empty string after trimming
    if (typeof trimmedNickname !== 'string' || trimmedNickname === '') {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel._validateNicknameInputs',
        message: 'Validation failed: New nickname must be a non-empty string.',
        context: { characterId: idString, newNickname: trimmedNickname },
      });
      throw new BadRequestError('New nickname must be a non-empty string.');
    }
    // Add length validation if needed, e.g.:
    // const MAX_NAME_LENGTH = 25;
    // if (trimmedNickname.length > MAX_NAME_LENGTH) {
    //   throw new BadRequestError(
    //     `Nickname cannot exceed ${ MAX_NAME_LENGTH } characters.`
    //   );
    // }
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'CharacterModel._validateNicknameInputs',
      message: 'Nickname inputs validated successfully.',
    });
  }

  /**
   * Updates the character name (`name` field) directly in the corresponding
   *   MongoDB document. Assumes ownership/validity checks have already been
   *   performed by the caller. Runs MongoDB schema validators during the
   *   update.
   *
   * @private
   * @static
   * @async
   * @param {string} idString - The character's MongoDB ObjectId as a string.
   * @param {string} trimmedNickname - The new, trimmed name to set.
   * @returns {Promise<boolean>} - Resolves `true` if the document was found
   *   (regardless of whether the name was actually changed), `false` if no
   *   document matched the `idString`.
   * @throws {BadRequestError} If MongoDB schema validation fails (e.g., name
   *   format is invalid) or if a unique index constraint is violated (duplicate
   *   name, handled via error code 11000).
   * @throws {ExpressError} For other unexpected database errors during the
   *   update.
   */
  static async _updateNicknameInMongo(idString, trimmedNickname) {
    const characterObjectId = convertToObjectId(idString);
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp,
      service: 'CharacterModel._updateNicknameInMongo',
      message: 'Updating name directly in MongoDB...',
      context: { characterId: idString, newName: trimmedNickname },
    });

    try {
      // Perform the update directly
      const mongoUpdateResult = await characterModel.updateOne(
        { _id: characterObjectId },
        { $set: { name: trimmedNickname } },
        { runValidators: true } // Ensure schema validation runs
      );

      if (mongoUpdateResult.matchedCount === 0) {
        // This means the character ID didn't exist in Mongo
        console.warn({
          timestamp,
          service: 'CharacterModel._updateNicknameInMongo',
          message: 'Update failed: Character not found in MongoDB.',
          context: { characterId: idString },
        });
        return false; // Indicate character not found
      }

      if (mongoUpdateResult.modifiedCount === 0) {
        // This means the character was found, but the name was already the same
        console.warn({
          timestamp,
          service: 'CharacterModel._updateNicknameInMongo',
          message: 'MongoDB name not modified (already set or no change).',
          context: { characterId: idString, newName: trimmedNickname },
        });
        // Still considered a success in terms of the operation not erroring
        return true;
      } else {
        // Successfully updated
        console.debug({
          timestamp,
          service: 'CharacterModel._updateNicknameInMongo',
          message: 'MongoDB name updated successfully.',
          context: { characterId: idString },
        });
        return true;
      }
    } catch (error) {
      // Check for MongoDB's duplicate key error (unique index violation)
      if (error.code === 11000) {
        console.warn({
          timestamp,
          service: 'CharacterModel._updateNicknameInMongo',
          message: 'MongoDB duplicate key error during nickname update.',
          context: {
            characterId: idString,
            newName: trimmedNickname,
            error: error.message,
          },
        });
        // Throw a more specific user-friendly error
        throw new BadRequestError(
          `A character with the name "${trimmedNickname}" already exists.`
        );
      }

      if (error.name === 'ValidationError') {
        console.warn({
          timestamp,
          service: 'CharacterModel._updateNicknameInMongo',
          message: 'MongoDB validation failed for nickname update.',
          context: {
            characterId: idString,
            newName: trimmedNickname,
            errors: error.errors,
          },
        });
        throw new BadRequestError(`Invalid name / nickname: ${error.message} `);
      }
      // Log and re-throw other errors
      console.error({
        timestamp,
        service: 'CharacterModel._updateNicknameInMongo',
        message: 'Error updating nickname in MongoDB.',
        context: {
          characterId: idString,
          newName: trimmedNickname,
          error: error.message,
        },
        stack: error.stack,
      });
      throw new ExpressError(
        `Database error during nickname update: ${error.message} `,
        500
      );
    }
  }

  /**
   * Updates a character's display name (nickname) in MongoDB. Before updating,
   *   it verifies that the new name doesn't conflict (case-insensitively) with
   *   any *other* existing characters belonging to the same user. Assumes the
   *   route handler has already verified ownership of the target character ID.
   *
   * @static
   * @async
   * @param {string | ObjectId} characterId - The MongoDB ObjectId (or string)
   *   of the character whose name is to be updated.
   * @param {string} newNickname - The desired new nickname (will be trimmed).
   * @param {number} userPgId - The PostgreSQL ID of the user owning the
   *   character, used for the duplicate name check against their other
   *   characters.
   * @returns {Promise<{ success: boolean, newNickname: string }>} Resolves upon
   *   successful update (even if the name value didn't actually change) with
   *   the new name.
   * @throws {BadRequestError} If `characterId`, `newNickname`, or `userPgId`
   *   are invalid, or if the `newNickname` fails MongoDB validation.
   * @throws {DuplicateCharacterNameError} If the `newNickname` is already used
   *   by another character belonging to the `userPgId`.
   * @throws {NotFoundError} If the character specified by `characterId` is not
   *   found in MongoDB during the update attempt.
   * @throws {ExpressError} For other database errors during the process
   *   (fetching characters for duplicate check or the final MongoDB update).
   */
  static async updateNickname(characterId, newNickname, userPgId) {
    const idString = characterId?.toString();
    const trimmedNickname = newNickname?.trim();
    const timestamp = new Date().toISOString();

    console.debug({
      timestamp,
      service: 'CharacterModel.updateNickname',
      message:
        `Attempting to update nickname for ID ${idString} to ` +
        `"${trimmedNickname}" for user ${userPgId}...`,
    });

    // 1. Validate Inputs (using simplified helper)
    Character._validateNicknameInputs(idString, trimmedNickname);

    // Validate userPgId (add this check)
    if (
      userPgId === undefined ||
      userPgId === null ||
      isNaN(Number(userPgId))
    ) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.updateNickname',
        message: 'Update nickname failed: Invalid or missing userPgId.',
        context: { userPgId },
      });
      throw new BadRequestError(
        'Valid numeric user ID is required for update.'
      );
    }
    const numericUserPgId = Number(userPgId);

    try {
      // 2. Check for duplicate name among OTHER characters for this user
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.updateNickname',
        message: `Checking for duplicate name "${trimmedNickname}" for user ${numericUserPgId}...`,
      });
      const allUserCharacters = await Character.getAllForUser(numericUserPgId);
      const otherCharacters = allUserCharacters.filter(
        (char) => char.character_id !== idString
      );
      const duplicateFound = otherCharacters.some(
        (char) => char.name.toLowerCase() === trimmedNickname.toLowerCase()
      );

      if (duplicateFound) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.updateNickname',
          message: 'Duplicate name found for this user.',
          context: {
            characterId: idString,
            newNickname: trimmedNickname,
            userPgId: numericUserPgId,
          },
        });
        throw new DuplicateCharacterNameError(
          `A character named "${trimmedNickname}" already exists for this user.`
        );
      }
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.updateNickname',
        message: 'No duplicate name found. Proceeding with MongoDB update.',
      });

      // 3. Call the MongoDB update helper directly
      const updateSuccess = await Character._updateNicknameInMongo(
        idString,
        trimmedNickname
      );

      // 4. Handle Result
      if (!updateSuccess) {
        // _updateNicknameInMongo returns false if matchedCount is 0
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.updateNickname',
          message:
            'Update failed: Character not found by _updateNicknameInMongo.',
          context: { characterId: idString },
        });
        throw new NotFoundError('Character not found.');
      }

      console.info({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.updateNickname',
        message:
          'Character nickname updated successfully in MongoDB to ' +
          `"${trimmedNickname}".`,
        context: { characterId: idString },
      });
      return { success: true, newNickname: trimmedNickname };
    } catch (error) {
      // 5. Handle Errors Propagated from Helper or duplicate check
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.updateNickname',
        message: 'Nickname update process failed.',
        context: { characterId: idString, error: error.message },
        stack: error.stack,
      });

      // Re-throw known errors or wrap others
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof DuplicateCharacterNameError ||
        error instanceof ExpressError // Allow ExpressError pass-through
      ) {
        throw error;
      }
      // Should be caught by the helper, but as a fallback:
      throw new ExpressError(
        `Failed to update character nickname: ${error.message} `,
        500
      );
    } finally {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.updateNickname',
        message: 'Update nickname process finished.',
        context: { characterId: idString },
      });
    }
  }

  /**
   * Verifies if a character reference exists in the PostgreSQL database that
   *   links the given character's MongoDB ID (`characterMongoId`) to the
   *   specified user's PostgreSQL ID (`userPgId`). This is primarily used for
   *   authorization checks before performing actions on a character.
   *
   * @static
   * @async
   * @param {string | ObjectId} characterMongoId - The MongoDB ObjectId (or
   *   string) of the character to check.
   * @param {number} userPgId - The PostgreSQL ID of the user attempting access.
   * @returns {Promise<boolean>} Resolves `true` if a matching record exists in
   *   the PostgreSQL `characters` table, indicating the user owns (or is
   *   linked to) the character. Resolves `false` if no such link is found or if
   *   input IDs are invalid.
   * @throws {ExpressError} If the database query to check ownership fails.
   */
  static async verifyOwnership(characterMongoId, userPgId) {
    const timestamp = new Date().toISOString();
    console.debug({
      timestamp: timestamp,
      service: 'CharacterModel.verifyOwnership',
      message: 'Verifying character ownership via PG lookup...',
      context: { characterMongoId, userPgId },
    });
    try {
      // Ensure IDs are in the correct format for the query
      const mongoIdString = characterMongoId?.toString();
      const numericUserPgId = Number(userPgId);

      if (!mongoIdString) {
        console.warn({
          timestamp: timestamp,
          service: 'CharacterModel.verifyOwnership',
          message: 'Verification failed: Missing or invalid characterMongoId.',
          context: { characterMongoId },
        });
        return false;
      }
      if (isNaN(numericUserPgId)) {
        console.warn({
          timestamp: timestamp,
          service: 'CharacterModel.verifyOwnership',
          message: 'Verification failed: Missing or invalid userPgId.',
          context: { userPgId },
        });
        return false;
      }

      // PG query to check for a row matching both IDs
      console.debug({
        timestamp: timestamp,
        service: 'CharacterModel.verifyOwnership',
        message: `Executing PG query to check ownership...`,
        context: {
          query: `SELECT 1 FROM ${CHARACTERS_DATABASE} WHERE character_id = $1 AND user_pg_id = $2 LIMIT 1`,
          params: [mongoIdString, numericUserPgId],
        },
      });

      const pgCheck = await query(
        `SELECT 
          1
        FROM 
          ${CHARACTERS_DATABASE}
        WHERE 
          character_id = $1 
        AND 
          user_pg_id = $2
        LIMIT 1`,
        [mongoIdString, numericUserPgId]
      );

      const ownsCharacter = pgCheck.rows.length > 0;

      console.debug({
        timestamp: timestamp,
        service: 'CharacterModel.verifyOwnership',
        message: `Ownership verification result: ${ownsCharacter}`,
        context: {
          characterMongoId: mongoIdString,
          userPgId: numericUserPgId,
          ownsCharacter,
        },
      });
      return ownsCharacter;
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.verifyOwnership',
        message: `Error verifying ownership: ${error.message}`,
        context: {
          characterMongoId,
          userPgId,
          errorStack: error.stack,
        },
      });
      // Avoid exposing detailed database errors, throw a generic one
      throw new ExpressError(
        'Database error during ownership verification.',
        500
      );
    }
  }

  /**
   * Retrieves the level of a specific skill for a character from MongoDB. The
   *   skill name is dynamically constructed by appending "Level" to the
   *   `cropType` (e.g., "wheat" becomes "wheatLevel"). Accesses the nested
   *   `skills` object in the character document.
   *
   * @static
   * @async
   * @param {string | ObjectId} characterId - The MongoDB ObjectId (or string)
   *   of the character.
   * @param {string} cropType - The type of crop (e.g., "wheat", "corn") used
   *   to determine the skill key within the `skills` object.
   * @returns {Promise<number>} A promise resolving to the character's level for
   *   that specific skill. Defaults to 1 if the character is found but the
   *   specific skill level is not defined or is null/undefined. Returns 0 if
   *   the character ID itself is not found or if input parameters are invalid.
   * @throws {ExpressError} If there's an unexpected database error during the
   *   MongoDB lookup.
   */
  static async getSkillLevel(characterId, cropType) {
    const timestamp = new Date().toISOString();
    const idString = characterId?.toString();

    console.debug({
      timestamp,
      service: 'CharacterModel.getSkillLevel',
      message:
        `Fetching skill level for character ${idString}, crop ${cropType}...`,
    });

    if (!idString || !cropType) {
      console.warn({
        timestamp,
        service: 'CharacterModel.getSkillLevel',
        message: 'Missing characterId or cropType.',
        context: { characterId: idString, cropType },
      });
      return 0; // Return default if input is invalid
    }

    try {
      // Validate/Convert ID
      const characterObjectId = convertToObjectId(idString);
      const skillKey = `${cropType}Level`;

      const character = await characterModel
        .findById(characterObjectId)
        // Select only the specific skill field
        .select(`skills.${skillKey}`)
        // Use lean for performance
        .lean();

      if (!character) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'CharacterModel.getSkillLevel',
          message: `Character not found for ID ${idString}.`,
        });
        return 0; // Character not found
      }

      // Access nested skill safely
      const skillLevel = character.skills?.[skillKey] || 1;

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getSkillLevel',
        message: `Skill level for ${skillKey} is ${skillLevel}.`,
        context: { characterId: idString, skillLevel },
      });

      return skillLevel;

    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'CharacterModel.getSkillLevel',
        message: 'Error fetching skill level.',
        context: { characterId: idString, cropType, error: error.message },
        stack: error.stack,
      });
      // Depending on requirements, you might re-throw or just return 0
      // Throwing for unexpected DB errors seems appropriate
      throw new ExpressError(
        `Database error fetching skill level: ${error.message}`,
        500
      );
    }
  }
}

export default Character;
