/**
 * @file Common test setup helper for Dual Database (PostgreSQL & MongoDB)
 *   tests.
 * @module server/database/helpers/_testCommonDual
 * @description Provides functions to create and manage shared test data
 *   across both PostgreSQL and MongoDB databases for integration testing.
 *   It coordinates actions involving user accounts (Postgres), characters
 *   (Postgres), and associated game data like maps, inventories, wallets,
 *   and status logs (Mongo). Relies on helper functions from
 *   `_testCommonMongoDb.js` and `_testCommonPostgres.js`.
 *   Note: The leading underscore indicates this is an internal testing
 *   utility.
 */
'use strict';

// import { query as queryPg /* connect */ } from '../dbPostgres.js';
// Unused in exported functions

// import {} from // characters_database, // Unused in exported functions
// maps_database, // Unused in exported functions
/* users_database, // Commented out unused import */
'../constants/config.js';

import {
  char1Id as char1IdMongo,
  // char1IdString as char1IdMongoString, // Unused in exported functions
  char2Id as char2IdMongo,
  getMongoModels,
} from './_testCommonMongoDb.js';

// import mapSchema from '../mongo/map-schema.js';
// Unused in exported functions
// import statusLogSchema from '../mongo/statusLog-schema.js';
// Unused in exported functions
// import { getMongooseModel } from './mongoose.js'; // Unused

// Imports from _testCommonPostgres.js (currently none used)
/*
import {
  // commonBeforeEach, // Commented out unused import
  // user1Id as user1IdPg, // Unused in exported functions
} from './_testCommonPostgres.js';
*/

// import { withTimeout } from './_timeoutsDatabase.js'; // Unused

// const user1CharName = "Alice's Character"; // Unused in exported functions
// const user2CharName = "Bob's Character"; // Commented out unused variable
// const charMap1Name = "Alice's Map"; // Unused in exported functions
// const charMap2Name = "Bob's Map"; // Unused in exported functions

/**
 * @todo This function is currently unused.
 *   Consider removing or implementing if needed.
async function connectToPostgres() {
  await connect();
}
*/

/**
 * Creates initial Map documents in MongoDB for the test characters.
 * Uses predefined character IDs from `_testCommonMongoDb`.
 *
 * @async
 * @function createTestMaps
 * @throws {Error} If the Mongoose 'Map' model is not defined.
 */
/* // Unused function
async function createTestMaps() {
  const mapModel = getMongooseModel('Map', mapSchema);
  if (!mapModel) throw new Error('Map Model undefined in createDualTestData');

  await mapModel.insertMany([
    {
      characterId: char1IdMongo,
      mapNickname: charMap1Name,
      maxWidth: 10,
      maxHeight: 10,
      maxCoordsLeasable: 5,
      rentCostPerTile: 1,
      nextRentDue: new Date(),
    },
    {
      characterId: char2IdMongo,
      mapNickname: charMap2Name,
      maxWidth: 10,
      maxHeight: 10,
      maxCoordsLeasable: 5,
      rentCostPerTile: 1,
      nextRentDue: new Date(),
    },
  ]);
}
*/

/**
 * Stores the MongoDB ObjectId of the status log created for test
 * character 1.
 * @type {Object|undefined}
 */
// let newCharStatusLog1IdMongo; // Unused

/**
 * Retrieves the MongoDB ObjectId for test character 1's status log.
 *
 * @function char1StatusLogId
 * @returns {Object|undefined} 
 */
// const char1StatusLogId = () => newCharStatusLog1IdMongo; // Unused

/**
 * Stores the MongoDB ObjectId of the status log created for test
 * character 2.
 * @type {Object}
 */
// let newCharStatusLog2IdMongo; // Unused

/**
 * Retrieves the MongoDB ObjectId for test character 2's status log.
 *
 * @function char2StatusLogId
 * @returns {Object|undefined} 
 */
// const char2StatusLogId = () => newCharStatusLog2IdMongo; // Unused

