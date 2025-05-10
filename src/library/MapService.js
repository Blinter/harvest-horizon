/**
 * @file MapService.js
 * @module MapService
 * @description Service for managing map data and WebSocket communication for
 *   tile-based maps. Handles WebSocket connection, map data storage, and tile
 *   updates. Integrates with a scene for UI rendering and uses a key-value
 *   store for tile data with coordinates as keys (e.g., "x,y").
 */

import { io } from 'socket.io-client';
// Direct console calls are used instead of componentLog;
import { handleError } from '../utils/errorHandler.js';
import { EventBus } from '../game/EventBus'; // Import EventBus
import {
  isPlantable,
  canLeaseTile,
  canClearRubbleTile,
  canPayRentTile,
  isActionAllowed,
  isBase,
} from './gameData.js';

import {
  canSpeedGrowTile,
  canHarvestTile,
} from './cropUtils.js';

const HEARTBEAT_INTERVAL_MS = 10 * 1000; // Send heartbeat every 10 seconds

/**
 * Service for managing map data via WebSocket communication.
 *
 * Connects to a WebSocket server, handles map data synchronization, tile
 * updates, and provides methods to access map information. It assumes the map
 * data is represented as a collection of tiles keyed by their coordinates
 * (e.g., "x,y"). Includes basic error handling and logging.
 *
 * @class MapService
 */
class MapService {
  /**
   * Creates an instance of MapService.
   *
   * Initializes the WebSocket connection using `socket.io-client` and
   * configures custom error handling. Sets up event listeners for map data
   * and tile updates.
   *
   * @param {object} config - Configuration object.
   * @param {string} [config.baseUrl=''] - The base URL for the WebSocket
   *   server.
   * @param {Phaser.Scene} config.scene - The Phaser scene instance associated
   *   with this service, used for emitting events.
   */
  constructor({ baseUrl = '', scene }) {
    this.instanceId = Math.random().toString(36).substring(1, 10);
    this.baseUrl = baseUrl;
    this.scene = scene;
    this.mapData = {};
    this.maxCoord = { x: 0, y: 0 }; // Tracks highest coords seen
    this.mapWidth = 0; // Calculated width
    this.mapHeight = 0; // Calculated height
    this.defaultCenter = { x: 0, y: 0 };
    this.heartbeatInterval = null; // Store heartbeat interval ID
    this.mapNickname = 'Loading...'; // Store map nickname
    // Actionable bounds (for InputHandler clamping and default center)
    this.minActionableCoord = { x: Infinity, y: Infinity };
    this.maxActionableCoord = { x: -Infinity, y: -Infinity };

    // --- Retrieve Auth Token --- //
    const token = localStorage.getItem('harvestHorizonToken');
    if (!token) {
      console.warn(
        `[MapSocket] Authentication token not found in localStorage. ` +
        `Proceeding without auth.`
      );
    }
    // --- End Token Retrieval --- //

    try {
      // --- Initialize Socket with Auth --- //
      const socketOptions = {
        reconnectionAttempts: 5,
        reconnectionDelay: 4000,
        timeout: 20000,
        // Include the token in the auth option
        auth: {
          token: token || undefined, // Send token if available
        },
      };

      this.socket = io(this.baseUrl, socketOptions);

      // --- Inlined createSafeSocket logic --- //
      if (!this.socket) {
        // Handle case where io() might fail unexpectedly, though unlikely
        throw new Error('[MapSocket] Failed to initialize socket instance.');
      }
      this.socket.safeEmit = (event, data) => {
        if (this.socket.connected) {
          this.socket.emit(event, data);
          return true;
        }
        console.warn(
          `[MapSocket] Failed to emit ${event}: Socket not connected`
        );
        return false;
      };
      this.socket.isBackendAvailable = () =>
        this.socket.connected;
      // --- End Inlined createSafeSocket --- //

      // --- Inlined configureSocketErrorHandling logic --- //
      this.socket.on('connect', () => {
        try {
          // Leave for socket debugging
          // console.info('[MapSocket] Connected to the map server');
          if (this.scene) {
            this.scene.events.emit('mapSocketConnected');
          }
          this.startHeartbeat(); // Start heartbeat after connection
        } catch (err) {
          handleError(err, { context: 'MapService.socket.onConnect' });
        }
      });

      this.socket.on('disconnect', (reason) => {
        try {
          // Log intentional client disconnects at debug level, others as warnings
          if (reason === 'io client disconnect') {
            // Keep for debugging
            console.debug(
              `[MapSocket] Disconnected from map server: ${reason}`
            );
          } else {
            console.warn(`[MapSocket] Disconnected from map server: ${reason}`);
          }

          this.stopHeartbeat(); // Stop heartbeat on disconnect
          if (this.scene) {
            this.scene.events.emit('mapSocketDisconnected', reason);
          }
        } catch (err) {
          handleError(err, { context: 'MapService.socket.onDisconnect' });
        }
      });

      this.socket.on('error', (error) => {
        try {
          // Log the error message or stringify for details
          console.error(
            `[MapSocket] Socket error: ${error?.message}`,
            error
          );
          if (this.scene) {
            this.scene.events.emit('mapSocketError', error);
          }
        } catch (err) {
          handleError(err, { context: 'MapService.socket.onError' });
        }
      });

      this.socket.on('reconnect_failed', () => {
        try {
          console.error(
            '[MapSocket] Failed to reconnect to map server ' +
            'after multiple attempts'
          );
          if (this.scene) {
            this.scene.events.emit('mapSocketReconnectFailed');
          }
        } catch (err) {
          handleError(err, { context: 'MapService.socket.onReconnectFailed' });
        }
      });

      // connect_error is often handled separately by socket.io-client
      this.socket.on('connect_error', (err) => {
        try {
          console.error(`[MapSocket] Connection Error: ${err.message}`);
          if (this.scene) {
            this.scene.events.emit('mapSocketConnectError', err);
          }
        } catch (innerErr) {
          handleError(innerErr, {
            context: 'MapService.socket.onConnectError',
          });
        }
      });
      // --- End Inlined configureSocketErrorHandling --- //

      this.setupSocketHandlers();

      // --- Add listener for scene-level actionability changes ---
      if (this.scene?.events) {
        this.scene.events.on(
          'scene:tileActionabilityChanged',
          this._recalculateActionableBounds,
          this // Ensure correct context
        );
      } else {
        console.warn(
          '[MapService] Scene events not available, cannot listen for ' +
          'scene:tileActionabilityChanged.'
        );
      }

      // --- Add listener for tile selection requests from UI elements ---
      // Store the bound listener function to ensure correct removal
      this.selectTilesRequestListener = (keys) =>
        this._handleSelectTilesRequest(keys);
      EventBus.on(
        'request-select-tiles',
        this.selectTilesRequestListener // Use the bound listener
      );

    } catch (err) {
      handleError(err, {
        context: 'MapService.constructor',
        onError: (error) => {
          console.error(
            `[MapSocket] Error initializing map service: ${error.message}`
          );
          if (this.scene) {
            this.scene.events.emit('mapServiceInitError', error);
          }
        },
      });
    }
  }

