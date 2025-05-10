/**
 * @file Authentication Routes
 * @module server/routes/auth
 * @description Provides API routes for user registration, login,
 *   password updates, token refresh, and logout.
 */
import express from 'express';
import jsonschema from 'jsonschema';

import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/tokenService.js';
import { formatValidationErrors } from '../utils/validationUtils.js';
import RefreshTokenStore from '../utils/refreshTokenStore.js';

import {
  userLoginSchema,
  userRegisterSchema,
  userPasswordUpdateSchema,
} from '../library/schemaHelpers.js';

import {
  BadRequestError,
  ExpressError,
  UnauthorizedError,
} from '../expressError.js';

import User from '../models/user.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: false }));

/**
 * Route for user registration.
 * Validates request body against `userRegisterSchema`.
 * Registers the user using `User.register`.
 * Generates access and refresh tokens for the new user.
 *
 * @name POST /register
 * @function
 * @memberof module:server/routes/auth
 * @param {string} path - Express path.
 * @param {callback} middleware - Express middleware.
 * @returns {object} 201 - JSON object containing the tokens:
 *   `{ accessToken, refreshToken }`
 * @returns {object} 400 - Bad request (validation error or duplicate
 *   username).
 * @returns {object} 500 - Internal server error.
 */
router.post('/register', async (req, res, next) => {
  const endpoint = '/api/auth/register';
  const timestamp = new Date().toISOString();
  console.debug({
    timestamp: timestamp,
    service: 'AuthRoutes.register',
    message: `POST ${endpoint} - Request received.`,
    context: { body: req.body },
  });

  if (!userRegisterSchema) {
    console.error({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'FATAL: User Registration Schema is undefined.',
      context: { endpoint },
    });
    return next(
      new ExpressError(
        'Server configuration error: Registration schema missing.',
        500
      )
    );
  }

  try {
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Validating request body...',
      context: { endpoint },
    });
    const validator = jsonschema.validate(req.body, userRegisterSchema);
    if (!validator.valid) {
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.register',
        message: 'Request body validation failed.',
        context: {
          endpoint,
          errors: validator.errors.map((e) => e.stack),
        },
      });
      return formatValidationErrors(validator.errors);
    }
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Validation passed.',
      context: { endpoint },
    });

    const { username, email, password } = req.body;
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Attempting to register user...',
      context: { endpoint, username },
    });
    const user = await User.register({
      username,
      email,
      password,
    });
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'User registered successfully.',
      context: {
        endpoint,
        userId: user.id,
        username: user.username,
      },
    });

    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Generating tokens...',
      context: {
        endpoint,
        userId: user.id,
      },
    });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Tokens generated.',
      context: {
        endpoint,
        userId: user.id,
      },
    });

    // Save the refresh token (RefreshTokenStore should log internally)
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Saving refresh token to store...',
      context: {
        endpoint,
        userId: user.id,
      },
    });

    await RefreshTokenStore.save(refreshToken, user.id);

    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Refresh token saved.',
      context: {
        endpoint,
        userId: user.id,
      },
    });

    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.register',
      message: 'Registration complete. Responding with tokens.',
      context: {
        endpoint,
        userId: user.id,
        username: user.username,
      },
    });

    return res.status(201).json({
      accessToken,
      refreshToken,
    });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error({
      timestamp: errorTimestamp,
      service: 'AuthRoutes.register',
      message: 'Registration error.',
      context: {
        endpoint,
        username: req.body?.username,
        error: err,
      },
    });
    // Handle specific duplicate errors
    if (
      err.message?.includes('duplicate key value violates unique constraint')
    ) {
      if (err.constraint === 'users_username_key') {
        console.warn({
          timestamp: errorTimestamp,
          service: 'AuthRoutes.register',
          message: 'Duplicate username detected.',
          context: {
            endpoint,
            username: req.body.username,
          },
        });
        return next(
          new BadRequestError(
            `Username '${req.body.username}' is already taken.`
          )
        );
      }
      // Separate check for email constraint
      if (err.constraint === 'users_email_key') {
        console.warn({
          timestamp: errorTimestamp,
          service: 'AuthRoutes.register',
          message: 'Duplicate email detected.',
          context: {
            endpoint,
            email: req.body.email,
          },
        });
        return next(
          new BadRequestError(
            `Email '${req.body.email}' is already registered.`
          )
        );
      }
    }
    // Pass other errors (including potential errors from tokenService or
    // RefreshTokenStore) to the main error handler
    return next(err);
  }
});

