/**
 * @file Map Model
 * @module server/models/map
 * @description Defines the Map class for managing map data using Mongoose.
 *   Includes methods for CRUD operations on maps and tiles.
 */

import {
  NotFoundError,
  BadRequestError,
  ExpressError,
} from '../expressError.js';
import { mapSchema } from '../database/mongo/mapSchema.js';
import { getMongooseModel } from '../database/helpers/mongoose.js';
import { convertToObjectId } from '../database/dbMongo.js';
import { generateMapName } from '../utils/nameGenerator.js';
import { MAX_MAPS_PER_CHARACTER } from '../constants/config.js';

if (!mapSchema) throw new Error('Map Schema undefined in map.js');
const mapModel = getMongooseModel('Map', mapSchema);
if (!mapModel) throw new Error('Map Model undefined in map');

/**
 * Represents a game map and provides static methods for interaction.
 * Uses the Mongoose `mapModel` for database operations.
 *
 * @class Map
 */
class Map {
  /**
   * Validates required input parameters for map creation.
   * Note: Refactored to be a static private helper.
   *
   * @private
   * @static
   * @param {object} params - Map creation parameters.
   * @param {string|ObjectId} params.characterId - The MongoDB ObjectId of the
   *   owner Character.
   * @param {string} params.mapNickname - Nickname for the map.
   * @param {number} params.maxWidth - Maximum width of the map.
   * @param {number} params.maxHeight - Maximum height of the map.
   * @param {number} params.maxCoordsLeasable - Max number of tiles that can be
   *   leased.
   * @param {number} [params.rentCostPerTile=1] - Optional cost per tile for
   *   rent. Defaults to 1.
   * @param {Date} [params.nextRentDue] - Optional date for the next rent
   *   payment. Defaults to 1 week from now.
   * @param {boolean} [params.isFavorite=false] - Optional flag indicating if
   *   this is the favorite map. Defaults to false.
   * @param {object} [params.debuffs={}] - Optional initial debuffs. Defaults
   *   to empty object.
   * @param {object} [params.variables={}] - Optional initial variables.
   *   Defaults to empty object.
   * @returns {Promise<object>} A Promise resolving to the newly created Map
   *   document (Mongoose document).
   * @throws {BadRequestError} If validation fails or parameters are invalid
   *   (e.g., invalid characterId format).
   * @throws {ExpressError} If a database error occurs during creation.
   */
  static _validateInputParams(params) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: `MapModel._validateInputParams`,
      message: `Validating required fields...`,
      context: { params },
    });
    const requiredFields = [
      // Should be the MongoDB ObjectId of the Character document
      'characterId',
      // REMOVED: 'mapNickname',
      // REMOVED: 'maxWidth',
      // REMOVED: 'maxHeight',
      // REMOVED: 'maxCoordsLeasable',
    ];
    for (const field of requiredFields) {
      if (
        !(field in params) ||
        params[field] === undefined ||
        params[field] === null
      ) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel._validateInputParams`,
          message: `Validation failed: Missing required field '${field}'.`,
          context: {
            field,
            params,
          },
        });
        throw new BadRequestError(
          `Missing required map creation field: ${field}`
        );
      }
    }

    // Ensure characterId can be converted
    try {
      convertToObjectId(params.characterId);
    } catch (e) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: `MapModel._validateInputParams`,
        message: `Validation failed: Invalid characterId format.`,
        context: { characterId: params.characterId, error: e.message },
      });
      throw new BadRequestError(
        `Invalid characterId format provided for map creation.`,
        params.characterId
      );
    }

    console.debug({
      timestamp: new Date().toISOString(),
      service: `MapModel._validateInputParams`,
      message: `Required fields validated.`,
      context: { params },
    });
  }

  /**
   * Validates the data types of map creation/update parameters.
   * Note: Refactored to be a static private helper.
   *
   * @private
   * @static
   * @param {object} params - Map parameters.
   * @param {string} [params.mapNickname] - Nickname for the map.
   * @param {number} [params.maxWidth] - Maximum width.
   * @param {number} [params.maxHeight] - Maximum height.
   * @param {number} [params.maxCoordsLeasable] - Max leasable tiles.
   * @param {number} [params.rentCostPerTile] - Optional rent cost.
   * @param {Date} [params.nextRentDue] - Optional next rent due date. Must be
   *   a Date object if provided.
   * @param {Array<object>} [params.tiles] - Optional initial tiles array.
   *   Must be an Array if provided.
   * @throws {BadRequestError} If any parameter has an invalid data type.
   */
  static _validateParamTypes(params) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: `MapModel._validateParamTypes`,
      message: `Validating parameter types...`,
      context: { params },
    });
    const typeChecks = {
      // characterId is checked separately for ObjectId/string validity
      mapNickname: 'string',
      maxWidth: 'number',
      maxHeight: 'number',
      maxCoordsLeasable: 'number',
      rentCostPerTile: 'number', // Optional, check if present
      // isFavorite: 'boolean', // Not typically set at creation
      nextRentDue: 'date', // Needs Date object check if present
      // tiles: 'object' // Needs array check if present
    };

    for (const key in typeChecks) {
      // Validate type only if the key exists AND the value is not 
      // null/undefined
      if (
        key in params &&
        params[key] != null &&
        typeof params[key] !== typeChecks[key]
      ) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel._validateParamTypes`,
          message:
            `Validation failed: Invalid type for field '${key}'. ` +
            `Expected '${typeChecks[key]}', got '${typeof params[key]}'.`,
          context: {
            key,
            expectedType: typeChecks[key],
            actualType: typeof params[key],
            params,
          },
        });
        throw new BadRequestError(
          `Invalid data type for field: ${key}. ` +
          `Expected ${typeChecks[key]}.`
        );
      }
    }
    // Add specific check for nextRentDue if needed
    if ('nextRentDue' in params && !(params.nextRentDue instanceof Date)) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: `MapModel._validateParamTypes`,
        message:
          `Validation failed: Invalid type for field 'nextRentDue'. ` +
          `Expected Date object.`,
        context: { params },
      });
      throw new BadRequestError(
        `Invalid data type for field: nextRentDue. ` +
        `Expected Date object.`
      );
    }
    // Add specific check for tiles if needed
    if ('tiles' in params && !Array.isArray(params.tiles)) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: `MapModel._validateParamTypes`,
        message: `Validation failed: Invalid type for field 'tiles'. ` +
          `Expected Array.`,
        context: { params },
      });
      throw new BadRequestError(
        `Invalid data type for field: tiles. ` +
        `Expected Array.`
      );
    }
    console.debug({
      timestamp: new Date().toISOString(),
      service: `MapModel._validateParamTypes`,
      message: `Parameter types validated.`,
      context: { params },
    });
  }

  /**
   * Validates that tiles field is an array before saving the document.
   *
   * @static
   * @param {object} map - The map document being validated.
   * @throws {ValidationError} If 'tiles' is not an array.
   */
  static validateTilesArray(map) {
    if (!Array.isArray(map.tiles)) {
      const validationError = new Error();
      validationError.name = 'ValidationError';
      validationError.message =
        `Validation failed: Invalid type for field 'tiles'. ` +
        `Expected Array.`;
      throw validationError;
    }
  }

  /**
   * Checks if a character can create a new map based on the limit.
   *
   * @private
   * @static
   * @async
   * @param {ObjectId} characterIdObj - The MongoDB ObjectId of the character.
   * @throws {BadRequestError} If the character has reached the map limit.
   */
  static async _checkMapLimit(characterIdObj) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'MapModel._checkMapLimit',
      message: `Checking map limit for character ${characterIdObj}...`,
    });
    const currentMapCount = await mapModel.countDocuments({
      characterId: characterIdObj,
    });

    if (currentMapCount >= MAX_MAPS_PER_CHARACTER) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'MapModel._checkMapLimit',
        message: `Map limit (${MAX_MAPS_PER_CHARACTER}) reached.`,
        context: { characterId: characterIdObj, count: currentMapCount },
      });
      throw new BadRequestError(
        `Character cannot have more than ${MAX_MAPS_PER_CHARACTER} maps.`
      );
    }
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'MapModel._checkMapLimit',
      message: `Map limit check passed (${currentMapCount}/${MAX_MAPS_PER_CHARACTER}).`,
    });
  }

  /**
   * Prepares the initial data object for map creation, including nickname.
   *
   * @private
   * @static
   * @param {object} params - The raw input parameters from the create call.
   * @param {ObjectId} characterIdObj - The validated ObjectId of the character.
   * @returns {{
   *   mapData: object,
   *   initialNickNameProvided: boolean,
   *   currentNickName: string
   * }} An object containing the prepared map data, whether a nickname was
   *    initially provided, and the current (initial) nickname.
   */
  static _prepareInitialMapData(params, characterIdObj) {
    // Determine nickname: Use provided or generate default
    const initialNickNameProvided = !!params.mapNickname?.trim();
    let currentNickName = initialNickNameProvided
      ? params.mapNickname.trim()
      : generateMapName();

    if (!initialNickNameProvided) {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel._prepareInitialMapData',
        message:
          `No mapNickname provided, initial generated: ${currentNickName}`,
      });
    }

    // Base map data
    const mapData = {
      characterId: characterIdObj,
      // mapNickname will be set inside the retry loop
    };

    // Add optional fields if explicitly provided and validated
    const optionalValidatedFields = [
      'rentCostPerTile',
      'nextRentDue',
      'isFavorite',
      'debuffs',
      'variables',
    ];
    for (const field of optionalValidatedFields) {
      if (field in params) {
        mapData[field] = params[field];
      }
    }

    return { mapData, initialNickNameProvided, currentNickName };
  }

  /**
   * Handles the specific case of a duplicate nickname error when the nickname
   * was auto-generated. Determines the next nickname to try (either newly
   * generated or a fallback).
   *
   * @private
   * @static
   * @param {Error} err - The caught error (expected MongoServerError 11000).
   * @param {number} attempts - Current attempt number.
   * @param {number} maxAttempts - Maximum allowed attempts.
   * @param {string} currentNickName - The generated nickname that failed.
   * @param {ObjectId} characterIdObj - Character ID for logging.
   * @returns {{nextNickName: string}} Object containing the next nickname to
   *   try.
   */
  static _handleGeneratedNicknameConflict(
    err,
    attempts,
    maxAttempts,
    currentNickName,
    characterIdObj
  ) {
    console.warn({
      timestamp: new Date().toISOString(),
      service: 'MapModel._handleGeneratedNicknameConflict',
      message: `Attempt ${attempts}/${maxAttempts}: Duplicate generated mapNickname '${currentNickName}'.`,
      context: { characterId: characterIdObj, error: err.message },
    });

    let nextNickName;
    if (attempts >= maxAttempts) {
      // Last attempt failed, generate a fallback name
      nextNickName = `Default Map ${Date.now()}`;
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'MapModel._handleGeneratedNicknameConflict',
        message:
          `Max nickname generation attempts reached. ` +
          `Falling back to '${nextNickName}'.`,
        context: { characterId: characterIdObj },
      });
    } else {
      // Generate a new name for the next retry
      nextNickName = generateMapName();
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel._handleGeneratedNicknameConflict',
        message: `Generated new name for retry: '${nextNickName}'`,
      });
    }
    // The helper always returns a name to retry with
    return { nextNickName };
  }

  /**
   * Handles errors that occur during the map save attempt.
   *
   * @private
   * @static
   * @param {Error} err - The error caught during save.
   * @param {number} attempts - The current attempt number.
   * @param {number} maxAttempts - The maximum allowed attempts.
   * @param {string} currentNickName - The nickname that failed.
   * @param {boolean} initialNickNameProvided - If the user provided the name.
   * @param {ObjectId} characterIdObj - The character ID for context.
   * @returns {{nextNickName: string}} Info for retry. Contains the next
   *   nickname to try if the error was a handled duplicate generated name.
   * @throws {BadRequestError|ExpressError} If the error is fatal or unhandled.
   */
  static _handleSaveMapError(
    err,
    attempts,
    maxAttempts,
    currentNickName,
    initialNickNameProvided,
    characterIdObj
  ) {
    // Handle duplicate key error specifically for generated nicknames
    if (
      !initialNickNameProvided &&
      err.name === 'MongoServerError' &&
      err.code === 11000 &&
      err.keyPattern?.mapNickname === 1
    ) {
      // Use helper method to handle generated nickname conflict
      const { nextNickName } = Map._handleGeneratedNicknameConflict(
        err,
        attempts,
        maxAttempts,
        currentNickName,
        characterIdObj
      );
      return { nextNickName };
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'MapModel._handleSaveMapError',
        message: `Mongoose validation error during map save attempt.`,
        context: {
          errors: err.errors,
          attemptedName: currentNickName,
          characterId: characterIdObj,
        },
      });
      throw new BadRequestError(`Map validation failed: ${err.message}`);
    }

    // Handle duplicate key error for user-provided nickname
    if (
      initialNickNameProvided &&
      err.name === 'MongoServerError' &&
      err.code === 11000 &&
      err.keyPattern?.mapNickname === 1
    ) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'MapModel._handleSaveMapError',
        message: `User provided duplicate mapNickname '${currentNickName}'.`,
        context: { characterId: characterIdObj, error: err.message },
      });
      throw new BadRequestError(
        `Map nickname '${currentNickName}' is already taken.`
      );
    }

    // Handle other specific errors if needed (like BadRequest re-throw)
    if (err instanceof BadRequestError) {
      throw err; // Re-throw already handled validation errors
    }

    // Log and throw unexpected errors
    console.error({
      timestamp: new Date().toISOString(),
      service: 'MapModel._handleSaveMapError',
      message:
        `Unexpected error saving map ` +
        `(attempt ${attempts}/${maxAttempts}).`,
      context: {
        error: err,
        attemptedName: currentNickName,
        characterId: characterIdObj,
      },
    });
    const baseMsg = `Failed to save map`;
    const nameMsg = currentNickName ? ` with name '${currentNickName}'` : '';
    const errMsg = err.message || 'Unknown error';
    throw new ExpressError(`${baseMsg}${nameMsg}: ${errMsg}`, 500);
  }

  /**
   * Attempts to save the map to the database, handling nickname conflicts.
   *
   * @private
   * @static
   * @async
   * @param {object} mapData - The core map data (without nickname initially).
   * @param {string} initialNickName - The first nickname to try.
   * @param {boolean} initialNickNameProvided - Whether the initial nickname
   *   came from user input.
   * @param {ObjectId} characterIdObj - The character's ObjectId (for logging).
   * @returns {Promise<object>} A Promise resolving to the newly created Map
   *   document (Mongoose document).
   * @throws {BadRequestError} If validation fails (e.g., user-provided
   *   duplicate name).
   * @throws {ExpressError} If saving fails after retries or for other reasons.
   */
  static async _attemptSaveMap(
    mapData,
    initialNickName,
    initialNickNameProvided,
    characterIdObj
  ) {
    const MAX_NICKNAME_ATTEMPTS = 5;
    let attempts = 0;
    let currentNickName = initialNickName;
    let newMap = null;

    while (attempts < MAX_NICKNAME_ATTEMPTS) {
      attempts++;
      mapData.mapNickname = currentNickName; // Set current name attempt

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel._attemptSaveMap',
        message:
          `Attempt ${attempts}/${MAX_NICKNAME_ATTEMPTS}: Saving map ` +
          `with nickname '${currentNickName}'...`,
        context: { mapData: { ...mapData, characterId: characterIdObj } }, // Log charId
      });

      try {
        const mapInstance = new mapModel(mapData);
        newMap = await mapInstance.save(); // save() runs schema validators
        console.info({
          timestamp: new Date().toISOString(),
          service: 'MapModel._attemptSaveMap',
          message: `New map '${newMap.mapNickname}' created successfully.`,
          context: {
            mapId: newMap._id,
            characterId: newMap.characterId,
            attempts,
          },
        });
        return newMap; // Success!
      } catch (err) {
        // Use helper to handle errors
        // If _handleSaveMapError throws, the error propagates out.
        // If it returns, it means we should retry with the new name.
        const { nextNickName } = Map._handleSaveMapError(
          err,
          attempts,
          MAX_NICKNAME_ATTEMPTS,
          currentNickName,
          initialNickNameProvided,
          characterIdObj
        );

        currentNickName = nextNickName;
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'MapModel._attemptSaveMap',
          message: `Retrying with new nickname: '${currentNickName}'`,
        });
      }
    } // End of while loop

    // If loop finishes, fallback nickname also failed
    console.error({
      timestamp: new Date().toISOString(),
      service: 'MapModel._attemptSaveMap',
      message:
        `Failed to save map after ${MAX_NICKNAME_ATTEMPTS} ` +
        `attempts, including fallback nickname.`,
      context: {
        characterId: characterIdObj,
        finalAttemptedNickName: currentNickName,
      },
    });
    throw new ExpressError(
      `Failed to create map due to persistent nickname conflicts ` +
      `after multiple attempts.`,
      500
    );
  }

  /**
   * Creates a new Map document with default initialization.
   *
   * @static
   * @async
   * @param {object} params - The map initialization parameters.
   * @param {string|ObjectId} params.characterId - The MongoDB ObjectId of the
   *   owner Character.
   * @param {string} [params.mapNickname] - Optional nickname. If not provided,
   *   one will be generated.
   * @param {boolean} [params.isActive=true] - Whether the map is active.
   *   Defaults to true.
   * @param {number} [params.maxCoordsLeasable=100] - Default max leasable
   *   tiles. Defaults to 100.
   * @param {number} [params.rentCostPerTile=1] - Optional cost per tile for
   *   rent. Defaults to 1.
   * @param {Date} [params.nextRentDue] - Optional date for the next rent
   *   payment. Defaults to 1 week from now if not provided.
   * @param {boolean} [params.isFavorite=false] - Optional flag indicating if
   *   this is the favorite map. Defaults to false.
   * @param {Array<object>} [params.tiles=[]] - Optional initial tiles array.
   *   Defaults to empty array.
   * @param {object} [params.variables={}] - Optional game variables. Defaults
   *   to empty object.
   * @param {object} [params.debuffs={}] - Optional game debuffs. Defaults to
   *   empty object.
   * @returns {Promise<object>} A Promise resolving to the newly created Map
   *   document (Mongoose document).
   * @throws {BadRequestError} If validation fails, parameters are invalid, or
   *   the map limit is reached.
   * @throws {ExpressError} If a database error occurs during creation.
   */
  static async create(params) {
    const startTime = Date.now();
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'MapModel.create',
      message: 'Starting map creation process...',
      context: { params },
    });

    try {
      // 1. Validate inputs
      Map._validateInputParams(params);
      Map._validateParamTypes(params); // Validate types before conversion

      // 2. Convert and validate characterId
      let characterIdObj;
      try {
        characterIdObj = convertToObjectId(params.characterId);
      } catch (e) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'MapModel.create',
          message: 'Failed to convert characterId to ObjectId.',
          context: {
            characterId: params.characterId,
            error: e.message,
          },
        });
        throw new BadRequestError(
          `Invalid characterId format.`,
          params.characterId
        );
      }
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel.create',
        message: 'CharacterId validated and converted.',
        context: { characterId: characterIdObj.toString() },
      });

      // 3. Check map limit
      await Map._checkMapLimit(characterIdObj);

      // 4. Prepare initial map data and nickname
      const { mapData, initialNickNameProvided, currentNickName } =
        Map._prepareInitialMapData(params, characterIdObj);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel.create',
        message: 'Initial map data prepared.',
        context: { initialNickName: currentNickName, initialNickNameProvided },
      });

      // 5. Attempt to save the map with retry logic
      const newMap = await Map._attemptSaveMap(
        mapData,
        currentNickName,
        initialNickNameProvided,
        characterIdObj
      );

      const duration = Date.now() - startTime;
      console.info({
        timestamp: new Date().toISOString(),
        service: 'MapModel.create',
        message:
          `Map creation process completed successfully for map ` +
          `'${newMap.mapNickname}'.`,
        context: { mapId: newMap._id, durationMs: duration },
      });
      return newMap;
    } catch (err) {
      // Log specific handled errors (BadRequestError, ExpressError from helpers)
      if (err instanceof BadRequestError || err instanceof ExpressError) {
        // Specific logging should happen within the helper or the point of throw
        console.warn({
          // Use warn for expected operational errors like limits/validation
          timestamp: new Date().toISOString(),
          service: 'MapModel.create',
          message: `Map creation failed: ${err.message}`,
          context: {
            errorType: err.name,
            characterId: params?.characterId,
          },
        });
        throw err; // Re-throw the specific error
      }

      // Catch truly unexpected errors during the main flow orchestration
      const duration = Date.now() - startTime;
      console.error({
        timestamp: new Date().toISOString(),
        service: 'MapModel.create',
        message: 'Unexpected error during map creation orchestration.',
        context: {
          error: err,
          errorMessage: err.message,
          characterId: params?.characterId,
          durationMs: duration,
        },
        stack: err.stack,
      });
      throw new ExpressError(
        `Unexpected failure during map creation: ${err.message}`,
        500
      );
    }
  }

  /**
   * Executes the MongoDB findOneAndUpdate operation for changing a map name.
   * Handles specific errors like duplicate key and not found.
   *
   * @private
   * @static
   * @async
   * @param {ObjectId} mapIdObj - The ObjectId of the map.
   * @param {string} trimmedNickName - The validated and trimmed new nickname.
   * @param {string} idString - The original map ID string (for logging).
   * @returns {Promise<object>} The updated map document (Mongoose document).
   * @throws {NotFoundError} If the map is not found.
   * @throws {ExpressError} If the nickname causes a duplicate key error (HTTP
   *   409) or for other unexpected database errors (HTTP 500).
   */
  static async _executeNameChange(mapIdObj, trimmedNickName, idString) {
    const updateData = { $set: { mapNickname: trimmedNickName } };
    const options = { new: true, runValidators: true };

    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel._executeNameChange',
        message: 'Attempting findOneAndUpdate for map nickname...',
        context: { mapId: idString, newNickName: trimmedNickName },
      });

      const updatedMap = await mapModel.findOneAndUpdate(
        { _id: mapIdObj },
        updateData,
        options
      );

      if (!updatedMap) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'MapModel._executeNameChange',
          message: 'Update failed: Map not found during findOneAndUpdate.',
          context: { mapId: idString },
        });
        throw new NotFoundError(`Map not found with ID: ${idString}`);
      }

      console.info({
        timestamp: new Date().toISOString(),
        service: 'MapModel._executeNameChange',
        message: 'Map nickname updated successfully via findOneAndUpdate.',
        context: { mapId: idString, updatedMap: updatedMap },
      });
      return updatedMap;
    } catch (error) {
      if (error.code === 11000) {
        // Handle duplicate key
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'MapModel._executeNameChange',
          message: 'Duplicate map nickname detected during findOneAndUpdate.',
          context: {
            mapId: idString,
            newNickName: trimmedNickName,
            error: error.message,
          },
        });
        throw new ExpressError(
          `A map with the name "${trimmedNickName}" already exists for this character.`,
          409 // HTTP 409 Conflict status code
        );
      } else if (error instanceof NotFoundError) {
        // Re-throw NotFoundError if it came from our check
        throw error;
      } else {
        // Handle other unexpected errors during the update
        console.error({
          timestamp: new Date().toISOString(),
          service: 'MapModel._executeNameChange',
          message: 'Unexpected error during findOneAndUpdate.',
          context: {
            error: error,
            mapId: idString,
            newNickName: trimmedNickName,
          },
        });
        throw new ExpressError(
          `Database error during map name update: ${error.message}`,
          500
        );
      }
    }
  }

  /**
   * Changes the nickname of a map.
   * Validates input, converts ID to ObjectId, and updates the map document.
   *
   * @static
   * @async
   * @param {string|ObjectId} id - The MongoDB ObjectId of the map to update.
   * @param {string} newNickName - The desired new nickname for the map.
   * @returns {Promise<object>} A Promise resolving to the updated map
   *   document (Mongoose document).
   * @throws {BadRequestError} If the map ID or new nickname is missing or
   *   invalid.
   * @throws {NotFoundError} If the map with the given ID is not found.
   * @throws {ExpressError} If the nickname is a duplicate (409) or if another
   *   database error occurs (500).
   */
  static async changeName(id, newNickName) {
    const idString = id?.toString();
    const trimmedNickName = newNickName?.trim(); // Trim here once

    if (
      !idString ||
      newNickName === undefined || // Check undefined/null explicitly
      newNickName === null ||
      typeof trimmedNickName !== 'string' || // Check type of trimmed
      trimmedNickName === '' // Check if empty after trim
    ) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.changeName`,
        message: `Missing or invalid map ID or new nickname.`,
        context: {
          mapId: idString,
          newNickName,
        },
      });
      throw new BadRequestError(
        `Valid Map ID and non-empty new nickname are required.`
      );
    }

    try {
      const mapIdObj = convertToObjectId(idString);

      // Call the helper function to perform the update
      const updatedMap = await Map._executeNameChange(
        mapIdObj,
        trimmedNickName,
        idString
      );

      return updatedMap;
    } catch (err) {
      // Catch errors from convertToObjectId or the helper
      if (err instanceof BadRequestError || err instanceof NotFoundError) {
        // Re-throw errors specifically handled by the helper or initial validation
        throw err;
      }
      if (err.name === 'CastError') {
        // Handle CastError from convertToObjectId
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.changeName`,
          message: `Invalid map ID format.`,
          context: { mapId: idString, error: err.message },
        });
        throw new BadRequestError(`Invalid map ID format: ${idString}`);
      }
      // Catch any other unexpected errors (including ExpressErrors from helper)
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.changeName`,
        message: `Unexpected error changing map name.`,
        context: { error: err, mapId: idString, newNickName: trimmedNickName },
      });
      // Ensure it's an ExpressError before sending to handler
      throw err instanceof ExpressError
        ? err
        : new ExpressError(`Failed to change map name: ${err.message}`, 500);
    }
  }

  /**
   * Marks a map as a favorite, automatically unfavoriting other maps for the
   * same character. Toggles the `isFavorite` status of the specified map.
   *
   * @static
   * @async
   * @param {string|ObjectId} id - The MongoDB ObjectId of the map to
   *   favorite/unfavorite.
   * @returns {Promise<object>} A Promise resolving to the updated map document
   *   (Mongoose document).
   * @throws {BadRequestError} If the map ID is missing or invalid.
   * @throws {NotFoundError} If the map with the given ID is not found.
   * @throws {ExpressError} If a database error occurs during the update
   *   process.
   */
  static async favorite(id) {
    const idString = id?.toString();
    if (!idString) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.favorite`,
        message: `Missing or invalid map ID for favoriting.`,
        context: { mapId: idString },
      });
      throw new BadRequestError(`Valid Map ID is required.`, {
        mapId: idString,
      });
    }

    try {
      const mapIdObj = convertToObjectId(idString);
      console.debug({
        timestamp: new Date().toISOString(),
        service: `MapModel.favorite`,
        message:
          `Attempting to toggle favorite status for map ` + `'${idString}'...`,
      });

      // Find the map first to get its current state and characterId
      const map = await mapModel
        .findById(mapIdObj)
        .select('characterId isFavorite mapNickname');

      if (!map) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.favorite`,
          message: `Map not found for favoriting.`,
          context: { mapId: idString },
        });
        throw new NotFoundError(`Map not found with ID: ${idString}`);
      }

      const newFavoriteStatus = !map.isFavorite;

      // If setting to true, ensure no other map for the user is favorite
      if (newFavoriteStatus) {
        console.debug({
          timestamp: new Date().toISOString(),
          service: `MapModel.favorite`,
          message:
            `Setting map '${idString}' as favorite. ` +
            `Unsetting other favorites for character...`,
          context: {
            characterId: map.characterId,
          },
        });
        await mapModel.updateMany(
          {
            characterId: map.characterId,
            _id: { $ne: mapIdObj },
          }, // $ne = not equal
          {
            $set: {
              isFavorite: false,
            },
          }
        );
        console.info({
          timestamp: new Date().toISOString(),
          service: `MapModel.favorite`,
          message: `Previous favorite maps unfavorited for character.`,
          context: { characterId: map.characterId },
        });
      }

      // Now, update the target map's status
      map.isFavorite = newFavoriteStatus;
      await map.save(); // Use save to trigger potential middleware/hooks

      console.info({
        timestamp: new Date().toISOString(),
        service: `MapModel.favorite`,
        message:
          `Map '${map.mapNickname}' favorite status set to` +
          ` ${newFavoriteStatus}.`,
        context: { mapId: idString },
      });
      return map; // Return the updated map
    } catch (err) {
      if (err instanceof BadRequestError || err instanceof NotFoundError) {
        throw err;
      }
      if (err.name === 'CastError') {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.favorite`,
          message: `Invalid map ID format.`,
          context: {
            mapId: idString,
            error: err.message,
          },
        });
        throw new BadRequestError(`Invalid map ID format.`, {
          mapId: idString,
          error: err.message,
        });
      }
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.favorite`,
        message: `Unexpected error toggling map favorite status.`,
        context: {
          error: err,
          mapId: idString,
        },
      });
      throw new ExpressError(
        `Failed to toggle favorite status for map ID ` +
        ` ${idString}: ${err.message}`,
        500
      );
    }
  }

  /**
   * Retrieves a map by its MongoDB ID.
   *
   * @static
   * @async
   * @param {string | ObjectId} id - The ID of the map.
   * @returns {Promise<object>} A Promise resolving to the map document
   *   (Mongoose document).
   * @throws {BadRequestError} If the map ID is missing or invalid.
   * @throws {NotFoundError} If the map is not found.
   * @throws {ExpressError} If the database operation fails.
   */
  static async get(id) {
    const idString = id?.toString();
    if (!idString) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.get`,
        message: `Missing or invalid map ID for retrieval.`,
        context: { mapId: idString },
      });
      throw new BadRequestError(`Valid Map ID is required.`, {
        mapId: idString,
      });
    }

    try {
      const mapIdObj = convertToObjectId(idString);
      console.debug({
        timestamp: new Date().toISOString(),
        service: `MapModel.get`,
        message:
          `Attempting to retrieve map ` + `'${idString}' from MongoDB...`,
      });

      // Consider using .lean() if you only need the plain JS object
      const map = await mapModel.findById(mapIdObj);

      if (!map) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.get`,
          message: `Map not found.`,
          context: { mapId: idString },
        });
        throw new NotFoundError(`Map not found with ID: ${idString}`);
      }
      console.info({
        timestamp: new Date().toISOString(),
        service: `MapModel.get`,
        message: `Map '${map.mapNickname}' retrieved ` + ` successfully.`,
        context: { mapId: idString },
      });
      return map;
    } catch (err) {
      if (err instanceof BadRequestError || err instanceof NotFoundError) {
        throw err;
      }
      if (err.name === 'CastError') {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.get`,
          message: `Invalid map ID format.`,
          context: {
            mapId: idString,
            error: err.message,
          },
        });
        throw new BadRequestError(`Invalid map ID format.`, {
          mapId: idString,
          error: err.message,
        });
      }
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.get`,
        message: `Unexpected error retrieving map.`,
        context: {
          error: err,
          mapId: idString,
        },
      });
      throw new ExpressError(
        `Failed to retrieve map with ID ` +
        ` ${idString}: ${err.message}`,
        500
      );
    }
  }

  /**
   * Validates the input parameters for the update operation.
   *
   * @private
   * @static
   * @param {string | ObjectId} id - The map ID.
   * @param {object} data - The update data object.
   * @returns {string} The validated and stringified map ID.
   * @throws {BadRequestError} If ID or data is invalid (ID missing, data not a
   *   non-null object).
   */
  static _validateUpdateInput(id, data) {
    const idString = id?.toString();
    if (!idString) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel._validateUpdateInput`,
        message: `Missing or invalid map ID for update.`,
        context: { mapId: idString },
      });
      throw new BadRequestError(`Valid Map ID is required.`, {
        mapId: idString,
      });
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel._validateUpdateInput`,
        message: `Invalid update data provided. Must be an object.`,
        context: { mapId: idString, data },
      });
      throw new BadRequestError(`Update data must be a non-null object.`, {
        mapId: idString,
        data,
      });
    }
    return idString;
  }

  /**
   * Sanitizes the update data, keeping only allowed fields.
   * Allowed fields: mapNickname, maxCoordsLeasable, rentCostPerTile,
   * nextRentDue, debuffs, variables. Note: 'isFavorite' is handled by the
   * `favorite()` method.
   *
   * @private
   * @static
   * @param {object} data - The raw update data.
   * @returns {object} The sanitized update data object containing only allowed
   *   fields.
   */
  static _sanitizeUpdateData(data) {
    // 'isFavorite' is explicitly removed - use the favorite() method instead.
    const allowedUpdates = [
      'mapNickname',
      'maxCoordsLeasable',
      'rentCostPerTile',
      'nextRentDue',
      'debuffs',
      'variables',
    ];
    const updateData = {};
    for (const key of allowedUpdates) {
      if (key in data) {
        updateData[key] = data[key];
      }
    }
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'MapModel._sanitizeUpdateData',
      message: 'Sanitized update data.',
      context: {
        originalData: data,
        sanitizedData: updateData,
      },
    });
    return updateData;
  }

  /**
   * Updates a map document with provided data.
   * Performs partial update using `$set` after sanitizing the data and
   * validating types. Only allowed fields specified in `_sanitizeUpdateData`
   * are updated. If no valid fields are provided, returns the unchanged map.
   *
   * @static
   * @async
   * @param {string | ObjectId} id - The ID of the map to update.
   * @param {object} data - The data to update. Should contain fields matching
   *   allowed updates.
   * @returns {Promise<object>} A Promise resolving to the updated map document
   *   (Mongoose document).
   * @throws {BadRequestError} If map ID is invalid, data is not an object, or
   *   Mongoose validation fails.
   * @throws {NotFoundError} If the map is not found.
   * @throws {ExpressError} If the database operation fails unexpectedly.
   */
  static async update(id, data) {
    // Use helper for initial validation
    const idString = Map._validateUpdateInput(id, data);

    // Use helper to sanitize data
    const updateData = Map._sanitizeUpdateData(data);

    if (Object.keys(updateData).length === 0) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'MapModel.update',
        message: 'No valid fields provided for update after sanitization.',
        context: {
          mapId: idString,
          originalData: data,
        },
      });
      // Return unchanged map instead of throwing error
      return await Map.get(id);
    }

    try {
      const mapIdObj = convertToObjectId(idString);

      // Validate types of the *sanitized* data
      Map._validateParamTypes(updateData);

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel.update',
        message: `Attempting to update map ` + `'${idString}' with data...`,
        context: { updateData },
      });

      const updatedMap = await mapModel.findByIdAndUpdate(
        mapIdObj,
        updateData,
        {
          new: true, // Return the updated document
          runValidators: true, // Run schema validators on the update
          context: 'query', // Ensure validators run correctly for updates
        }
      );

      if (!updatedMap) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'MapModel.update',
          message: 'Map not found for update.',
          context: { mapId: idString },
        });
        throw new NotFoundError(`Map not found with ID: ${idString}`);
      }

      console.info({
        timestamp: new Date().toISOString(),
        service: `MapModel.update`,
        message: `Map '${updatedMap.mapNickname}' updated ` + `successfully.`,
        context: { mapId: idString },
      });
      return updatedMap;
    } catch (err) {
      if (err instanceof BadRequestError || err instanceof NotFoundError) {
        throw err;
      }
      if (err.name === 'CastError') {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.update`,
          message: `Invalid map ID format.`,
          context: {
            mapId: idString,
            error: err.message,
          },
        });
        throw new BadRequestError(`Invalid map ID format.`, {
          mapId: idString,
          error: err.message,
        });
      }
      if (err.name === 'ValidationError') {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.update`,
          message: `Mongoose validation error during map ` + `update.`,
          context: {
            errors: err.errors,
            mapId: idString,
            updateData: data,
          },
        });
        console.error({
          timestamp: new Date().toISOString(),
          service: `MapModel.update`,
          message: `Unexpected error updating map.`,
          context: {
            error: err,
            mapId: idString,
            updateData: data, // Log the data that was attempted
          },
        });
        throw new ExpressError(
          `Failed to update map with ID ${idString}: ${err.message}`,
          500
        );
      }
    }
  }

  /**
   * Retrieves all map documents associated with a specific character ID.
   *
   * @static
   * @async
   * @param {string|ObjectId} characterId - The MongoDB ObjectId (or string
   *  representation) of the character.
   * @returns {Promise<Array<object>>} A promise resolving to an array of map
   *   documents (plain JavaScript objects due to `.lean()`) belonging to the
   *   character.
   * @throws {BadRequestError} If the characterId format is invalid.
   * @throws {ExpressError} If a database error occurs.
   */
  static async getAllForCharacter(characterId) {
    const timestamp = new Date().toISOString();
    let characterIdObj;
    try {
      characterIdObj = convertToObjectId(characterId);
    } catch (e) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'MapModel.getAllForCharacter',
        message: `Invalid characterId format provided.`,
        context: {
          providedCharacterId: characterId,
          error: e,
          errorMessage: e.message,
        },
        stack: e.stack,
      });
      throw new BadRequestError(`Invalid character ID format: ${characterId}`);
    }

    console.debug({
      timestamp,
      service: 'MapModel.getAllForCharacter',
      message: `Attempting to fetch all maps for character ID ${characterIdObj}...`,
    });

    try {
      const maps = await mapModel.find({ characterId: characterIdObj }).lean();

      console.debug({
        timestamp: new Date().toISOString(),
        service: 'MapModel.getAllForCharacter',
        message: `Found ${maps.length} maps for character ID ${characterIdObj}.`,
        context: { count: maps.length },
      });
      return maps;
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'MapModel.getAllForCharacter',
        message: `Database error fetching maps. Original error: ${error.name}`,
        context: {
          characterId: characterIdObj?.toString(),
          error,
        },
        stack: error.stack,
      });
      throw new ExpressError(
        `Failed to retrieve maps: ${error.name} - ${error.message}`,
        500
      );
    }
  }

  /**
   * Deletes a map document by its ID.
   *
   * @static
   * @async
   * @param {string | ObjectId} id - The ID of the map to delete.
   * @returns {Promise<{deletedCount: number}>} A promise resolving to an
   *   object like `{ acknowledged: true, deletedCount: 1 }` on success.
   * @throws {BadRequestError} If the map ID format is invalid.
   * @throws {NotFoundError} If the map with the given ID is not found.
   * @throws {ExpressError} If the database operation fails unexpectedly.
   */
  static async delete(id) {
    const idString = id?.toString();
    if (!idString) {
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.delete`,
        message: `Missing or invalid map ID for deletion.`,
        context: { mapId: idString },
      });
      throw new BadRequestError(`Valid Map ID is required for deletion.`);
    }

    try {
      const mapIdObj = convertToObjectId(idString);
      console.debug({
        timestamp: new Date().toISOString(),
        service: `MapModel.delete`,
        message: `Attempting to delete map '${idString}' from MongoDB...`,
      });

      // Use deleteOne for efficiency if we don't need the deleted document
      const result = await mapModel.deleteOne({ _id: mapIdObj });

      if (result.deletedCount === 0) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.delete`,
          message: `Map not found for deletion.`,
          context: { mapId: idString },
        });
        // Throw NotFoundError if the document didn't exist
        throw new NotFoundError(`Map not found with ID: ${idString}`);
      }

      console.info({
        timestamp: new Date().toISOString(),
        service: `MapModel.delete`,
        message: `Map deleted successfully.`,
        context: { mapId: idString, deletedCount: result.deletedCount },
      });
      return result; // Contains { acknowledged: true, deletedCount: 1 }
    } catch (err) {
      // Re-throw specific errors we expect (BadRequest, NotFound)
      if (err instanceof BadRequestError || err instanceof NotFoundError) {
        throw err;
      }
      // Handle potential CastError from convertToObjectId if it occurs before deleteOne
      if (err.name === 'CastError') {
        console.warn({
          timestamp: new Date().toISOString(),
          service: `MapModel.delete`,
          message: `Invalid map ID format provided for deletion.`,
          context: {
            mapId: idString,
            error: err.message,
          },
        });
        throw new BadRequestError(`Invalid map ID format: ${idString}`);
      }

      // Catch any other unexpected database errors
      console.error({
        timestamp: new Date().toISOString(),
        service: `MapModel.delete`,
        message: `Unexpected error deleting map. Original error: ${err.name}`,
        context: {
          error: err,
          mapId: idString,
        },
        stack: err.stack,
      });
      throw new ExpressError(
        `Failed to delete map with ID ` +
        `${idString}: ${err.name} - ${err.message}`,
        500
      );
    }
  }

  /**
   * Executes a batch of tile update operations using MongoDB's bulkWrite.
   * Provides detailed logging of the outcome. Operations are unordered.
   *
   * @static
   * @async
   * @param {Array<object>} bulkOps - An array of MongoDB bulk write operations
   *   (e.g., { updateOne: { filter: {...}, update: {...} } }).
   * @returns {Promise<object>} Resolves to the result object from `bulkWrite`,
   *   containing counts of modified, matched, upserted documents, etc.
   * @throws {BadRequestError} If `bulkOps` is not a non-empty array.
   * @throws {ExpressError} If the bulkWrite database operation fails.
   */
  static async bulkUpdateTiles(bulkOps) {
    const timestamp = new Date().toISOString();
    if (!Array.isArray(bulkOps) || bulkOps.length === 0) {
      console.error({
        timestamp,
        service: 'MapModel.bulkUpdateTiles',
        message: 'Invalid or empty bulkOps array provided.',
        context: { bulkOps },
      });
      throw new BadRequestError('bulkOps must be a non-empty array.');
    }

    console.debug({
      timestamp,
      service: 'MapModel.bulkUpdateTiles',
      message: `Executing bulkWrite with ${bulkOps.length} operations...`,
      // Avoid logging full bulkOps if it's very large or contains sensitive data
      context: { operationCount: bulkOps.length },
    });

    try {
      // Execute the bulk write operation directly on the model
      const result = await mapModel.bulkWrite(bulkOps, { ordered: false });

      console.info({
        timestamp: new Date().toISOString(),
        service: 'MapModel.bulkUpdateTiles',
        message: 'bulkWrite operation completed.',
        context: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
          deletedCount: result.deletedCount,
          writeErrors: result.hasWriteErrors() ? result.getWriteErrors().length : 0,
        },
      });

      // Optional: Check for write errors and log/throw if necessary
      if (result.hasWriteErrors()) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'MapModel.bulkUpdateTiles',
          message: 'bulkWrite completed with write errors.',
          context: { writeErrors: result.getWriteErrors() },
        });
        // Decide if write errors should cause a full throw or just be logged
        // For now, just log and return the result
      }

      return result;
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'MapModel.bulkUpdateTiles',
        message: `Database error during bulkWrite execution. Original error: ${error.name}`,
        context: { error },
        stack: error.stack,
      });
      throw new ExpressError(
        `Database error during bulk tile update: ${error.name} - ${error.message}`,
        500
      );
    }
  }

  /**
   * Processes rent payment for all eligible tiles on a given map.
   * Identifies tiles where rent is currently due based on `canPayRent`,
   * calculates the total cost using `costToRentTile`, and executes a bulk
   * update to set the `nextRentDue` date using `leaseTime`. Includes an
   * optimistic concurrency check in the update.
   *
   * **Important:** This method *only* updates the map tiles in the database.
   * The actual cost deduction from the character's wallet must be handled
   * separately by the caller, using the `totalCost` returned by this method.
   *
   * @static
   * @async
   * @param {string|ObjectId} mapId - The ID of the map to process.
   * @param {string|ObjectId} characterId - The ID of the character initiating
   *   the payment (used for logging/context).
   * @returns {Promise<{updatedTileCount: number, totalCost: number}>} Resolves
   *   to an object containing the number of tiles whose rent was successfully
   *   processed (`modifiedCount` from bulkWrite) and the total calculated rent
   *   cost based on all eligible tiles initially found.
   * @throws {NotFoundError} If the map is not found.
   * @throws {ExpressError} If the bulk update database operation fails.
   * @throws {Error} Potentially other errors if dynamic import of gameData
   *   fails.
   */
  static async payRentForMap(mapId, characterId) {
    const timestamp = new Date().toISOString();
    const mapIdObj = convertToObjectId(mapId);
    const mapIdStr = mapIdObj.toString();
    const characterIdStr = characterId.toString(); // For logging

    console.debug(
      `[${timestamp}] [DEBUG] [MapModel.payRentForMap] Initiated for map ` +
      `${mapIdStr} by char ${characterIdStr}.`
    );

    const map = await mapModel.findById(mapIdObj).lean(); // Use lean for iteration
    if (!map) {
      throw new NotFoundError(`Map not found with ID: ${mapIdStr}`);
    }

    if (!map.tiles || typeof map.tiles !== 'object') {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [MapModel.payRentForMap] Map ` +
        `${mapIdStr} has no tiles or tiles field is not an object.`
      );
      return { updatedTileCount: 0, totalCost: 0 };
    }

    const bulkOps = [];
    let eligibleTileCount = 0;
    // Dynamically import shared libraries
    // Cannot use top-level await, must use dynamic import()
    const { canPayRent, leaseTime, costToRentTile } = await import(
      '../../src/library/gameData.js'
    );

    const now = new Date();
    const nextDueDate = new Date(now.getTime() + leaseTime);

    for (const coordString in map.tiles) {
      if (Object.hasOwn(map.tiles, coordString)) {
        const tile = map.tiles[coordString];
        // Check if rent is due using the utility function
        if (tile?.properties && canPayRent(tile.properties)) {
          eligibleTileCount++;
          bulkOps.push({
            updateOne: {
              filter: {
                _id: mapIdObj,
                // Add optimistic concurrency check: ensure the tile still
                // meets the condition (rent was due)
                [`tiles.${coordString}.properties.leasable`]: false,
                // Ensure rent is actually due before updating
                [`tiles.${coordString}.properties.nextRentDue`]: {
                  $lte: now // Rent is due if nextRentDue is now or in the past
                }
              },
              update: {
                $set: {
                  [`tiles.${coordString}.properties.nextRentDue`]: nextDueDate,
                },
              },
            },
          });
        }
      }
    }

    const totalCost = eligibleTileCount * costToRentTile;

    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [MapModel.payRentForMap] ` +
      `Prepared ${bulkOps.length} update operations for map ${mapIdStr}. ` +
      `Total cost: ${totalCost}.`
    );

    try {
      // Execute the bulk update using the existing static method
      const result = await Map.bulkUpdateTiles(bulkOps);

      // Check the result. `modifiedCount` reflects successful updates.
      const actualUpdatedCount = result.modifiedCount;

      console.info(
        `[${new Date().toISOString()}] [INFO] [MapModel.payRentForMap] ` +
        `Bulk update completed for map ${mapIdStr}. Matched: ` +
        `${result.matchedCount}, Modified: ${actualUpdatedCount}.`
      );

      // Return the *actual* number of tiles updated by the bulk op
      // and the *calculated* total cost based on eligibility check.
      // The calling route handles the wallet deduction based on this totalCost.
      return { updatedTileCount: actualUpdatedCount, totalCost };
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [MapModel.payRentForMap] ` +
        `Bulk update failed for map ${mapIdStr}:`, error
      );
      console.error(error.stack);
      // Re-throw the error to be handled by the calling route
      throw error;
    }
  }
}

export default Map;