  /**
   * High performance method to strip the coordinates from the tiles array for
   * the payload.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects.
   * @returns {Array<{x: number, y: number}>} Array of tile coordinate objects,
   *   potentially modified.
   */
  stripForPayload(tiles) {
    const strippedTiles = [];
    for (const tile of tiles) {
      strippedTiles.push({ x: tile.x, y: tile.y });
    }
    return strippedTiles;
  }

  /**
   * Sets up the core WebSocket event handlers for 'initialMapData' and
   * 'tileUpdate'.
   *
   * Includes error handling wrappers for safe processing of received data.
   */
  setupSocketHandlers() {
    // Listen for the initial bulk map data
    this.socket.on('initialMapData', payload => {
      try {
        // Debugging: Initial Map Data
        // console.debug(
        //   `[MapSocket] Received initialMapData event. ` + 
        //   `Map (Tiles) Object Length:`,
        //   Object.keys(payload.tiles).length,
        //   payload.tiles
        // );

        // Process the entire payload
        if (!payload ||
          typeof payload !== 'object' ||
          payload === null ||
          !Object.hasOwn(payload, 'mapNickname') ||
          !Object.hasOwn(payload, 'tiles') ||
          payload.tiles.length === 0 ||
          payload.mapNickname === null
        ) {
          console.error(
            `[MapService] Received an invalid initialMapData payload:`,
            payload
          );
        }

        this.mapNickname = payload.mapNickname;
        this.updateMapData(payload.tiles);

        // Emit a scene event AFTER processing, using the correct name and full 
        // payload
        if (this.scene?.events) {
          this.scene.events.emit('initialMapData', payload);
        } else {
          console.warn(
            `[MapService] Cannot emit initialMapData: Scene or scene events ` +
            `missing.`
          );
        }
      } catch (err) {
        handleError(err, { context: 'MapService.initialMapData' });
      }
    });

    // Socket hook on client for tile updates
    // Client libraries listen on tileUpdate then call tileUpdated
    // After data has been processed.
    // Socket listens on tileUpdate but EventBus listens on tileUpdated.
    this.socket.on('tileUpdate', data => {
      try {
        this.updateTile(data);
        // Emit scene event with the same payload structure
        if (this.scene?.events) {
          this.scene.events.emit('tileUpdated', data);
        } else {
          console.warn(
            `[MapService] Cannot emit tileUpdated: Scene or ` +
            `scene events missing.`
          );
        }
      } catch (err) {
        handleError(err, { context: 'MapService.tileUpdate' });
      }
    });

    // Listen for heartbeat acknowledgements
    this.socket.on('heartbeat:ack', (_ackData) => {
      // Optional: Use ackData.serverTime or ackData.uptime if needed
    });

    this.socket.on('server:walletUpdate', (data) => {
      try {
        if (this.scene?.mapId !== data?.mapIdStr) {
          console.warn(
            `[MapService] Received server:walletUpdate` +
            ` for map ${data?.mapIdStr} ` +
            `but this MapService is managing map ` +
            `${this.scene?.mapId}. ` +
            `Ignoring update.`
          );
        }

        const coins = data?.coins;
        if (typeof coins === 'number') {
          // Debugging: Wallet Update
          // console.debug(`[MapSocket] Received server:walletUpdate:`, data);
          // Emit a scene event that the React UI can listen for
          if (EventBus) {
            EventBus.emit('playerWalletUpdated', {
              coins,
              mapId: this.scene?.mapId,
              characterId: this.scene?.characterId,
            });
          } else {
            console.warn(
              `[MapService] Cannot emit playerWalletUpdated: Scene or ` +
              `scene events missing.`
            );
          }
        } else {
          console.warn(
            `[MapSocket] Received invalid server:walletUpdate payload:`,
            data
          );
        }
      } catch (err) {
        handleError(err, { context: 'MapService.server:walletUpdate' });
      }
    });

    // --- Listener for Server-Reported Action Failures ---
    this.socket.on('server:action_failed', (data) => {
      try {
        const { action, reason, context } = data || {};
        if (action && reason) {
          // Keep for debugging
          // console.warn(
          //   `[MapSocket] Server reported action failure: ` +
          //   `Action='${action}', ` +
          //   `Reason='${reason}', ` +
          //   `Context='${JSON.stringify(context)}'`
          // );
          // Emit to the global EventBus for UI components
          EventBus.emit('ACTION_FAILED_EVENT', { action, reason, context });
        } else {
          console.error(
            `[MapSocket] Received invalid server:action_failed payload:`,
            data
          );
        }
      } catch (err) {
        handleError(err, { context: 'MapService.serverActionFailed' });
      }
    });
    // --- End Listener ---
  }