/**
 * Route for user login.
 * Validates request body against `userLoginSchema`.
 * Authenticates the user using `User.authenticate`.
 * Generates access and refresh tokens upon successful authentication.
 *
 * @name POST /login
 * @function
 * @memberof module:server/routes/auth
 * @param {string} path - Express path.
 * @param {callback} middleware - Express middleware.
 * @returns {object} 200 - JSON object containing the tokens:
 *   `{ accessToken, refreshToken }`
 * @returns {object} 400 - Bad request (validation error).
 * @returns {object} 401 - Unauthorized (invalid username/password).
 * @returns {object} 500 - Internal server error.
 */
router.post('/login', async (req, res, next) => {
  const endpoint = '/api/auth/login';
  const timestamp = new Date().toISOString();
  console.debug({
    timestamp: timestamp,
    service: 'AuthRoutes.login',
    message: `POST ${endpoint} - Request received.`,
    context: { body: req.body },
  });

  try {
    if (!req.body) {
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.login',
        message: 'Login failed: No request body received.',
        context: { endpoint },
      });
      throw new BadRequestError('Login failed: No data provided.');
    }

    if (!userLoginSchema) {
      console.error({
        timestamp: timestamp,
        service: 'AuthRoutes.login',
        message: 'FATAL: User Login Schema is undefined.',
        context: { endpoint },
      });

      return next(
        new ExpressError(
          'Server configuration error: Login schema missing.',
          500
        )
      );
    }

    // 1. Validate Request Body
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Validating request body...',
      context: { endpoint },
    });
    const validator = jsonschema.validate(req.body, userLoginSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.login',
        message: 'Login failed: Request body validation failed.',
        context: {
          endpoint,
          errors: errs,
        },
      });
      // Keep simple error reporting for login
      throw new BadRequestError(errs);
    }
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Validation passed.',
      context: { endpoint },
    });

    const { username, password } = req.body;

    // 2. Authenticate User
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Attempting authentication for user...',
      context: {
        endpoint,
        username,
      },
    });

    // User.authenticate handles NotFoundError/UnauthorizedError internally
    // and should log
    const authenticatedUser = await User.authenticate(username, password);
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'User authenticated successfully.',
      context: {
        endpoint,
        userId: authenticatedUser.id,
        username: authenticatedUser.username,
      },
    });

    // 3. Generate Tokens
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Generating tokens...',
      context: {
        endpoint,
        userId: authenticatedUser.id,
      },
    });
    const accessToken = generateAccessToken(authenticatedUser);
    const refreshToken = generateRefreshToken(authenticatedUser);
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Tokens generated.',
      context: {
        endpoint,
        userId: authenticatedUser.id,
      },
    });

    // 4. Save Refresh Token
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Saving refresh token to store...',
      context: {
        endpoint,
        userId: authenticatedUser.id,
      },
    });

    await RefreshTokenStore.save(refreshToken, authenticatedUser.id);

    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Refresh token saved.',
      context: {
        endpoint,
        userId: authenticatedUser.id,
      },
    });

    // 5. Send Response
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.login',
      message: 'Login complete. Responding with tokens.',
      context: {
        endpoint,
        userId: authenticatedUser.id,
        username: authenticatedUser.username,
      },
    });

    return res.json({
      accessToken,
      refreshToken,
    });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.warn({
      timestamp: errorTimestamp,
      service: 'AuthRoutes.login',
      message: 'Login failed.',
      context: {
        endpoint,
        username: req.body?.username,
        error: err,
      },
    });
    // Pass to global error handler, which should handle specific errors
    // like BadRequestError and UnauthorizedError appropriately.
    return next(err);
  }
});

/**
 * Route for updating a user's password.
 * Requires authentication via JWT.
 * Validates request body against `userPasswordUpdateSchema`.
 * Updates the password using `User.updatePassword`.
 *
 * @name PATCH /password
 * @function
 * @memberof module:server/routes/auth
 * @param {string} path - Express path.
 * @param {callback} middleware - Express middleware, including
 *   `authenticateJWT`.
 * @returns {object} 200 - Success message:
 *   `{ message: "Password updated successfully." }`
 * @returns {object} 400 - Bad request (validation error or incorrect
 *   current password).
 * @returns {object} 401 - Unauthorized (missing or invalid token).
 * @returns {object} 404 - User not found.
 * @returns {object} 500 - Internal server error.
 */
