/**
 * @file Common test setup helper for PostgreSQL tests.
 * @module server/database/helpers/_testCommonPostgres
 * @description
 * Provides standard setup and teardown functions (`beforeAll`, `beforeEach`,
 * `afterEach`, `afterAll`) for PostgreSQL integration tests. Handles
 * connecting, cleaning tables, creating a default test user, and generating
 * a JWT token for that user.
 *
 * Note: The leading underscore indicates this is an internal testing utility.
 */
'use strict';

import { query, connect, end } from '../dbPostgres.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import {
  users_database,
  characters_database,
  SECRET_KEY,
  BCRYPT_WORK_FACTOR,
} from '../constants/config.js';

/**
 * JWT token for the default test user (`user1`).
 * Generated in `commonBeforeEach`.
 *
 * @type {string | undefined}
 */
let _userToken;

/**
 * PostgreSQL ID of the default test user (`user1`).
 * Set in `commonBeforeEach`.
 *
 * @type {number | undefined}
 */
let postgresUserId1;

/**
 * Runs before all tests in a suite.
 * - Establishes a PostgreSQL connection.
 * - Truncates relevant tables (`farm_users`, `farm_characters`)
 *   and resets identity sequences to ensure a clean state.
 *
 * @async
 * @function commonBeforeAll
 * @returns {Promise<void>} A promise resolving when setup is complete.
 * @throws {Error} If connecting or truncating tables fails.
 */
export async function commonBeforeAll() {
  try {
    await connect();

    await query(`TRUNCATE TABLE 
        ${users_database}, 
        ${characters_database}
        RESTART IDENTITY CASCADE;
        ALTER SEQUENCE ${users_database}_id_seq RESTART WITH 1;
        ALTER SEQUENCE ${characters_database}_id_seq RESTART WITH 1;`);
  } catch (err) {
    await query('ROLLBACK');
    await query('END');
    console.error('commonBeforeAll() Error:', err);
    throw err;
  } finally {
    await query('COMMIT');
  }
}

/**
 * Retrieves the JWT token for the default test user (`user1`).
 *
 * @function getUser1Token
 * @returns {string | undefined} The JWT token, or undefined if not generated
 *   yet.
 */
export const getUser1Token = () => _userToken;

/**
 * Runs before each test.
 * - Hashes a default password.
 * - Inserts a standard test user (`NotaTestUser`) into the `farm_users`
 *   table.
 * - Stores the generated user ID in `postgresUserId1`.
 * - Creates and stores a JWT token for this user in `_userToken`.
 *
 * @async
 * @function commonBeforeEach
 * @returns {Promise<void>} A promise resolving when the user is created and
 *   token generated.
 * @throws {Error} If inserting the user or generating the token fails.
 */
export async function commonBeforeEach() {
  try {
    const hashedPassword = await bcrypt.hash(
      'NotAPassword123',
      BCRYPT_WORK_FACTOR
    );

    await query('BEGIN');
    const result = await query(
      `INSERT INTO ${users_database} 
        (username, email, password_hash) 
        VALUES ($1, $2, $3) RETURNING *`,
      ['NotaTestUser', 'NotATest@example.com', hashedPassword]
    );

    if (result?.rows == undefined)
      throw new Error('Cannot insert test data into PostgreSQL');

    const user = result.rows[0];
    postgresUserId1 = user.id;

    _userToken = jwt.sign(
      {
        username: user.username,
        email: user.email,
      },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    await query('ROLLBACK');
    await query('END');
    console.error('commonBeforeEach', err);
    throw err;
  } finally {
    await query('COMMIT');
  }
}

/**
 * Retrieves the PostgreSQL ID of the default test user (`user1`).
 * Returns the stored ID if available, otherwise falls back to 1 (primarily
 * for edge cases where `commonBeforeEach` might not have run yet, though
 * this is generally discouraged).
 *
 * @function user1Id
 * @returns {number} The PostgreSQL ID of user 1.
 */
export const user1Id = () => {
  if (postgresUserId1 !== undefined) {
    return postgresUserId1;
  }

  console.debug(`postgresUserId1 undefined, but continuing with hardcoded ID.`);

  return 1;
};

/**
 * Runs after each test.
 * - Truncates relevant tables (`farm_users`, `farm_characters`) and
 * resets identity sequences to clean up data created during the test.
 *
 * @async
 * @function commonAfterEach
 * @returns {Promise<void>} A promise resolving when tables are cleaned.
 * @throws {Error} If truncating tables fails.
 */
export async function commonAfterEach() {
  try {
    await query(`TRUNCATE TABLE 
        ${users_database}, 
        ${characters_database} 
        RESTART IDENTITY CASCADE;
        ALTER SEQUENCE ${users_database}_id_seq RESTART WITH 1;
        ALTER SEQUENCE ${characters_database}_id_seq RESTART WITH 1;`);
  } catch (err) {
    await query('ROLLBACK');
    await query('END');
    console.error('commonAfterEach', err);
    throw err;
  } finally {
    await query('COMMIT');
  }
}

/**
 * Runs after all tests in a suite.
 * - Closes the PostgreSQL connection pool.
 *
 * @async
 * @function commonAfterAll
 * @returns {Promise<void>} A promise resolving when the connection pool
 *   is closed.
 * @throws {Error} If closing the connection pool fails.
 */
export async function commonAfterAll() {
  try {
    await end();
  } catch (err) {
    console.error('commonAfterAll() Error:', err);
    throw err;
  }
}