  /**
   * Requests the initial map data from the server for the current scene's map.
   *
   * Emits a 'client:request_initial_map' event to the WebSocket server with the
   * map ID. Checks for scene/mapId availability and socket connection status
   * before emitting.
   *
   * @returns {boolean | undefined} Returns `false` if the request cannot be
   *   sent (missing scene/mapId or disconnected socket), otherwise returns
   *   `undefined` after attempting to emit.
   */
  requestMapData() {
    try {
      if (!this.scene?.mapId) {
        console.warn(
          'Cannot request map data - scene or scene.mapId is missing'
        );
        return false;
      }
      if (!this.socket?.isBackendAvailable()) {
        console.warn('Cannot request map data - socket not available');
        return false;
      }

      // Align event name and payload with server expectations
      this.socket.safeEmit('client:request_initial_map', {
        mapId: this.scene.mapId,
      });
    } catch (err) {
      handleError(err, { context: 'MapService.requestMapData' });
    }
  }

  /**
   * Updates the local map data cache with incoming bulk tile data.
   *
   * Processes an object where keys are coordinate strings ("x,y") and values
   * are tile data objects. Updates the `mapData` store, tracks the maximum
   * coordinates seen (`maxCoord`), recalculates map dimensions (`mapWidth`,
   * `mapHeight`), determines actionable/base tile boundaries, and sets the
   * `defaultCenter`.
   *
   * @param {object<string, object>} data - An object containing tile data keyed
   *   by coordinate strings (e.g., `{"0,0": {tileType: 'grass'}, ...}`).
   * @returns {void}
   */
  updateMapData(data) {
    if (!data) {
      return;
    }

    try {
      // Track overall max coordinates for map dimensions
      let maxX = -Infinity;
      let maxY = -Infinity;

      // Initialize bounds tracking state
      let boundsState = {
        minActionableX: Infinity,
        maxActionableX: -Infinity,
        minActionableY: Infinity,
        maxActionableY: -Infinity,
        actionableTileFound: false,
        minBaseX: Infinity,
        maxBaseX: -Infinity,
        minBaseY: Infinity,
        maxBaseY: -Infinity,
        baseTileFound: false,
      };

      // Iterate over the KEYS (coordinate strings) of the data object
      Object.keys(data).forEach((coordString) => {
        const tile = data[coordString]; // Get the tile data

        // Parse x, y from the coordString key
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // Basic validation for parsed coordinates and tile data
        if (isNaN(x) || isNaN(y) || !tile) {
          return; // Skip this invalid entry
        }

        const key = `${x},${y}`; // Use parsed x, y for mapData key
        this.mapData[key] = tile;

        // Update overall max coordinates
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        // Update actionable and base bounds separately
        boundsState = this._updateSingleBoundType(
          tile.properties,
          x,
          y,
          boundsState,
          isActionAllowed,
          'Actionable'
        );
        boundsState = this._updateSingleBoundType(
          tile.properties,
          x,
          y,
          boundsState,
          isBase,
          'Base'
        );
      });

      // --- Finalize Bounds and Center Calculation ---
      this._finalizeBoundsAndCenter(boundsState, maxX, maxY);

      // Note: The original logic for data.center is removed.
    } catch (err) {
      handleError(err, {
        context: 'MapService.updateMapData',
        onError: (error) => {
          console.error(`Error processing map data: ${error.message}`);
        },
      });
    }
  }

  /**
   * Updates the bounds state for a specific type (Actionable or Base) based on
   * a single tile's properties and coordinates.
   *
   * @param {object | null | undefined} properties - The properties object of the
   *   tile being checked.
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   * @param {object} currentBounds - The current state object tracking minimum
   *   and maximum coordinates for different types (Actionable, Base).
   * @param {function} checkFunction - The function (e.g., `isActionAllowed`,
   *   `isBase`) used to determine if the tile matches the type.
   * @param {'Actionable' | 'Base'} type - A string indicating the type of bound
   *   being updated ('Actionable' or 'Base').
   * @returns {object} The potentially updated bounds state object.
   * @private
   */
  _updateSingleBoundType(
    properties,
    x,
    y,
    currentBounds,
    checkFunction,
    type
  ) {
    // Only proceed if properties exist
    if (!properties) {
      return currentBounds;
    }

    const updatedBounds = { ...currentBounds };
    const checkResult = checkFunction(properties);

    if (checkResult) {
      const foundKey = `${type.toLowerCase()}TileFound`;
      const minXKey = `min${type}X`;
      const maxXKey = `max${type}X`;
      const minYKey = `min${type}Y`;
      const maxYKey = `max${type}Y`;

      updatedBounds[foundKey] = true;
      if (x < updatedBounds[minXKey]) updatedBounds[minXKey] = x;
      if (x > updatedBounds[maxXKey]) updatedBounds[maxXKey] = x;
      if (y < updatedBounds[minYKey]) updatedBounds[minYKey] = y;
      if (y > updatedBounds[maxYKey]) updatedBounds[maxYKey] = y;
    }

    return updatedBounds;
  }

