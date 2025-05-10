/**
 * @file Token Service
 * @module server/utils/tokenService
 * @description Provides utility functions for generating JWT access and
 *   refresh tokens, adhering to security best practices and configured
 *   expiration times.
 */
import jwt from 'jsonwebtoken';
// Import keys from the central config file
import { SECRET_KEY, REFRESH_SECRET_KEY } from '../constants/config.js';

// Define token expiration times
const ACCESS_TOKEN_EXPIRY = '2h'; // Increased from 15m
const REFRESH_TOKEN_EXPIRY = '7d'; // Long-lived refresh token (e.g., 7 days)

/**
 * Generates a JWT Access Token.
 *
 * This token is used for authenticating user requests for protected
 * resources. It includes essential user identification details but avoids
 * sensitive information.
 *
 * @param {object} user - The user object containing required identifiers
 *   like `id`, `username`, and `email`.
 * @returns {string} The generated JWT access token, signed with the primary
 *   secret key and set to expire according to `ACCESS_TOKEN_EXPIRY`.
 * @throws {Error} If the user object is invalid or if token signing fails.
 */
function generateAccessToken(user) {
  console.debug({
    timestamp: new Date().toISOString(),
    service: 'TokenService.generateAccessToken',
    message: 'Attempting token generation for user...',
    context: { userId: user?.id, username: user?.username },
  });
  // Validate user object structure
  if (!user || !user.id || !user.username || !user.email) {
    console.error({
      timestamp: new Date().toISOString(),
      service: 'TokenService.generateAccessToken',
      message: 'Invalid user object provided.',
      context: { user },
    });
    throw new Error(
      'Invalid user object provided for access token generation.'
    );
  }
  // Prepare payload - include only necessary, non-sensitive claims
  const payload = {
    userId: user.id, // Use consistent casing (userId)
    username: user.username,
    email: user.email,
    // roles: user.roles || [], // Example: Add roles if applicable
  };
  console.debug({
    timestamp: new Date().toISOString(),
    service: 'TokenService.generateAccessToken',
    message: 'Payload prepared for access token.',
    context: { payload },
  });

  try {
    const token = jwt.sign(payload, SECRET_KEY, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
    console.info({
      timestamp: new Date().toISOString(),
      service: 'TokenService.generateAccessToken',
      message: 'Access token generated successfully.',
      context: {
        userId: user.id,
        username: user.username,
        expiresIn: ACCESS_TOKEN_EXPIRY,
      },
    });
    return token;
  } catch (err) {
    console.error({
      timestamp: new Date().toISOString(),
      service: 'TokenService.generateAccessToken',
      message: 'Error during jwt.sign for access token.',
      context: { error: err, userId: user.id },
    });
    // Re-throw error for caller to handle
    throw new Error(`Failed to generate access token: ${err.message}`);
  }
}

/**
 * Generates a JWT Refresh Token.
 *
 * This long-lived token is used to obtain a new access token without
 * requiring the user to log in again. It contains minimal user
 * identification, typically just the user ID.
 *
 * @param {object} user - The user object containing the user `id`.
 * @returns {string} The generated JWT refresh token, signed with the
 *   dedicated refresh secret key and set to expire according to
 *   `REFRESH_TOKEN_EXPIRY`.
 * @throws {Error} If the user object is invalid (missing ID) or if token
 *   signing fails.
 */
function generateRefreshToken(user) {
  console.debug({
    timestamp: new Date().toISOString(),
    service: 'TokenService.generateRefreshToken',
    message: 'Attempting refresh token generation...',
    context: { userId: user?.id },
  });
  // Validate user object for required ID
  if (!user || !user.id) {
    console.error({
      timestamp: new Date().toISOString(),
      service: 'TokenService.generateRefreshToken',
      message: 'Invalid user object (missing ID) provided.',
      context: { user },
    });
    throw new Error(
      'Invalid user object (missing ID) provided for refresh token generation.'
    );
  }
  // Refresh token payload should be minimal, typically just user ID
  const payload = {
    userId: user.id, // Use consistent casing
    // Avoid including username, email, or other PII here if possible
  };
  console.debug({
    timestamp: new Date().toISOString(),
    service: 'TokenService.generateRefreshToken',
    message: 'Payload prepared for refresh token.',
    context: { payload },
  });

  try {
    // Use the separate REFRESH_SECRET_KEY
    const token = jwt.sign(payload, REFRESH_SECRET_KEY, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });
    console.info({
      timestamp: new Date().toISOString(),
      service: 'TokenService.generateRefreshToken',
      message: 'Refresh token generated successfully.',
      context: { userId: user.id, expiresIn: REFRESH_TOKEN_EXPIRY },
    });
    return token;
  } catch (err) {
    console.error({
      timestamp: new Date().toISOString(),
      service: 'TokenService.generateRefreshToken',
      message: 'Error during jwt.sign for refresh token.',
      context: { error: err, userId: user.id },
    });
    // Re-throw error
    throw new Error(`Failed to generate refresh token: ${err.message}`);
  }
}

export { generateAccessToken, generateRefreshToken };
