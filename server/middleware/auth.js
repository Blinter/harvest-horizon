/**
 * @file Authentication and Authorization Middleware.
 * @module server/middleware/auth
 * @description Provides middleware functions for Express routes and Socket.IO
 *   connections to handle JWT authentication and user authorization checks.
 */
'use strict';

import jwt from 'jsonwebtoken';
import {
  SECRET_KEY,
  QUICK_START_TEMP_PG_EMAIL_PREFIX
} from '../constants/config.js';
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ExpressError,
} from '../expressError.js';
import User from '../models/user.js';
import Map from '../models/map.js';
import Character from '../models/character.js';
// Direct console calls are used instead of logger;

/**
 * Middleware: Authenticate user via JWT.
 *
 * If a token is provided in the `Authorization` header (Bearer schema),
 * it verifies the token and, if valid, adds the token payload
 * (containing user information) to `res.locals.user`.
 *
 * It Does Not Throw Error if token is invalid or missing; it simply
 * won't add `user` to `res.locals`. Subsequent middleware like
 * `ensureLoggedIn` should be used to enforce authentication.
 *
 * @function authenticateJWT
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void} Calls `next()`.
 *   Calls `next(error)` if JWT verification fails unexpectedly
 *   (though typically caught and handled as UnauthorizedError).
 */
function authenticateJWT(req, res, next) {
  const isoTimestamp = `[${new Date().toISOString()}]`;
  const logPrefix = `${isoTimestamp} [AuthMiddleware] authenticateJWT:`;
  console.debug(`${logPrefix} Processing request for path ${req.path}`);

  try {
    // Extract token from Authorization header (e.g., "Bearer <token>")
    const authHeader = req.headers?.authorization;
    console.debug(
      `${logPrefix} Authorization header: ${authHeader ? 'Present' : 'Missing'}`
    );

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove "Bearer " prefix
      console.debug(`${logPrefix} Bearer token extracted. Verifying...`);

      try {
        const payload = jwt.verify(token, SECRET_KEY);
        console.debug(
          `${logPrefix} Token verified successfully. Payload:`,
          payload
        );

        // Dynamically determine and add isTemporary flag based on username
        if (
          payload.username &&
          (payload.username.startsWith('guest_') ||
            payload.username.startsWith(QUICK_START_TEMP_PG_EMAIL_PREFIX))
        ) {
          payload.isTemporary = true;
        } else {
          payload.isTemporary = false;
        }
        console.debug(
          `${logPrefix} Determined isTemporary status: ${payload.isTemporary}`
        );

        res.locals.user = payload; // Attach payload (now with isTemporary) to res.locals
      } catch (jwtError) {
        // Log specific JWT errors (e.g., TokenExpiredError,
        // JsonWebTokenError)
        console.warn(`${logPrefix} Token verification failed.`, jwtError);

        // Check if the error is specifically TokenExpiredError
        if (jwtError.name === 'TokenExpiredError') {
          // Pass a specific UnauthorizedError for expired tokens
          return next(new UnauthorizedError('JWT token has expired.'));
        }

        // For other JWT errors, just nullify the user and let subsequent
        // middleware (like ensureLoggedIn) handle it.
        res.locals.user = null; // Explicitly set to null
      }
    } else {
      console.debug(
        `${logPrefix} No 'Authorization: Bearer ...' header found.`
      );
      res.locals.user = null; // Explicitly set to null if no header
    }
    return next(); // Always call next(), even if token is invalid/missing
  } catch (err) {
    // Catch unexpected errors during the process
    // (e.g., issues accessing headers)
    console.error(
      `${logPrefix} Unexpected error during token processing.`,
      err
    );
    // Pass unexpected errors to the central error handler
    return next(err);
  }
}

/**
 * Middleware: Ensure user is logged in.
 *
 * Checks if `res.locals.user` exists (meaning `authenticateJWT`
 * successfully verified a token). If not, throws an `UnauthorizedError`.
 *
 * Should be placed *after* `authenticateJWT` in the middleware chain for
 * routes requiring authentication.
 *
 * @function ensureLoggedIn
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void} Calls `next()` if logged in, otherwise calls `next(error)`.
 */
