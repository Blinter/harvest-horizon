/**
 * @file Delete Specific StatusLog Document
 * @description Connects to MongoDB and deletes the StatusLog document for a
 *   specific character ID.
 */

import mongoose from 'mongoose';
import StatusLog from '../server/models/statusLog.js'; // Use the model schema
import { MONGODB_URI } from '../server/constants/config.js';

// --- Configuration ---
const CHARACTER_ID_TO_DELETE = '67f6a545576c1b94521c1ab0';

/**
 * Connects to MongoDB, deletes the StatusLog document associated with the
 * `CHARACTER_ID_TO_DELETE`, and logs the outcome. Handles connection errors
 * and ensures disconnection.
 */
async function deleteStatusLog() {
  try {
    console.info(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.info('Successfully connected to MongoDB.');

    console.info(
      `Attempting to delete StatusLog for Character ID: ` +
      `${CHARACTER_ID_TO_DELETE}...`,
    );

    // Use the characterId field defined in the model schema
    const result = await StatusLog.deleteOne({
      characterId: CHARACTER_ID_TO_DELETE,
    });

    if (result.deletedCount > 0) {
      console.info(
        `Successfully deleted ${result.deletedCount} StatusLog ` +
        `document(s).`,
      );
    } else {
      console.warn(
        `No StatusLog document found for Character ID: ` +
        `${CHARACTER_ID_TO_DELETE}. Nothing deleted.`,
      );
    }

  } catch (error) {
    console.error('Deletion script failed:', error);
    process.exitCode = 1; // Indicate failure
  } finally {
    if (mongoose.connection.readyState === 1) {
      console.info('Disconnecting from MongoDB...');
      await mongoose.disconnect();
      console.info('Disconnected.');
    }
  }
}

// --- Execute the deletion ---
deleteStatusLog(); 