/**
 * @fileoverview Prevents duplicate server instances using a lock file.
 *
 * This module implements a lock file mechanism to ensure that only one
 * instance of the Express server is running at a time. This is particularly
 * useful when using tools like nodemon that might trigger multiple restarts.
 * It also includes functionality to check for and terminate existing server
 * processes on the designated port.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeKillNodeProcesses } from './server.js';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lockFilePath = path.join(__dirname, '.express-server.lock');

/**
 * Attempts to acquire a lock file to signal that this server instance is
 * the active one. Checks for existing or stale lock files.
 *
 * @returns {Promise<boolean>} Resolves to true if the lock was
 *   successfully acquired, false otherwise (e.g., another instance is
 *   likely running or an error occurred).
 */
export async function acquireServerLock() {
  try {
    // Check if lock file exists and is recent (less than 5 seconds old)
    if (fs.existsSync(lockFilePath)) {
      const stats = fs.statSync(lockFilePath);
      const fileAgeSeconds = (Date.now() - stats.mtimeMs) / 1000;

      // If lock file is recent, another instance is likely starting
      if (fileAgeSeconds < 5) {
        console.warn(
          'Another server instance appears to be starting. Checking port...'
        );
        return false;
      }

      // Lock file exists but is old (stale), remove it
      fs.unlinkSync(lockFilePath);
      console.info('Removed stale lock file');
    }

    // Create lock file with current timestamp
    fs.writeFileSync(lockFilePath, Date.now().toString());

    // Set up cleanup of lock file on exit
    setupLockFileCleanup();

    return true;
  } catch (err) {
    console.error('Error managing server lock:', err);
    return false;
  }
}

/**
 * Sets up event listeners to ensure the lock file is removed when the
 * process exits. This covers various scenarios like normal exit, signals,
 * or uncaught exceptions.
 */
function setupLockFileCleanup() {
  const cleanupLockFile = () => {
    try {
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
    } catch (err) {
      console.error('Error cleaning up lock file:', err);
    }
  };

  // Clean up on various termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT', 'exit', 'uncaughtException'].forEach(
    (signal) => {
      process.on(signal, cleanupLockFile);
    }
  );
}

/**
 * Checks if the specified port is currently in use by another Node.js
 * process. If a process is found, it attempts to terminate it safely,
 * ensuring it's not related to development environments (like any Node-based
 * IDE).
 *
 * @param {number} [port=3000] The port number to check. Defaults to 3000.
 * @returns {Promise<boolean>} Resolves to true if the port is clear or was
 *   successfully cleared. Resolves to false if an error occurred during
 *   the check or termination process.
 */
export async function ensureNoOtherServerOnPort(port = 3000) {
  console.info(
    `Checking if port ${port} is already in use by another server instance...`
  );
  try {
    // Attempt to safely kill any non-IDE Node processes on port 3000
    const result = await safeKillNodeProcesses(port);
    console.debug(result);

    // Wait briefly to ensure port is released
    await new Promise((resolve) => setTimeout(resolve, 500));

    return true;
  } catch (err) {
    console.error('Error checking for other servers:', err);
    return false;
  }
}
