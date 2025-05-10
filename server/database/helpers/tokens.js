/**
 * @file JWT token creation helper.
 * @module server/database/helpers/tokens
 * @description Provides a function to create signed JWT tokens for
 *   users.
 */

import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../constants/config.js';

/**
 * Creates a signed JWT token for a given user.
 *
 * The token payload currently includes the username. Ensure the user
 * object contains the necessary fields for the payload.
 *
 * @function createToken
 * @param {Object} user - The user object. Must contain at least a `username` property.
 * @returns {string} A signed JWT token string.
 */
function createToken(user) {
  // Add assertion for development to ensure user object is valid
  console.assert(
    user?.username !== undefined,
    'User object passed to createToken must have a username property'
  );

  // Create payload - consider adding roles or other non-sensitive info
  // if needed
  let payload = {
    username: user.username,
    // email: user.email // Example: Include email if needed
  };

  // Sign the token using the secret key (no expiration set here)
  return jwt.sign(payload, SECRET_KEY);
}

export { createToken };
