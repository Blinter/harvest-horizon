/**
 * @file Reset Development Environment
 * @description Truncates all MongoDB collections and resets the PostgreSQL
 *   database using the respective seed scripts. Ensures a clean state for
 *   development or testing.
 */

import mongoose from 'mongoose';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { MONGODB_URI } from '../server/constants/config.js';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const exec = promisify(execCb);

// Import the path to the MongoDB seed script
const mongoSeedScriptPath = 'server/database/mongo/seeds/all.js';

/**
 * Resets all non-system collections in the MongoDB database specified by
 * the MONGODB_URI environment variable. It connects, lists collections,
 * filters out system collections, and deletes all documents from the
 * remaining user collections.
 */
async function resetMongoDB() {
  let connection;
  try {
    console.info(`Connecting to MongoDB at ${MONGODB_URI}...`);
    connection = await mongoose.connect(MONGODB_URI);
    console.info('Successfully connected to MongoDB.');

    const collections = await connection.connection.db
      .listCollections()
      .toArray();
    const nonSystemCollections = collections.filter(
      // Filter out system collections and views if any
      (coll) => !coll.name.startsWith('system.') && coll.type === 'collection'
    );

    if (nonSystemCollections.length === 0) {
      console.info('No non-system collections found to truncate.');
      return;
    }

    console.info(
      `Found ${nonSystemCollections.length} non-system collections to ` +
      `truncate.`
    );

    for (const coll of nonSystemCollections) {
      console.info(`Truncating collection: ${coll.name}...`);
      const collection = connection.connection.db.collection(coll.name);
      const result = await collection.deleteMany({});
      console.info(
        `Deleted ${result.deletedCount} documents from ${coll.name}.`
      );
    }

    console.info('Successfully truncated MongoDB collections.');

  } catch (error) {
    console.error('Failed to reset MongoDB:', error);
    throw error; // Re-throw to be caught by the main handler
  } finally {
    if (connection && connection.connection.readyState === 1) {
      console.info('Disconnecting from MongoDB...');
      await connection.disconnect();
      console.info('Disconnected from MongoDB.');
    }
  }
}

/**
 * Seeds the MongoDB database by executing the Node.js script specified
 * by `mongoSeedScriptPath`. Captures and logs stdout/stderr, throwing an
 * error if the script indicates failure.
 */
async function seedMongoDB() {
  console.info(`Running MongoDB seed script: ${mongoSeedScriptPath}...`);
  const command = `node ${mongoSeedScriptPath}`;

  try {
    const { stdout, stderr } = await exec(command);

    if (stderr) {
      // Node script might print info to stderr, check for actual errors
      const isError = /Error:|Fatal:|Panic:/.test(stderr);
      if (isError) {
        console.error('MongoDB seed script stderr:', stderr);
        throw new Error(`MongoDB seeding failed. Stderr: ${stderr}`);
      } else {
        console.warn(
          `MongoDB seed script stderr (non-error): ${stderr}`
        );
      }
    }
    console.info(`MongoDB seed script stdout: ${stdout}`);
    console.info('Successfully ran MongoDB seed script.');

  } catch (error) {
    console.error('Failed to run MongoDB seed script:', error);
    if (error.stdout) { console.error('stdout:', error.stdout); }
    if (error.stderr) { console.error('stderr:', error.stderr); }
    throw error; // Re-throw to be caught by the main handler
  }
}

/**
 * Resets the PostgreSQL database by executing the `all.sql` seed script
 * using the `psql` command-line utility. It assumes `psql` is in the PATH
 * and database connection details (PGUSER, PGPASSWORD, PGHOST, PGPORT,
 * PGDATABASE) are available as environment variables. Captures and logs
 * stdout/stderr, distinguishing between real errors and informational
 * messages from `psql`.
 */
async function resetPostgreSQL() {
  const sqlScriptPath = 'server/database/postgres/seeds/all.sql';
  // Construct the command carefully to avoid injection issues if paths were dynamic
  // In this case, the path is static.
  const command = `psql -f "${sqlScriptPath}"`;

  console.info(
    `Resetting PostgreSQL database using script: ${sqlScriptPath}...`
  );
  console.info(`Executing command: ${command}`);

  try {
    // Add PGPASSWORD to env for the child process if it exists
    const env = { ...process.env };
    if (process.env.PGPASSWORD) {
      env.PGPASSWORD = process.env.PGPASSWORD;
    }

    const { stdout, stderr } = await exec(command, { env });

    if (stderr) {
      // psql often outputs notices to stderr, check if it's just noise
      const isError = /ERROR|FATAL|PANIC/.test(stderr);
      if (isError) {
        console.error('PostgreSQL reset script stderr:', stderr);
        // Throw an error only if stderr contains actual error keywords
        throw new Error(
          `PostgreSQL reset failed. Stderr: ${stderr}`
        );
      } else {
        // Log non-error stderr messages as warnings or info
        console.warn(
          `PostgreSQL reset script stderr (non-error): ${stderr}`
        );
      }
    }
    console.info(`PostgreSQL reset script stdout: ${stdout}`);
    console.info('Successfully reset PostgreSQL database.');
  } catch (error) {
    console.error('Failed to execute PostgreSQL reset script:', error);
    // Log stdout/stderr from the caught error object if available
    if (error.stdout) {
      console.error('stdout:', error.stdout);
    }
    if (error.stderr) {
      console.error('stderr:', error.stderr);
    }
    throw error; // Re-throw to be caught by the main handler
  }
}

/**
 * Main function to orchestrate the environment reset process. Executes
 * MongoDB reset, MongoDB seeding, and PostgreSQL reset sequentially. Logs
 * progress and handles errors, setting the process exit code on failure.
 */
async function resetEnvironment() {
  console.info('--- Starting Environment Reset ---');
  try {
    // 1. Reset MongoDB (truncate collections)
    await resetMongoDB();
    // 2. Seed MongoDB
    await seedMongoDB();
    // 3. Reset PostgreSQL
    await resetPostgreSQL();

    console.info('--- Environment Reset Completed Successfully ---');
  } catch (error) {
    console.error('--- Environment Reset Failed ---');
    // Log the specific error that caused the failure
    console.error('Error details:', error);
    // Error details are also logged within the specific functions
    process.exitCode = 1; // Indicate failure
  }
  // No finally block needed here as MongoDB disconnect is handled in resetMongoDB
}

// --- Execute the reset ---
resetEnvironment(); 