function ensureLoggedIn(req, res, next) {
  const isoTimestamp = `[${new Date().toISOString()}]`;
  const logPrefix = `${isoTimestamp} [AuthMiddleware] ensureLoggedIn:`;
  // Keep for middleware debugging
  // console.debug(
  //   `${logPrefix} Checking for` + ` authenticated user on path ${req.path}`
  // );
  // Check if authenticateJWT successfully attached a user
  if (res?.locals?.user) {
    // Keep for middleware debugging
    // console.debug(`${logPrefix} User found in res.locals. Proceeding.`);
    return next();
  } else {
    console.warn(
      `${logPrefix} No authenticated user found in res.locals. ` +
      `Access denied.`
    );
    // If no user, pass an UnauthorizedError to the error handler
    return next(new UnauthorizedError('Login required.'));
  }
}

/**
 * Middleware: Ensure user is the correct user for the route.
 *
 * Checks if `res.locals.user` exists and if the logged-in user's
 * username matches the `username` parameter in the route
 * (`req.params.username`). If the condition is not met, throws an
 * `UnauthorizedError`.
 *
 * Should be placed *after* `authenticateJWT` in the middleware chain.
 *
 * @function ensureCorrectUser
 * @param {Object} req - Express request object, expects `req.params.username`.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 * @returns {void} Calls `next()` if authorized, otherwise calls `next(error)`.
 */
function ensureCorrectUser(req, res, next) {
  // Determine if the route parameter is intended to be username or ID
  // Assuming routes like /users/:id use ID, and others might use username.
  // For the specific problematic route /api/user/1, we assume it's :id
  const routeParamKey = req.params.id ? 'id' : 'username'; // Adapt if needed
  const routeParamValue = req.params[routeParamKey];

  const isoTimestamp = `[${new Date().toISOString()}]`;
  const logPrefix = `${isoTimestamp} [AuthMiddleware] ensureCorrectUser:`;

  // Keep for middleware debugging
  // console.debug(
  //   `${logPrefix} Checking access` +
  //   ` for route param ${routeParamKey} '${routeParamValue}' ` +
  //   `on path ${req.path}`
  // );
  try {
    const user = res.locals.user; // User payload from authenticateJWT

    if (!user) {
      console.warn(`${logPrefix} Access denied. No authenticated user found.`);
      throw new UnauthorizedError('Authentication required.');
    }

    // Determine which field from the token payload to compare against
    const tokenValueToCompare = String(
      routeParamKey === 'id' ? user.userId : user.username
    );
    const routeValueToCompare = String(routeParamValue);

    // Keep for middleware debugging
    // console.debug(
    //   `${logPrefix} Authenticated user: ` +
    //   `'${user.username}' (ID: ${user.userId}). ` +
    //   `Required route ${routeParamKey}: '${routeValueToCompare}'`
    // );

    // Compare the appropriate token field with the route parameter
    if (tokenValueToCompare === routeValueToCompare) {
      // Keep for middleware debugging
      // console.debug(
      //   `${logPrefix} Access granted (User match on ${routeParamKey}).` +
      //   ` Proceeding.`
      // );
      return next();
    } else {
      // Determine the user identifier string based on the route parameter key
      const userIdentifier =
        routeParamKey === 'id'
          ? `ID ${tokenValueToCompare}`
          : `username ${tokenValueToCompare}`;

      console.warn(
        `${logPrefix} Access denied. Authenticated user (${userIdentifier}) ` +
        `does not match route parameter '${routeValueToCompare}'.`
      );
      throw new UnauthorizedError('Access denied: Incorrect user.');
    }
  } catch (err) {
    // Catch the UnauthorizedError thrown above or any unexpected errors
    if (!(err instanceof UnauthorizedError)) {
      // Log unexpected errors
      console.error(`${logPrefix} Unexpected error.`, err);
    }
    return next(err);
  }
}

