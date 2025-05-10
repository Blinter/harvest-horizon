/**
 * @file Test Script for StatusLog Model
 * @description Connects to MongoDB, fetches paginated status logs for a
 *   specific character using the StatusLog model's static method, and prints
 *   the result.
 */

import mongoose from 'mongoose';
import StatusLog from '../server/models/statusLog.js'; // Adjust path if needed
import { MONGODB_URI } from '../server/constants/config.js';
// Adjust path if needed

// --- Configuration ---
const CHARACTER_ID_TO_TEST = '67f6a545576c1b94521c1ab0';
const SKIP_ENTRIES = 0; // Start from the beginning
const LIMIT_ENTRIES = 10; // Fetch the first 10 entries

/**
 * Main function to test the StatusLog model. Connects to the database,
 * fetches logs using the model's static method, prints the results, and
 * handles disconnection.
 */
async function testStatusLogModel() {
  try {
    console.info(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.info('Successfully connected to MongoDB.');

    console.info(
      `Fetching logs for Character ID: ${CHARACTER_ID_TO_TEST} ` +
      `(skip=${SKIP_ENTRIES}, limit=${LIMIT_ENTRIES})...`
    );

    const result = await StatusLog.getPaginatedLogsByCharacterId(
      CHARACTER_ID_TO_TEST,
      SKIP_ENTRIES,
      LIMIT_ENTRIES
    );

    console.info('\n--- Test Results ---');
    if (result) {
      console.info(`Total Entries Found: ${result.totalEntries}`);
      console.info(
        `Fetched Entries (${result.paginatedEntries.length}):`
      );
      // Pretty print the entries
      console.log(JSON.stringify(result.paginatedEntries, null, 2));
    } else {
      // Should not happen based on model logic, but good to check
      console.warn('No result returned from the model method.');
    }
    console.info('--------------------\n');

  } catch (error) {
    console.error('Test script failed:', error);
    process.exitCode = 1; // Indicate failure
  } finally {
    if (mongoose.connection.readyState === 1) {
      console.info('Disconnecting from MongoDB...');
      await mongoose.disconnect();
      console.info('Disconnected.');
    }
  }
}

// --- Execute the test ---
testStatusLogModel(); 