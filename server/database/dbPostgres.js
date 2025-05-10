/**
 * @file PostgreSQL database connection and query helpers.
 * @module server/database/dbPostgres
 * @description Initializes a PostgreSQL connection pool (`pgPool`) and
 *   provides utility functions for connecting, querying, and closing the
 *   connection.
 */

import pgPool from 'pg-pool';
import { getDatabaseUriPostgres } from '../constants/config.js';

/**
 * The PostgreSQL connection pool instance. Initialized once when the module
 * is loaded.
 * pg-pool instance
 *
 * @type {object}
 */
let db;

/**
 * Flag to track if the pool end process has been initiated.
 *
 * @type {boolean}
 */
let isEnded = false;

// Initialize the pool immediately
try {
  db = new pgPool({
    connectionString: getDatabaseUriPostgres(),
    ssl: {
      rejectUnauthorized: false, // Necessary for some cloud providers
    },
  });

  if (db === undefined) throw new Error('Failed to initialize PG Pool.');

  // Optional: Add listener for pool errors
  db.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // Consider application termination or specific handling
    process.exit(-1);
  });
} catch (err) {
  console.error('Failed to start PgPool', err.message);
  throw err;
}

/**
 * Executes a SQL query against the connected PostgreSQL database.
 *
 * @async
 * @function query
 * @param {string} sql - The SQL query string (can include placeholders like
 *   $1, $2).
 * @param {Array<any>} [params=[]] - An array of parameters to substitute into
 *   the query.
 * @returns {Promise<Object>} A promise resolving to the query result.
 * @throws {Error} If the database query fails.
 */
export const query = async (sql, params = []) => {
  const client = await db.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } catch (err) {
    // Log error with more context if possible
    console.error(
      'dbPostgres PG Query Error executing:',
      sql,
      'Params:',
      params,
      'Error:',
      err.message
    );
    throw err; // Re-throw original error
  } finally {
    client.release();
  }
};

/**
 * Acquires a client connection from the pool.
 * Important: The caller MUST release the client using `client.release()` when
 * finished to return it to the pool. Primarily used for transactions.
 *
 * @async
 * @function connect
 * @returns {Promise<Object>} A promise resolving to a connected pool client.
 * @throws {Error} If acquiring a connection fails.
 */
export const connect = async () => {
  // No try/catch needed here, db.connect() throws on failure
  const client = await db.connect();
  return client;
};

/**
 * Gracefully ends the database connection pool. Waits for idle clients to
 * disconnect, with a timeout.
 *
 * @async
 * @function end
 * @returns {Promise<void>} A promise resolving when the pool has ended.
 * @throws {Error} If ending the pool fails.
 */
export const end = async () => {
  try {
    if (!isEnded && db) {
      isEnded = true;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);

        db.end()
          .then(() => {
            clearTimeout(timeout);
            resolve();
          })
          .catch((err) => {
            clearTimeout(timeout);
            console.error('Error in db.end()', err);
            reject(
              new Error(`Failed to end database connection: ${err.message}`)
            );
          });
      });
    }
  } catch (err) {
    console.error('Error in end function:', err);
    throw err;
  }
};

/**
 * Resets the `isEnded` flag. Used primarily for testing purposes to allow
 * reconnecting after `end()` was called.
 *
 * @function reset
 */
export const reset = () => {
  isEnded = false;
};

/**
 * Returns the raw database pool instance. Use with caution.
 *
 * @function getPool
 * @returns {Object|undefined} The pgPool instance.
 */
export const getPool = () => db;
