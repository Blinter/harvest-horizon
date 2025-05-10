/**
 * @file Provides server directory and file path constants.
 * @module server/serverPath
 * @description This utility addresses the absence of `__dirname` and
 *   `__filename` in ES modules by exporting equivalent constants derived
 *   using the `path` module. It ensures consistent access to the server's root
 *   directory and the main server file path throughout the application.
 */

import path from 'path';

/**
 * Absolute path to the server directory.
 *
 * Used as an equivalent for `__dirname` in CommonJS.
 * @type {string}
 */
const __dirname = path.join(path.resolve(), 'server');

/**
 * Absolute path to the main server entry file (`server.js`).
 *
 * Used as an equivalent for `__filename` in CommonJS.
 * @type {string}
 */
const __filename = path.join(__dirname, 'server.js');

export { __filename, __dirname };
