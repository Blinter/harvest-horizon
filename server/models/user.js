/**
 * @file User Model
 * @module server/models/user
 * @description Defines the User class for interacting with the PostgreSQL
 *   user table. Handles user authentication, registration, updates,
 *   lookups, and deletion according to application requirements.
 */

'use strict';

import bcrypt from 'bcrypt';
import { query } from '../database/dbPostgres.js';
import {
  BCRYPT_WORK_FACTOR,
  USERS_DATABASE,
  QUICK_START_TEMP_PG_EMAIL_PREFIX
} from '../constants/config.js';

import sqlForPartialUpdate from '../database/helpers/sql.js';
import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ExpressError,
} from '../expressError.js';

/**
 * Represents a user and provides static methods for user management
 * within the PostgreSQL database. This class encapsulates all database
 * interactions related to user accounts.
 *
 * @class User
 */
class User {
  /**
   * Authenticates a user by verifying their username and password against
   * the database records.
   *
   * @static
   * @async
   * @param {string} username - The user's provided username.
   * @param {string} password - The user's provided raw password.
   * @returns {Promise<{id: number, username: string, email: string}>} A
   *   promise that resolves to the authenticated user object, containing
   *   their ID, username, and email. The password hash is explicitly
   *   removed before returning.
   * @throws {BadRequestError} If the username or password parameters are
   *   missing.
   * @throws {UnauthorizedError} If authentication fails due to the user
   *   not being found or the provided password being incorrect.
   * @throws {ExpressError} If a database query error or a password
   *   comparison error occurs during the process.
   */
  static async authenticate(username, password) {
    if (!username || !password) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.authenticate',
        message: 'Authentication failed: Username or password missing.',
        context: {
          usernameProvided: !!username,
          passwordProvided: !!password,
        },
      });
      throw new BadRequestError(`Username and password are required.`);
    }

    let foundUser;
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.authenticate',
        message: `Querying database for user '${username}'...`,
      });
      foundUser = await query(
        `SELECT
          id,
          username,
          password_hash,
          email
        FROM
          ${USERS_DATABASE}
        WHERE
          username = $1`,
        [username]
      );
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.authenticate',
        message:
          `Database query completed. Found ` + `${foundUser.rows.length} rows.`,
        context: { username },
      });
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.authenticate',
        message: 'Database error querying for user.',
        context: {
          username,
          error: err,
        },
      });
      throw new ExpressError(
        `Database error during authentication: ${err.message}`,
        500
      );
    }

    if (!foundUser || foundUser.rows.length === 0) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'UserModel.authenticate',
        message: 'Authentication failed: User not found.',
        context: { username },
      });
      throw new UnauthorizedError('Invalid username/password');
    }

    const user = foundUser.rows[0];
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.authenticate',
      message: 'User found. Verifying password...',
      context: {
        username,
        userId: user.id,
      },
    });

    try {
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (isValid) {
        console.info({
          timestamp: new Date().toISOString(),
          service: 'UserModel.authenticate',
          message: 'Password verified successfully.',
          context: {
            username,
            userId: user.id,
          },
        });
        delete user.password_hash; // Never return the hash
        return user; // Return user object including id, username, email
      }
    } catch (bcryptError) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.authenticate',
        message: 'Error during bcrypt password comparison.',
        context: {
          username,
          userId: user.id,
          error: bcryptError,
        },
      });
      // Treat bcrypt errors as internal server errors
      throw new ExpressError(
        `Password comparison failed: ${bcryptError.message}`,
        500
      );
    }

    // If password was not valid
    console.warn({
      timestamp: new Date().toISOString(),
      service: 'UserModel.authenticate',
      message: 'Authentication failed: Invalid password.',
      context: {
        username,
        userId: user.id,
      },
    });
    throw new UnauthorizedError('Invalid username/password');
  }

  /**
   * Helper method to check if a given username or email already exists in
   * the database. Used internally before attempting to register a new user
   * or potentially update an existing one's email.
   *
   * @private
   * @static
   * @async
   * @param {string} username - The username to check for duplicates.
   * @param {string} email - The email address to check for duplicates.
   * @throws {BadRequestError} If the provided username or email is already
   *   registered in the database.
   * @throws {ExpressError} If a database error occurs during the check.
   */
  static async _checkDuplicates(username, email) {
    let duplicateCheck;
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel._checkDuplicates',
        message: 'Checking for duplicate username or email...',
        context: {
          username,
          email,
        },
      });
      duplicateCheck = await query(
        `SELECT
          username,
          email
        FROM
          ${USERS_DATABASE}
        WHERE
          username = $1
        OR
          email = $2`,
        [username, email]
      );
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel._checkDuplicates',
        message:
          `Duplicate check query completed. Found ` +
          `${duplicateCheck.rows.length} potential conflicts.`,
      });
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel._checkDuplicates',
        message: 'Database error during duplicate check.',
        context: {
          username,
          email,
          error: err,
        },
      });
      // Rethrow as a generic error, let the caller handle context
      throw new ExpressError(
        `Database error during duplicate check: ${err.message}`,
        500
      );
    }

    if (duplicateCheck.rows.length > 0) {
      const existing = duplicateCheck.rows[0];
      if (existing.username === username) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel._checkDuplicates',
          message: 'Duplicate username detected.',
          context: { username },
        });
        throw new BadRequestError(`Username '${username}' is already taken.`);
      }
      // No need for else if, since the query returns at most one row
      // matching either
      if (existing.email === email) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel._checkDuplicates',
          message: 'Duplicate email detected.',
          context: { email },
        });
        throw new BadRequestError(`Email '${email}' is already registered.`);
      }
    }
    // If no rows or no match, proceed silently
  }

  /**
   * Helper method responsible for hashing a user's raw password and
   * inserting the complete user record (username, hashed password, email)
   * into the database.
   *
   * @private
   * @static
   * @async
   * @param {string} username - The username for the new user.
   * @param {string} password - The raw, plain-text password to be hashed.
   * @param {string} email - The email address for the new user.
   * @returns {Promise<{id: number, username: string, email: string}>} A
   *   promise that resolves to the newly created user object, containing
   *   the database-assigned ID, username, and email.
   * @throws {BadRequestError} If the database insert fails due to a unique
   *   constraint violation (username or email already exists), which can
   *   happen in race conditions despite the prior `_checkDuplicates` call.
   * @throws {ExpressError} If an error occurs during password hashing or
   *   the database insertion process itself (other than constraint
   *   violations).
   */
  static async _insertUserRecord(username, password, email) {
    let hashedPassword;
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel._insertUserRecord',
        message: 'Hashing password...',
        context: { username },
      });
      hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel._insertUserRecord',
        message: 'Password hashed.',
      });
    } catch (bcryptError) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel._insertUserRecord',
        message: 'Error during password hashing.',
        context: { username, error: bcryptError },
      });
      // Throw specific error for hashing failure
      throw new ExpressError(
        `Password hashing failed: ${bcryptError.message}`,
        500
      );
    }

    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel._insertUserRecord',
        message: 'Inserting user into database...',
        context: { username, email },
      });
      const result = await query(
        `INSERT INTO
          ${USERS_DATABASE}
          (username, password_hash, email)
        VALUES
          ($1, $2, $3)
        RETURNING
          id,
          username,
          email`,
        [username, hashedPassword, email]
      );
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel._insertUserRecord',
        message: 'Database insert completed.',
        context: {
          username,
          rowCount: result.rowCount,
        },
      });

      if (!result || result.rows.length !== 1) {
        // This case indicates a problem beyond simple constraints
        console.error({
          timestamp: new Date().toISOString(),
          service: 'UserModel._insertUserRecord',
          message: 'Database insert failed unexpectedly (no rows returned).',
        });
        throw new ExpressError(
          'User registration insert failed unexpectedly.',
          500
        );
      }
      return result.rows[0]; // Return the newly created user object
    } catch (dbErr) {
      // Catch potential constraint violations during INSERT
      if (dbErr.code === '23505') {
        // unique_violation
        let conflictField = 'unknown field';
        if (dbErr.constraint?.includes('username')) conflictField = 'username';
        if (dbErr.constraint?.includes('email')) conflictField = 'email';
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel._insertUserRecord',
          message:
            `Insert failed: Duplicate ${conflictField} ` +
            `detected during insert.`,
          context: {
            username,
            email,
            conflictField,
            constraint: dbErr.constraint,
          },
        });
        // Throw BadRequestError for constraint violation
        throw new BadRequestError(
          `The ${conflictField} '${conflictField === 'username' ? username : email
          }' is already registered.`
        );
      }
      // Handle other database errors during insert
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel._insertUserRecord',
        message: 'Database error during user insert.',
        context: {
          username,
          email,
          error: dbErr,
        },
      });
      throw new ExpressError(
        `Database error during registration insert: ${dbErr.message}`,
        500
      );
    }
  }

  /**
   * Registers a new user account. It validates input, checks for duplicate
   * username/email, hashes the password, and inserts the new user record
   * into the database.
   *
   * @static
   * @async
   * @param {object} userData - An object containing the new user's details.
   * @param {string} userData.username - The desired username for the new
   *   account. Must be unique.
   * @param {string} userData.password - The desired raw password for the new
   *   account. Will be securely hashed.
   * @param {string} userData.email - The email address for the new account.
   *   Must be unique.
   * @returns {Promise<{id: number, username: string, email: string}>} A
   *   promise that resolves to the newly registered user object, including
   *   their database ID.
   * @throws {BadRequestError} If any required fields (username, password,
   *   email) are missing, or if the chosen username or email is already
   *   taken.
   * @throws {ExpressError} If an error occurs during password hashing or
   *   any database operation.
   */
  static async register({ username, password, email }) {
    // 1. Validate input presence
    if (!username || !password || !email) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.register',
        message: 'Registration failed: Missing username, password, or email.',
        context: {
          usernameProvided: !!username,
          passwordProvided: !!password,
          emailProvided: !!email,
        },
      });
      throw new BadRequestError(`Username, password, and email are required.`);
    }

    // Use a single try block for the main logic flow
    try {
      // 2. Check for duplicates using the helper
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.register',
        message: 'Initiating duplicate check...',
        context: {
          username,
          email,
        },
      });
      await this._checkDuplicates(username, email);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.register',
        message: 'Duplicate check passed. Proceeding with insertion...',
        context: {
          username,
          email,
        },
      });

      // 3. Insert the user record using the helper
      const newUser = await this._insertUserRecord(username, password, email);

      console.info({
        timestamp: new Date().toISOString(),
        service: 'UserModel.register',
        message: 'User registered successfully.',
        context: {
          userId: newUser.id,
          username: newUser.username,
          email: newUser.email,
        },
      });
      return newUser;
    } catch (error) {
      // Log the error at the top level of register
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.register',
        message: 'Registration failed.',
        context: {
          username,
          email,
          error: error.message,
          stack: error.stack,
        }, // Include stack for debugging
      });

      // Re-throw the error caught from helpers (already logged within them)
      // No need to wrap in new ExpressError unless adding more context
      throw error;
    }
  }

  /**
   * Retrieves a list of all registered users from the database, returning
   * only their username and email. Password hashes are never included.
   *
   * @static
   * @async
   * @returns {Promise<Array<{id: number, username: string, email: string}>>}
   *   A promise that resolves to an array of user objects, each containing
   *   id, username, and email. The array will be empty if no users exist.
   *   Users are ordered alphabetically by username.
   * @throws {ExpressError} If a database error occurs while querying users.
   */
  static async findAll() {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.findAll',
      message: 'Attempting to retrieve all users...',
    });
    try {
      const result = await query(
        `SELECT
          id,
          username,
          email
        FROM
          ${USERS_DATABASE}
        ORDER BY
          username`
      );
      console.info({
        timestamp: new Date().toISOString(),
        service: 'UserModel.findAll',
        message: `Retrieved ${result.rows.length} users.`,
      });
      return result.rows;
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.findAll',
        message: 'Database error retrieving all users.',
        context: { error: err },
      });
      throw new ExpressError(`Failed to retrieve users: ${err.message}`, 500);
    }
  }

  /**
   * Applies partial updates to an existing user's record based on the
   * provided data. Allows updating fields like email or password. If a
   * new password is provided, it will be automatically hashed before
   * storage.
   *
   * @static
   * @async
   * @param {string} username - The username identifying the user to update.
   * @param {object} data - An object containing the fields to update.
   *   Allowed fields typically include `email` and `password`. Other fields
   *   might be supported depending on the `sqlForPartialUpdate` helper's
   *   configuration.
   * @returns {Promise<{id: number, username: string, email: string}>} A
   *   promise that resolves to the updated user object, reflecting the
   *   changes made.
   * @throws {BadRequestError} If the `username` parameter is missing, if the
   *   `data` object is empty or invalid, or if an update attempts to set
   *   a field (e.g., email) to a value already used by another user.
   * @throws {NotFoundError} If no user exists with the provided `username`.
   * @throws {ExpressError} If an error occurs during password hashing (if
   *   applicable) or during the database update operation.
   */
  static async update(username, data) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.update',
      message: `Attempting to update user '${username}'...`,
      context: { username, data },
    });

    // Validate input
    if (!username) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'Update failed: Username is required.',
      });
      throw new BadRequestError('Username parameter is required for update.');
    }
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'Update failed: Data object is empty or invalid.',
        context: {
          username,
          data,
        },
      });
      throw new BadRequestError('Valid data object is required for update.');
    }

    // Securely handle password update
    if (data.password) {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'Password update requested. Hashing new password...',
        context: { username },
      });
      try {
        data.password_hash = await bcrypt.hash(
          data.password,
          BCRYPT_WORK_FACTOR
        );
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'UserModel.update',
          message: 'New password hashed successfully.',
          context: { username },
        });
      } catch (bcryptError) {
        console.error({
          timestamp: new Date().toISOString(),
          service: 'UserModel.update',
          message: 'Error hashing new password during update.',
          context: {
            username,
            error: bcryptError,
          },
        });
        throw new ExpressError(
          `Password hashing failed during update: ${bcryptError.message}`,
          500
        );
      }
      delete data.password; // Don't store the plain password
    }

    // Prepare for partial update
    const { setCols, values } = sqlForPartialUpdate(data, {
      // Map JS field names to DB column names if different
      // Example: firstName: "first_name",
      // passwordHash: "password_hash" // Map after hashing
    });
    const usernameVarIdx = `$${values.length + 1}`;
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.update',
      message: 'Generated SQL for partial update.',
      context: {
        username,
        setCols,
        valueCount: values.length,
      },
    });

    const querySql = `UPDATE
        ${USERS_DATABASE}
      SET
        ${setCols}
      WHERE
        username = ${usernameVarIdx}
      RETURNING
        id,
        username,
        email`; // Return updated fields

    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'Executing update query...',
        context: { username },
      });
      const result = await query(querySql, [...values, username]);
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'Update query completed.',
        context: { username, rowCount: result.rowCount },
      });

      if (!result || result.rows.length === 0) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel.update',
          message: 'Update failed: User not found.',
          context: { username },
        });
        throw new NotFoundError(`User '${username}' not found.`);
      }

      const user = result.rows[0];
      console.info({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'User updated successfully.',
        context: {
          userId: user.id,
          username: user.username,
          updatedFields: Object.keys(data),
        },
      });
      return user; // Return the updated user object
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) {
        throw err; // Re-throw known errors
      }
      // Handle unique constraint violations
      if (err.code === '23505') {
        let conflictField = 'field';
        if (err.constraint?.includes('email')) conflictField = 'email';
        // Add other unique constraints if needed
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel.update',
          message: `Update failed: Duplicate ${conflictField} detected during update.`,
          context: {
            username,
            conflictField,
            constraint: err.constraint,
            updateData: data,
          },
        });
        throw new BadRequestError(
          `The ${conflictField} '${data[conflictField]}' is already in use.`
        );
      }
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.update',
        message: 'Unexpected database error during user update.',
        context: { username, error: err, updateData: data },
      });
      throw new ExpressError(`Failed to update user: ${err.message}`, 500);
    }
  }

  /**
   * Retrieves a single user's information (id, username, email) from the
   * database based on their unique username.
   *
   * @static
   * @async
   * @param {string} username - The username of the user to retrieve.
   * @returns {Promise<{id: number, username: string, email: string}>} A
   *   promise that resolves to the user object if found.
   * @throws {BadRequestError} If the `username` parameter is missing.
   * @throws {NotFoundError} If no user exists with the provided username.
   * @throws {ExpressError} If a database error occurs during the query.
   */
  static async getByUsername(username) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.getByUsername',
      message: `Attempting to retrieve user by username '${username}'...`,
    });
    if (!username) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getByUsername',
        message: 'Retrieval failed: Username is required.',
      });
      throw new BadRequestError('Username is required.');
    }

    try {
      const userRes = await query(
        `SELECT
          id,
          username,
          email
        FROM
          ${USERS_DATABASE}
        WHERE
          username = $1`,
        [username]
      );

      if (!userRes || userRes.rows.length === 0) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel.getByUsername',
          message: 'User not found.',
          context: { username },
        });
        throw new NotFoundError(`User '${username}' not found.`);
      }

      const user = userRes.rows[0];
      console.info({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getByUsername',
        message: 'User retrieved successfully by username.',
        context: { userId: user.id, username: user.username },
      });
      return user;
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) {
        throw err;
      }
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getByUsername',
        message: 'Database error retrieving user by username.',
        context: { username, error: err },
      });
      throw new ExpressError(
        `Failed to retrieve user '${username}': ${err.message}`,
        500
      );
    }
  }

  /**
   * Retrieves a single user's information (id, username, email) from the
   * database based on their unique ID. Also dynamically adds the
   * `isTemporary` flag based on username patterns.
   *
   * @static
   * @async
   * @param {string|number} id - The unique ID of the user to find.
   * @returns {Promise<{id: number, username: string, email: string,
   *   isTemporary: boolean}>}
   *   A promise that resolves to the user object with the added `isTemporary`
   *   flag.
   * @throws {BadRequestError} If the `id` parameter is missing.
   * @throws {NotFoundError} If no user is found with the given ID.
   * @throws {ExpressError} If a database error occurs during the query.
   */
  static async getById(id) {
    if (!id) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getById',
        message: 'Lookup failed: User ID missing.',
      });
      throw new BadRequestError('User ID is required for lookup.');
    }
    let userResult;
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getById',
        message: `Querying database for user ID ${id}...`,
      });
      userResult = await query(
        `SELECT
          id,
          username,
          email
        FROM
          ${USERS_DATABASE}
        WHERE
          id = $1`,
        [id]
      );
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getById',
        message:
          `Database query completed. ` +
          `Found ${userResult.rows.length} rows.`,
        context: { userId: id },
      });
    } catch (err) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getById',
        message: 'Database error querying for user by ID.',
        context: {
          userId: id,
          error: err,
        },
      });
      throw new ExpressError(
        `Database error fetching user: ${err.message}`,
        500
      );
    }

    if (!userResult || userResult.rows.length === 0) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'UserModel.getById',
        message: 'User not found.',
        context: { userId: id },
      });
      throw new NotFoundError(`No user found with ID: ${id}`);
    }

    const user = userResult.rows[0];
    console.info({
      timestamp: new Date().toISOString(),
      service: 'UserModel.getById',
      message: `User found successfully.`,
      context: {
        userId: id,
        username: user.username,
      },
    });

    // Dynamically determine the isTemporary flag
    if (
      user.username.startsWith('guest_') ||
      user.username.startsWith(QUICK_START_TEMP_PG_EMAIL_PREFIX)
    ) {
      user.isTemporary = true;
    } else {
      user.isTemporary = false;
    }

    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.getById',
      message: `Determined isTemporary status: ${user.isTemporary}`,
      context: {
        userId: id,
        username: user.username,
      },
    });

    // Note: Password hash is not selected, so no need to delete it.
    return user;
  }

  /**
   * Permanently deletes a user record from the database based on their
   * username. This action is irreversible.
   *
   * @static
   * @async
   * @param {string} username - The username of the user to be deleted.
   * @returns {Promise<void>} A promise that resolves when the deletion is
   *   successful. The resolved value is undefined.
   * @throws {BadRequestError} If the `username` parameter is missing.
   * @throws {NotFoundError} If no user exists with the provided username.
   * @throws {ExpressError} If a database error occurs during the deletion
   *   process.
   */
  static async remove(username) {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'UserModel.remove',
      message: `Attempting to delete user '${username}'...`,
      context: { username },
    });

    if (!username) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.remove',
        message: 'Deletion failed: Username is required.',
      });
      throw new BadRequestError('Username parameter is required for deletion.');
    }

    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.remove',
        message: 'Executing delete query...',
        context: { username },
      });
      const result = await query(
        `DELETE FROM
          ${USERS_DATABASE}
        WHERE
          username = $1
        RETURNING
          id,
          username,
          email`,
        [username]
      );
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'UserModel.remove',
        message: 'Delete query completed.',
        context: {
          username,
          rowCount: result.rowCount,
        },
      });

      if (!result || result.rows.length === 0) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'UserModel.remove',
          message: 'User not found.',
          context: { username },
        });
        throw new NotFoundError(`User '${username}' not found.`);
      }

      const user = result.rows[0];
      console.info({
        timestamp: new Date().toISOString(),
        service: 'UserModel.remove',
        message: 'User deleted successfully.',
        context: {
          userId: user.id,
          username: user.username,
        },
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) {
        throw err; // Re-throw known errors
      }
      console.error({
        timestamp: new Date().toISOString(),
        service: 'UserModel.remove',
        message: 'Unexpected database error ' + 'during user deletion.',
        context: { username, error: err },
      });
      throw new ExpressError(`Failed to delete user: ${err.message}`, 500);
    }
  }
}

export default User;

// If there were more methods (getById, getByEmail, remove), they should be
// added here.
