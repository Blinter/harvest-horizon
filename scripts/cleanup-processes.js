#!/usr/bin/env node
/**
 * @file Process cleanup utility script.
 * @module scripts/cleanup-processes
 *
 * This script is used to find and terminate processes that are running on
 * specific ports (e.g., 3000 and 5173). It helps to clean up processes
 * that might be preventing server startup due to port conflicts.
 *
 * The script is designed to work cross-platform, executing different
 * commands for Windows versus Unix-based systems (macOS/Linux). It
 * identifies processes by their listening port number and forcefully
 * terminates them using their Process ID (PID).
 */

import { execSync } from 'child_process';
import colors from 'colors'; // Using colors for better output visibility

/**
 * Ports to check and clean up during the script's execution.
 * @type {number[]}
 */
const ports = [3000, 5173]; // Backend and Frontend default ports

/**
 * Finds process IDs (PIDs) listening on a specific port on Windows.
 *
 * It executes `netstat -ano` and filters the output to find lines
 * indicating a process in the 'LISTENING' state for the target port.
 * It then extracts the PID from the matching lines.
 *
 * @param {number} port - The network port number to check.
 * @returns {number[]} An array of PIDs found listening on the specified port.
 *   Returns an empty array if no processes are found or if an error occurs
 *   during command execution (errors are logged internally).
 */
function findPidsWindows(port) {
  const command = `netstat -ano | findstr ":${port}"`;
  const output = execSync(command).toString();
  const lines = output.trim().split('\n');
  const pids = [];
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
  return pids;
}

/**
 * Finds process IDs (PIDs) listening on a specific port on Unix-like
 * systems (Linux, macOS).
 *
 * It executes `lsof -t -i:<port>` which directly returns the PIDs of
 * processes using the specified network port.
 *
 * @param {number} port - The network port number to check.
 * @returns {number[]} An array of PIDs found listening on the specified port.
 *   Returns an empty array if no processes are found or if an error occurs.
 */
function findPidsUnix(port) {
  const command = `lsof -t -i:${port}`;
  const output = execSync(command).toString();
  return output
    .trim()
    .split('\n')
    .map((pid) => parseInt(pid, 10))
    .filter((pid) => !isNaN(pid) && pid > 0);
}

/**
 * Attempts to forcefully terminate a process identified by its PID.
 *
 * Selects the appropriate command based on the operating system:
 * - Windows: `taskkill /PID <pid> /F`
 * - Unix-like: `kill -9 <pid>`
 * Logs success or failure messages to the console.
 *
 * @param {number} pid - The process ID (PID) to terminate.
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

/**
 * Handles errors encountered while searching for processes on a specific port.
 *
 * Distinguishes between errors indicating no process was found (which are
 * logged as informational messages) and genuine errors during command
 * execution (which are logged as errors, including stderr if available).
 *
 * @param {Error} error - The error object caught during the process search.
 * @param {number} port - The port being checked when the error occurred.
 */
function handleFindError(error, port) {
  // Common conditions indicating no process was found (not a true error)
  const noProcessFound =
    (error.stdout && error.stdout.toString().trim() === '') ||
    (error.stderr &&
      (error.stderr.toString().includes('No such file or directory') || // lsof error
        error.stderr.toString().includes('exit status 1'))) || // lsof error
    (process.platform === 'win32' && error.message.includes('findstr')); // findstr error

  if (noProcessFound) {
    console.info(
      colors.green(`No active processes found listening on port ${port}.`)
    );
  } else {
    console.error(
      colors.red(`Error finding processes on port ${port}:`),
      error.message.split('\n')[0]
    );
    if (error.stderr) {
      console.error(colors.grey('Stderr:'), error.stderr.toString().trim());
    }
  }
}

// --- Main Script Logic ---

console.info(
  colors.cyan('Attempting to clean up processes on ports:'),
  ports.join(', ')
);

ports.forEach((port) => {
  /**
   * Holds the PIDs found for the current port being checked.
   * @type {number[]}
   */
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
      return; // Skip to next port
    }

    console.info(colors.yellow(`Found PIDs on port ${port}:`), pids.join(', '));

    pids.forEach(killPid); // Use the extracted kill function
  } catch (findError) {
    handleFindError(findError, port); // Use the extracted error handler
  }
});

console.info(colors.cyan('\nCleanup process finished.'));
