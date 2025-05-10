'use strict';
import 'dotenv/config'; // Load environment variables
import 'colors'; // Enhance console logging colors (used implicitly)

/**
 * Secret key for signing JWT tokens.
 *
 * Falls back to a default development key if not set in environment.
 *
 * @type {string}
 */
export const SECRET_KEY = process.env.SECRET_KEY || `secret-devs`;

/**
 * Secret key for signing JWT refresh tokens.
 *
 * Falls back to the primary SECRET_KEY if not set. Consider setting a
 * distinct REFRESH_SECRET_KEY in production.
 *
 * @type {string}
 */
export const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY || SECRET_KEY;

/**
 * Lifetime of a refresh token in seconds.
 *
 * Defaults to 7 days (604800 seconds) if not set in environment.
 *
 * @type {number}
 */
export const REFRESH_TOKEN_LIFETIME_SECONDS =
  Number(process.env.REFRESH_TOKEN_LIFETIME_SECONDS) || 60 * 60 * 24 * 7;

/**
 * Port number for the application server.
 *
 * Falls back to 3000 if not set in environment.
 *
 * @type {number}
 */
export const PORT = Number(process.env.PORT) || 3000;

/**
 * CORS Origin URL allowed to connect.
 *
 * Falls back to development default if not set.
 *
 * @type {string}
 */
export const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:5173`;

/**
 * Determines the appropriate PostgreSQL database URI based on the
 * environment.
 *
 * @function getDatabaseUriPostgres
 * @returns {string} The PostgreSQL connection URI.
 */
export function getDatabaseUriPostgres() {
  if (process.env.NODE_ENV === 'test') {
    // Use a separate test database
    return process.env.DATABASE_URL_TEST ||
      `postgres://farm_test:NEWPASSWORDzzzz@localhost:5432/farm_test`;
  }
  // Use DATABASE_URL from environment or fallback to default development DB
  return process.env.DATABASE_URL ||
    `postgres://farm:NEWPASSWORDzzzz@localhost:5432/farm`;
}

/**
 * Determines the appropriate MongoDB database URI based on the environment.
 *
 * @function getDatabaseUriMongo
 * @returns {string} The MongoDB connection URI.
 */
export function getDatabaseUriMongo() {
  if (process.env.NODE_ENV === 'test') {
    return (
      process.env.MONGODB_URI_TEST ||
      // Example test URI
      `mongodb://farm_test:NEWPASSWORDxxxx@127.0.0.1:27017/` +
      `farm_test?` +
      `authSource=farm_test` +
      `&retryWrites=true` +
      `&ssl=false` +
      `&directConnection=true` +
      // If running locally, no SSL would be used
      `&ssl=false` +
      `&directConnection=true`
    );
  }
  // Use MONGODB_URI from environment or fallback to default development DB
  return (
    process.env.MONGODB_URI ||
    // Fallback - replace NEWPASSWORDxxxx
    `mongodb://farm:NEWPASSWORDxxxx@127.0.0.1:27017/` +
    `farm?authSource=farm&retryWrites=true` +
    // If running locally, no SSL would be used
    `&ssl=false` +
    `&directConnection=true`
  );
}
export const MONGODB_URI = getDatabaseUriMongo(); // Export the determined URI

/**
 * Work factor for bcrypt password hashing.
 *
 * Uses a lower factor in test environment for speed.
 *
 * @type {number}
 */
export const BCRYPT_WORK_FACTOR = process.env.NODE_ENV === 'test' ? 1 : 12;

// Database table names (Consider moving to a dedicated schema constants file?)
/**
 * Name of the PostgreSQL table storing user data.
 *
 * @type {string}
 */
export const USERS_DATABASE = `farm_users`;
/**
 * Name of the PostgreSQL table storing character data.
 *
 * @type {string}
 */
export const CHARACTERS_DATABASE = `farm_characters`;

/**
 * Maximum number of characters allowed per user account.
 *
 * @type {number}
 */
export const MAX_CHARACTERS_PER_USER = 5;

/**
 * Maximum number of maps allowed per character.
 *
 * @type {number}
 */
export const MAX_MAPS_PER_CHARACTER = 5;

/**
 * Prefix for temporary PostgreSQL email addresses used in quick start.
 *
 * @type {string}
 */
export const QUICK_START_TEMP_PG_EMAIL_PREFIX = 'guest_';

/**
 * Lifetime of a quick start session in seconds (e.g., how long a guest
 * session is valid).
 *
 * @type {number}
 */
export const QUICK_START_TTL_SECONDS = 3600; // 1 hour
