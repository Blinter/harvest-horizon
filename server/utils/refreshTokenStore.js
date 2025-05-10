/**
 * @file Refresh Token Store Service
 * @module server/utils/refreshTokenStore
 * @description Provides an interface for managing refresh tokens, validating
 *   them using JWT and checking against the database model.
 */

import { UnauthorizedError } from '../expressError.js';
import jwt from 'jsonwebtoken';
import {
  REFRESH_SECRET_KEY,
  REFRESH_TOKEN_LIFETIME_SECONDS,
} from '../constants/config.js';
import RefreshToken from '../models/refreshToken.js'; // Import the model

// Default lifetime if not specified in config (7 days)
const DEFAULT_REFRESH_LIFETIME_SEC =
  REFRESH_TOKEN_LIFETIME_SECONDS || 60 * 60 * 24 * 7;

/**
 * Manages the storage and retrieval of refresh tokens, using the
 * RefreshToken model. This class is intended to be used statically.
 */
export default class RefreshTokenStore {
  /**
   * Saves a refresh token associated with a user ID using the RefreshToken
   * model.
   * @param {string} token - The refresh token to save.
   * @param {string|number} userId - The ID of the user associated with the
   *   token.
   * @returns {Promise<void>}
   * @throws {Error} If saving fails (propagated from model).
   */
  static async save(token, userId) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + DEFAULT_REFRESH_LIFETIME_SEC * 1000
    );
    const timestamp = now.toISOString();

    console.debug(
      `[${timestamp}] [RefreshTokenStore] Save - UserID: ${userId}` +
      ` starting (using model)`
    );

    if (!token || userId === undefined || userId === null) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] Save failed:` +
        ` Missing token or userId.`
      );
      throw new Error('Missing token or userId for saving refresh token.');
    }

    // Ensure userId is a number before passing to model
    const numericUserId =
      typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(numericUserId)) {
      throw new Error('Invalid User ID format for saving refresh token.');
    }

    try {
      await RefreshToken.create(token, numericUserId, expiresAt);
      console.info(
        `[${timestamp}] [RefreshTokenStore] Save: Token save delegated to` +
        ` model for user ID ${numericUserId}.`
      );
    } catch (err) {
      // Error logging happens in the model, just re-throw
      console.error(
        `[${timestamp}] [RefreshTokenStore] Save failed: Error from ` +
        `RefreshToken model.`, // Concatenation
        err
      );
      // Re-throw the error (already logged in model)
      throw err;
    }
  }

  /**
   * Finds a valid (not expired) refresh token using the RefreshToken model.
   * @param {string} token - The refresh token to find.
   * @returns {Promise<{token: string, userId: number, expires_at: Date}|null>}
   *   The token record if found and valid, or null otherwise.
   * @throws {Error} If checking fails unexpectedly (propagated from model).
   */
  static async find(token) {
    const tokenDisplay = token ? `${token.substring(0, 10)}...` : 'N/A';
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [RefreshTokenStore] Find - Token: ${tokenDisplay}` +
      ` starting (using model)`
    );

    if (!token) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] Find failed: No token provided.`
      );
      throw new Error('Token is required to find.');
    }

    try {
      const foundToken = await RefreshToken.get(token);
      if (foundToken) {
        console.info(
          `[${timestamp}] [RefreshTokenStore] Find: Valid token found via` +
          ` model.`
        );
      } else {
        console.info(
          `[${timestamp}] [RefreshTokenStore] Find: Token not found or` +
          ` expired via model.`
        );
      }
      return foundToken;
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] Find failed: Error from ` +
        `RefreshToken model.`, // Concatenation
        err
      );
      // Re-throw the error (already logged in model)
      throw err;
    }
  }

  /**
   * Revokes (deletes) a specific refresh token using the RefreshToken model.
   * @param {string} token - The refresh token to revoke.
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails (propagated from model).
   */
  static async revoke(token) {
    const tokenDisplay = token ? `${token.substring(0, 10)}...` : 'N/A';
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [RefreshTokenStore] Revoke - Token: ${tokenDisplay}` +
      ` starting (using model)`
    );

    if (!token) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] Revoke failed: No token provided.`
      );
      throw new Error('Token is required to revoke.');
    }

    try {
      const deletedCount = await RefreshToken.delete(token);
      if (deletedCount > 0) {
        console.info(
          `[${timestamp}] [RefreshTokenStore] Revoke: Token removal` +
          ` delegated to model.`
        );
      } else {
        console.warn(
          `[${timestamp}] [RefreshTokenStore] Revoke: Token not found via` +
          ` model, nothing removed.`
        );
      }
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] Revoke failed: Error from ` +
        `RefreshToken model.`, // Concatenation
        err
      );
      // Re-throw the error (already logged in model)
      throw err;
    }
  }

  /**
   * Revokes (deletes) all refresh tokens associated with a specific user ID
   * using the RefreshToken model.
   * @param {string|number} userId - The ID of the user whose tokens should
   *   be revoked.
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails (propagated from model).
   */
  static async revokeAllForUser(userId) {
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [RefreshTokenStore] RevokeAllForUser - UserID:` +
      ` ${userId} starting (using model)`
    );

    if (userId === undefined || userId === null) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] RevokeAllForUser failed:` +
        ` Missing userId.`
      );
      throw new Error('User ID is required to revoke all tokens.');
    }

    // Ensure userId is a number before passing to model
    const numericUserId =
      typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(numericUserId)) {
      throw new Error('Invalid User ID format for revoking tokens.');
    }

    try {
      const deletedCount = await RefreshToken.deleteAllForUser(numericUserId);
      console.info(
        `[${timestamp}] [RefreshTokenStore] RevokeAllForUser:` +
        ` ${deletedCount} tokens revoked via model for user ID` +
        ` ${numericUserId}.`
      );
    } catch (err) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] RevokeAllForUser failed: Error` +
        ` from RefreshToken model.`, // Concatenation
        err
      );
      // Re-throw the error (already logged in model)
      throw err;
    }
  }

  /**
   * Validates a refresh token. Checks JWT signature, expiry, and if it
   * exists and is valid in the database via the RefreshToken model.
   * @param {string} token - The refresh token to validate.
   * @returns {Promise<{userId: string|number}>} The token payload containing
   *   the userId.
   * @throws {UnauthorizedError} If the token is invalid, expired, or not
   *   found/valid in the store.
   * @throws {Error} For other validation errors (propagated from model).
   */
  static async validate(token) {
    const tokenDisplay = token ? `${token.substring(0, 10)}...` : 'N/A';
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [RefreshTokenStore] Validate - Token: ${tokenDisplay}` +
      ` starting (using model)`
    );

    if (!token) {
      console.error(
        `[${timestamp}] [RefreshTokenStore] Validate failed: No token` +
        ` provided.`
      );
      throw new UnauthorizedError('Refresh token is required for validation.');
    }

    try {
      console.debug(
        `[${timestamp}] [RefreshTokenStore] Validate: Attempting JWT` +
        ` verification.`
      );

      // 1. Verify JWT signature and expiration
      let decoded;
      try {
        decoded = jwt.verify(token, REFRESH_SECRET_KEY);
        console.debug(
          `[${timestamp}] [RefreshTokenStore] Validate: JWT verified` +
          ` successfully. Payload:`, // Concatenation
          decoded
        );
      } catch (jwtError) {
        console.warn(
          `[${timestamp}] [RefreshTokenStore] Validate: JWT verification` +
          ` failed.`, // Concatenation
          jwtError.message
        );
        throw new UnauthorizedError('Invalid or expired refresh token.');
      }

      // 2. Check if token exists and is valid in the database via the model
      console.debug(
        `[${timestamp}] [RefreshTokenStore] Validate: Checking database` +
        ` via model...`
      );
      const storedToken = await RefreshTokenStore.find(token); // Use the store's find method which uses the model

      if (storedToken) {
        // Ensure the userId from the JWT matches the one stored with the token
        if (decoded.userId !== storedToken.userId) {
          console.error(
            `[${timestamp}] [RefreshTokenStore] Validate Failed: JWT userId` +
            ` (${decoded.userId}) does not match stored userId ` +
            `(${storedToken.userId}) for token.`
          );
          // Revoke the mismatched token as a security measure
          await RefreshTokenStore.revoke(token);
          throw new UnauthorizedError('Token user mismatch.');
        }

        console.info(
          `[${timestamp}] [RefreshTokenStore] Validate: Refresh token` +
          ` validated successfully (JWT & DB via model). User ID: ` +
          `${decoded.userId}.`
        );
        return decoded; // Return the decoded payload
      } else {
        // If find returns null (token not found or expired in DB)
        console.warn(
          `[${timestamp}] [RefreshTokenStore] Validate: Token not found ` +
          `or expired via model. Attempting revocation.`
        );
        // Attempt to revoke the token in case it exists but is expired/invalid
        // according to the DB, but the JWT was still valid.
        // This handles cleanup if the DB state is inconsistent with JWT expiry.
        // Ignore errors during revoke, as the main goal is to deny validation.
        try {
          await RefreshTokenStore.revoke(token);
        } catch (revokeError) {
          console.error(
            `[${timestamp}] [RefreshTokenStore] Validate: Error during ` +
            `attempted revocation of invalid/expired token:`, // Concatenation
            revokeError.message
          );
        }
        throw new UnauthorizedError(
          'Refresh token not found or has been revoked.'
        );
      }
    } catch (err) {
      // Log specific UnauthorizedErrors caught here
      if (err instanceof UnauthorizedError) {
        console.warn(
          `[${timestamp}] [RefreshTokenStore] Validate failed:` +
          ` ${err.message}` // Concatenation
        );
        throw err;
      } else {
        // Log other errors (likely from model/DB)
        console.error(
          `[${timestamp}] [RefreshTokenStore] Validate failed: Error during` +
          ` validation process.`, // Concatenation
          err
        );
        // Re-throw non-UnauthorizedError (potentially DB error from model)
        throw err;
      }
    }
  }
}
