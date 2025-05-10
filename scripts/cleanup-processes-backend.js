#!/usr/bin/env node
/**
 * @file Process cleanup utility script for the backend.
 * @module scripts/cleanup-processes-backend
 *
 * This script is used to find and terminate processes that are running on
 * the backend port (3000). It helps to clean up processes that might
 * be preventing server startup due to port conflicts.
 *
 * The script works cross-platform, with different commands for Windows and
 * Unix-based systems (macOS/Linux). It identifies processes by port number
 * and forcefully terminates them.
 */

import { execSync } from 'child_process';
import colors from 'colors'; // Using colors for better output visibility

/**
 * Backend port to check and clean up.
 * @type {number}
 */
const backendPort = 3000;

/**
 * Finds process IDs (PIDs) listening on a specific port on Windows.
 *
 * @param {number} port - The port number.
 * @returns {number[]} An array of PIDs found listening on the specified port.
 *   Returns an empty array if no processes are found or if an expected error
 *   (like 'findstr' finding no matches) occurs.
 * @throws {Error} Rethrows any unexpected errors encountered during command
 *   execution.
 */
function findPidsWindows(port) {
  const command = `netstat -ano | findstr ":${port}"`;
  let pids = [];
  try {
    const output = execSync(command).toString();
    const lines = output.trim().split('\n');
    lines.forEach((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 0) {
        const potentialPid = parts[parts.length - 1];
        // Ensure the line is relevant (LISTENING state, correct port)
        // and PID is valid
        if (
          line.includes(`:${port}`) &&
          line.toUpperCase().includes('LISTENING') && // Be more specific
          /\d+/.test(potentialPid)
        ) {
          const pid = parseInt(potentialPid, 10);
          if (!isNaN(pid) && pid > 0 && !pids.includes(pid)) {
            pids.push(pid);
          }
        }
      }
    });
  } catch (error) {
    // findstr exits with error if no match is found. This is expected.
    if (error.message.includes('findstr')) {
      // Handled in the main logic as a non-error case.
      return [];
    } else {
      // Rethrow unexpected errors
      throw error;
    }
  }
  return pids;
}

/**
 * Finds process IDs (PIDs) listening on a specific port on Unix-like
 * systems (Linux/macOS).
 *
 * @param {number} port - The port number.
 * @returns {number[]} An array of PIDs found listening on the specified port.
 *   Returns an empty array if no processes are found or if an expected error
 *   (like 'lsof' finding no processes) occurs.
 * @throws {Error} Rethrows any unexpected errors encountered during command
 *   execution.
 */
function findPidsUnix(port) {
  const command = `lsof -t -i:${port}`;
  try {
    const output = execSync(command).toString();
    return output
      .trim()
      .split('\n')
      .map((pid) => parseInt(pid, 10))
      .filter((pid) => !isNaN(pid) && pid > 0);
  } catch (error) {
    // lsof errors if no process is found. This is expected.
    if (
      (error.stdout && error.stdout.toString().trim() === '') ||
      (error.stderr &&
        (error.stderr.toString().includes('No such file or directory') ||
          error.stderr.toString().includes('exit status 1')))
    ) {
      // Handled in the main logic as a non-error case.
      return [];
    } else {
      // Rethrow unexpected errors
      throw error;
    }
  }
}

/**
 * Attempts to forcefully terminate a process by its PID. Logs success or
 * failure to the console.
 *
 * @param {number} pid - The process ID to terminate.
 */
function killPid(pid) {
  let command;
  try {
    console.info(
      colors.magenta(`Attempting to kill process with PID ${pid}...`)
    );
    if (process.platform === 'win32') {
      command = `taskkill /PID ${pid} /F`;
    } else {
      command = `kill -9 ${pid}`;
    }
    execSync(command);
    console.info(colors.green(`Successfully killed process with PID ${pid}.`));
  } catch (killError) {
    console.error(
      colors.red(`Failed to kill process with PID ${pid}:`),
      killError.message.split('\n')[0]
    );
    if (killError.stderr) {
      console.error(colors.grey('Stderr:'), killError.stderr.toString().trim());
    }
  }
}

// --- Main Script Logic ---

console.info(
  colors.cyan('Attempting to clean up backend process on port:'),
  backendPort
);

/**
 * Cleans up processes on a specific port.
 *
 * @param {number} port The port number to check and clean up.
 */
(function cleanupPort(port) {
  /** @type {number[]} */
  let pids = [];

  try {
    console.info(colors.yellow(`\nChecking for processes on port ${port}...`));

    if (process.platform === 'win32') {
      pids = findPidsWindows(port);
    } else {
      // Linux/macOS
      pids = findPidsUnix(port);
    }

    if (pids.length === 0) {
      console.info(colors.green(`No processes found on port ${port}.`));
      return; // Done for this port
    }

    console.info(colors.yellow(`Found PIDs on port ${port}:`), pids.join(', '));

    pids.forEach(killPid); // Use the extracted kill function
  } catch (findError) {
    // Catch unexpected errors during the find process
    console.error(
      colors.red(`Error finding processes on port ${port}:`),
      findError.message.split('\n')[0]
    );
    if (findError.stderr) {
      console.error(colors.grey('Stderr:'), findError.stderr.toString().trim());
    }
  }
})(backendPort);

console.info(colors.cyan('\nBackend cleanup process finished.'));
