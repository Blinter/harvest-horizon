/**
 * @file In-memory MongoDB server setup for testing.
 * @module server/database/testDbMongo
 * @description Provides functions to start, connect to, disconnect from, and
 *   stop an in-memory MongoDB server instance (`mongodb-memory-server`).
 *
 *   This is used to create isolated database environments for tests.
 */

import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Holds the instance of the in-memory MongoDB server.
 * MongoMemoryServer or undefined
 *
 * @type {object}
 */
let mongoServer;

/**
 * Holds the connected MongoDB client instance.
 * MongoClient or undefined or null
 *
 * @type {object}
 */
let client;

/**
 * Connects to an in-memory MongoDB server for testing.
 *
 * If a server instance doesn't exist, it creates one. It then connects a
 * MongoDB client to the server's URI. Stores the server instance and the
 * connected client.
 *
 * @async
 * @function connectTestMongo
 * @returns {Promise<MongoClient>} A promise resolving to the connected
 *   MongoClient instance. The client instance also has a `url` property
 *
 *   added containing the connection URI.
 * @throws {Error} If starting the server or connecting the client fails.
 */
export const connectTestMongo = async () => {
  try {
    if (!mongoServer) mongoServer = await MongoMemoryServer.create();

    const uri = await mongoServer.getUri();

    if (!uri) {
      console.error('MongoMemoryServer getUri returned undefined');
      throw new Error('URI UNDEFINED: Please check stack');
    }

    client = await MongoClient.connect(uri, {
      minPoolSize: 1,
      maxPoolSize: 10,
    });

    client.url = uri;

    return client;
  } catch (error) {
    console.error('Error connecting to test MongoDB:', error);
    throw error;
  }
};

/**
 * Disconnects the MongoDB client and stops the in-memory server.
 *
 * Sets the internal client and server variables to null.
 *
 * @async
 * @function disconnectTestMongo
 * @returns {Promise<void>} A promise resolving when disconnection is
 *
 *   complete.
 * @throws {Error} If disconnecting the client or stopping the server fails.
 */
export const disconnectTestMongo = async () => {
  try {
    if (client) {
      await client.close();
      client = null;
    }

    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  } catch (error) {
    console.error('Error disconnecting from test MongoDB:', error);
    throw error;
  }
};

/**
 * Retrieves the currently connected MongoDB test client instance.
 *
 * @function getTestMongoClient
 * @returns {MongoClient} The connected MongoClient instance.
 * @throws {Error} If the client has not been initialized by calling
 *
 *   `connectTestMongo` first.
 */
export const getTestMongoClient = () => {
  if (!client) {
    throw new Error(`MongoDB client is not initialized. 
            Call connectTestMongo first.`);
  }
  return client;
};