/**
 * Socket.IO middleware to authenticate connections using JWT.
 * Extracts token from handshake, verifies it, fetches user,
 * and attaches user info to socket.data.
 *
 * @param {Object} socket - The socket instance.
 * @param {Function} next - The next middleware function.
 */
async function authenticateSocket(socket, next) {
  // Keep for middleware debugging
  // console.info(
  //   `[${new Date().toISOString()}] [AuthMiddleware] authenticateSocket: ` +
  //   `Attempting to authenticate socket ID: ${socket.id}`
  // );
  const isoTimestamp = `[${new Date().toISOString()}]`;
  const logPrefix = `${isoTimestamp} [AuthMiddleware] authenticateSocket:`;
  // Keep for middleware debugging
  // console.debug(
  //   `${isoTimestamp} [AuthMiddleware] AUTHENTICATE SOCKET starting - ` +
  //   `ID: ${socket.id}`
  // );

  // Keep for middleware debugging
  // console.debug(`${logPrefix} Handshake data:`, socket.handshake);
  // Extract token from handshake auth object or headers
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    console.warn(`${logPrefix} Authentication failed - No token provided.`);
    // Pass error to Socket.IO connection error handler
    return next(new Error('Authentication error: No token provided'));
  }

  // Keep for middleware debugging
  // console.debug(`${logPrefix} Token found. Verifying...`);
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    // Keep for middleware debugging
    // console.debug(`${logPrefix} Token verified. Payload:`, payload);

    if (!payload?.username) {
      console.warn(
        `${logPrefix} Authentication failed - Invalid token payload ` +
        `(missing username).`
      );
      return next(new Error('Authentication error: Invalid token payload'));
    }

    // Keep for middleware debugging
    // console.debug(
    //   `${logPrefix} Fetching user '${payload.username}' from database...`
    // );
    // Assumes User model handles NotFoundError
    const user = await User.getByUsername(payload.username);

    // Keep for middleware debugging
    // console.info(
    //   `${logPrefix} User '${user.username}' (ID: ${user.id}) found.`
    // );

    // Attach user information to the socket
    socket.data.user = {
      id: user.id, // Assuming user object from DB has id
      username: user.username,
      email: user.email,
      // Add other relevant non-sensitive fields if needed by socket handlers
    };
    // Keep for middleware debugging
    // console.debug(`${logPrefix} User data attached to socket.data.user`);

    // Keep for middleware debugging
    // console.info(
    //   `${logPrefix} Authentication successful for ` +
    //   `user '${user.username}' (Socket ID: ${socket.id}).`
    // );
    return next(); // Proceed with connection
  } catch (err) {
    // Handle JWT verification errors (e.g., expired) or DB errors
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError
    ) {
      console.warn(
        `${logPrefix} Authentication failed - Token verification error: ` +
        `${err.name}`,
        err
      );
      return next(new Error(`Authentication error: ${err.message}`));
    } else if (err instanceof NotFoundError) {
      // Handle case where user in token doesn't exist in DB anymore
      console.warn(
        `${logPrefix} Authentication failed - User ` +
        `from token not found in database.`
      );
      return next(
        new Error('Authentication error: User associated with token not found')
      );
    } else {
      // Handle unexpected errors (e.g., DB connection issues)
      console.error(`${logPrefix} Unexpected authentication error.`, err);
      return next(new Error('Internal server error during authentication.'));
    }
  }
}