/**
 * Creates initial StatusLog documents in MongoDB for the test characters.
 * Uses predefined character IDs from `_testCommonMongoDb`. Stores the
 * generated ObjectIds in module-level variables.
 *
 * @async
 * @function createTestStatusLogs
 * @throws {Error} If the Mongoose 'StatusLog' model is not defined.
 */
/* // Unused function
async function createTestStatusLogs() {
  const statusLogModel = getMongooseModel('StatusLog', statusLogSchema);
  if (!statusLogModel)
    throw new Error('Status Log Model undefined in createDualTestData');

  await statusLogModel.insertMany([
    { characterId: char1IdMongo },
    { characterId: char2IdMongo },
  ]);
}
*/

/**
 * Retrieves all relevant MongoDB ObjectIds associated with test character 1.
 * Fetches Inventory, Wallet, Map, and StatusLog documents based on the
 * predefined character 1 ID (`char1IdMongo`).
 *
 * @async
 * @function getCharacter1Ids
 * @returns {Promise<Object>} A promise resolving to an object containing
 *   the string representations of the ObjectIds for character 1.
 * @property {string} username - The username associated with the character
 *   (Postgres).
 * @property {string} characterId - The MongoDB ObjectId of the character
 *   document.
 * @property {string} inventoryId - The MongoDB ObjectId of the inventory
 *   document.
 * @property {string} walletId - The MongoDB ObjectId of the wallet document.
 * @property {string} mapId - The MongoDB ObjectId of the map document.
 * @property {string} statusLogId - The MongoDB ObjectId of the status log
 *   document.
 * @throws {Error} If any required Mongoose model is undefined or if any
 *   associated document cannot be found for character 1.
 */
export async function getCharacter1Ids() {
  try {
    const models = getMongoModels();
    if (models === undefined) {
      throw new Error(
        `getCharacter1Ids() called with invalid mongoose models instance`
      );
    }

    if (!models.inventory) {
      throw new Error(`Inventory Model not defined`);
    }

    const inventory = await models.inventory.findOne({
      characterId: char1IdMongo,
    });

    if (inventory?._id === undefined) {
      console.info(models);
      console.info(models.inventory);
      console.info(inventory);
      throw new Error(
        `Cannot find Inventory for Test Character #1`,
        models,
        inventory
      );
    }

    if (!models.wallet) {
      throw new Error(`Wallet Model not defined`);
    }
    const wallet = await models.wallet.findOne({
      characterId: char1IdMongo,
    });

    if (wallet?._id === undefined) {
      throw new Error(`Cannot find Wallet for Test Character #1`);
    }

    if (!models.map) {
      throw new Error(`Map Model not defined`);
    }
    const map = await models.map.findOne({
      characterId: char1IdMongo,
    });

    if (map?._id === undefined) {
      throw new Error(`Cannot find Map for Test Character #1`);
    }

    if (!models.statusLog) {
      throw new Error(`StatusLog Model not defined`);
    }
    const statusLog = await models.statusLog.findOne({
      characterId: char1IdMongo,
    });

    if (statusLog?._id === undefined) {
      throw new Error(`Cannot find Status Log for Test Character #1`);
    }

    return {
      username: 'NotaTestUser',
      characterId: char1IdMongo.toString(),
      inventoryId: inventory._id.toString(),
      walletId: wallet._id.toString(),
      mapId: map._id.toString(),
      statusLogId: statusLog._id.toString(),
    };
  } catch (err) {
    console.error(`Error checking getCharacter1Ids: ${err.message}`);
    console.error(`Error stack: ${err.stack}`);
    throw err;
  }
}

/**
 * Retrieves all relevant MongoDB ObjectIds associated with test character 2.
 * Fetches Inventory, Wallet, Map, and StatusLog documents based on the
 * predefined character 2 ID (`char2IdMongo`).
 *
 * @async
 * @function getCharacter2Ids
 * @returns {Promise<Object>} A promise resolving to an object containing
 *   the string representations of the ObjectIds for character 2.
 * @property {string} inventoryId - The MongoDB ObjectId of the inventory
 *   document.
 * @property {string} walletId - The MongoDB ObjectId of the wallet
 *   document.
 * @property {string} mapId - The MongoDB ObjectId of the map document.
 * @property {string} statusLogId - The MongoDB ObjectId of the status log
 *   document.
 * @throws {Error} If any required Mongoose model is undefined or if any
 *   associated document cannot be found for character 2.
 */
