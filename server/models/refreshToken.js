/**
 * @fileoverview Refresh Token Model definition for PostgreSQL interaction.
 * @module server/models/refreshToken
 * @description This module defines the `RefreshToken` class, providing static
 *   methods for creating, retrieving, and deleting refresh tokens stored in
 *   the `farm_refreshTokens` PostgreSQL table. It handles database operations
 *   related to user session refresh tokens.
 */

import { query } from '../database/dbPostgres.js';
import { ExpressError } from '../expressError.js'; // For potential DB errors

// Table name constant
const TABLE_NAME = 'farm_refreshTokens';

/**
 * Represents a Refresh Token stored in the database and provides static
 * methods for managing these tokens. This class interacts directly with the
 * `farm_refreshTokens` table.
 *
 * @class RefreshToken
 */
class RefreshToken {
  /**
   * Creates a new refresh token record in the `farm_refreshTokens` table. If a
   * token with the same value already exists, this operation does nothing due
   * to the `ON CONFLICT DO NOTHING` clause.
   *
   * @static
   * @async
   * @param {string} token The unique refresh token string to be stored.
   * @param {number} userId The numeric ID of the user associated with this
   *   token.
   * @param {Date} expiresAt The exact date and time when this token will
   *   expire.
   * @returns {Promise<void>} Resolves when the token insertion attempt is
   *   complete. Does not return the created record.
   * @throws {ExpressError} If there is a database error during the insert
   *   operation. The error includes a descriptive message and status code 500.
   */
  static async create(token, userId, expiresAt) {
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [RefreshTokenModel] Create - UserID: ${userId} starting`
    );
    try {
      const sql = `
        INSERT INTO ${TABLE_NAME} (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (token) DO NOTHING; -- Avoid error if token exists
      `;
      await query(sql, [userId, token, expiresAt]);
      console.info(
        `[${timestamp}] [RefreshTokenModel] Create - Token saved for UserID: ${userId}`
      );
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenModel] Create - DB Error for UserID ${userId}: ${err.message}`,
        err
      );
      throw new ExpressError(
        `Failed to save refresh token to database: ${err.message}`,
        500
      );
    }
  }

  /**
   * Retrieves a refresh token record from the database, but only if it exists
   * and has not yet expired (i.e., `expires_at` is in the future).
   *
   * @static
   * @async
   * @param {string} token The refresh token string to search for.
   * @returns {Promise<{
   *   token: string,
   *   userId: number,
   *   expires_at: Date
   * }|null>} A promise that resolves to an object containing the token data
   *   (`token`, `userId`, `expires_at`) if a valid, non-expired token is
   *   found. Resolves to `null` if the token is not found or has expired.
   * @throws {ExpressError} If there is a database error during the query.
   *   The error includes a descriptive message and status code 500.
   */
  static async get(token) {
    const timestamp = new Date().toISOString();
    const tokenDisplay = token ? `${token.substring(0, 10)}...` : 'N/A';
    console.debug(
      `[${timestamp}] [RefreshTokenModel] Get - Token: ${tokenDisplay} starting`
    );
    try {
      const sql = `
        SELECT token, user_id AS "userId", expires_at
        FROM ${TABLE_NAME}
        WHERE token = $1 AND expires_at > NOW()
      `;
      const result = await query(sql, [token]);

      if (result.rows.length > 0) {
        console.debug(
          `[${timestamp}] [RefreshTokenModel] Get - Valid token found.`
        );
        return result.rows[0];
      } else {
        console.debug(
          `[${timestamp}] [RefreshTokenModel] Get - Token not found or expired.`
        );
        return null;
      }
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenModel] Get - DB Error: ${err.message}`,
        err
      );
      throw new ExpressError(
        `Error checking database for refresh token: ${err.message}`,
        500
      );
    }
  }

  /**
   * Deletes a specific refresh token from the `farm_refreshTokens` table based
   * on the token string.
   *
   * @static
   * @async
   * @param {string} token The refresh token string to delete.
   * @returns {Promise<number>} A promise that resolves to the number of rows
   *   deleted (expected to be 0 or 1).
   * @throws {ExpressError} If there is a database error during the delete
   *   operation. The error includes a descriptive message and status code 500.
   */
  static async delete(token) {
    const timestamp = new Date().toISOString();
    const tokenDisplay = token ? `${token.substring(0, 10)}...` : 'N/A';
    console.debug(
      `[${timestamp}] [RefreshTokenModel] Delete - Token: ${tokenDisplay} starting`
    );
    try {
      const sql = `DELETE FROM ${TABLE_NAME} WHERE token = $1`;
      const result = await query(sql, [token]);
      console.debug(
        `[${timestamp}] [RefreshTokenModel] Delete - ${result.rowCount} rows deleted.`
      );
      return result.rowCount;
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenModel] Delete - DB Error: ${err.message}`,
        err
      );
      throw new ExpressError(
        `Error removing refresh token from database: ${err.message}`,
        500
      );
    }
  }

  /**
   * Deletes all refresh tokens associated with a specific user ID from the
   * `farm_refreshTokens` table. This is typically used during logout or when
   * revoking all sessions for a user.
   *
   * @static
   * @async
   * @param {number} userId The numeric ID of the user whose tokens should be
   *   deleted.
   * @returns {Promise<number>} A promise that resolves to the total number of
   *   tokens deleted for the specified user.
   * @throws {ExpressError} If there is a database error during the delete
   *   operation. The error includes a descriptive message and status code 500.
   */
  static async deleteAllForUser(userId) {
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [RefreshTokenModel] DeleteAllForUser - UserID: ${userId} starting`
    );
    try {
      const sql = `DELETE FROM ${TABLE_NAME} WHERE user_id = $1`;
      const result = await query(sql, [userId]);
      console.info(
        `[${timestamp}] [RefreshTokenModel] DeleteAllForUser - ${result.rowCount} tokens deleted for UserID: ${userId}`
      );
      return result.rowCount;
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenModel] DeleteAllForUser - DB Error for UserID ${userId}: ${err.message}`,
        err
      );
      throw new ExpressError(
        `Database error revoking tokens for user: ${err.message}`,
        500
      );
    }
  }
}

export default RefreshToken;