  /**
   * Finalizes the map boundaries (overall and actionable) and calculates the
   * default center based on the processed tile data from `updateMapData`.
   * Sets `maxCoord`, `mapWidth`, `mapHeight`, `minActionableCoord`,
   * `maxActionableCoord`, and `defaultCenter`.
   *
   * @param {object} boundsState - The final state of the bounds tracking object
   *   containing min/max coordinates for actionable and base tiles.
   * @param {number} maxX - The maximum X coordinate found across all processed
   *   tiles.
   * @param {number} maxY - The maximum Y coordinate found across all processed
   *   tiles.
   * @private
   */
  _finalizeBoundsAndCenter(boundsState, maxX, maxY) {
    // 1. Set Overall Map Boundaries
    if (maxX > -Infinity && maxY > -Infinity) {
      this.maxCoord = { x: maxX, y: maxY };
      this.mapWidth = maxX + 1;
      this.mapHeight = maxY + 1;
    } else {
      this.maxCoord = { x: 0, y: 0 };
      this.mapWidth = 0;
      this.mapHeight = 0;
      console.warn('[MapService] No valid tiles found in updateMapData.');
    }

    // 2. Set Final Actionable Coordinates (for clamping/bounds checks)
    this._setFinalActionableCoords(boundsState);

    // 3. Calculate and Set Default Center
    const centerCoords = this._calculateCenterCoordinates(boundsState);
    this.defaultCenter = centerCoords;

    // 4. Adjust Center for Empty Map Edge Case
    if (this.mapWidth === 0) this.defaultCenter.x = 0;
    if (this.mapHeight === 0) this.defaultCenter.y = 0;
  }

  /**
   * Sets the final `minActionableCoord` and `maxActionableCoord` based on
   * whether actionable or base tiles were found during bounds calculation.
   * Falls back to overall map bounds if neither type was found.
   *
   * @param {object} boundsState - The final state of the bounds tracking
   *   object containing indicators (`actionableTileFound`, `baseTileFound`) and
   *   min/max coordinates.
   * @private
   */
  _setFinalActionableCoords(boundsState) {
    if (boundsState.actionableTileFound) {
      this.minActionableCoord = {
        x: boundsState.minActionableX,
        y: boundsState.minActionableY,
      };
      this.maxActionableCoord = {
        x: boundsState.maxActionableX,
        y: boundsState.maxActionableY,
      };
    } else if (boundsState.baseTileFound) {
      // Use base bounds if no actionable found
      this.minActionableCoord = {
        x: boundsState.minBaseX,
        y: boundsState.minBaseY,
      };
      this.maxActionableCoord = {
        x: boundsState.maxBaseX,
        y: boundsState.maxBaseY,
      };
    } else {
      // Default to overall map bounds if neither found
      this.minActionableCoord = { x: 0, y: 0 };
      this.maxActionableCoord = { ...this.maxCoord };
    }
  }

  /**
   * Calculates the default center coordinates (`{x, y}`) based on the bounds
   * of found tiles, prioritizing actionable tiles, then base tiles, and finally
   * the overall map dimensions.
   *
   * @param {object} boundsState - The final state of the bounds tracking object
   *   containing indicators and min/max coordinates.
   * @returns {{x: number, y: number}} The calculated center coordinates.
   * @private
   */
  _calculateCenterCoordinates(boundsState) {
    let centerX, centerY;

    if (boundsState.actionableTileFound) {
      // Keep for Debugging:
      // console.debug('[MapService] Centering based on actionable tiles.');
      centerX = Math.floor(
        (boundsState.minActionableX + boundsState.maxActionableX) / 2
      );
      centerY = Math.floor(
        (boundsState.minActionableY + boundsState.maxActionableY) / 2
      );
    } else if (boundsState.baseTileFound) {
      // Keep for Debugging:
      // console.warn(
      //   '[MapService] No actionable tiles found. ' +
      //   'Centering based on base tiles instead.'
      // );
      centerX = Math.floor((boundsState.minBaseX + boundsState.maxBaseX) / 2);
      centerY = Math.floor((boundsState.minBaseY + boundsState.maxBaseY) / 2);
    } else {
      console.warn(
        '[MapService] No actionable or base tiles found. ' +
        'Centering based on overall map dimensions.'
      );
      centerX = Math.floor(this.mapWidth / 2);
      centerY = Math.floor(this.mapHeight / 2);
    }

    return { x: centerX, y: centerY };
  }

