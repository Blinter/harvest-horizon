/**
 * @file expressError.js
 * @module expressError
 * @description Custom error classes for the Express application. These classes help standardize error responses and provide appropriate HTTP status codes.
 */

/**
 * Base Express error class extending the native Error. Provides status code
 * and proper stack trace capabilities.
 */
class ExpressError extends Error {
  /**
   * Create a new ExpressError.
   *
   * @param {string} message - Error message.
   * @param {number} status - HTTP status code.
   */
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
    // This maintains proper stack trace for the error (available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 404 Not Found error. Used when a requested resource doesn't exist.
 */
class NotFoundError extends ExpressError {
  /**
   * Create a new NotFoundError.
   *
   * @param {string} [message='Not Found'] - Optional error message.
   */
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

/**
 * 401 Unauthorized error. Used when authentication is required but failed
 * or not provided.
 */
class UnauthorizedError extends ExpressError {
  /**
   * Create a new UnauthorizedError.
   *
   * @param {string} [message='Unauthorized'] - Optional error message.
   */
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 400 Bad Request error. Used when the request was malformed or contains
 * invalid parameters.
 */
class BadRequestError extends ExpressError {
  /**
   * Create a new BadRequestError.
   *
   * @param {string} [message='Bad Request'] - Optional error message.
   */
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * 403 Forbidden error. Used when the user is authenticated but doesn't
 * have permission.
 */
class ForbiddenError extends ExpressError {
  /**
   * Create a new ForbiddenError.
   *
   * @param {string} [message='Forbidden'] - Optional error message.
   */
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 403 Forbidden error specifically for when a user attempts to create more
 * characters than allowed by the limit.
 */
class CharacterLimitExceededError extends ExpressError {
  /**
   * Create a new CharacterLimitExceededError.
   *
   * @param {string} [message='Character limit reached'] - Optional error
   *   message.
   */
  constructor(message = 'Character limit reached') {
    super(message, 403);
  }
}

/**
 * Duplicate Character Name error (409 Conflict). Used when attempting to
 * create a character with a name that already exists.
 */
class DuplicateCharacterNameError extends ExpressError {
  /**
   * Creates a new DuplicateCharacterNameError.
   *
   * @param {string} [message='A character with this name already exists.'] -
   *   Optional error message.
   */
  constructor(message = 'A character with this name already exists.') {
    super(message, 409);
  }
}

/**
 * Duplicate Map Name error (409 Conflict). Used when attempting to create a
 * map with a name that already exists.
 */
class DuplicateMapNameError extends ExpressError {
  /**
   * Creates a new DuplicateMapNameError.
   *
   * @param {string} [message='A map with this name already exists.'] -
   *   Optional error message.
   */
  constructor(message = 'A map with this name already exists.') {
    super(message, 409);
  }
}

export {
  ExpressError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  CharacterLimitExceededError,
  DuplicateCharacterNameError,
  DuplicateMapNameError,
};
