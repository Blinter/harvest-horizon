/**
 * @file map.js
 * @module map
 * @description Handles socket events related to map updates and game actions for connected clients. Ensures users receive initial map state and updates.
 *
 * SocketIOServer: The Socket.IO server instance type.
 * SocketIOSocket: The Socket.IO socket instance type.
 */

// mapTileProgress was imported but not used
// import { mapTileProgress } from '../library/gameData.js';
// Direct console calls are used instead of logger;
import Map from '../models/map.js';
import StatusLog from '../models/statusLog.js';
import { convertToObjectId } from '../database/dbMongo.js';
import {
  handlePlantCropBatch,
  handleHarvestCropBatch,
  handleSpeedGrowBatch,
  handleClearRubbleBatch,
  handleLeaseTileBatch,
  handlePayRentBatch
} from './mapHelpers.js';
/**
 * Sets up Socket.IO event handlers for map and game interactions. This
 * function is called once the main Socket.IO server is initialized and attaches
 * listeners for new client connections and their subsequent actions.
 *
 * @export
 * @param {SocketIOServer} io - The Socket.IO server instance used
 *   to manage connections and emit events globally or to specific rooms.
 */
function setupSocketIO(io) {
  /**
   * Handles new client connections after successful authentication via the
   * `authenticateSocket` middleware.
   *
   * - Retrieves user data attached to the socket (`socket.data.user`).
   * - Sets up a listener for the client to request initial map data based on a
   *   provided `mapId`.
   * - Fetches the corresponding map data from MongoDB using `Map.get`.
   * - Validates map data and associates the socket with the `characterId` and
   *   `mapId`.
   * - Emits the initial map tiles and nickname (`initialMapData`) to the
   *   requesting client.
   * - Sets up action-specific listeners (`setupActionListeners`) once the map
   *   is successfully loaded.
   * - Registers a listener for socket disconnection (`disconnect`) to log the
   *   event.
   *
   * @listens io#connection
   * @param {object} socket - The newly connected client socket instance, 
   *   pre-authenticated and containing user data.
   * @emits error If user data is missing, the requested map is not found, the
   *   map ID format is invalid, map data is incomplete (e.g., missing
   *   `characterId`), or a database error occurs during map retrieval.
   * @emits initialMapData Sends the tile data (`tiles`) and `mapNickname` for
   *   the character's map upon a successful `client:request_initial_map`
   *   event.
   */
  io.on('connection', async (socket) => {
    // --- Added Log: Handler Start ---
    console.info(
      `[${new Date().toISOString()}] [SocketMapHandler] ` +
      `Connection handler started for socket ID: ${socket.id}`
    );
    // --------------------------------

    const socketId = socket.id;
    const user = socket.data.user;

    // --- Debug Log 1: User Data --- //
    console.info(
      `[${new Date().toISOString()}] [SocketMapHandler] Socket ` +
      `${socketId}: Processing connection for user:`,
      user?.username
    );

    if (!user?.id || !user.username) {
      const timestamp = new Date().toISOString();
      console.error(
        `[${timestamp}] [ERROR]: Socket ${socketId} connected without ` +
        `authenticated user data.`
      );
      socket.disconnect(true);
      return;
    }

    const timestampConnected = new Date().toISOString();
    console.info(
      `[${timestampConnected}] [INFO]: Socket connected for user: ` +
      `${user.username} (ID: ${user.id}, Socket: ${socketId})`
    );

    // --- Listener for Client Requesting Initial Map --- //
    socket.on(
      'client:request_initial_map',
      async ({ mapId: requestedMapIdStr }) => {
        const timestampPrefix = `[${new Date().toISOString()}] ` +
          `[SocketMapHandler] [MapReq: ${requestedMapIdStr}] ` +
          `[Socket: ${socketId}]`;
        console.info(`${timestampPrefix} Received event.`);
        if (!requestedMapIdStr) {
          console.error(
            `${timestampPrefix} [ERROR] Received event without a mapId.`
          );
          socket.emit('error', {
            message: 'Map ID is required to load map data.',
          });
          return;
        }

        console.debug(`${timestampPrefix} Map ID format validated.`);

        let requestedMapId;
        try {
          requestedMapId = convertToObjectId(requestedMapIdStr);
        } catch (idError) {
          console.error(
            `${timestampPrefix} [ERROR] Invalid Map ID format received: ` +
            `${requestedMapIdStr}`,
            idError
          );
          socket.emit('error', { message: 'Invalid Map ID format.' });
          return;
        }

        let currentMap = null;
        let mapNickname;
        try {
          console.info(
            `${timestampPrefix} Attempting Map.get for mapId: ${requestedMapId}`
          );
          // Using Map.get which might handle population
          currentMap = await Map.get(requestedMapId);
          mapNickname = currentMap?.mapNickname || 'Unnamed Map';
          const mapResultString = currentMap
            ? `Found map ${currentMap._id} with NickName: ${currentMap.mapNickname}`
            : 'Not Found';
          console.info(`${timestampPrefix} Map.get result: ${mapResultString}`);

          if (!currentMap) {
            console.error(
              `${timestampPrefix} [ERROR]: No map found in MongoDB for ` +
              `requested ID: ${requestedMapId}`
            );
            socket.emit('error', {
              message: `Map data not found for ID: ${requestedMapIdStr}.`,
            });
            // Consider disconnecting if map is essential
            // no data here, so crash socket and allow retry
            socket.disconnect(true);
            return;
          }

          // console.info(
          //   `${timestampPrefix} Socket ${socketId}: Map found: ` +
          //   `${currentMap._id} NickName: ${currentMap.mapNickname}`
          // );
          // console.info(currentMap);
          // Associate map with socket
          socket.data.currentMapId = currentMap._id;
          console.info(
            `${timestampPrefix} Associated socket with map ${currentMap._id}`
          );

          // --- Associate Character ID from Map --- //
          console.debug(
            `${timestampPrefix} Attempting to get characterId from map.`
          );
          const characterIdFromMap = currentMap.characterId;
          console.debug(
            `${timestampPrefix} CharacterId from map: ${characterIdFromMap}`
          );

          if (!characterIdFromMap) {
            console.error(
              `${timestampPrefix} [ERROR] Map ${currentMap._id} ` +
              `does not have an associated characterId!`
            );
            socket.emit('error', {
              message:
                'Map data is incomplete (missing character association).',
            });
            // Potentially disconnect or handle differently
            return;
          }
          // Ensure it's an ObjectId if necessary, though Mongoose might handle 
          // this
          try {
            socket.data.characterId = convertToObjectId(characterIdFromMap);
            console.info(
              `${timestampPrefix} Associated socket with character ` +
              `${socket.data.characterId} from map ${currentMap._id}`
            );
          } catch (charIdError) {
            console.error(
              `${timestampPrefix} [ERROR] Failed to convert ` +
              `characterIdFromMap (${characterIdFromMap}) to ObjectId:`,
              charIdError
            );
            socket.emit('error', {
              message: 'Map data is invalid (invalid character association).',
            });
            return;
          }
          // -------------------------------------- //

          // --- Emit Initial Map Data --- //
          const tilesToSend = currentMap.tiles || {};
          const tileCount = Object.keys(tilesToSend).length;
          console.info(`${timestampPrefix} Emitting ${tileCount} tiles.`);

          // Create the payload with tiles and nickname
          const payload = {
            tiles: tilesToSend,
            mapNickname
          };

          socket.emit('initialMapData', payload);
          console.info(
            `${timestampPrefix} Emitted 'initialMapData' successfully.`
          );

          // --- Setup Other Socket Listeners AFTER Map is Loaded --- //
          setupActionListeners(io, socket, user);
          // -------------------------------------------------------- //
        } catch (mapLoadError) {
          console.error(
            `${timestampPrefix} [ERROR]: Failed to load map data for map ID ` +
            `${requestedMapIdStr} (User: ${user.username}, ` +
            `Socket: ${socketId}): ${mapLoadError.message}`
          );
          socket.emit('error', { message: 'Failed to load map data.' });
          // Consider disconnecting on critical load failure
          // socket.disconnect(true);
        }
      }
    );
    // --- End Listener for Initial Map Request --- //

    /**
     * Listener for socket disconnection. Logs the disconnection event along with
     * the reason. If a `characterId` was successfully associated with the
     * socket during the map loading process, it attempts to log a
     * 'disconnected' status entry in the `StatusLog` collection for that
     * character.
     *
     * @listens socket#disconnect
     * @param {string} reason - The reason provided by Socket.IO for the
     *   disconnection (e.g., 'client namespace disconnect',
     *   'server namespace disconnect', 'transport close').
     */
    socket.on('disconnect', async (reason) => {
      const timestamp = new Date().toISOString();
      console.info(
        `[${timestamp}] [INFO]: Socket disconnected: ${socketId} ` +
        `(Reason: ${reason})`
      );

      // Attempt to log disconnect ONLY if characterId was successfully associated during map load
      const associatedCharacterId = socket.data.characterId;
      const associatedMapId = socket.data.currentMapId;
      if (associatedCharacterId && associatedMapId) {
        console.info(
          `[${timestamp}] [INFO]: Logging disconnect for ` +
          `Character ${associatedCharacterId} from Map ${associatedMapId}`
        );
        try {
          await StatusLog.updateOne(
            { characterId: associatedCharacterId },
            {
              $push: {
                entries: {
                  statusType: 'disconnected',
                  timestamp: new Date(),
                  details: `User disconnected (Reason: ${reason}).`,
                },
              },
            }
          );
          console.info(
            `[${timestamp}] [INFO]: Added 'disconnected' ` +
            `log entry for character ${associatedCharacterId}`
          );
        } catch (logError) {
          console.error(
            `[${timestamp}] [ERROR]: Failed to add 'disconnected' ` +
            `log entry for character ${associatedCharacterId}: ${logError.message}`
          );
        }
      }
    });
  });
}