  /**
   * Updates a single tile in the local `mapData` cache based on a server update.
   *
   * Merges the incoming `payload.updates` with the existing data for the tile
   * at `(payload.x, payload.y)`. Performs a deep merge specifically for the
   * `properties` key to preserve nested values. Also dynamically updates map
   * boundaries if the updated tile extends them.
   *
   * @param {object} payload - The payload received from the server, expected
   *   to have the structure `{ x: number, y: number, updates: object }`.
   */
  updateTile(payload) {
    const { x, y, updates } = payload || {};

    if (
      x === undefined ||
      y === undefined ||
      !updates ||
      typeof updates !== 'object'
    ) {
      console.warn(
        `[MapService] Received invalid tile update payload:`,
        payload
      );
      return;
    }

    try {
      const key = `${x},${y}`;
      const existingTile = this.mapData[key] || {};
      let finalUpdates = { ...updates }; // Copy updates to avoid mutating original payload

      // Deep merge for the 'properties' key if both exist
      if (
        updates.properties &&
        typeof updates.properties === 'object' &&
        existingTile.properties &&
        typeof existingTile.properties === 'object'
      ) {
        // Merge existing properties and new properties
        const mergedProperties = {
          ...existingTile.properties,
          ...updates.properties,
        };
        // Use the merged properties in the final updates
        finalUpdates.properties = mergedProperties;
      }

      // Perform the merge with the potentially adjusted finalUpdates
      this.mapData[key] = { ...existingTile, ...finalUpdates };

      // --- Dynamically update map boundaries if necessary ---
      this._updateMapBoundariesIfNeeded(x, y, this.mapData[key]);
      // --- End boundary update ---

      // Logging the specific update being applied (using finalUpdates)
      // console.debug(
      //   // Log final applied update
      //   `[MapService] Updated tile (${x},${y}) with:`,
      //   finalUpdates
      // );
    } catch (err) {
      handleError(err, { context: 'MapService.updateTile' });
    }
  }

  /**
   * Retrieves the data for a specific tile from the local `mapData` cache.
   *
   * @param {number} x - The X coordinate of the tile.
   * @param {number} y - The Y coordinate of the tile.
   * @returns {object | null} The tile data object if found, otherwise `null`.
   *   Returns `null` on internal error as well.
   */
  getTile(x, y) {
    try {
      const key = `${x},${y}`;
      return this.mapData[key] || null;
    } catch (err) {
      handleError(err, { context: 'MapService.getTile' });
      return null;
    }
  }

  /**
   * Checks if an updated tile requires adjusting the known map boundaries
   * (`maxCoord`, `mapWidth`, `mapHeight`) or actionable boundaries
   * (`minActionableCoord`, `maxActionableCoord`) and updates them if necessary.
   *
   * @param {number} x - The x-coordinate of the updated tile.
   * @param {number} y - The y-coordinate of the updated tile.
   * @param {object} tileData - The complete, merged data for the updated tile.
   * @private
   */
  _updateMapBoundariesIfNeeded(x, y, tileData) {
    // Keep for debugging
    // let overallBoundariesChanged = false; // Track overall changes
    // let actionableBoundariesChanged = false; // Track actionable changes

    // --- Update Overall Bounds ---
    if (x > this.maxCoord.x) {
      this.maxCoord.x = x;
      this.mapWidth = x + 1;
      // Keep for debugging
      // overallBoundariesChanged = true;
    }
    if (y > this.maxCoord.y) {
      this.maxCoord.y = y;
      this.mapHeight = y + 1;
      // Keep for debugging
      // overallBoundariesChanged = true;
    }

    // --- Update Actionable Bounds if tile is actionable ---
    // Check properties safely
    if (tileData?.properties && isActionAllowed(tileData.properties)) {
      // Check and update min/max for actionable bounds
      if (x < this.minActionableCoord.x) {
        this.minActionableCoord.x = x;
        // Keep for debugging
        // actionableBoundariesChanged = true;
      }
      if (x > this.maxActionableCoord.x) {
        this.maxActionableCoord.x = x;
        // Keep for debugging
        // actionableBoundariesChanged = true;
      }
      if (y < this.minActionableCoord.y) {
        this.minActionableCoord.y = y;
        // Keep for debugging
        // actionableBoundariesChanged = true;
      }
      if (y > this.maxActionableCoord.y) {
        this.maxActionableCoord.y = y;
        // Keep for debugging
        // actionableBoundariesChanged = true;
      }
    }

    // --- Logging (Conditional) ---
    // if (overallBoundariesChanged) {
    //   console.debug(
    //     `[MapService] Map boundaries updated due to tile (${x},${y}). ` +
    //     `New maxCoord: (${this.maxCoord.x}, ${this.maxCoord.y}), ` +
    //     `New dimensions: ${this.mapWidth}x${this.mapHeight}`
    //   );
    // Consider emitting an event if needed elsewhere:
    // this.scene?.events.emit('mapBoundariesUpdated', {
    //   maxCoord: { ...this.maxCoord }, // Send copy
    //   mapWidth: this.mapWidth,
    //   mapHeight: this.mapHeight,
    // });
    // }
    // if (actionableBoundariesChanged) {
    // console.debug(
    //   `[MapService] Actionable boundaries updated ` +
    //   `due to tile (${x},${y}). ` +
    //   `New actionable bounds: ` +
    //   `(${this.minActionableCoord.x},` +
    //   `${this.minActionableCoord.y}) ` +
    //   `to (${this.maxActionableCoord.x},` +
    //   `${this.maxActionableCoord.y})`
    // );
    // Consider emitting an event if needed elsewhere for actionable bounds
    // }
  }

