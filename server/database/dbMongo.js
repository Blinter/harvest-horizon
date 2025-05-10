/**
 * @file MongoDB connection management and utility functions using Mongoose.
 * @module server/database/mongo
 * @description Handles connecting to MongoDB using Mongoose and provides
 *   utility functions.
 */

import mongoose from 'mongoose'; // Use Mongoose
import { ObjectId } from 'mongodb'; // Still need ObjectId for validation/conversion
import { BadRequestError } from '../expressError.js';
// Import MONGODB_URI from the central config file
import { MONGODB_URI } from '../constants/config.js';
// Direct console calls used instead of logger

/**
 * Establishes a connection to the MongoDB server using Mongoose.
 * Includes retry logic and proper event handling.
 *
 * @async
 * @function connectDb
 * @throws {Error} If the connection fails after retries, preventing server
 *   startup.
 */
export const connectDb = async () => {
  // MONGODB_URI is now imported from config
  if (!MONGODB_URI) {
    console.error(
      'MONGODB_URI environment variable not set or config missing.'
    );
    throw new Error('MONGODB_URI not configured.');
  }

  // Handle Mongoose connection events
  mongoose.connection.on('connected', () => {
    console.info(`Mongoose connected to ${MONGODB_URI}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn(
      `Mongoose disconnected. Optional: implement reconnection logic here ` +
      `if needed beyond initial connect`
    );
  });

  try {
    console.info(`Attempting to connect Mongoose to ${MONGODB_URI}...`); // Use info
    await mongoose.connect(MONGODB_URI, {
      // Use imported constant
      // Recommended options:
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    });
    // Connection successful message is handled by the
    // 'connected' event listener
  } catch (error) {
    // Split the log message
    console.error('Initial Mongoose connection ' + 'failed:');
    console.error(error); // Log the error object separately
    throw error; // Re-throw error to signal connection failure during startup
  }
};

/**
 * Closes the Mongoose MongoDB connection gracefully. Logs errors if
 * disconnection fails but does not throw.
 *
 * @async
 * @function endDb
 */
export const endDb = async () => {
  try {
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error disconnecting Mongoose:', err);
  }
};

/**
 * Converts a string or ObjectId into a MongoDB ObjectId. Throws a
 * `BadRequestError` if the input is invalid or conversion fails.
 *
 * @function convertToObjectId
 * @param {string | ObjectId} id - The ID to convert. Must be a valid ObjectId
 *   string or an existing ObjectId instance.
 * @returns {ObjectId} The converted MongoDB ObjectId.
 * @throws {BadRequestError} If the input ID is not a valid string or ObjectId,
 *   or if the conversion process fails for other reasons.
 */
export const convertToObjectId = (id) => {
  try {
    if (typeof id === 'string') {
      // Ensure string is a valid ObjectId format before converting
      if (!ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid ObjectId string format: ${id}`);
      }
      return new ObjectId(id);
    } else if (id instanceof ObjectId) {
      return id; // Already an ObjectId
    }
    // If not string or ObjectId, throw error
    throw new BadRequestError(
      'Invalid ID type provided for ObjectId conversion'
    );
  } catch (err) {
    // Catch potential errors from ObjectId constructor or isValid
    if (err instanceof BadRequestError) throw err; // Re-throw specific errors
    throw new BadRequestError(`ObjectId conversion failed: ${err.message}`);
  }
};

// Default export is the utility function for convenience
export default convertToObjectId;
