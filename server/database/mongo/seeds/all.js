/**
 * @file MongoDB Seeding Script for All Collections
 * @module server/database/mongo/seeds/all
 * @description Populates MongoDB collections with initial data, specifically
 *   market items.
 */

import mongoose from 'mongoose';
import Market from '../marketSchema.js';
// Import the function to get the URI based on environment
import { getDatabaseUriMongo } from '../../../constants/config.js';

// --- Market Seed Data ---
// Defines items available in the marketplace

const marketSeedData = [
  {
    itemName: 'wheat',
    itemType: 'seed',
    currentPrice: 3, // Price to buy seeds
    currency: 'coins',
    isPurchasable: true, // Explicitly purchasable
  },
  {
    itemName: 'wheat',
    itemType: 'crop',
    currentPrice: 5, // Base price when selling crops back
    currency: 'coins',
    isPurchasable: false, // Not purchasable from market
  },
  // Add other market items here if needed
  // e.g., map tiles, other seeds/crops
];

/**
 * Seeds the database with initial data.
 * Connects to MongoDB, clears specified collections, inserts seed data,
 * and disconnects.
 * @async
 */
const seedDatabase = async () => {
  // Get the appropriate MongoDB URI for the current environment
  const mongoDbUri = getDatabaseUriMongo();

  if (!mongoDbUri) {
    console.error('[Seed Script] Error: MongoDB URI could not be determined.');
    process.exit(1);
  }

  console.log('[Seed Script] Connecting to MongoDB...');
  try {
    await mongoose.connect(mongoDbUri);
    console.log('[Seed Script] MongoDB Connected.');

    // --- Seed Market Collection ---
    console.log('[Seed Script] Seeding Market collection...');
    // Clear existing market data (optional, uncomment if needed)
    try {
      await Market.collection.drop();
      console.log('[Seed Script] Existing Market collection dropped.');
    } catch (err) {
      // Ignore error if collection doesn't exist (e.g., first run)
      if (err.code === 26 || err.message.includes('ns not found')) {
        console.log(
          '[Seed Script] Market collection does not exist, skipping drop.'
        );
      } else {
        throw err; // Rethrow other errors
      }
    }

    // Insert new market data
    await Market.insertMany(marketSeedData);
    console.log(
      `[Seed Script] Market collection seeded with ${marketSeedData.length} items.`
    );

    // --- Add seeding for other collections here ---

    console.log('[Seed Script] Database seeding completed successfully.');
  } catch (error) {
    console.error('[Seed Script] Error during database seeding:', error);
    process.exit(1); // Exit with error code
  } finally {
    console.log('[Seed Script] Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('[Seed Script] MongoDB Disconnected.');
  }
};

// Run the seeding function
seedDatabase();