  /**
   * Starts sending periodic heartbeat messages ('heartbeat') to the server via
   * WebSocket at a fixed interval (`HEARTBEAT_INTERVAL_MS`). Clears any
   * existing interval before starting a new one. Requires the socket to be
   * available.
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Ensure no duplicate intervals

    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot start heartbeat - socket not available');
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.isBackendAvailable()) {
        this.socket.safeEmit('heartbeat');
      } else {
        console.warn(
          `[MapSocket] Skipping heartbeat send - ` +
          `socket disconnected or unavailable`
        );
        // Consider stopping the interval if the socket is permanently gone
        // Or rely on the onDisconnect handler to stop it.
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stops the periodic sending of heartbeat messages by clearing the interval
   * timer.
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Checks if the given tile coordinates are within the calculated map
   * boundaries (`mapWidth`, `mapHeight`). Assumes dimensions are up-to-date.
   *
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @returns {boolean} True if coordinates are within the bounds [0, mapWidth)
   *   and [0, mapHeight), false otherwise.
   */
  isWithinBounds(x, y) {
    // Use calculated dimensions. Assumes dimensions are updated by 
    // updateMapData.
    return x >= 0 &&
      x < this.mapWidth &&
      y >= 0 &&
      y < this.mapHeight;
  }

  /**
   * Cleans up the MapService instance before destruction.
   *
   * Stops the heartbeat, disconnects the WebSocket if active, and removes
   * event listeners associated with the scene and EventBus to prevent memory
   * leaks.
   */
  cleanup() {
    try {
      this.stopHeartbeat(); // Stop heartbeat before disconnecting
      if (this.socket) {
        // Leave for socket cleanup debugging
        // console.info(
        //   `[MapSocket] Cleaning up MapService and disconnecting socket`
        // );
        this.socket.disconnect();
        this.socket = null;
      }

      // --- Remove listener for scene-level actionability changes ---
      if (this.scene?.events) {
        this.scene.events.off(
          'scene:tileActionabilityChanged',
          this._recalculateActionableBounds,
          this
        );
      }

      // --- Remove listener for tile selection requests ---
      EventBus.off(
        'request-select-tiles',
        this.selectTilesRequestListener // Use the same bound listener reference
      );

    } catch (err) {
      handleError(err, { context: 'MapService.cleanup' });
    }
  }

  /**
   * Sends a request to the server via WebSocket to clear rubble from specified
   * tiles ('client:clear_rubble').
   *
   * Filters the input `tiles` array to include only those tiles that are
   * actually clearable based on their current state (`canClearRubbleTile`).
   * Requires socket connection and `scene.mapId`.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects to attempt clearing.
   * @returns {boolean} `true` if the request was successfully emitted (at least
   *   one valid tile found), `false` otherwise (no valid tiles, socket issue,
   *   or missing mapId).
   */
  clearRubble(tiles) {
    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot clear rubble: Socket not available');
      return false;
    }

    if (!this.scene?.mapId) {
      console.warn('[MapSocket] Cannot clear rubble: Map ID is missing');
      return false;
    }

    // Filter out tiles that are not clearable
    const tilesToSend = this.stripForPayload(
      tiles.filter(tile => canClearRubbleTile(this.getTile(tile.x, tile.y)))
    );

    // No action needed if all tiles were filtered
    if (tilesToSend.length === 0) {
      return false;
    }

    const payload = {
      mapId: this.scene.mapId,
      tiles: tilesToSend,
    };

