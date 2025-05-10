/**
 * @file server.js
 * @module server/server
 * @description Main server file that initializes Express, Socket.IO, and routes. Sets up the Express application, configures middleware, establishes database connections, initializes Socket.IO, handles environments, and provides functions for server lifecycle.
 */

import http from 'http';
import { Server } from 'socket.io';
import {
  connect as connectPostgres,
  end as endPostgres,
} from './database/dbPostgres.js';
import app from './app.js';

import setupSocketIO from './sockets/map.js';
import { setupHeartbeatHandlers } from './socket/handlers/heartbeat.js';
import { authenticateSocket } from './middleware/auth.js';
import {
  connectDb as connectMongoDb,
  endDb as endMongoDb,
} from './database/dbMongo.js';
import { isPortInUse } from './library/serverUtils.js';
// Import config constants
import { PORT, CORS_ORIGIN } from './constants/config.js';
import colors from 'colors';
import { execSync } from 'child_process';

/**
 * HTTP server instance.
 * http.Server instance
 *
 * @type {object}
 */
let server;

/**
 * Socket.IO server instance.
 * socket.io.Server instance
 *
 * @type {object}
 */
let io;

/**
 * Starts the server and establishes database connections.
 *
 * Handles checking for port availability, database connections,
 * and setting up the HTTP and Socket.IO servers.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the server has started.
 */
export async function startServer() {
  try {
    // Check if this process is likely being managed by a tool like nodemon
    // (process.send is typically available in child processes)
    const isRestart = process.send !== undefined;

    if (isRestart) {
      console.info(
        'Detected server restart (likely via nodemon). ' +
        'Ensuring clean environment...'
      );
      // Wait a moment before starting to ensure previous instance is fully
      // cleaned up
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Before starting, check if port 3000 is in use and safely clear it if
    // needed
    if (await isPortInUse(PORT)) {
      console.warn(`Port ${PORT} is in use. Attempting to safely clear it...`);
      try {
        // Run the cleanup script synchronously
        console.info('Executing "npm run cleanup:backend"...');
        execSync('npm run cleanup:backend', { stdio: 'inherit' });
        console.info('Cleanup script finished.');

        // Wait a moment for the port to be fully released after cleanup
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Optional: Check again if the port is still in use after cleanup
        if (await isPortInUse(PORT)) {
          console.error(
            `Port ${PORT} is still in use after cleanup attempt. Exiting.`
          );
          process.exit(1); // Exit if cleanup failed
        }
      } catch (err) {
        console.error(
          `Error executing cleanup script for port ${PORT}: ${err.message}`,
          err // Log the full error object
        );
        console.error('Cannot start server. Exiting.');
        process.exit(1); // Exit if cleanup script fails
      }
    }

    // Connect to databases first
    await connectMongoDb();
    await connectPostgres();
  } catch (error) {
    console.error('Failed to connect to Database(s):', error);
    process.exit(1);
  }

  // Create HTTP server using the imported app
  server = http.createServer(app);

  // Initialize Socket.IO
  io = new Server(server, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },

    transports: ['websocket', 'polling'],

    pingTimeout: 30000,
    pingInterval: 25000,

    connectTimeout: 10000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8,
    path: '/socket.io/',

    serveClient: true,
  });

  if (process.env.NODE_ENV === 'development') {
    console.info('Socket.IO in development mode, verbose logging enabled');
    console.info('Socket.IO CORS configuration:', CORS_ORIGIN);
  }

  // Apply Socket.IO Middleware
  io.use(authenticateSocket);

  // Setup Event Handlers (after auth middleware)
  setupSocketIO(io);
  setupHeartbeatHandlers(io);

  server
    .listen(PORT, '0.0.0.0', () => {
      console.info(
        colors.cyan(
          `[${new Date().toISOString()}] [Server] Server listening on`,
          colors.bold.yellow(`http://0.0.0.0:${PORT}`),
          colors.cyan('Process PID:'),
          colors.bold.magenta(process.pid)
        )
      );
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `Port ${PORT} is already in use. Please run 'npm run cleanup' ` +
          `to free the port or use a different port.`
        );
        process.exit(1);
      } else {
        console.error('Server startup error:', err);
        process.exit(1);
      }
    });
}

/**
 * Gracefully shuts down the server and closes all connections.
 *
 * Closes Socket.IO connections, HTTP server, and database connections
 * in the correct order to ensure proper cleanup.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the server has been
 * shut down.
 */
export async function endServer() {
  console.info('Shutting down server...');

  if (io && typeof io.cleanupHeartbeat === 'function') {
    io.cleanupHeartbeat();
  }

  let ioClosePromise = Promise.resolve();
  if (io) {
    console.info('Closing Socket.IO server...');
    ioClosePromise = new Promise((resolve) => {
      io.close(() => resolve());
    });
  }

  let serverClosePromise = Promise.resolve();
  if (server) {
    console.info('Closing HTTP server...');
    serverClosePromise = new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  try {
    await ioClosePromise;
    console.info('Socket.IO server closed.');
  } catch (err) {
    console.error('Failed closing socket server.', err.message);
    // Decide if you want to throw err here or continue shutdown
    // throw err; // Uncomment if this failure should stop the entire shutdown
  }

  try {
    await serverClosePromise;
    console.info('HTTP server closed.');
  } catch (err) {
    console.error('Failed closing HTTP server.', err.message);
    throw err;
  }

  try {
    await endPostgres();
    console.info('PostgreSQL connection closed.');
  } catch (err) {
    console.error('Failed closing postgresql connection.', err.message);
    throw err;
  }

  try {
    await endMongoDb();
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
    // Decide if you want to throw err here or continue shutdown
    // throw err;
  }

  console.info('Server shutdown sequence complete.');
}

// Start server immediately if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.info('Starting server from server.js...');
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
