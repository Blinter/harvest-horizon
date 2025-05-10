import mongoose from 'mongoose';
import StatusLog from '../server/models/statusLog.js';
import Character from '../server/database/mongo/characterSchema.js';
import { MONGODB_URI } from '../server/constants/config.js'; // Import config

/**
 * Generates a random number of pseudo-random status log entries for a
 * given character ID. The number of entries is between 5 and 15, and
 * timestamps are chronologically generated starting from approximately
 * one week ago.
 *
 * @param {mongoose.Types.ObjectId} characterId - The ID of the
 *   character for whom to generate log entries.
 * @returns {Array<object>} An array of pseudo log entry objects, each
 *   containing a timestamp, statusType, and details string.
 */
function generatePseudoLogEntries(characterId) {
  const entries = [];
  // Generate 5 to 15 entries
  const numberOfEntries = Math.floor(Math.random() * 11) + 5;
  const statusTypes = [
    'connected', // Note: pre-save hook adds initial 'connected'
    'disconnected',
    'announcement',
    'achievement',
    'milestone',
    'event',
    'purchase',
    'sale',
  ];
  // Start timestamps roughly 1 week ago
  let lastTimestamp = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

  console.debug(
    `Generating ${numberOfEntries} entries for ${characterId}`
  );

  for (let i = 0; i < numberOfEntries; i++) {
    const statusType =
      statusTypes[Math.floor(Math.random() * statusTypes.length)];
    // Ensure timestamps are chronological and slightly varied
    lastTimestamp = new Date(
      lastTimestamp.getTime() +
      Math.random() * 1000 * 60 * 60 * 6 // Add up to 6 hours
    );

    if (lastTimestamp > Date.now()) {
      lastTimestamp = new Date(); // Cap at current time
    }

    const ip =
      `${Math.floor(Math.random() * 256)}.` +
      `${Math.floor(Math.random() * 256)}.` +
      `${Math.floor(Math.random() * 256)}.` +
      `${Math.floor(Math.random() * 256)}`;
    const announcements = [
      'Maintenance soon',
      'Double XP weekend!',
      'New patch deployed',
    ];
    const achievements = [
      'Woodcutter Apprentice',
      'First Harvest',
      'Explorer',
    ];
    const events = [
      'Harvest Festival',
      'Fishing Contest',
      'Community Bonfire',
    ];
    const purchases = ['Iron Axe', 'Healing Potion', 'Recipe Book'];
    const sales = ['Wheat Bundle', 'Copper Ore', 'Wooden Shield'];

    const randomAnnounce = announcements[
      Math.floor(Math.random() * announcements.length)
    ];
    const randomAchieve = achievements[
      Math.floor(Math.random() * achievements.length)
    ];
    const randomEvent = events[
      Math.floor(Math.random() * events.length)
    ];
    const randomPurchaseItem = purchases[
      Math.floor(Math.random() * purchases.length)
    ];
    const randomSaleItem = sales[
      Math.floor(Math.random() * sales.length)
    ];

    const detailsMap = {
      connected: `Connected from IP ${ip}`,
      disconnected: `Disconnected after ${Math.floor(Math.random() * 120) + 1
        } minutes`,
      announcement: `Server announcement: ${randomAnnounce}`,
      achievement: `Achievement unlocked: ${randomAchieve}`,
      milestone: `Reached level ${Math.floor(Math.random() * 50) + 1}`,
      event: `Participated in ${randomEvent}`,
      purchase:
        `Purchased ${randomPurchaseItem} for ` +
        `${Math.floor(Math.random() * 100) + 10} gold`,
      sale:
        `Sold ${randomSaleItem} for ` +
        `${Math.floor(Math.random() * 50) + 5} gold`,
    };

    entries.push({
      timestamp: new Date(lastTimestamp), // Create new Date object
      statusType,
      details: detailsMap[statusType] ||
        `Generic event details for ${statusType}`,
    });
  }
  return entries;
}

/**
 * Main script function to populate the StatusLog collection in MongoDB.
 * Connects to the database, fetches character IDs (either all or a
 * specific one provided via command-line argument), generates pseudo log
 * entries for each character using `generatePseudoLogEntries`, and then
 * upserts these entries into the StatusLog collection. Handles errors
 * during the process and ensures disconnection from the database.
 */
async function populateStatusLogs() {
  const targetCharacterId = process.argv[2]; // Get ID from command line args
  let isSpecificIdRun = false;

  if (targetCharacterId) {
    // Basic validation for ObjectId format (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(targetCharacterId)) {
      console.error(
        `Invalid Character ID format provided: ${targetCharacterId}. ` +
        'Expected 24 hex characters.'
      );
      process.exit(1);
    }
    console.info(
      `Running population script for specific Character ID: ` +
      `${targetCharacterId}`
    );
    isSpecificIdRun = true;
  } else {
    console.info('Running population script for ALL characters.');
  }

  try {
    console.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.info('Successfully connected to MongoDB.');

    let characters = [];
    if (isSpecificIdRun) {
      console.info(`Fetching character with ID: ${targetCharacterId}...`);
      const character = await Character.findById(targetCharacterId, '_id')
        .lean();
      if (!character) {
        console.error(`Character with ID ${targetCharacterId} not found.`);
        // Disconnect before exiting
        await mongoose.disconnect();
        console.info('Disconnected.');
        process.exit(1);
      }
      characters = [character]; // Put the single character in an array
      console.info(`Found character: ${targetCharacterId}`);
    } else {
      console.info('Fetching all Character IDs...');
      // Fetch only the _id field for efficiency
      characters = await Character.find({}, '_id').lean();
      console.info(`Found ${characters.length} characters.`);
    }

    if (characters.length === 0 && !isSpecificIdRun) {
      console.warn(
        'No characters found in the database. Exiting.'
      );
      return;
    }

    let processedCount = 0;
    for (const character of characters) {
      const characterId = character._id;
      const entriesToAdd = generatePseudoLogEntries(characterId);

      try {
        console.debug(
          `Updating/creating status log for ${characterId}...`
        );
        const updateOperation = {
          $push: {
            entries: { $each: entriesToAdd, $sort: { timestamp: 1 } }
          },
          $setOnInsert: { characterId: characterId },
        };
        // Upsert: create if not found, update if found.
        // new: return the modified document.
        // setDefaultsOnInsert: apply schema defaults on insert.
        const options = {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        };

        const result = await StatusLog.findOneAndUpdate(
          { characterId: characterId },
          updateOperation,
          options
        );
        // The pre-save hook in statusLogSchema handles the initial
        // 'connected' entry on upsert if it's a new document.
        console.info(
          `Successfully processed log for Character ID: ${characterId}. ` +
          `Total entries: ${result.entries.length}`
        );
        processedCount++;
      } catch (error) {
        // Log specific error for the character and continue
        console.error(
          `Error processing status log for ` +
          `Character ID: ${characterId}`,
          error
        );
      }
    }

    console.info(
      `\nPopulation complete. Processed ${processedCount} characters.`
    );
  } catch (error) {
    // Log general script error
    console.error('Population script failed:', error);
    process.exitCode = 1; // Indicate failure
  } finally {
    console.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.info('Disconnected.');
  }
}

populateStatusLogs();