    return this.socket.safeEmit('client:clear_rubble', payload);
  }

  /**
   * Sends a request to the server via WebSocket to plant a specific crop on
   * specified tiles ('client:plant_crop').
   *
   * Filters the input `tiles` array to include only those tiles where planting
   * is currently allowed (`isPlantable`). Requires socket connection and
   * `scene.mapId`.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects to attempt planting on.
   * @param {string} cropType - The type identifier of the crop to plant (e.g.,
   *   'wheat').
   * @returns {boolean} `true` if the request was successfully emitted (at least
   *   one valid tile found), `false` otherwise.
   */
  plantCrop(tiles, cropType) {
    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot plant crop: Socket not available');
      return false;
    }
    if (!this.scene?.mapId) {
      console.warn('[MapSocket] Cannot plant crop: Map ID is missing');
      return false;
    }

    // Filter out tiles that are not plantable
    const tilesToSend = this.stripForPayload(
      tiles.filter(tile =>
        isPlantable(this.getTile(tile.x, tile.y)))
    );

    // No action needed if all tiles were filtered
    if (tilesToSend.length === 0) {
      return false;
    }

    const payload = {
      mapId: this.scene.mapId,
      // Strip list to only the coordinate values after filtering
      tiles: tilesToSend,
      cropType,
    };

    return this.socket.safeEmit('client:plant_crop', payload);
  }

  /**
   * Sends a request to the server via WebSocket to harvest crops from specified
   * tiles ('client:harvest_crop').
   *
   * Filters the input `tiles` array to include only those tiles that are
   * currently harvestable (`canHarvestTile`). Requires socket connection and
   * `scene.mapId`.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects to attempt harvesting from.
   * @param {string} cropType - The type identifier of the crop being harvested.
   * @returns {boolean} `true` if the request was successfully emitted (at least
   *   one valid tile found), `false` otherwise.
   */
  harvestCrop(tiles, cropType) {
    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot harvest crop: Socket not available');
      return false;
    }
    if (!this.scene?.mapId) {
      console.warn('[MapSocket] Cannot harvest crop: Map ID is missing');
      return false;
    }

    // Filter out tiles that are not harvestable
    const tilesToSend = this.stripForPayload(
      tiles.filter(tile =>
        canHarvestTile(this.getTile(tile.x, tile.y)))
    );

    // No action needed if all tiles were filtered
    if (tilesToSend.length === 0) {
      return false;
    }

    // Use filtered list
    const payload = {
      mapId: this.scene.mapId,
      tiles: tilesToSend,
      cropType,
    };

    // Debugging: Harvest Crop
    console.debug(
      `[MapService]` +
      `[Instance: ` +
      `${this.instanceId}]` +
      `[Socket: ` +
      `${this.socket?.id || 'N/A'}] ` +
      `Emitting 'client:harvest_crop' (${cropType}) ` +
      // ` for Map ${this.scene.mapId}` +
      `[Tiles: ${payload?.tiles.length}]`
    );
    return this.socket.safeEmit('client:harvest_crop', payload);
  }

  /**
   * Sends a request to the server via WebSocket to speed up crop growth on
   * specified tiles ('client:speed_grow').
   *
   * Filters the input `tiles` array to include only those tiles where speed
   * grow is applicable (`canSpeedGrowTile`). Requires socket connection and
   * `scene.mapId`.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects to attempt speeding up growth on.
   * @returns {boolean} `true` if the request was successfully emitted (at least
   *   one valid tile found), `false` otherwise.
   */
  speedGrow(tiles) {
    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot speed grow: Socket not available');
      return false;
    }
    if (!this.scene?.mapId) {
      console.warn('[MapSocket] Cannot speed grow: Map ID is missing');
      return false;
    }

    // Filter out tiles that don't have a crop
    const tilesToSend = this.stripForPayload(
      tiles.filter(tile =>
        canSpeedGrowTile(this.getTile(tile.x, tile.y)))
    );

    // No action needed if all tiles were filtered
    if (tilesToSend.length === 0) {
      return false;
    }

    // Use filtered list
    const payload = {
      mapId: this.scene.mapId,
      tiles: tilesToSend,
    };

    // Debugging: Speed Grow
    console.debug(
      `[MapService]` +
      `[Instance: ` +
      `${this.instanceId}]` +
      `[Socket: ` +
      `${this.socket?.id || 'N/A'}] ` +
      `Emitting 'client:speed_grow'` +
      // ` for Map ${this.scene.mapId}` +
      `[Tiles: ${payload?.tiles.length}]`
    );
    return this.socket.safeEmit('client:speed_grow', payload);
  }

  /**
   * Sends a request to the server via WebSocket to lease specified tiles
   * ('client:lease_tile').
   *
   * Filters the input `tiles` array to include only those tiles that are
   * currently leasable (`canLeaseTile`). Requires socket connection and
   * `scene.mapId`. Performs client-side validation of tile coordinates within
   * the filter.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects to attempt leasing.
   * @returns {boolean} `true` if the request was successfully emitted (at least
   *   one valid tile found), `false` otherwise.
   */
  leaseTile(tiles) {
    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot lease tile: Socket not available');
      return false;
    }
    if (!this.scene?.mapId) {
      console.warn('[MapSocket] Cannot lease tile: Map ID is missing');
      return false;
    }

    // Filter out tiles that are not leasable
    const tilesToSend = this.stripForPayload(
      tiles.filter(tile =>
        canLeaseTile(this.getTile(tile.x, tile.y)))
    );

    // No action needed if all tiles were filtered
    if (tilesToSend.length === 0) {
      return false;
    }

    const payload = {
      mapId: this.scene.mapId,
      tiles: tilesToSend,
    };

    // Debugging: Lease Tile
    console.debug(
      `[MapService]` +
      `[Instance: ` +
      `${this.instanceId}]` +
      `[Socket: ` +
      `${this.socket?.id || 'N/A'}] ` +
      `Emitting 'client:lease_tile' ` +
      // ` for Map ${this.scene.mapId}` +
      `[Tiles: ${payload?.tiles.length}]`
    );
    return this.socket.safeEmit('client:lease_tile', payload);
  }

  /**
   * Sends a request to the server via WebSocket to pay rent on specified tiles
   * ('client:pay_rent').
   *
   * Filters the input `tiles` array to include only those tiles where rent
   * payment is applicable (`canPayRentTile`). Requires socket connection and
   * `scene.mapId`.
   *
   * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinate
   *   objects to attempt paying rent on.
   * @returns {boolean} `true` if the request was successfully emitted (at least
   *   one valid tile found), `false` otherwise.
   */
  payRent(tiles) {
    if (!this.socket?.isBackendAvailable()) {
      console.warn('[MapSocket] Cannot pay rent: Socket not available');
      return false;
    }
    if (!this.scene?.mapId) {
      console.warn('[MapSocket] Cannot pay rent: Map ID is missing');
      return false;
    }

    // Filter out tiles that are not payable
    const tilesToSend = this.stripForPayload(
      tiles.filter(tile =>
        canPayRentTile(this.getTile(tile.x, tile.y)))
    );

    // No action needed if all tiles were filtered
    if (tilesToSend.length === 0) {
      return false;
    }

    const payload = {
      mapId: this.scene.mapId,
      tiles: tilesToSend,
    };

    // Debugging: Pay Rent
    console.debug(
      `[MapService]` +
      `[Instance: ` +
      `${this.instanceId}]` +
      `[Socket: ` +
      `${this.socket?.id || 'N/A'}] ` +
      `Emitting 'client:pay_rent' ` +
      // ` for Map ${this.scene.mapId}` +
      `[Tiles: ${payload?.tiles.length}]`
    );
    return this.socket.safeEmit('client:pay_rent', payload);
  }

  /**
   * Handles the 'request-select-tiles' event received from the global EventBus.
   * Fetches the full tile data objects from the local `mapData` cache for the
   * requested tile keys (coordinate strings "x,y"). Emits a 'tiles-selected'
   * event on the EventBus with an array of the found tile data objects (each
   * augmented with its `x` and `y` coordinates), or `null` if no valid keys
   * were provided or no data was found for any key.
   *
   * @param {string[]} keys - An array of tile coordinate strings (e.g., ["0,0",
   *   "1,0"]) requested for selection.
   * @private
   */
  _handleSelectTilesRequest(keys) {
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      console.warn('[MapService] Received invalid keys for tile selection request:', keys);
      EventBus.emit('tiles-selected', null);
      return;
    }

    try {
      const finalSelectedTileData = [];
      keys.forEach(key => {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        if (isNaN(x) || isNaN(y)) {
          console.warn(`[MapService] Invalid coordinate key in selection request: ${key}`);
          return; // Skip this invalid key
        }

        const tileData = this.getTile(x, y);
        if (tileData) {
          // Ensure x, y are included with the fetched data
          finalSelectedTileData.push({ ...tileData, x, y });
        } else {
          // Optionally log if a selected key didn't have data
          // console.warn(`[MapService handleSelectTilesRequest] No tile data found for key ${key}`);
        }
      });

      // Emit the array of full tile data objects, or null if empty
      EventBus.emit(
        'tiles-selected',
        finalSelectedTileData.length > 0 ? finalSelectedTileData : null
      );
    } catch (error) {
      console.error('Error handling tile selection request:', error);
      EventBus.emit('tiles-selected', null); // Emit null on error
    }
  }

  /**
   * Recalculates the minimum and maximum coordinates (`minActionableCoord`,
   * `maxActionableCoord`) encompassing all currently known tiles that are
   * considered actionable (`isActionAllowed`). Iterates through all entries in
   * `mapData`. If no actionable tiles are found, resets actionable bounds to
   * the overall map edges. Also checks if the scene's current center tile is
   * outside the new bounds and requests a center update if necessary. If no
   * actionable tiles remain, requests a center update to (0,0).
   *
   * @private
   */
  _recalculateActionableBounds() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let foundActionable = false;

    // Get current center *before* recalculating bounds
    const currentCenter = this.scene?.currentCenterTile
      ? { ...this.scene.currentCenterTile }
      : null;

    // Corrected Iteration:
    Object.keys(this.mapData).forEach(key => {
      const tile = this.mapData[key];
      if (tile?.properties && isActionAllowed(tile.properties)) {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        if (!isNaN(x) && !isNaN(y)) {
          foundActionable = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    });

    if (foundActionable) {
      this.minActionableCoord = { x: minX, y: minY };
      this.maxActionableCoord = { x: maxX, y: maxY };
      // Debugging: Recalculated Actionable Bounds
      // console.debug(
      //   `[MapService] Recalculated actionable bounds: ` +
      //   `(${this.minActionableCoord.x},${this.minActionableCoord.y}) ` +
      //   `to (${this.maxActionableCoord.x},${this.maxActionableCoord.y})`
      // );
    } else {
      // No actionable tiles found, reset to default (e.g., overall map bounds)
      // This mirrors logic in _setFinalActionableCoords fallback
      this.minActionableCoord = { x: 0, y: 0 };
      this.maxActionableCoord = { ...this.maxCoord };
      // Debugging: Recalculated Actionable Bounds
      // console.warn(
      //   '[MapService] Recalculation found no actionable tiles. ' +
      //   'Resetting actionable bounds to map edges.'
      // );
    }

    // --- Check if current center needs clamping --- 
    if (currentCenter && foundActionable) {
      const clampedX = Math.max(minX, Math.min(maxX, currentCenter.x));
      const clampedY = Math.max(minY, Math.min(maxY, currentCenter.y));

      // If clamping changed the coordinates, request an update
      if (clampedX !== currentCenter.x || clampedY !== currentCenter.y) {
        // Debugging: Recalculated Actionable Bounds
        // console.debug(
        //   `[MapService] Current center ` +
        //   `(${currentCenter.x},${currentCenter.y}) ` +
        //   `is outside new actionable bounds. Requesting update to ` +
        //   `(${clampedX},${clampedY}).`
        // );
        this.scene?.events.emit('scene:requestCenterUpdate', {
          x: clampedX,
          y: clampedY,
        });
      }
    } else if (!foundActionable && currentCenter) {
      // If no actionable tiles exist anymore, request center update to 0,0
      // or potentially the center of the base tiles / overall map?
      // For now, let's reset to 0,0 if all actionable tiles disappear.
      // This assumes the map isn't completely empty.
      if (currentCenter.x !== 0 || currentCenter.y !== 0) {
        console.warn(
          `[MapService] No actionable tiles remain. Requesting center ` +
          `update to (0,0).`
        );
        this.scene?.events.emit('scene:requestCenterUpdate', { x: 0, y: 0 });
      }
    }
  }
}

export { MapService as default, MapService };
