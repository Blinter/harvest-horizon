/**
 * @file Common test setup helper for MongoDB tests.
 * @module server/database/helpers/_testCommonMongoDb
 * @description Provides functions to initialize, manage, seed, and tear down
 *   a MongoDB test environment using Mongoose and potentially an in-memory
 *   server. Exports test character IDs and functions for database lifecycle
 *   management.
 *   Note: The leading underscore indicates this is an internal testing utility.
 */
import mongoose from 'mongoose';

import {
  connectTestMongo,
  disconnectTestMongo,
  getTestMongoClient,
} from '../testMongo.js';

import characterSchema from '../mongo/character-schema.js';
import inventorySchema from '../mongo/inventory-schema.js';
import walletSchema from '../mongo/wallet-schema.js';

import statusLogSchema from '../mongo/statusLog-schema.js';
import mapSchema from '../mongo/map-schema.js';

import marketSchema from '../mongo/market-schema.js';

import { ObjectId } from 'mongodb';

import { getMongooseModel } from './mongoose.js';

/**
 * Predefined MongoDB ObjectId for test character 1.
 *
 * @type {Object}
 */
export const char1Id = new ObjectId();

/**
 * String representation of the ObjectId for test character 1.
 *
 * @type {string}
 */
export const char1IdString = char1Id.toString();

/**
 * Predefined MongoDB ObjectId for test character 2.
 *
 * @type {Object}
 */
export const char2Id = new ObjectId();

/**
 * String representation of the ObjectId for test character 2.
 *
 * @type {string}
 */
export const char2IdString = char2Id.toString();

/**
 * Holds the reference to the MongoDB test client/server instance.
 *
 * @type {any}
 */
let mongoServer;
/**
 * Cache object for Mongoose models used in tests.
 *
 * @type {Object}
 */
let models = {};

/**
 * Sets up the MongoDB test database environment.
 *
 * Connects using `connectTestMongo` (likely starts an in-memory server).
 * Establishes a Mongoose connection to the test database URI. Compiles and
 * caches Mongoose models for Character, Inventory, Wallet, etc. Waits for the
 * connection to be fully established. Seeds the database with initial test
 * data using `createMongoTestData`. Stores the MongoDB client/server instance.
 *
 * @async
 * @function setupMongoTestDb
 * @param {string} [dbName='testFarmDb'] - The name for the test database.
 * @returns {Promise<void>} A promise resolving when setup is complete.
 * @throws {Error} If the MongoDB client setup, Mongoose connection, model
 *   compilation, or data seeding fails.
 */
export async function setupMongoTestDb(dbName = 'testFarmDb') {
  try {
    await connectTestMongo(dbName);

    const client = getTestMongoClient();
    if (!client?.url) {
      throw new Error('MongoDB client or URI is undefined');
    }

    let uri = client.url;
    if (typeof uri !== 'string' || uri.trim().length === 0) {
      throw new Error('Invalid MongoDB URI');
    }

    await mongoose.connect(uri);

    models.character = getMongooseModel('Character', characterSchema);
    models.inventory = getMongooseModel('Inventory', inventorySchema);
    models.wallet = getMongooseModel('Wallet', walletSchema);

    models.statusLog = getMongooseModel('StatusLog', statusLogSchema);
    models.map = getMongooseModel('Map', mapSchema);

    models.market = getMongooseModel('Market', marketSchema);

    await waitForMongoConnection();

    await createMongoTestData(models);

    mongoServer = client;
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

/**
 * Retrieves the stored MongoDB test client/server instance.
 *
 * @function getMongoServer
 * @returns {any} The MongoDB client/server instance started during setup.
 */
export const getMongoServer = () => mongoServer;

/**
 * Tears down the MongoDB test database environment.
 *
 * Disconnects Mongoose. Disconnects the underlying test MongoDB client/server
 * using `disconnectTestMongo`.
 *
 * @async
 * @function teardownMongoTestDb
 * @returns {Promise<void>} A promise resolving when teardown is complete.
 * @throws {Error} If disconnecting Mongoose or the test server fails.
 */
export const teardownMongoTestDb = async () => {
  try {
    await mongoose.disconnect();
    await disconnectTestMongo();
  } catch (err) {
    console.error('Error tearing down test database:', err);
    throw err;
  }
};

/**
 * Clears all data and drops indexes (except _id) from all collections in the
 * currently connected Mongoose test database.
 * Issues a warning if called when not connected.
 *
 * @async
 * @function clearMongoDatabase
 * @returns {Promise<void>} A promise resolving when the database is cleared.
 * @throws {Error} If clearing the database encounters an unexpected error.
 */
export async function clearMongoDatabase() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected when trying to clear database');
      return;
    }

    // Get all collections
    const collections = mongoose.connection.collections;

    // Drop each collection
    const removePromises = [];
    for (const key in collections) {
      try {
        removePromises.push(collections[key].deleteMany({}));
        // Also drop indexes except for _id
        const indexes = await collections[key].indexes();
        for (const index of indexes) {
          if (index.name !== '_id_') {
            removePromises.push(collections[key].dropIndex(index.name));
          }
        }
      } catch (err) {
        console.error(`Error clearing collection ${key}:`, err);
      }
    }
    await Promise.all(removePromises);
    console.info('MongoDB database cleared successfully');
  } catch (err) {
    console.error('Error clearing MongoDB database:', err);
    throw err;
  }
}