/**
 * Sets up socket event listeners for specific game actions after the initial
 * map data has been sent and the client is ready for interaction. This function
 * centralizes the registration of handlers for actions like planting,
 * harvesting, clearing rubble, etc.
 *
 * It uses a factory function (`createActionListener`) to streamline the
 * creation of listeners for common batch actions, delegating the core logic to
 * handler functions imported from `./mapHelpers.js`. It also sets up listeners
 * for requesting the full map state and acknowledging game start. Finally, it
 * joins the socket to a room identified by the `mapId` for targeted broadcasts.
 *
 * @param {object} io - The main Socket.IO server instance.
 * @param {object} socket - The specific client socket for which listeners are being set up. This socket should already have `currentMapId` and `characterId` attached to its `data` property.
 * @param {object} user - The authenticated user data associated with the
 *   socket, typically containing `id` and `username`.
 * @private
 */
function setupActionListeners(io, socket, user) {
  const socketId = socket.id;
  const mapIdForLog = socket.data.currentMapId?.toString() || 'UNKNOWN_MAP';

  // --- List of events this function sets up ---
  const actionEventsHandled = [
    'requestAllMapData',
    'client:clear_rubble',
    'client:plant_crop',
    'client:harvest_crop',
    'client:speed_grow',
    'client:lease_tile',
    'client:pay_rent',
    'game:start'
  ];

  // --- Remove any existing listeners for these events on this socket ---
  // This prevents MaxListenersExceededWarning if setupActionListeners is
  // called multiple times for the same socket (e.g., if client can request
  // a different map on the same connection, or reloads the map).
  actionEventsHandled.forEach(eventName => {
    const listenerCount = socket.listenerCount(eventName);
    if (listenerCount > 0) {
      // Keep for Debugging
      // console.debug(
      //   `[${new Date().toISOString()}] ` + 
      //   `[SocketMapHandler] ` +
      //   `Socket ${socketId} on map ${mapIdForLog}: ` +
      //   `Removing ${listenerCount} ` + 
      //   `existing listener(s) for '${eventName}' ` +
      //   `before re-attaching.`
      // );
      socket.removeAllListeners(eventName);
    }
  });

  console.info(
    `[${new Date().toISOString()}] [SocketMapHandler] ` +
    `Setting up action listeners for socket ${socketId} on map ${mapIdForLog}`
  );

  /**
   * Listener for a client explicitly requesting the full current map data.
   * Retrieves the `currentMapId` associated with the socket, fetches the
   * complete map data using `Map.get`, and emits the `tiles` object back to the
   * requesting client via the `allMapData` event. Handles cases where no map is
   * associated or the map fetch fails.
   *
   * @listens socket#requestAllMapData
   * @async
   * @emits allMapData Sends the complete tile data object (e.g., `map.tiles`)
   *   for the map currently associated with the socket.
   * @emits error If the socket does not have a `currentMapId` associated with
   *   it, or if there's an error fetching the map data from the database.
   */
  socket.on('requestAllMapData', async () => {
    const mapId = socket.data.currentMapId;
    const timestamp = new Date().toISOString();
    console.info(
      `[${timestamp}] [SocketMapHandler] Socket ${socketId}: ` +
      `Received 'requestAllMapData' for map ${mapId}`
    );
    try {
      if (!mapId) throw new Error('No map associated with this socket.');
      const map = await Map.get(mapId);
      if (!map) throw new Error(`Map not found in DB for ID: ${mapId}`);
      socket.emit('allMapData', map.tiles || {});
      console.info(
        `[${timestamp}] [SocketMapHandler] Socket ${socketId}: ` +
        `Emitted 'allMapData' successfully for map ${mapId}`
      );
    } catch (error) {
      console.error(
        `[${timestamp}] [SocketMapHandler] Socket ${socketId}: ` +
        `Failed to fetch map data for map ${mapId}: ${error.message}`
      );
      socket.emit('error', { message: 'Failed to fetch map data.' });
    }
  });

  /**
   * Generic listener factory for client-initiated game actions that are
   * processed in batches (e.g., applying an action to multiple tiles at once).
   * It creates a listener for a specific `client:<actionString>` event.
   *
   * When the event is received:
   * 1. Retrieves the `mapId` and `characterId` associated with the socket.
   * 2. Validates that both IDs are present.
   * 3. Prepares arguments for the corresponding `batchHandler` function.
   * 4. Conditionally adds the `socket` instance itself as an argument if the
   *    handler requires it (e.g., for actions involving currency checks or
   *    direct feedback).
   * 5. Calls the specified `batchHandler` with the prepared arguments.
   * 6. Catches and logs any errors during processing, emitting an 'error'
   *    event back to the client.
   *
   * @param {string} actionString - The specific action name (e.g.,
   *   'plant_crop', 'harvest_crop') used in the event name
   *   `client:<actionString>`.
   * @param {Function} batchHandler - The asynchronous function (imported from
   *   `./mapHelpers.js`) responsible for handling the logic of this specific
   *   batch action. It's expected to accept `io`, `mapId`, `characterId`,
   *   `actionData`, and optionally `socket` as arguments.
   * @listens socket#client:* Dynamically listens for events matching
   *   `client:<actionString>`.
   * @param {object} actionData - The data payload sent by the client for the
   *   action, typically including an array of `tiles` or other relevant
   *   parameters for the batch operation.
   * @async
   * @emits error If no map or character is associated with the socket, or if
   *   the `batchHandler` throws an error during execution. The error message is
   *   sent back to the client.
   */
  const createActionListener = (actionString, batchHandler) => {
    socket.on(`client:${actionString}`, async (actionData) => {
      const mapId = socket.data.currentMapId;
      const characterId = socket.data.characterId;
      const timestamp = new Date().toISOString();
      console.info(
        `[${timestamp}] [SocketMapHandler] Socket ${socket.id}: ` +
        `Received 'client:${actionString}' for map ${mapId}`, actionData);
      try {
        if (!mapId) throw new Error(
          'No map associated with this socket for action.'
        );
        if (!characterId) throw new Error(
          'No character associated with this socket for action.'
        );

        // Prepare arguments for the batch handler
        const args = [io, mapId, characterId, actionData];

        // Pass the socket itself specifically for handlers that need it
        if (
          batchHandler === handleSpeedGrowBatch ||
          batchHandler === handleLeaseTileBatch ||
          batchHandler === handlePayRentBatch
        ) {
          args.push(socket);
        }

        // Call the specific batch handler directly with potentially
        // extended args
        await batchHandler(...args);
      } catch (error) {
        console.error(
          `[${timestamp}] [ERROR]: Error processing action ` +
          `'client:${actionString}' ` +
          `for ${socket.id} (Map: ${mapId}): ${error.message}`,
          error // Log the full error object
        );
        socket.emit('error', {
          message: `Action '${actionString}' failed: ${error.message}`
        });
      }
    });
  };

  // Register listeners using the factory function
  createActionListener('clear_rubble', handleClearRubbleBatch);
  createActionListener('plant_crop', handlePlantCropBatch);
  createActionListener('harvest_crop', handleHarvestCropBatch);
  createActionListener('speed_grow', handleSpeedGrowBatch);
  createActionListener('lease_tile', handleLeaseTileBatch);
  createActionListener('pay_rent', handlePayRentBatch);

  /**
   * Listens for the 'game:start' event sent by the client, typically after
   * initial assets and data are loaded. Logs the reception of the event and
   * sends back a 'game:start-ack' event to acknowledge readiness on the server
   * side. Includes the associated `mapId` in the acknowledgment.
   *
   * @listens socket#game:start
   * @param {any} data - Optional data payload sent by the client with the
   *   'game:start' event. Currently logged but not used functionally.
   * @emits game:start-ack Sends an acknowledgment object containing a
   *   timestamp, success status, and the `mapId` associated with the socket
   *   back to the client that emitted 'game:start'.
   */
  socket.on('game:start', (data) => {
    const timestamp = new Date().toISOString();
    const mapId = socket.data.currentMapId;
    console.info(
      `[${timestamp}] [INFO]: 'game:start' event received by client ` +
      `${socketId} (User: ${user?.username}, Map: ${mapId}): ` +
      `${JSON.stringify(data)}`
    );
    // Acknowledge the start, maybe include mapId if useful
    socket.emit('game:start-ack', {
      timestamp: Date.now(),
      status: 'success',
      mapId: mapId?.toString(), // Send back the mapId it's associated with
    });
  });

  // --- Join Map Room --- //
  const mapIdStr = socket.data.currentMapId?.toString();
  if (mapIdStr) {
    socket.join(mapIdStr);

    console.info(
      `[${new Date().toISOString()}] [SocketMapHandler] ` +
      `Socket ${socketId} joined room ${mapIdStr}`
    );
  }
  // ------------------- //
}

export default setupSocketIO;
