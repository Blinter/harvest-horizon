import mongoose from 'mongoose';
import dotenv from 'dotenv';
import StatusLog from '../server/database/mongo/statusLogSchema.js';
// Remove Character import as it's no longer needed for listing
// import Character from '../server/database/mongo/characterSchema.js';

dotenv.config({ path: '../.env' }); // Assuming .env is in the root

const MONGODB_URI =
  process.env.MONGODB_URI_DEV ||
  'mongodb://localhost:27017/farm';

/**
 * Fetches and lists status log entries for a specific character ID
 * provided via command-line arguments.
 *
 * Connects to MongoDB using the connection string from environment
 * variables or a default. Retrieves log entries associated with the
 * given character ID, sorts them chronologically, formats them for
 * readability, and prints them to the standard output.
 *
 * Exits the process with status code 1 if the character ID argument
 * is missing, invalid (not a 24-character hex string), or if any
 * database operation fails. Logs informational messages, warnings,
 * and errors to the console during execution. Ensures disconnection
 * from MongoDB before exiting.
 *
 * @async
 * @function listStatusLogsForCharacter
 * @returns {Promise<void>} A promise that resolves when the script
 *   completes or rejects on error.
 */
async function listStatusLogsForCharacter() {
  const targetCharacterId = process.argv[2]; // Get ID from command line args

  // --- Argument Validation ---
  if (!targetCharacterId) {
    console.error(
      'Error: Character ID argument is missing.\n' +
      'Usage: node scripts/list-status-logs.js <characterId>'
    );
    process.exit(1);
  }

  // Basic validation for ObjectId format (24 hex characters)
  if (!/^[0-9a-fA-F]{24}$/.test(targetCharacterId)) {
    console.error(
      `Invalid Character ID format provided: ${targetCharacterId}. ` +
      `Expected 24 hex characters.`
    );
    process.exit(1);
  }

  console.info(
    'Attempting to list status logs for Character ID: ' +
    `${targetCharacterId}` // Fixed line length
  );

  try {
    console.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.info('Successfully connected to MongoDB.');

    console.info(`Fetching status logs for ID: ${targetCharacterId}...`);
    // Fetch the specific log document by characterId
    const statusLog = await StatusLog.findOne(
      { characterId: targetCharacterId },
      'entries' // Select only the entries field
    ).lean(); // Use lean for plain JS objects

    if (!statusLog?.entries || statusLog.entries.length === 0) {
      console.warn(
        `No status log entries found for Character ID: ${targetCharacterId}.`
      );
    } else {
      console.info(
        `Found ${statusLog.entries.length} log entries for ` +
        `${targetCharacterId}:` // Fixed line length
      );
      console.info('--- Log Entries ---');
      // Sort entries chronologically just in case they aren't stored sorted
      statusLog.entries.sort((a, b) => a.timestamp - b.timestamp);
      statusLog.entries.forEach(entry => {
        // Format timestamp for better readability
        const timestampStr = entry.timestamp.toISOString();
        console.log(
          `[${timestampStr}] Type: ${entry.statusType} - ` +
          `Details: ${entry.details}` // Fixed line length
        );
      });
      console.info('--- End of Log Entries ---');
    }
  } catch (error) {
    // Log general script error
    console.error('Script execution failed:', error);
    process.exitCode = 1; // Indicate failure
  } finally {
    console.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.info('Disconnected.');
  }
}

// Call the renamed function
listStatusLogsForCharacter();
