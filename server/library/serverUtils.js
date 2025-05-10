import http from 'http';

/**
 * Checks if a specific network port is currently in use on a given host.
 *
 * @param {number} port - The port number to check for availability.
 * @param {string} [host='0.0.0.0'] - The network host address to check
 *   against. Defaults to '0.0.0.0', meaning it checks if the port is in
 *   use on any available network interface.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the
 *   port is currently occupied and `false` otherwise. Logs a warning for
 *   errors other than 'EADDRINUSE'.
 */
export async function isPortInUse(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const server = http.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is definitely in use
      } else {
        // Other errors might occur (e.g., permission denied)
        // Treat these as port *not* usable, but maybe not strictly 'in use'
        console.warn(`Error checking port ${port}: ${err.message}`);
        resolve(false);
      }
    });

    server.once('listening', () => {
      // If we can listen, the port is free
      server.close(() => {
        resolve(false);
      });
    });

    try {
      server.listen(port, host);
    } catch (listenError) {
      // Catch synchronous errors during listen attempt (less common)
      console.warn(
        `Direct error listening on port ${port}: ${listenError.message}`
      );
      resolve(false); // Consider port not usable
    }
  });
}