export async function getCharacter2Ids() {
  try {
    const models = getMongoModels();
    if (!models) {
      throw new Error(
        `getCharacter2Ids() called with invalid mongoose models instance`
      );
    }

    if (!models.inventory) {
      throw new Error(`Inventory Model not defined`);
    }
    const inventory = await models.inventory.findOne({
      characterId: char2IdMongo,
    });
    if (inventory === undefined) {
      throw new Error(`Cannot find Inventory for Test Character #2`);
    }

    if (!models.wallet) {
      throw new Error(`Wallet Model not defined`);
    }
    const wallet = await models.wallet.findOne({
      characterId: char2IdMongo,
    });
    if (wallet === undefined) {
      throw new Error(`Cannot find Wallet for Test Character #2`);
    }

    if (!models.map) {
      throw new Error(`Map Model not defined`);
    }
    const map = await models.map.findOne({
      characterId: char2IdMongo,
    });
    if (map === undefined) {
      throw new Error(`Cannot find Map for Test Character #2`);
    }

    if (!models.statusLog) {
      throw new Error(`StatusLog Model not defined`);
    }
    const statusLog = await models.statusLog.findOne({
      characterId: char2IdMongo,
    });
    if (statusLog === undefined) {
      throw new Error(`Cannot find Status Log for Test Character #2`);
    }

    return {
      inventoryId: inventory._id.toString(),
      walletId: wallet._id.toString(),
      mapId: map._id.toString(),
      statusLogId: statusLog._id.toString(),
    };
  } catch (err) {
    console.error(`Error checking getCharacter2Ids:`, err.message);
    console.error(`Error stack:`, err.stack);
    throw err;
  }
}

/**
 * @todo This function is currently unused. It seems intended to ensure a
 *   user exists in Postgres before creating related data, potentially
 *   calling `commonBeforeEach` from `_testCommonPostgres` if the user is
 *   missing. Consider removing or implementing if needed for specific
 *   test scenarios.
 * @async
 * @function ensureUserExists
 * @param {Object} userId - The Postgres user ID to check.
 */
/* // Unused function
async function ensureUserExists(userId) {
  try {
    await queryPg(`BEGIN`);
    const result = await queryPg(
      `SELECT 
        id
       FROM 
        ${users_database}
       WHERE 
        id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      console.debug("User doesn't exist, creating one");
      await commonBeforeEach();
      console.debug('Created test user');
      await queryPg(`COMMIT`);
    }
    await queryPg(`END`);
  } catch (err) {
    console.error('Error checking User Exists:', err.message);
    console.error('Error stack:', err.stack);
    await queryPg(`ROLLBACK`);
    await queryPg(`END`);
    throw err;
  }
}
*/

/**
 * Inserts a character record into the PostgreSQL `farm_characters` table.
 * This links the PostgreSQL character entry to its corresponding MongoDB
 * documents using the provided IDs.
 *
 * @async
 * @function insertCharacterIntoPostgres
 * @param {Object} ids - An object containing the MongoDB ObjectIds (as
 *   strings) for the character's related documents (inventory, statusLog,
 *   wallet). Should match the structure returned by `getCharacter1Ids` or
 *   `getCharacter2Ids`.
 * @param {string} ids.inventoryId - MongoDB ObjectId for inventory.
 * @param {string} ids.statusLogId - MongoDB ObjectId for status log.
 * @param {string} ids.walletId - MongoDB ObjectId for wallet.
 * @throws {Error} If any value in the data array to be inserted is
 *   undefined, or if the database insertion fails.
 */