/**
 * Populates the test MongoDB with initial data for characters, inventories,
 * wallets, and market items.
 * Uses predefined ObjectIds (`char1Id`, `char2Id`).
 *
 * @async
 * @function createMongoTestData
 * @param {Object} tempModels - An object containing the compiled Mongoose models required for seeding.
 * @returns {Promise<void>} A promise resolving when data seeding is complete.
 * @throws {Error} If called without the `tempModels` parameter or if Mongoose
 *   is not connected.
 */
export async function createMongoTestData(tempModels) {
  await ensureMongoConnected();
  if (tempModels === undefined)
    throw new Error(
      'createMongoTestData() Create Test Data sent without models parameter.'
    );

  await tempModels.character.insertMany([
    {
      _id: char1Id,
      name: 'Alice',
    },
    {
      _id: char2Id,
      name: 'Bob',
    },
  ]);

  await tempModels.inventory.insertMany([
    {
      characterId: char1Id,
      items: [
        {
          itemName: 'wheat',
          itemType: 'crop',
          quantity: 5,
        },
      ],
    },
    {
      characterId: char2Id,
      items: [],
    },
  ]);

  await tempModels.wallet.insertMany([
    {
      characterId: char1Id,
      coins: 10,
    },
    {
      characterId: char2Id,
      coins: 20,
    },
  ]);

  await tempModels.market.insertMany([
    {
      itemId: new mongoose.Types.ObjectId(),
      itemName: 'wheat',
      itemType: 'crop',
      currentPrice: 20,
      lastUpdated: Date.now(),
      currency: 'coins',
    },
    {
      itemId: new mongoose.Types.ObjectId(),
      itemName: 'wheat',
      itemType: 'seed',
      currentPrice: 10,
      lastUpdated: Date.now(),
      currency: 'coins',
    },
    {
      itemId: new mongoose.Types.ObjectId(),
      itemName: 'unlock',
      itemType: 'mapTile',
      currentPrice: 60,
      lastUpdated: Date.now(),
      currency: 'coins',
    },
    {
      itemId: new mongoose.Types.ObjectId(),
      itemName: 'wheat',
      itemType: 'seed',
      currentPrice: 12,
      lastUpdated: Date.now(),
      currency: 'coins',
    },
  ]);
}

/**
 * Returns the cached Mongoose models.
 *
 * @function getMongoModels
 * @returns {Object} The cached models.
 */
export const getMongoModels = () => models;

/**
 * Ensures that Mongoose is connected before proceeding.
 *
 * @async
 * @function ensureMongoConnected
 * @throws {Error} If Mongoose is not connected (readyState !== 1).
 */
async function ensureMongoConnected() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'Mongoose not connected. Ensure setupMongoTestDb was called and completed.'
    );
  }
}

/**
 * Waits for the Mongoose connection to be established.
 * Polls the connection state with a timeout.
 *
 * @async
 * @function waitForMongoConnection
 * @param {number} [maxAttempts=10] - Maximum number of attempts.
 * @param {number} [delay=2000] - Delay between attempts in milliseconds.
 * @returns {Promise<void>} Resolves when connected.
 * @throws {Error} If connection fails after maximum attempts.
 */
async function waitForMongoConnection(maxAttempts = 10, delay = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    if (mongoose.connection.readyState === 1) {
      console.info('MongoDB connected successfully.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error(
    `MongoDB connection failed after ${maxAttempts} attempts (delay: ${delay}ms)`
  );
}