/**
 * Middleware to ensure the logged-in user owns the character associated
 * with the requested map specified by the `:mapId` route parameter.
 * Assumes Map.get exists and uses Character.verifyOwnership.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const ensureMapOwnership = async (req, res, next) => {
  const { mapId } = req.params;
  // Use consistent identifier logic
  const userIdentifier = res.locals.user?.userId || res.locals.user?.pgId;
  const userId = userIdentifier; // Keep variable name for consistency if used below

  // Keep for middleware debugging
  //const timestamp = new Date().toISOString();

  // Keep for middleware debugging
  // console.debug({
  //   timestamp: timestamp,
  //   service: 'Middleware:ensureMapOwnership',
  //   message: `Verifying ownership request parameters.`,
  //   context: { mapId, userId },
  // });

  if (!userId) {
    console.warn({
      timestamp: new Date().toISOString(),
      service: 'Middleware:ensureMapOwnership',
      message: 'User ID missing from res.locals.user for ownership check.',
      context: { mapId },
    });
    return next(new UnauthorizedError('Authentication required.'));
  }
  if (!mapId) {
    // This shouldn't happen if the route parameter is defined, but check anyway
    console.error({
      timestamp: new Date().toISOString(),
      service: 'Middleware:ensureMapOwnership',
      message: `Map ID missing from route parameters. Route misconfiguration?`,
      context: { userId },
    });
    return next(new BadRequestError('Map ID missing from request parameters.'));
  }

  try {
    // 1. Fetch the map
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnership',
    //   message: `Fetching map ${mapId}...`,
    //   context: { userId },
    // });
    const map = await Map.get(mapId); // Use existing Map.get method

    if (!map) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'Middleware:ensureMapOwnership',
        message: `Map ${mapId} not found. Cannot verify ownership.`,
        context: { userId },
      });
      // Let route handler deal with 404.
      return next();
    }

    // 2. Extract character ID
    const characterMongoId = map.characterId;
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnership',
    //   message: `Map found. Extracted character ID.`,
    //   context: {
    //     mapId,
    //     userId,
    //     characterMongoId: characterMongoId?.toString(),
    //   },
    // });

    if (!characterMongoId) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'Middleware:ensureMapOwnership',
        message:
          `Map ${mapId} is missing characterId. Cannot verify ownership.`,
        context: { userId, mapData: map },
      });
      return next(
        new ExpressError('Map data incomplete, cannot verify ownership.', 500)
      );
    }

    // 3. Verify ownership
    const characterIdString = characterMongoId.toString();

    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnership',
    //   message: `Calling Character.verifyOwnership...`,
    //   context: { characterId: characterIdString, userId },
    // });

    const isOwner = await Character.verifyOwnership(characterIdString, userId);

    // 4. Handle result

    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnership',
    //   message: `Character.verifyOwnership returned: ${isOwner}`,
    //   context: { characterId: characterIdString, userId, isOwner },
    // });

    if (!isOwner) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'Middleware:ensureMapOwnership',
        message:
          `Ownership check failed. ` +
          `User ${userId} does NOT own character ${characterIdString} ` +
          `(linked to map ${mapId}).`,
        context: { userId, mapId, characterId: characterIdString },
      });
      return next(new ForbiddenError('Permission denied to access this map.'));
    }

    // Ownership confirmed
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnership',
    //   message: `Ownership confirmed for map ${mapId}. Proceeding.`,
    //   context: { userId, mapId, characterId: characterIdString },
    // });
    return next();
  } catch (err) {
    console.error({
      timestamp: new Date().toISOString(),
      service: 'Middleware:ensureMapOwnership',
      message: `Error during ownership check.`,
      context: { mapId, userId, error: err.message, stack: err.stack },
    });
    return next(err);
  }
};

/**
 * Middleware to ensure the logged-in user owns the character specified
 * by the `:characterId` route parameter.
 * Uses Character.verifyOwnership.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const ensureCharacterOwnership = async (req, res, next) => {
  const { characterId } = req.params;
  // Use consistent identifier logic
  const userIdentifier = res.locals.user?.userId || res.locals.user?.pgId;
  const userId = userIdentifier; // Keep variable name for consistency

  // Keep for middleware debugging
  // const timestamp = new Date().toISOString();

  // Keep for middleware debugging
  // console.debug(
  //   `[${timestamp}] [DEBUG] [Middleware:ensureCharacterOwnership]: ` +
  //   `Verifying ownership for character ${characterId} by user ${userId}`
  // );

  if (!userId) {
    // This case should ideally be prevented by ensureLoggedIn or similar
    console.warn(
      `[${new Date().toISOString()}] [WARN] ` +
      `[Middleware:ensureCharacterOwnership]: ` +
      `User ID missing from res.locals.user for ownership check.`
    );
    return next(new UnauthorizedError('Authentication required.'));
  }
  if (!characterId) {
    return next(new BadRequestError('Character ID missing from parameters.'));
  }

  try {
    // Verify ownership using the dedicated method
    const isOwner = await Character.verifyOwnership(characterId, userId);

    if (!isOwner) {
      // Character might not exist, or user doesn't own it.
      // Log the attempt and deny access.
      // We don't know *why* it failed (not found vs no permission) without
      // another query, but Forbidden is safer.
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[Middleware:ensureCharacterOwnership]: ` +
        `Ownership check failed for user ${userId} on character ${characterId}.`
      );
      // Use ForbiddenError as the user is authenticated but lacks rights
      return next(
        new ForbiddenError('Permission denied to access this character.')
      );
    }

    // Ownership confirmed
    // Keep for middleware debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] ` +
    //   `[Middleware:ensureCharacterOwnership]: ` +
    //   `Ownership confirmed for character ${characterId} by user ${userId}.`
    // );
    return next();
  } catch (err) {
    // Handle errors during the verification check (e.g., DB connection)
    console.error(
      `[${new Date().toISOString()}] [ERROR] ` +
      `[Middleware:ensureCharacterOwnership]: ` +
      `Error during ownership check for character ${characterId}.`,
      err
    );
    // Pass the error to the global error handler
    return next(err);
  }
};

/**
 * Middleware to ensure the logged-in user owns the character specified
 * by the `characterId` in the request body.
 * Uses Character.verifyOwnership.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const ensureCharacterOwnershipFromBody = async (req, res, next) => {
  // Get characterId from request BODY
  const { characterId } = req.body;
  // Use consistent identifier logic
  const userIdentifier = res.locals.user?.userId || res.locals.user?.pgId;
  const userId = userIdentifier; // Keep variable name for consistency

  // Keep for middleware debugging
  // console.debug(
  //   `[${timestamp}] [DEBUG] ` +
  //   `[Middleware:ensureCharacterOwnershipFromBody]: Verifying ownership ` +
  //   `for character ${characterId} (from body) by user ${userId}`
  // );

  if (!userId) {
    console.warn(
      `[${new Date().toISOString()}] [WARN] ` +
      `[Middleware:ensureCharacterOwnershipFromBody]: ` +
      `User ID missing from res.locals.user for ownership check.`
    );
    return next(new UnauthorizedError('Authentication required.'));
  }
  if (!characterId) {
    // If characterId is required for ownership check, it must be present.
    console.warn(
      `[${new Date().toISOString()}] [WARN] ` +
      `[Middleware:ensureCharacterOwnershipFromBody]: ` +
      `Character ID missing from request body. Cannot verify ownership.`
    );
    return next(new BadRequestError('Character ID required in request body.'));
  }

  try {
    // Verify ownership
    const isOwner = await Character.verifyOwnership(characterId, userId);

    if (!isOwner) {
      // Ownership check failed (not found or wrong user)
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[Middleware:ensureCharacterOwnershipFromBody]: ` +
        `Ownership check failed for user ${userId} on character ` +
        `${characterId} (from body).`
      );
      return next(
        new ForbiddenError('Permission denied for character specified in body.')
      );
    }

    // Ownership confirmed
    // Keep for middleware debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] ` +
    //   `[Middleware:ensureCharacterOwnershipFromBody]: ` +
    //   `Ownership confirmed for character ${characterId} (from body) ` +
    //   `by user ${userId}.`
    // );
    return next();
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] [ERROR] ` +
      `[Middleware:ensureCharacterOwnershipFromBody]: ` +
      `Error during ownership check for character ${characterId} (from body).`,
      err
    );
    return next(err);
  }
};

/**
 * Middleware to ensure the logged-in user owns the character associated
 * with the map specified by `mapId` in the request body.
 * Assumes Map.get exists and uses Character.verifyOwnership.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const ensureMapOwnershipFromBody = async (req, res, next) => {
  // Get mapId from request BODY
  const { mapId } = req.body;
  // Use consistent identifier logic
  const userIdentifier = res.locals.user?.userId || res.locals.user?.pgId;
  const userId = userIdentifier; // Keep variable name for consistency

  // Keep for middleware debugging
  // const timestamp = new Date().toISOString();

  // Keep for middleware debugging
  // console.debug({
  //   timestamp: timestamp,
  //   service: 'Middleware:ensureMapOwnershipFromBody',
  //   message: `Verifying ownership request body.`,
  //   context: { mapId, userId }, // Log inputs
  // });

  if (!userId) {
    console.warn({
      timestamp: new Date().toISOString(),
      service: 'Middleware:ensureMapOwnershipFromBody',
      message: 'User ID missing from res.locals.user for ownership check.',
      context: { mapId },
    });
    return next(new UnauthorizedError('Authentication required.'));
  }
  if (!mapId) {
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnershipFromBody',
    //   message: 'Map ID missing from request body. Skipping ownership check.',
    //   context: { userId },
    // });
    return next(new BadRequestError('Map ID missing from request body.'));
  }

  try {
    // 1. Get the map document
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnershipFromBody',
    //   message: `Fetching map ${mapId}...`,
    //   context: { userId },
    // });
    const map = await Map.get(mapId);

    if (!map) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'Middleware:ensureMapOwnershipFromBody',
        message: `Map ${mapId} not found. Cannot verify ownership.`,
        context: { userId },
      });
      // Let route handler deal with 404.
      // Note: If the map doesn't exist, ownership can't be checked,
      // but we shouldn't throw Forbidden here.
      return next();
    }

    // 2. Extract character ID
    const characterMongoId = map.characterId;
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnershipFromBody',
    //   message: `Map found. Extracted character ID.`,
    //   context: {
    //     mapId,
    //     userId,
    //     characterMongoId: characterMongoId?.toString(),
    //   },
    // });

    if (!characterMongoId) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'Middleware:ensureMapOwnershipFromBody',
        message: `Map ${mapId} is missing characterId. Cannot verify ownership.`,
        context: { userId, mapData: map }, // Log map data for inspection
      });
      return next(
        new ExpressError('Map data incomplete, cannot verify ownership.', 500)
      );
    }

    // 3. Verify ownership
    const characterIdString = characterMongoId.toString(); // Ensure it's a string
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnershipFromBody',
    //   message: `Calling Character.verifyOwnership...`,
    //   context: { characterId: characterIdString, userId },
    // });

    const isOwner = await Character.verifyOwnership(characterIdString, userId);

    // 4. Handle result
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnershipFromBody',
    //   message: `Character.verifyOwnership returned: ${isOwner}`,
    //   context: { characterId: characterIdString, userId, isOwner },
    // });

    if (!isOwner) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'Middleware:ensureMapOwnershipFromBody',
        message:
          `Ownership check failed. User ${userId} does NOT own character` +
          ` ${characterIdString} (linked to map ${mapId}).`,
        context: { userId, mapId, characterId: characterIdString },
      });
      return next(new ForbiddenError('Permission denied to access this map.'));
    }

    // Ownership confirmed
    // Keep for middleware debugging
    // console.debug({
    //   timestamp: new Date().toISOString(),
    //   service: 'Middleware:ensureMapOwnershipFromBody',
    //   message: `Ownership confirmed for map ${mapId}. Proceeding.`,
    //   context: { userId, mapId, characterId: characterIdString },
    // });
    return next();
  } catch (err) {
    console.error({
      timestamp: new Date().toISOString(),
      service: 'Middleware:ensureMapOwnershipFromBody',
      message: `Error during ownership check.`,
      context: { mapId, userId, error: err.message, stack: err.stack },
    });
    return next(err);
  }
};

export {
  authenticateJWT,
  ensureLoggedIn,
  ensureCorrectUser,
  authenticateSocket,
  ensureMapOwnership,
  ensureCharacterOwnership,
  ensureCharacterOwnershipFromBody,
  ensureMapOwnershipFromBody,
};