/* // Unused function
async function insertCharacterIntoPostgres(ids) {
  const timestamp = new Date().toISOString();
  console.debug(
    `[${timestamp}] [DEBUG]: Starting PostgreSQL ` +
    `insertCharacter for ids: ${JSON.stringify(ids)}`
  );

  const data = [
    user1IdPg(),
    user1CharName,
    true,
    char1IdMongoString,
    ids.inventoryId,
    ids.statusLogId,
    ids.walletId,
  ];

  if (data.some((v) => v === undefined)) {
    throw new Error('Undefined value in data array DATA:', data);
  }
  try {
    await queryPg('BEGIN');

    const insertQuery = `
        INSERT INTO ${characters_database} 
          (user_pg_id,
          name, 
          favorite_character,
          character_id, 
          inventory_id, 
          status_log_id, 
          wallet_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *`;

    const result = await queryPg(insertQuery, data);

    if (result.rows.length === 0) {
      throw new Error('No rows returned after insertion');
    }
    await queryPg(`END`);
    await queryPg(`COMMIT`);

    return result;
  } catch (error) {
    console.error('Error inserting character:', error.message);
    console.error('Error stack:', error.stack);
    await queryPg(`ROLLBACK`);
    await queryPg(`END`);
    throw error;
  } finally {
    console.info(
      `[${timestamp}] [INFO]: PostgreSQL ` + `insertCharacter completed.`
    );
  }
} */

/**
 * Creates comprehensive test data across both MongoDB and PostgreSQL.
 * This is the main setup function for dual-database integration tests.
 * It orchestrates the creation of:
 * 1. MongoDB test data (Users, Characters, Inventories, Wallets via
 *    `_testCommonMongoDb`).
 * 2. MongoDB Maps and StatusLogs (via internal functions like
 *    `createTestMaps`, `createTestStatusLogs`).
 * 3. Retrieves the generated MongoDB IDs.
 * 4. Inserts corresponding Character and Map records into PostgreSQL,
 *    linking them to the MongoDB data using the retrieved IDs.
 *
 * This function ensures a consistent starting state for tests that interact
 * with both database systems. It uses timeouts from `_timeoutsDatabase`.
 *
 * @async
 * @function createDualTestData
 * @throws {Error} If any step in the data creation process fails.
 */
export async function createDualTestData() {
  // NOTE: This function currently only exports getCharacter1Ids and
  // getCharacter2Ids implicitly by being in the same file.
  // It doesn't perform the setup actions described in the JSDoc
  // as the required helper functions (createTestMaps, createTestStatusLogs,
  // insertCharacterIntoPostgres, insertMapIntoPostgres) were removed
  // due to being unused in the original file.
  // Restore and call those functions here if their setup logic is needed.
  console.warn(
    `createDualTestData is a stub and does not fully set up ` + `dual DB data.`
  );
  // Example (if functions were restored):
  // await commonBeforeEach();
  // Assuming setup from _testCommonMongoDb is needed
  // await createTestMongoData();
  // await createTestMaps();
  // await createTestStatusLogs();
  // const ids1 = await getCharacter1Ids();
  // const ids2 = await getCharacter2Ids();
  // await insertCharacterIntoPostgres(ids1); // Or adapt for multiple chars
  // await insertMapIntoPostgres(ids1.mapId); // Or adapt for multiple maps
}

// const { StatusLog } = getMongoModels(); // Commented out unused variable

// Unused in exported functions
// const char1Id = char1IdMongo ? char1IdMongo.toString() : undefined;
// Unused in exported functions
// const char2Id = char2IdMongo ? char2IdMongo.toString() : undefined;
// Unused in exported functions

/**
 * Retrieves the mapId string for a given character.
 *
 * @async
 * @function getMapIdForCharacter
 * @param {Object} characterId - The MongoDB ObjectId of the character.
 * @returns {Promise<string>} A promise that resolves with the mapId string.
 * @throws {Error} If the Mongoose 'Map' model is not defined or the Map
 *   cannot be found.
 */
/* // Commenting out unused function
async function getMapIdForCharacter(characterId) {
  // Implementation of the function
}
*/