router.patch('/password', authenticateJWT, async (req, res, next) => {
  const endpoint = '/api/auth/password';
  const timestamp = new Date().toISOString(); // Reuse timestamp
  const loggedInUsername = res.locals.user?.username;
  console.debug({
    timestamp: timestamp,
    service: 'AuthRoutes.password',
    message: `PATCH ${endpoint} - User: '${loggedInUsername || 'Unknown (No Token)'}'`,
    context: { endpoint },
  });
  // Don't log passwords here
  console.debug(`[${timestamp}] [AuthRoutes] Request Body:`, req.body);

  try {
    // --- Pre-checks using Guard Clauses ---

    // 1. Check if user is authenticated (should be caught by middleware, but double-check)
    if (!loggedInUsername) {
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.password',
        message: `Password update failed: No authenticated user found in res.locals.`,
        context: { endpoint },
      });
      // authenticateJWT should handle invalid token, but check again
      return next(
        new UnauthorizedError('Authentication required for password update.')
      );
    }

    // 2. Check for request body
    if (!req.body) {
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.password',
        message:
          `Password update failed for user ${loggedInUsername}. ` +
          `No request body.`,
        context: { endpoint },
      });
      throw new BadRequestError('Password update failed: No data provided.');
    }

    // 3. Check for schema configuration
    if (!userPasswordUpdateSchema) {
      console.error({
        timestamp: timestamp,
        service: 'AuthRoutes.password',
        message: 'FATAL: User Password Update Schema is undefined.',
        context: { endpoint },
      });

      return next(
        new ExpressError(
          'Server configuration error: Password update schema missing.',
          500
        )
      );
    }

    // --- Main Logic ---

    // 4. Validate Request Body
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message: `Validating request body for user ${loggedInUsername}...`,
      context: { endpoint },
    });

    const validator = jsonschema.validate(req.body, userPasswordUpdateSchema);

    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.password',
        message:
          `Password update failed for user ${loggedInUsername}. ` +
          `Request body validation failed.`,
        context: { endpoint, errors: errs },
      });
      throw new BadRequestError(errs);
    }

    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message: 'Validation passed.',
      context: { endpoint },
    });

    const { oldPassword, password } = req.body;

    // 5. Verify Old Password
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message: `Verifying old password for user ${loggedInUsername}`,
      context: { endpoint },
    });
    // User.authenticate will throw UnauthorizedError if old password is
    // incorrect
    await User.authenticate(loggedInUsername, oldPassword);
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message: `Old password verified for user ${loggedInUsername}`,
      context: { endpoint },
    });

    // 6. Update Password in DB
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message: `Updating password in database for user ${loggedInUsername}`,
      context: { endpoint },
    });
    const updatedUser = await User.updatePassword(loggedInUsername, {
      password,
    });
    // User.update should log
    // Check if update seemed successful (User.update should throw on DB
    // error)
    if (!updatedUser) {
      console.error({
        timestamp: timestamp,
        service: 'AuthRoutes.password',
        message:
          `Password update failed unexpectedly for user ` +
          `${loggedInUsername} (User.update returned null/undefined).`,
        context: { endpoint },
      });
      throw new ExpressError(`User password update failed unexpectedly.`, 500);
    }
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message:
        `Password updated successfully in DB for user ` +
        `${updatedUser.username}.`,
      context: { endpoint },
    });

    // 7. Invalidate Refresh Tokens
    // Get userId from the token payload
    const userId = res.locals.user.userId;
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message:
        `Revoking all refresh tokens for user ID: ${userId} ` +
        `due to password change.`,
      context: { endpoint },
    });
    const count = await RefreshTokenStore.revokeAllForUser(userId);
    console.info(
      `[${timestamp}] [AuthRoutes] Revoked ${count} refresh tokens for ` +
      `user ID ${userId}.`
    );

    // 8. No Need to Generate New Access Token (user should re-authenticate or refresh)
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message: `Skipping new access token generation after password change.`,
      context: { endpoint },
    });

    // 9. Send Success Response
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.password',
      message:
        `Password update process complete for user ` +
        `${updatedUser.username}. Responding with new access token.`,
      context: { endpoint },
    });
    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error({
      timestamp: errorTimestamp,
      service: 'AuthRoutes.password',
      message:
        `Password update failed for user ${loggedInUsername}. ` +
        `Error: ${err.status || 'N/A'} - ${err.message}`,
      context: { endpoint },
    });
    return next(err);
  }
});

/**
 * Route for refreshing an access token using a refresh token.
 * Expects { refreshToken } in the request body.
 * Verifies the refresh token and issues a new access token if valid.
 *
 * @name POST /refresh
 * @function
 * @memberof module:server/routes/auth
 * @param {string} path - Express path.
 * @param {callback} middleware - Express middleware.
 * @returns {object} 200 - JSON object containing the new JWT access
 *   token: `{ accessToken }`
 * @returns {object} 400 - Bad request (missing refresh token).
 * @returns {object} 401 - Unauthorized (invalid, expired, revoked
 *   refresh token, or user not found from token).
 * @returns {object} 500 - Internal server error.
 */
