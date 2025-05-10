/**
 * @file Socket.IO heartbeat handler setup.
 * @module server/socket/handlers/heartbeat
 * @description Sets up heartbeat event listeners and a periodic check
 *   to detect and disconnect stale socket connections based on missed
 *   heartbeats.
 */

/** Timeout in milliseconds for heartbeat checks. */
const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
/** Interval in milliseconds for checking stale connections. */
const HEARTBEAT_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Checks a single socket for staleness and disconnects it if necessary.
 *
 * This function evaluates if a socket has exceeded the heartbeat timeout
 * threshold. If the time since the last recorded heartbeat is greater
 * than the specified timeout, the socket is disconnected. Warnings are
 * logged if the socket object lacks expected data or if disconnection
 * fails.
 *
 * @param {string} socketId - The ID of the socket being checked.
 * @param {object} socket - The socket instance.
 * @param {Date} now - The current timestamp used for comparison.
 * @param {number} timeoutMs - The maximum allowed inactivity period in
 *   milliseconds before disconnecting the socket.
 * @returns {boolean} True if the socket was disconnected due to
 *   staleness, false otherwise.
 */
const _checkAndDisconnectStaleSocket = (socketId, socket, now, timeoutMs) => {
  // Basic check for socket data integrity
  if (!socket?.data) {
    console.warn({
      timestamp: new Date().toISOString(),
      service: 'SocketHeartbeatCheck',
      message: 'Socket missing data object during heartbeat check.',
      context: { socketId },
    });
    return false; // Not disconnected
  }

  // Check time since last heartbeat
  if (socket.data.lastHeartbeat) {
    const timeSinceLastHeartbeat =
      now.getTime() - socket.data.lastHeartbeat.getTime();

    // Disconnect if heartbeat timeout exceeded
    if (timeSinceLastHeartbeat > timeoutMs) {
      console.warn({
        timestamp: new Date().toISOString(),
        service: 'SocketHeartbeatCheck',
        message: 'Stale socket connection. Disconnecting.',
        context: {
          socketId: socketId,
          lastHeartbeatMsAgo: timeSinceLastHeartbeat,
          timeoutMs: timeoutMs,
        },
      });
      try {
        socket.disconnect(true); // Force disconnection
        return true; // Disconnected
      } catch (disconnectError) {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'SocketHeartbeatCheck',
          message: 'Error disconnecting stale socket',
          context: { socketId, error: disconnectError.message },
        });
        return false; // Disconnect failed
      }
    }
    // Heartbeat is recent enough
    return false;
  } else {
    // If lastHeartbeat is missing after connection, log a warning
    console.warn({
      timestamp: new Date().toISOString(),
      service: 'SocketHeartbeatCheck',
      message: 'Socket missing lastHeartbeat time.',
      context: { socketId },
    });
    // Consider disconnecting these too, depending on strictness
    // socket.disconnect(true);
    return false; // Not disconnected
  }
};

/**
 * Configures heartbeat mechanisms for a Socket.IO server instance.
 *
 * Attaches connection listeners to initialize heartbeat tracking for each
 * new socket. Sets up a 'heartbeat' event listener on each socket to
 * update its last active time. Starts a periodic interval timer to invoke
 * `_checkAndDisconnectStaleSocket` for all connected sockets, removing
 * those that haven't sent a heartbeat within the configured timeout.
 * Also adds a `cleanupHeartbeat` method to the `io` instance to stop the
 * interval timer on server shutdown.
 *
 * @param {object} io - The Socket.IO server instance to configure.
 * @typedef {Object} SocketIOServer
 * @description The same server instance with heartbeat handlers and cleanup function attached.
 * @returns {SocketIOServer}
 */
