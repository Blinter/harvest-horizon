/**
 * @file Timeout utility for asynchronous operations.
 * @module server/database/helpers/_timeoutsDatabase
 * @description Provides a function to wrap promises with a timeout,
 *   ensuring they don't hang indefinitely. Primarily intended for
 *   database operations in testing scenarios.
 *   Note: The leading underscore indicates this is an internal
 *   testing utility.
 */
import { setTimeout } from 'timers';

/**
 * Default timeout duration in milliseconds.
 * @type {number}
 */
const TIMEOUT_MS = 5000;

/**
 * Wraps a promise with a timeout.
 * If the provided promise does not resolve or reject within the
 * specified timeout period, the returned promise will reject with a
 * timeout error.
 *
 * @function withTimeout
 * @param {Promise<any>} promise The promise to wrap with a timeout.
 * @param {number} [timeoutMs=TIMEOUT_MS] The timeout duration in
 *   milliseconds. Defaults to `TIMEOUT_MS` (5000ms).
 * @returns {Promise<any>} A promise that either resolves/rejects with the
 *   original promise's result or rejects with a timeout error.
 * @throws {Error} If the operation times out.
 */
export function withTimeout(promise, timeoutMs = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}