router.post('/refresh', async (req, res, next) => {
  const endpoint = '/api/auth/refresh';
  const timestamp = new Date().toISOString(); // Reuse timestamp
  console.debug({
    timestamp: timestamp,
    service: 'AuthRoutes.refresh',
    message: `POST ${endpoint} - Request received.`,
    context: { body: req.body },
  });

  try {
    // 1. Get and validate presence of refresh token (Guard Clause)
    const { refreshToken } = req.body;
    if (!refreshToken) {
      console.warn({
        timestamp: timestamp,
        service: 'AuthRoutes.refresh',
        message: `Refresh failed: Refresh token missing in request body.`,
        context: { endpoint },
      });
      throw new BadRequestError('Refresh token is required.');
    }

    // 2. Validate Refresh Token with Store
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `Refresh token received. Validating...`,
      context: { endpoint },
    });
    const { userId } = await RefreshTokenStore.validate(refreshToken);
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `Refresh token validated successfully for user ID: ${userId}.`,
      context: { endpoint },
    });

    // 3. Fetch User Details
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `Fetching user details for user ID: ${userId}...`,
      context: { endpoint },
    });
    const user = await User.getById(userId);
    // Throws NotFoundError if user deleted since token was issued
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `User details fetched successfully for user ${user.username}.`,
      context: { endpoint },
    });

    // 4. Generate New Access Token
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `Generating new access token for user ${user.username}...`,
      context: { endpoint },
    });
    const accessToken = generateAccessToken(user);
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `New access token generated.`,
      context: { endpoint },
    });

    // 5. Send Response
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.refresh',
      message: `Refresh complete. Responding with new access token.`,
      context: { endpoint },
    });
    return res.status(200).json({ accessToken });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error({
      timestamp: errorTimestamp,
      service: 'AuthRoutes.refresh',
      message: `Refresh failed. Error: ${err.status || 'N/A'} - ${err.message}`,
      context: { endpoint },
    });
    return next(err);
  }
});

/**
 * Route for user logout.
 * Requires authentication to identify the user.
 * Revokes the specific refresh token provided in the request body.
 *
 * @name POST /logout
 * @function
 * @memberof module:server/routes/auth
 * @param {string} path - Express path.
 * @param {callback} middleware - Express middleware, including
 *   `authenticateJWT`.
 * @returns {object} 200 - JSON object indicating success:
 *   `{ message: "Logged out successfully" }`
 * @returns {object} 400 - Bad request (missing refresh token in body).
 * @returns {object} 401 - Unauthorized (if token is invalid/missing).
 * @returns {object} 500 - Internal server error.
 */
router.post('/logout', authenticateJWT, async (req, res, next) => {
  const endpoint = '/api/auth/logout';
  const timestamp = new Date().toISOString(); // Reuse timestamp
  const { refreshToken } = req.body;
  const userId = res.locals.user.id;

  console.debug({
    timestamp: timestamp,
    service: 'AuthRoutes.logout',
    message: `POST ${endpoint} - Request received.`, // No need for group here
    context: {
      userId,
      hasRefreshToken: !!refreshToken,
    },
  });

  // Guard clause: Check if refresh token exists in the body
  if (!refreshToken) {
    console.warn({
      timestamp: timestamp,
      service: 'AuthRoutes.logout',
      message: 'Logout request missing refresh token in body.',
      context: {
        endpoint,
        userId,
      },
    });
    return next(new BadRequestError('Refresh token is required.'));
  }

  try {
    console.debug({
      timestamp: timestamp,
      service: 'AuthRoutes.logout',
      message: 'Attempting to remove refresh token from store...',
      context: {
        endpoint,
        userId,
      },
    });
    // Revoke the specific refresh token provided in the request body
    await RefreshTokenStore.revoke(refreshToken);
    console.info({
      timestamp: timestamp,
      service: 'AuthRoutes.logout',
      message: 'Refresh token removed successfully. Logout complete.',
      context: {
        endpoint,
        userId,
      },
    });
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    const errorTimestamp = new Date().toISOString();
    console.error({
      timestamp: errorTimestamp,
      service: 'AuthRoutes.logout',
      message: 'Logout error (during token removal).',
      context: {
        endpoint,
        userId,
        error: err,
      },
    });
    // Pass error to the global error handler
    return next(err);
  }
});

export default router;
