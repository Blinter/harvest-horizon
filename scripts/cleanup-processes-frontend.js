#!/usr/bin/env node
/**
 * @file Process cleanup utility script for the frontend.
 * @module scripts/cleanup-processes-frontend
 *
 * This script finds and terminates processes running on the frontend port
 * (default 5173). It helps clean up lingering processes that might block
 * the Vite dev server from starting due to port conflicts ("address already
 * in use").
 *
 * The script operates cross-platform, using appropriate system commands for
 * Windows and Unix-based systems (macOS/Linux) to identify processes by
 * port number and forcefully terminate them.
 */

import { execSync } from 'child_process';
import colors from 'colors'; // Using colors for better output visibility

/**
 * Frontend port to check and clean up.
 *
 * @type {number}
 */
const frontendPort = 5173;

/**
 * Finds process IDs (PIDs) listening on a specific port on Windows using
 * `netstat` and `findstr`.
 *
 * @param {number} port The port number to check.
 * @returns {number[]} An array of PIDs found listening on the specified
 *   port. Returns an empty array if no processes are found or if an
 *   expected 'findstr' error occurs (no match).
 * @throws {Error} Rethrows unexpected errors during command execution.
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
 * systems (macOS/Linux) using `lsof`.
 *
 * @param {number} port The port number to check.
 * @returns {number[]} An array of PIDs found listening on the specified
 *   port. Returns an empty array if no processes are found or if an
 *   expected `lsof` error occurs (no process found).
 * @throws {Error} Rethrows unexpected errors during command execution.
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
 * Attempts to terminate a process forcefully using its PID. Uses
 * `taskkill` on Windows and `kill -9` on Unix-like systems. Logs success
 * or failure messages.
 *
 * @param {number} pid The process ID to terminate.
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
  colors.cyan('Attempting to clean up frontend process on port:'),
  frontendPort,
);

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
      colors.red(`Error finding processes on port ${port}: `) +
      findError.message.split('\n')[0],
    );
    if (findError.stderr) {
      console.error(colors.grey('Stderr:'), findError.stderr.toString().trim());
    }
  }
})(frontendPort);

console.info(colors.cyan('\nFrontend cleanup process finished.'));