export function setupHeartbeatHandlers(io) {
  console.debug({
    timestamp: new Date().toISOString(),
    service: 'SocketHeartbeat',
    message: 'Setting up Socket.IO heartbeat handlers',
  });

  io.on('connection', (socket) => {
    console.debug({
      timestamp: new Date().toISOString(),
      service: 'SocketHeartbeat',
      message: 'Setting up heartbeat listeners',
      context: { socketId: socket.id },
    });

    // Initialize heartbeat data on the socket
    socket.data.connectionTime = new Date();
    socket.data.lastHeartbeat = new Date();
    socket.data.heartbeatCount = 0;

    // Handler for client heartbeat messages
    socket.on('heartbeat', () => {
      socket.data.lastHeartbeat = new Date();
      socket.data.heartbeatCount++;

      // Optional: Log every Nth heartbeat for debugging
      if (socket.data.heartbeatCount % 10 === 0) {
        const uptime =
          (new Date().getTime() - socket.data.connectionTime.getTime()) / 1000;
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'SocketHeartbeat',
          message: 'Heartbeat received',
          context: {
            socketId: socket.id,
            heartbeatCount: socket.data.heartbeatCount,
            uptimeSeconds: uptime.toFixed(2),
          },
        });
      }

      // Acknowledge the heartbeat
      socket.emit('heartbeat:ack', {
        serverTime: new Date().toISOString(),
        uptime:
          (new Date().getTime() - socket.data.connectionTime.getTime()) / 1000,
      });
    });

    // Log disconnection with heartbeat stats
    socket.on('disconnect', (reason) => {
      const uptimeMs = socket.data.connectionTime
        ? new Date().getTime() - socket.data.connectionTime.getTime()
        : 0;
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'SocketHeartbeat',
        message: 'Socket disconnected',
        context: {
          socketId: socket.id,
          reason: reason,
          heartbeatCount: socket.data.heartbeatCount || 0,
          uptimeMs: uptimeMs,
        },
      });
    });
  });

  // Set up the interval to check for stale connections
  const heartbeatCheckInterval = setInterval(() => {
    try {
      const sockets = io?.sockets?.sockets; // Use optional chaining

      if (!sockets) {
        console.debug({
          timestamp: new Date().toISOString(),
          service: 'SocketHeartbeatCheck',
          message: 'No active sockets collection found during heartbeat check',
        });
        return;
      }

      // Check if sockets is iterable (it should be a Map)
      if (typeof sockets[Symbol.iterator] !== 'function') {
        console.warn({
          timestamp: new Date().toISOString(),
          service: 'SocketHeartbeatCheck',
          message: 'Sockets collection is not iterable during heartbeat check.',
          context: { socketsType: typeof sockets },
        });
        return;
      }

      const now = new Date();
      let staleConnections = 0;
      const initialSocketCount = sockets.size;

      // Iterate over connected sockets and check them
      for (const [socketId, socket] of sockets) {
        const disconnected = _checkAndDisconnectStaleSocket(
          socketId,
          socket,
          now,
          HEARTBEAT_TIMEOUT_MS
        );
        if (disconnected) {
          staleConnections++;
        }
      }

      // Log summary of the check
      // Note: sockets.size reflects the count *after* potential disconnections
      // in this loop
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'SocketHeartbeatCheck',
        message: 'Heartbeat check summary',
        context: {
          initialConnectionCount: initialSocketCount,
          staleRemoved: staleConnections,
          remainingConnections: sockets.size,
        },
      });
    } catch (error) {
      // Catch errors during the check itself
      console.error({
        timestamp: new Date().toISOString(),
        service: 'SocketHeartbeatCheck',
        message: `Error during socket heartbeat check: ${error.message}`,
        context: { error }, // Includes stack trace if available
      });
    }
  }, HEARTBEAT_CHECK_INTERVAL_MS);

  // Store interval ID on io instance for cleanup
  io._heartbeatInterval = heartbeatCheckInterval;

  /**
   * Cleans up the heartbeat check interval.
   *
   * Stops the periodic check for stale connections. This should be called
   * during the server shutdown process to prevent resource leaks. Logs a
   * message upon successful cleanup.
   */
  io.cleanupHeartbeat = () => {
    if (io._heartbeatInterval) {
      clearInterval(io._heartbeatInterval);
      io._heartbeatInterval = null; // Clear reference
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'SocketHeartbeat',
        message: 'Socket.IO heartbeat interval stopped',
      });
    }
  };

  return io;
}

export default setupHeartbeatHandlers;
