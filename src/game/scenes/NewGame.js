import { SceneBase } from './SceneBase';
import { CropManager } from '../CropManager';
import { RentManager } from '../RentManager.js';
import { InputHandler } from '../InputHandler';
import { EventBus } from '../EventBus';
import { ItemRenderer } from './NewGame/ItemRenderer';
import MapService from '../../library/MapService.js';
import * as SCENES from '../constants/scenes.js';

/**
 * @class NewGame
 * @extends {SceneBase}
 * @description The main gameplay scene. Handles rendering the tile map, crops,
 *   user input for selection, camera movement, and interaction with the
 *   CropManager.
 */
export class NewGame extends SceneBase {
  // #region Scene Properties
  /**
   * The ID of the map to load, passed during scene initialization.
   * @type {string | null}
   * @private
   */
  mapId = null;

  /**
   * Reference to the MapService instance.
   * @type {MapService | null}
   * @private
   */
  mapService = null;

  /**
   * Flag indicating if the map data has been received and setup is complete.
   * @type {boolean}
   * @private
   */
  isMapReady = false;

  /**
   * Flag indicating if all setup, including UI, is complete.
   * @type {boolean}
   * @private
   */
  isFullyInitialized = false;

  /**
   * Flag indicating if the scene is currently undergoing shutdown.
   * @type {boolean}
   * @private
   */
  isShuttingDown = false;

  /**
   * @constructor
   */
  constructor() {
    super('NewGame');
    this.initialize(); // Call initialization logic
  }

  /**
   * @method initialize
   * @description Sets up initial properties, verifies assets, and binds
   *   necessary methods.
   * @returns {void}
   * @throws {Error} If initialization fails.
   */
  initialize() {
    try {
      // Set default values for scene properties - This logic should likely
      this.mapNickname = null;
      this.audioHandler = null;

      this.selectionIndicator = null;
      this.mapService = null; // Initialize mapService as null
      this.rentManager = null; // Initialize rentManager as null
      this.tileSizeX = 32; // (32x32) base
      this.tileSizeY = 32;
      this.currentCenterTile = { x: 0, y: 0 }; // Default center
      this.mapWidth = 0; // Will be set during map setup
      this.mapHeight = 0; // Will be set during map setup

      // --- Game Dimensions --- //
      this.gameWidth = 0;
      this.gameHeight = 0;
      // ----------------------- //

      // --- Add state for periodic logging --- //
      this.lastLogTime = 0;
      // ------------------------------------- //

      // --- State for container movement --- //
      this.isAnimating = false; // Flag for container tween
      this.cursors = null;
      // ---------------------------------- //

      // --- Selection Graphics --- //
      /**
       * Graphics object for the selection rectangle.
       * @type {Phaser.GameObjects.Graphics | null}
       */
      this.selectionGraphics = null;
      // -------------------------- //

      // --- State for scene reload debounce --- //
      this.lastReloadTime = 0;
      // --------------------------------------- //

      // --- State for center marker --- //
      this.centerMarker = null;
      this.centerText = [];
      // ------------------------------- //

      // --- Add state for ruler logging timer --- //
      this.lastRulerLogTime = 0;
      // --- Add state for ruler debugging flags --- //
      this._warnedRulerPrereqs = false; // Track prerequisite warnings
      // --- Add state for center marker warning --- //
      this._warnedCenterMarkerContainer = false;
      // -------------------------------------- //

      // --- UI Container for Overlays ---
      this.uiContainer = null;
      this.mapNicknameText = null; // Initialize nickname text property
      // Initialize map title visibility on by default
      this.isMapTitleVisible = true;

      // --- Store requested center on restart --- //
      this.requestedCenterTile = null;
      // --------------------------------------- //

      // --- Store requested selection on restart --- //
      this.requestedSelection = null;
      // ------------------------------------------ //

      // --- Bound Event Handlers --- //
      this._boundMoveUpHandler = null;
      this._boundMoveDownHandler = null;
      this._boundMoveLeftHandler = null;
      this._boundMoveRightHandler = null;
      this._boundHandlePayRent = null;
      this._boundHandleRentDue = null;
      // --- Add state for wallet display --- //
      this._boundHandlePlayerWalletUpdated = null;
      this.walletBalanceText = null;
      this.walletBalanceTimer = null;
      // ---------------------------------- //
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] ` +
        `Failed to initialize NewGame scene:`,
        error
      );
      throw new Error('Scene initialization failed');
    }
  }

  /**
   * Initializes basic scene properties and resets state flags based on input
   * data.
   * @param {object} data - Data passed from the calling scene.
   * @private
   */
  _initializeBasicProperties(data) {
    this.characterId = data?.characterId || null;
    this.mapId = data?.mapId || null;

    this.audioHandler = data?.audioHandler || null;
    this.registry.set('audioHandler', this.audioHandler);

    this.isMapReady = false; // Reset map readiness flag

    // Reset last resize dimensions
    this._lastResizeWidth = 0;
    this._lastResizeHeight = 0;
  }

  /**
   * Handles optional data passed during a scene restart, setting requested
   * center and selection states.
   * @param {object} data - Data passed from the calling scene.
   * @private
   */
  _handleRestartData(data) {
    // Check for requested center from restart data
    this.requestedCenterTile = data?.previousCenterTile || null;

    // Check for requested selection from restart data
    this.requestedSelection = Array.isArray(data?.previousSelection)
      ? data.previousSelection
      : null;
  }

  /**
   * @method init
   * @description Phaser scene lifecycle method. Receives data passed from the
   *   previous scene (e.g., map ID).
   * @param {object} data - Data passed from the calling scene.
   * @param {string} [data.mapId] - The ID of the map to load.
   * @param {string} [data.characterId] - The ID of the character.
   * @param {object} [data.audioHandler] - Reference to the audio handler.
   * @param {object} [data.previousCenterTile] - Center tile from previous
   *   load.
   * @param {Array<{x: number, y: number}>} [data.previousSelection] - Selected
   *   tiles from previous load.
   * @returns {void}
   */
  init(data) {
    this._initializeBasicProperties(data);
    this._handleRestartData(data);

    // --- Instantiate MapService
    this.mapService = new MapService({ scene: this });

    // --- Create Loading Elements (similar to Preloader.js) --- //
    const gameDisplayHeight = window.innerHeight / 2; // Game occupies top half

    // Gradient Background
    this.loadingGradient = this.add.graphics();
    this.loadingGradient.fillGradientStyle(0x000033, 0x000033, 0x000088, 0x000088, 1);
    this.loadingGradient.fillRect(0, 0, window.innerWidth, gameDisplayHeight);
    this.loadingGradient.setDepth(98); // Below text and progress bar

    // Loading Text
    const textX = Math.floor(window.innerWidth / 2);
    const textY = Math.floor(gameDisplayHeight / 2); // Center of game's vertical half

    this.loadingText = this.add
      .text(
        textX,
        textY,
        'Initializing...', // Default initial text
        {
          fontSize: '24px',
          color: '#ffffff',
          fontFamily: 'Helvetica, sans-serif, Arial',
        }
      )
      .setOrigin(0.5)
      .setDepth(100); // Ensure it's on top

    // Progress Bar Elements
    const progressBarWidth = 240;
    const progressBarHeight = 50;
    const progressBarX = (window.innerWidth - progressBarWidth) / 2;
    // Position below the text, textY is already centered in gameDisplayHeight
    const progressBarY = textY + 70; // Adjusted offset from text

    this.loadingProgressBox = this.add.graphics();
    this.loadingProgressBox.fillStyle(0x222222, 0.8);
    this.loadingProgressBox.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
    this.loadingProgressBox.setDepth(99);

    this.loadingProgressBar = this.add.graphics();
    this.loadingProgressBar.fillStyle(0xffffff, 1);
    // Static fill for the progress bar, adjust as needed for animation
    this.loadingProgressBar.fillRect(
      progressBarX + 10,
      progressBarY + 10,
      progressBarWidth - 20,
      progressBarHeight - 20
    );
    this.loadingProgressBar.setDepth(99);
    // --- End Loading Elements --- //

    // _setupSocketAndMapListeners handles waiting for connection if needed.
    this._setupSocketAndMapListeners();

    // Register shutdown listener early (keeping this placement is fine)
    this.events.on('shutdown', this.shutdown, this);
  }

  /**
   * @method preload
   * @description Phaser scene lifecycle method. Loads assets specific to the
   *   NewGame scene.
   * @returns {void}
   */
  preload() {
    // Load the tileset image directly
    this.load.spritesheet(
      'farmableGround',
      'assets/tilesets/farmableGround.png',
      {
        frameWidth: 32,
        frameHeight: 32,
      }
    );

    // Removed: this.load.tilemapTiledJSON('farmableGround', ...)
    // No longer loading map layout JSON, only the tileset image above.

    // Load other assets like crops
    this.load.spritesheet('cropsWheat', 'assets/tilesets/cropsWheat.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Load NewGame background music (replace 'newGameMusic.mp3' with actual file)
    this.load.audio('newGameMusic', 'game/04-Blue-Forest.mp3');
  }

  /**
   * @method create
   * @description Phaser scene lifecycle method. Sets up initial state,
   *   loading indicators, and listeners for map data from the socket.
   * @returns {void}
   */
  create() {
    // Basic scene setup (background, etc.)
    this.cameras.main.setBackgroundColor(0xadd8e6); // lightblue

    // --- Re-center and Resize Loading Elements --- //
    if (this.loadingText) {
      const cameraWidth = this.cameras.main.width;
      const cameraHeight = this.cameras.main.height; // This is the game's viewport height

      // Update Gradient
      this.loadingGradient?.clear();
      this.loadingGradient?.fillGradientStyle(0x000033, 0x000033, 0x000088, 0x000088, 1);
      this.loadingGradient?.fillRect(0, 0, cameraWidth, cameraHeight);

      // Update Text Position
      const textX = Math.floor(cameraWidth / 2);
      const textY = Math.floor(cameraHeight / 2);
      this.loadingText.setPosition(textX, textY);

      // Update Progress Bar Position
      const progressBarWidth = 240;
      const progressBarHeight = 50;
      const progressBarX = (cameraWidth - progressBarWidth) / 2;
      const progressBarY = textY + 70; // Position below new textY

      this.loadingProgressBox?.clear();
      this.loadingProgressBox?.fillStyle(0x222222, 0.8);
      this.loadingProgressBox?.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);

      this.loadingProgressBar?.clear();
      this.loadingProgressBar?.fillStyle(0xffffff, 1);
      this.loadingProgressBar?.fillRect(
        progressBarX + 10,
        progressBarY + 10,
        progressBarWidth - 20,
        progressBarHeight - 20
      );
    }
    // --------------------------------------------- //

    // Socket and listener setup is now handled entirely within
    // init -> _setupSocketAndMapListeners
  }

  /**
   * Sets up socket listeners and requests initial map data once the socket
   * instance is available and connected.
   * @private
   */
  _setupSocketAndMapListeners() {
    if (!this.mapService.scene?.events) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame ` +
        `_setupSocketAndMapListeners] ` +
        `MapService or its scene events are not available!`
      );
      this.loadingText?.setText('Error: Map Service invalid.');
      return; // Cannot proceed
    }

    const socket = this.mapService.socket;
    if (!socket) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame ` +
        `_setupSocketAndMapListeners] ` +
        `MapService socket is not available!`
      );
      this.loadingText?.setText('Error: Socket invalid.');
      return; // Cannot proceed
    }

    // Handles tiles and map details
    this.handleInitialMapDataReceived = this
      ._setupMapAndDetailsFromData.bind(this);

    // Handler function to be called when the socket connects
    const onMapSocketConnected = () => {
      // Update status
      this.loadingText?.setText('Loading Map...');

      // Optional: Add listeners for other MapService events like 
      // disconnect/error
      this.mapService.scene.events.once(
        'mapSocketDisconnected',
        this.handleMapSocketDisconnect,
        this
      );

      this.mapService.scene.events.once(
        'mapSocketError',
        this.handleMapSocketError,
        this
      );

      // Listen for the initial map data VIA MapService scene event (fired once)
      this.mapService.scene.events.once(
        'initialMapData',
        this.handleInitialMapDataReceived,
        this
      );

      // Now that the socket is connected and listeners are ready, 
      // request map data
      this.mapService.requestMapData();

      // Listen for subsequent single tile updates via MapService scene events
      this.mapService.scene.events.on(
        'tileUpdated',
        this.handleTileUpdate,
        this
      );

      // Listen for the new actionFailed event
      this.mapService.socket.on('actionFailed', (data) => {
        const timestamp = new Date().toISOString();
        console.warn(
          `[${timestamp}] [WARN] [NewGame] Action '${data.action}' failed ` +
          `on server: ${data.reason}`
        );
        // Emit an event for the UI to potentially display a message
        // Don't include context for now
        EventBus.emit('ACTION_FAILED_EVENT', {
          action: data.action,
          reason: data.reason,
          context: data.context,
        });
      });

    };

    // --- Check Current Connection State --- //
    if (socket.connected) {
      onMapSocketConnected(); // Execute the setup directly
    } else {
      this.loadingText?.setText('Initializing Map Service...');
      // Listen ONCE for the connection event from MapService
      this.mapService.scene.events.once(
        'mapSocketConnected',
        onMapSocketConnected
      );
    }
  }

  /**
   * Handles the initial map data and details received via MapService event.
   * Extracts nickname and tiles, then calls setup helpers.
   * @param {object} initialPayload - The initial payload containing `tiles` and
   *   `mapNickname`.
   * @param {object} initialPayload.tiles - Object mapping "x,y" keys to tile
   *   data.
   * @param {string} initialPayload.mapNickname - The name of the map.
   * @private
   */
  async _setupMapAndDetailsFromData(initialPayload) {
    // Extract tiles and nickname from the payload
    if (!initialPayload ||
      typeof initialPayload !== 'object' ||
      initialPayload === null ||
      !Object.hasOwn(initialPayload, 'tiles') ||
      !Object.hasOwn(initialPayload, 'mapNickname')
    ) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] ` +
        `Received invalid initial payload in event:`,
        initialPayload
      );
      return;
    }

    // Set other details in the initial payload for other features
    // like center, etc.

    // --- Call the helper method to process the tiles --- //
    // Await the map setup which now includes async finalization
    await this._setupMapFromSocketData(initialPayload.tiles);
    // --------------------------------------------------- //
  }

  /**
   * Sets up the map using data received from the socket. Creates the Tilemap,
   * layers, populates tiles, initializes managers, and finishes scene setup.
   * Handles scene restart logic if the map is already initialized.
   * @param {object} initialTilesData - An object where keys are "x,y" strings
   *   and values are tile data objects (e.g., {tileIndex: 0, ...}).
   * @private
   */
  async _setupMapFromSocketData(initialTilesData) { // <-- Make async
    // 1. Validate basic tile data structure
    if (typeof initialTilesData !== 'object' ||
      initialTilesData === null) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] ` +
        `Received invalid initial tile data structure in event:`,
        initialTilesData
      );

      // Abort if structure is wrong
      this.loadingText?.setText('Error: Invalid map data received.');
      return;
    }

    if (this.isMapReady) {
      if (!this.mapId) {
        console.error(
          `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
          `Cannot restart scene: mapId is missing.`
        );

        return;
        // Optionally, transition to an error scene or show a message
      }

      // Handle map restart scenario
      const selectionArray = this.inputHandler?.selectedTiles
        ? Array.from(this.inputHandler.selectedTiles).map(key => {
          const [x, y] = key.split(',').map(Number);
          return { x, y };
        }) : [];

      // Use extracted helper method for restart
      this._handleMapRestart(selectionArray);

      // Stop further processing in this instance
      return;
    }

    // --- Get dimensions and center AFTER service has processed the data --- //
    if (!this.mapService) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `MapService instance is not available. ` +
        `Cannot get dimensions/center.`
      );

      this.loadingText?.setText('Error: Map Service connection lost.');
      return;
    }
    // Get the map nickname from the MapService
    this.mapNickname = this.mapService.mapNickname;

    // Emit the nickname *after* the text object exists
    this._emitMapNickname(this.mapNickname);

    const width = this.mapService.mapWidth;
    const height = this.mapService.mapHeight;
    const center = this.mapService.defaultCenter;

    // Validate dimensions specifically
    if (!this._validateMapDimensions(width, height)) {
      // Error logged in _validateMapDimensions
      return;
    }

    // Use extracted helper method for nickname
    this._removeLoadingText();
    this._setMapDimensions(width, height);
    this._setInitialCenter(width, height, center);

    // 2. Create Map Structure (Tilemap, Tileset, Layer)
    const { layer } = this._createMapStructure(width, height);
    if (!layer) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `Failed to create map structure. Aborting.`
      );
      // Maybe show an error message
      return;
    }

    // Pass nickname to the manager initializer
    this._initializeCoreManagers();
    this._populateInitialState(initialTilesData);
    // Wait for final setup steps, including audio init/playback
    await this._finalizeSceneSetup();
  }

  /**
   * Validates the map dimensions received from the server.
   * @param {number} width - The width of the map in tiles.
   * @param {number} height - The height of the map in tiles.
   * @returns {boolean} True if dimensions are valid (positive numbers), false
   *   otherwise.
   * @private
   */
  _validateMapDimensions(width, height) {
    if (
      width === undefined ||
      width === null ||
      isNaN(width) ||
      width <= 0 ||
      height === undefined ||
      height === null ||
      isNaN(height) ||
      height <= 0
    ) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] Invalid map dimensions received from event (width: ${width}, height: ${height}). Aborting map setup.`
      );
      this.loadingText?.setText(`Error: Invalid map size (${width}x${height})`);
      return false;
    }
    return true;
  }

  /**
   * Removes the loading text game object from the scene if it exists.
   * @private
   */
  _removeLoadingText() {
    this.loadingText?.destroy();
    this.loadingText = null;
    this.loadingGradient?.destroy();
    this.loadingGradient = null;
    this.loadingProgressBox?.destroy();
    this.loadingProgressBox = null;
    this.loadingProgressBar?.destroy();
    this.loadingProgressBar = null;
  }

  /**
   * Sets the `mapWidth` and `mapHeight` properties on the scene instance.
   * @param {number} width - The width of the map in tiles.
   * @param {number} height - The height of the map in tiles.
   * @private
   */
  _setMapDimensions(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  /**
   * Determines and sets the initial center tile for the scene view, based on
   * priority: requested center from restart, default center from MapService,
   * or calculated center from dimensions.
   * @param {number} width - The map width in tiles.
   * @param {number} height - The map height in tiles.
   * @param {object | null} serviceCenter - The default center object {x, y}
   *   from MapService, or null.
   * @private
   */
  _setInitialCenter(width, height, serviceCenter) {
    let initialX, initialY;

    // --- PRIORITY 1: Use requested center from restart data --- //
    if (
      this.requestedCenterTile &&
      typeof this.requestedCenterTile.x === 'number' &&
      typeof this.requestedCenterTile.y === 'number'
    ) {
      initialX = this.requestedCenterTile.x;
      initialY = this.requestedCenterTile.y;
      this.requestedCenterTile = null; // Clear after use
      // --- PRIORITY 2: Use default center from MapService --- //
    } else if (
      serviceCenter &&
      typeof serviceCenter.x === 'number' &&
      !isNaN(serviceCenter.x) &&
      typeof serviceCenter.y === 'number' &&
      !isNaN(serviceCenter.y) &&
      (serviceCenter.x !== 0 ||
        serviceCenter.y !== 0 ||
        (width <= 1 && height <= 1))
    ) {
      initialX = serviceCenter.x;
      initialY = serviceCenter.y;
      // --- PRIORITY 3: Calculate center based on dimensions --- //
    } else {
      initialX = Math.floor(width / 2);
      initialY = Math.floor(height / 2);
    }
    this.initialCenterTile = { x: initialX, y: initialY };
    this.currentCenterTile = { ...this.initialCenterTile };
  }

  /**
   * Initializes core managers (container, CropManager, ItemRenderer,
   * RentManager) and the Audio Manager. Creates the main item map container
   * and the UI container. Sets up initial audio state.
   * @private
   */
  _initializeCoreManagers() {
    // Initial Map Container of Scene
    this.itemMapContainer = this.add.container(0, 0);
    this.itemMapContainer.setDepth(0);
    this.registry.set('itemMapContainer', this.itemMapContainer);

    // Setup the UI container and its fixed elements
    this._setupUiContainer();

    // --- Initialize Managers that might depend on containers --- //
    this.initializeManagers();
    // Called after container is created
    this.initializeItemRenderer();

    // --- Initialize Audio Manager --- //
    this.audioHandler = this.registry.get('audioHandler');
    if (this.audioHandler) {
      this.audioHandler.init();
    } else {
      console.warn('Audio handler not found in registry.');
    }
    // *** Notify AudioManager of the scene change AFTER init ***
    this.audioHandler.changeScenes(SCENES.NEW_GAME, 'NewGame');
  }

  /**
   * Creates the UI container and its base elements like ruler, selection
   * graphics, and map nickname text. Registers them with the scene registry.
   * @private
   */
  _setupUiContainer() {
    // --- UI Container for Overlays --- //
    this.uiContainer = this.add.container(0, 0);
    this.uiContainer.setDepth(11);
    this.uiContainer.setScrollFactor(0); // Keep UI fixed relative to camera
    this.registry.set('uiContainer', this.uiContainer);
    // -------------------------------- //

    // --- Create Selection Graphics --- //
    this.selectionGraphics = this.add
      .graphics({
        lineStyle: { width: 2, color: 0xffffff, alpha: 0.8 },
        fillStyle: { color: 0x2ecc71, alpha: 0.25 },
      })
      .setDepth(1) // Slightly above land tiles
      .setVisible(false);
    this.uiContainer.add(this.selectionGraphics);
    this.registry.set('selectionGraphics', this.selectionGraphics);
    // -------------------------------- //

    // --- Create Ruler Graphics --- //
    this.rulerGraphics = this.add.graphics();
    this.rulerGraphics.setDepth(10); // Depth relative to uiContainer
    // Ruler graphics don't need scroll factor as they are redrawn in place
    this.uiContainer.add(this.rulerGraphics);
    this.registry.set('rulerGraphics', this.rulerGraphics);
    this.rulerTexts = []; // Initialize/reset text array
    // ----------------------------- //

    // --- Create Map Nickname Text --- //
    this.mapNicknameText = this.add.text(
      // Initialize at 0, resize handler will position it correctly
      0,                 // <-- Set initial x to 0
      16,                // Position near the top
      this.mapNickname || 'Loading Map...', // Initial text
      {
        fontFamily: '"Press Start 2P", monospace', // Specify font
        fontSize: '16px',                       // Adjust size as needed
        color: '#ffffff',                       // White color
        align: 'center',
        // Optional: Add stroke or shadow for visibility
        // stroke: '#000000',
        // strokeThickness: 2,
      }
    ).setOrigin(0.5, 0); // Center horizontally, align top
    this.mapNicknameText.setDepth(12); // Ensure it's above other UI elements
    this.mapNicknameText.setScrollFactor(0); // Keep fixed
    this.uiContainer.add(this.mapNicknameText); // Add to the UI container
    this.registry.set('mapNicknameText', this.mapNicknameText); // Register

    // Recenter the text immediately if gameWidth is already known
    // This helps if resize hasn't run yet but width is available
    if (this.gameWidth > 0) {
      this.mapNicknameText.x = this.gameWidth / 2;
    }

    // Set initial visibility
    this.mapNicknameText.visible = this.isMapTitleVisible;
    // -------------------------------- //

    // --- Reset Center Marker References --- //
    this.centerMarker = null;
    this.centerText = [];
    // ------------------------------------ //
  }

  /**
   * Populates the initial map state (crops, rent) using data provided by
   * MapService. Parses coordinates from the payload keys and passes valid data
   * to the respective managers.
   * @param {object} initialTilesData - An object where keys are "x,y" strings
   *   and values are tile data objects.
   * @private
   */
  _populateInitialState(initialTilesData) {
    // Parse for invalid keys and prep data for Managers
    const tileDataForManager = Object.entries(initialTilesData).map(
      ([coordString, tileData]) => {
        const [xStr, yStr] = coordString.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        // Check if parsing failed
        if (isNaN(x) || isNaN(y)) {
          console.warn(
            `[NewGame _populateInitialState] Failed to parse coordinates ` +
            `from key: ${coordString}. Skipping this tile for crop loading.`
          );
          return null; // Indicate failure to parse
        }

        // Merge coordinates with the tile data
        return {
          x,
          y,
          ...tileData, // Spread the rest of the tile data
        };
      }
    );

    // Filter out any entries that failed parsing
    const validTileData = tileDataForManager.filter(data =>
      data !== null);
    // Load crops
    if (this.cropManager) {
      // --- Debugging --- 
      // console.debug(
      //   `[NewGame _populateInitialState] Loading crops for ` + 
      //   `${validTileData.length} tiles.`
      // );
      this.cropManager.loadCrops(validTileData);
    } else {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `CropManager not initialized, cannot load crops.`
      );
    }

    // Populate the initial map layer
    if (this.itemRenderer) {
      this.itemRenderer.populateInitialMapLayer(initialTilesData);
      // --- Debugging --- 
      // console.debug(
      //   `[NewGame _populateInitialState] Populated initial ` + 
      //   `map layer for ${validTileData.length} tiles.`
      // );
    } else {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `ItemRenderer not initialized, cannot populate map layer.`
      );
    }

    if (this.rentManager) {
      // Use the new load method for batch processing
      this.rentManager.load(validTileData);
      /* --- REMOVED OLD LOOP ---
      validTileData.forEach(tile => {
        if (tile.properties &&
          Object.hasOwn(tile.properties, 'nextRentDue')) {
          this.rentManager.addOrUpdateTile(
            tile.x,
            tile.y,
            tile.properties.nextRentDue
          );
        }
      });
      */
    } else {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `RentManager not initialized, cannot process initial rent states.`
      );
    }
    // Placeholder for other map data

  }

  /**
   * Creates the core Tilemap structure: the Tilemap object itself, adds the
   * necessary Tileset image, and creates the blank base TilemapLayer.
   * @param {number} mapWidth - The width of the map in tiles.
   * @param {number} mapHeight - The height of the map in tiles.
   * @returns {{map: Phaser.Tilemaps.Tilemap,
   *            tileset: Phaser.Tilemaps.Tileset | null,
   *            layer: Phaser.Tilemaps.TilemapLayer | null}} References to the
   *   created map, tileset (or null on failure), and layer (or null on
   *   failure).
   * @private
   */
  _createMapStructure(mapWidth, mapHeight) {
    const TILE_WIDTH = 32;
    const TILE_HEIGHT = 32;

    // Create Tilemap
    this.map = this.make.tilemap({
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      width: mapWidth,
      height: mapHeight,
    });

    // Add Tileset
    const tileset = this.map.addTilesetImage(
      'farmableGroundTileset',
      'farmableGround'
    );
    if (!tileset) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `Failed to add tileset 'farmableGround'.`
      );
      return { map: this.map, tileset: null, layer: null };
    }

    // Create Layer
    const layer = this.map.createBlankLayer('baseLayer', tileset, 0, 0);
    if (!layer) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `Failed to create blank layer 'baseLayer'.`
      );
      return { map: this.map, tileset: tileset, layer: null };
    }

    return { map: this.map, tileset: tileset, layer: layer };
  }

  /**
   * Performs final scene setup steps after map structure and initial state are
   * ready. Sets background color, sets up event listeners, performs initial
   * layout/resize, initializes audio, and marks the scene as fully ready.
   * Emits relevant events ('current-scene-ready', 'game-map-loaded', etc.).
   * @private
   */
  async _finalizeSceneSetup() {
    // Set the main camera background to black
    this.cameras.main.setBackgroundColor(0x000000);

    // Setup event listeners (EventBus, Phaser scale)
    await this._setupEventListeners(); // Ensure listeners affecting layout are ready

    // Perform Initial Layout (resize, positioning) and State Setup
    await this._performInitialLayoutAndState(); // Includes initial selection

    // Initialize and play audio
    await this._initializeAudio();

    // Final step: Mark the scene as fully initialized
    this.isFullyInitialized = true;

    // Emit the initial state for the UI map title toggle
    EventBus.emit('map-title-visibility-state', this.isMapTitleVisible);

    // Emit scene ready event LAST, ensuring all internal setup is complete
    EventBus.emit('current-scene-ready', this);

    // Emit map loaded event after scene is ready
    if (this.mapId) {
      EventBus.emit('game-map-loaded', {
        mapId: this.mapId,
        mapNickname: this.mapNickname || 'Unknown Map',
      });
    }

    // Signal debounce status END (Safety net)
    EventBus.emit('reload-debounce-status', false);
  }

  /**
   * Sets up all necessary event listeners for the scene, including global
   * EventBus listeners (tile selection, reload, movement, farming actions, map
   * title visibility), Phaser scale resize listener, and scene-specific event
   * listeners (like center update requests).
   * @private
   */
  async _setupEventListeners() {
    // General Event Bus Listeners
    if (typeof this.handleTilesSelected === 'function') {
      EventBus.on('tiles-selected', this.handleTilesSelected.bind(this));
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] ` +
        `handleTilesSelected method not found, listener not attached.`
      );
    }

    // Scene Reload Listener
    this.handleReloadRequest = () => {
      const now = performance.now();
      const DEBOUNCE_MS = 5000;
      EventBus.emit('reload-debounce-status', true);
      if (now - this.lastReloadTime < DEBOUNCE_MS) return;
      if (this.mapId) {
        this.lastReloadTime = now;
        this.mapService.requestMapData();
      } else {
        console.warn(
          `[${new Date().toISOString()}] [WARN] [NewGame] ` +
          `Reload requested but no mapId available.`
        );
      }
    };
    EventBus.on('reload-current-scene', this.handleReloadRequest, this);

    // Phaser Resize Listener
    this.debouncedResizeHandler = this._debounce(
      this.handlePhaserResize.bind(this),
      250
    );
    this.scale.on('resize', this.debouncedResizeHandler, this);

    // Movement Listeners (EventBus & Keyboard)
    this._setupMovementListeners();

    // Farming Action Listeners
    this._setupFarmingActionListeners();

    // Center Update Listener (from MapService)
    if (this.events) {
      this._boundHandleRequestCenterUpdate = (coords) => {
        if (this.inputHandler && coords) {
          console.debug(
            `[NewGame] Received requestCenterUpdate from MapService. ` +
            `Moving center to (${coords.x}, ${coords.y}).`
          );
          this.inputHandler.updateCenter(coords.x, coords.y, true); // Use instant=true
        }
      };
      this.events.on(
        'scene:requestCenterUpdate',
        this._boundHandleRequestCenterUpdate
      );
    } else {
      console.warn(
        '[NewGame] Scene events not available, cannot listen for ' +
        'scene:requestCenterUpdate.'
      );
    }

    // Map Title Visibility Listener
    this._boundHandleSetMapTitleVisibility = (isVisible) => {
      this.isMapTitleVisible = isVisible;
      if (this.mapNicknameText) {
        this.mapNicknameText.visible = this.isMapTitleVisible;
      }
    };
    EventBus.on(
      'set-map-title-visibility',
      this._boundHandleSetMapTitleVisibility,
      this
    );
  }

  /**
   * Sets up movement-related event listeners, both from the global EventBus
   * ('move-up', 'move-down', etc.) and direct keyboard input (Arrow keys, WASD).
   * @private
   */
  _setupMovementListeners() {
    // EventBus Movement
    this._boundMoveUpHandler = () => this._handleMoveEvent(0, -1);
    this._boundMoveDownHandler = () => this._handleMoveEvent(0, 1);
    this._boundMoveLeftHandler = () => this._handleMoveEvent(-1, 0);
    this._boundMoveRightHandler = () => this._handleMoveEvent(1, 0);
    EventBus.on('move-up', this._boundMoveUpHandler, this);
    EventBus.on('move-down', this._boundMoveDownHandler, this);
    EventBus.on('move-left', this._boundMoveLeftHandler, this);
    EventBus.on('move-right', this._boundMoveRightHandler, this);

    // Keyboard Movement
    if (this.input?.keyboard) {
      // Arrow Keys
      this.input.keyboard.on('keydown-UP', () => this._handleMoveEvent(0, -1));
      this.input.keyboard.on('keydown-DOWN', () => this._handleMoveEvent(0, 1));
      this.input.keyboard.on('keydown-LEFT', () => this._handleMoveEvent(-1, 0));
      this.input.keyboard.on('keydown-RIGHT', () => this._handleMoveEvent(1, 0));
      // WASD Keys
      this.input.keyboard.on('keydown-W', () => this._handleMoveEvent(0, -1));
      this.input.keyboard.on('keydown-S', () => this._handleMoveEvent(0, 1));
      this.input.keyboard.on('keydown-A', () => this._handleMoveEvent(-1, 0));
      this.input.keyboard.on('keydown-D', () => this._handleMoveEvent(1, 0));
    } else {
      console.warn('[NewGame] Keyboard input not available for listeners.');
    }
  }

  /**
   * Sets up EventBus listeners for farming-related actions triggered by the UI
   * (e.g., 'clear-rubble', 'plant-crop', 'harvest-crop', 'speed-grow',
   * 'lease-tile', 'pay-rent', 'rent-due'). Binds the handler methods.
   * @private
   */
  _setupFarmingActionListeners() {
    this._boundHandleClearRubble = this._handleClearRubble.bind(this);
    this._boundHandlePlantCrop = this._handlePlantCrop.bind(this);
    this._boundHandleHarvestCrop = this._handleHarvestCrop.bind(this);
    this._boundHandleSpeedGrow = this._handleSpeedGrow.bind(this);
    this._boundHandleLeaseTile = this._handleLeaseTile.bind(this);
    this._boundHandlePayRent = this._handlePayRent.bind(this);
    this._boundHandleRentDue = this._handleRentDueEvent.bind(this);

    EventBus.on('clear-rubble', this._boundHandleClearRubble);
    EventBus.on('plant-crop', this._boundHandlePlantCrop);
    EventBus.on('harvest-crop', this._boundHandleHarvestCrop);
    EventBus.on('speed-grow', this._boundHandleSpeedGrow);
    EventBus.on('lease-tile', this._boundHandleLeaseTile);
    EventBus.on('pay-rent', this._boundHandlePayRent);
    EventBus.on('rent-due', this._boundHandleRentDue);
  }

  /**
   * Handles initial layout calculations, rendering, and state setup after the
   * map data is ready but before audio plays or the scene is fully initialized.
   * Performs an initial resize, renders the map via ItemRenderer, sets up the
   * initial tile selection, and marks the center for debugging.
   * @private
   */
  async _performInitialLayoutAndState() {
    // Signal readiness early for components that might need it before audio/full init
    this.isMapReady = true;

    // --- Perform Initial Resize and Positioning ---
    if (this.scale.gameSize) {
      this.resize(this.scale.gameSize.width, this.scale.gameSize.height);
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] ` +
        `Scale Manager size not available for initial resize.`
      );
    }
    // Initial render call happens after first resize attempt
    this.itemRenderer?.renderItemMap();

    // --- Setup Initial Selection ---
    this._setupInitialSelection();

    // --- Mark Center for Debug ---
    this._updateCenterMarker();
  }

  /**
   * Sets the initial tile selection state. Prioritizes using a selection
   * requested during a scene restart. If no selection was requested, it
   * currently defaults to no selection (previously selected the center tile).
   * Emits a 'tiles-selected' event if an initial selection is applied.
   * @private
   */
  _setupInitialSelection() {
    if (!this.inputHandler) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] ` +
        `InputHandler not ready, cannot set initial selection.`
      );
      this.requestedSelection = null; // Clear requested if handler isn't ready
      return;
    }

    // --- Apply requested selection from restart (if any) ---
    if (this.requestedSelection) {
      this.inputHandler.setSelectedTiles(this.requestedSelection);
      console.debug(
        `[NewGame] Emitting tiles-selected event for ` +
        `${this.requestedSelection.length} restored tiles.`
      );
      EventBus.emit('tiles-selected', this.requestedSelection);
      this.requestedSelection = null; // Clear after use
    } else {
      // Map Coordinates debugging:
      // Keep for debugging
      // --- Auto-select the center tile (Default) ---
      // const centerTile = {
      //   x: this.currentCenterTile.x,
      //   y: this.currentCenterTile.y,
      // };
      // this.inputHandler.setSelectedTiles([centerTile]);
      // // Emit event for the default center selection as well
      // EventBus.emit('tiles-selected', [centerTile]);
    }
  }

  /**
   * Updates the debug center marker's position and text based on the current
   * center tile and camera position. (Currently commented out in the method
   * body).
   * @private
   */
  _updateCenterMarker() {
    if (this.inputHandler) {
      // TEMP: Commented out marker logic, enable if needed for debugging
      // this.inputHandler.markGridCenter();
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] ` +
        `InputHandler not ready, cannot mark center tile.`
      );
    }
  }

  /**
   * Initializes the audio manager instance obtained from the registry and
   * notifies it of the scene change to start playing the appropriate
   * background music for the NewGame scene.
   * @private
   */
  async _initializeAudio() {
    const audioHandler = this.registry.get('audioHandler');
    if (!audioHandler) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] ` +
        `AudioManager not found in registry. Cannot initialize audio.`
      );
      return; // Exit if no audio handler
    }

    try {
      await audioHandler.init(); // Wait for AudioManager to be fully ready
      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [NewGame] ` +
      //   `Calling audioHandler.changeScenes for ${SCENES.NEW_GAME}...`
      // );
      // *** Notify AudioManager of the scene change AFTER init ***
      audioHandler.changeScenes(SCENES.NEW_GAME, 'NewGame');

    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `Error during AudioManager initialization or music playback:`,
        error
      );
    }
  }

  /**
   * @method getGridCenter
   * @description Calculates the logical center tile's screen position and
   *   related information (absolute coordinates, game dimensions).
   * @returns {{x: number, y: number, tileX: number | undefined, tileY: number
   *   | undefined, absoluteX: number, absoluteY: number, gameWidth: number,
   *   gameHeight: number}} An object containing:
   *   - `x`, `y`: Screen coordinates of the center point (usually canvas
   *     center).
   *   - `tileX`, `tileY`: Logical tile coordinates of the current center tile.
   *   - `absoluteX`, `absoluteY`: Calculated absolute world coordinates of the
   *     center of the center tile.
   *   - `gameWidth`, `gameHeight`: Current dimensions of the game canvas.
   */
  getGridCenter() {
    return {
      x: (this.gameWidth ?? this.sys.game.config.width) / 2,
      //The center tile uses two translations to reach the center of the screen
      // 1. The tile's position relative to the map's origin
      // 2. The map's position relative to the screen's origin

      // Accurately calculating the center tile's position is a bit tricky
      // because the tileSizeX and tileSizeY are floating point values
      // and the itemMapContainer's position is an integer value
      // So we need to use the tileSizeX and tileSizeY properties to
      // calculate the absolute position of the center tile

      // Target Y is calculated as gameHeight / 4 in the resize function
      // The system width and height do not accomodate half-sized phaser scenes
      // So we use the gameWidth and gameHeight properties instead
      // When window is resized, the gameWidth and gameHeight properties are
      // updated to match the window size
      // This ensures the center marker is positioned at the top half of the
      // screen, with React components occupying the bottom half.
      y: this.gameHeight
        ? this.gameHeight / 2
        : this.sys.game.config.height / 4,

      // The currentCenterTile is the logical center tile of the map
      // This is used to calculate the absolute position of the center marker
      tileX: this.currentCenterTile?.x,
      tileY: this.currentCenterTile?.y,

      // The absolute position of the center marker is the sum of the
      // container's position and the center tile's position
      // position and the center tile's position
      absoluteX:
        this.itemMapContainer?.x +
        (this.currentCenterTile?.x * this.tileSizeX + this.tileSizeX / 2),
      absoluteY:
        this.itemMapContainer?.y +
        (this.currentCenterTile?.y * this.tileSizeY + this.tileSizeY / 2),
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
    };
  }

  /**
   * @method getItemMapContainerPosition
   * @description Returns the current top-left screen position (x, y) of the
   *   `itemMapContainer`. Required by InputHandler for coordinate calculations.
   * @returns {{x: number, y: number}} The container's position, or {x: 0, y: 0}
   *   if the container doesn't exist.
   */
  getItemMapContainerPosition() {
    return this.itemMapContainer
      ? { x: this.itemMapContainer.x, y: this.itemMapContainer.y }
      : { x: 0, y: 0 };
  }

  /**
   * @method initializeManagers
   * @description Creates and registers instances of core gameplay managers:
   *   `CropManager`, `RentManager`, and `InputHandler`. Ensures the
   *   `itemMapContainer` exists before initializing `InputHandler`. Also cleans
   *   up any pre-existing rent-related event listeners.
   * @returns {void}
   */
  initializeManagers() {
    if (!this.cropManager) {
      this.cropManager = new CropManager(this);
      this.registry.set('cropManager', this.cropManager);
    }
    // <-- ADDED: Initialize RentManager -->
    if (!this.rentManager) {
      this.rentManager = new RentManager(this);
      this.registry.set('rentManager', this.rentManager);
    }
    // <----------------------------------->
    if (!this.itemMapContainer) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
        `Cannot initialize InputHandler: itemMapContainer is missing!`
      );
      return; // Or handle error appropriately
    }
    if (!this.inputHandler) {
      this.inputHandler = new InputHandler(this);
      this.registry.set('inputHandler', this.inputHandler);
    }
    if (this._boundHandlePayRent) {
      EventBus.off('pay-rent', this._boundHandlePayRent);
      this._boundHandlePayRent = null;
    }
    if (this._boundHandleRentDue) {
      EventBus.off('rent-due', this._boundHandleRentDue);
      this._boundHandleRentDue = null;
    }
    // <------------------------------------->
  }

  /**
   * @method initializeItemRenderer
   * @description Creates and registers an instance of the `ItemRenderer`,
   *   responsible for drawing tiles and items onto the `itemMapContainer`.
   *   Ensures required dependencies (`itemMapContainer`, `cropManager`) exist
   *   before initialization.
   * @returns {void}
   */
  initializeItemRenderer() {
    if (!this.itemRenderer) {
      // Pass scene, container, and cropManager to the constructor
      if (!this.itemMapContainer) {
        console.error(
          `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
          `Cannot initialize ItemRenderer: itemMapContainer is missing!`
        );
        return;
      }
      if (!this.cropManager) {
        console.error(
          `[${new Date().toISOString()}] [ERROR] [NewGame] ` +
          `Cannot initialize ItemRenderer: cropManager is missing!`
        );
        return;
      }
      this.itemRenderer = new ItemRenderer(this);
      this.registry.set('itemRenderer', this.itemRenderer);
    }
  }

  /**
   * @method update
   * @description Phaser scene lifecycle method, called every game frame.
   *   Handles updating the selection box visualization if the user is actively
   *   selecting, updates the rendering via `ItemRenderer`, and draws the debug
   *   ruler.
   * @param {number} time - The current time in milliseconds.
   * @param {number} delta - The time in milliseconds since the last frame.
   * @returns {void}
   */
  update(time, delta) {
    super.update(time, delta); // Call SceneBase update if needed

    // Update selection box visualization if selecting
    if (this.inputHandler?.isSelecting) {
      this.inputHandler.updateSelectionBox();
    }

    // --- Only run marking after map is ready --- //
    if (this.isMapReady) {
      // --- Removed Keyboard Input Handling --- //
    }
    // ------------------------------------------- //

    // Update rendering via ItemRenderer (Renderer might handle its own readiness checks)
    this.itemRenderer?.renderItemMap();

    // --- Draw Ruler and Mark Center --- //
    this._drawRuler();

    // TEMP: Commented out to debug movement issues
    //this.markGridCenter();
    // ---------------------------------- //
  }

  /**
   * @method resize
   * @description Handles resizing of the game canvas. Updates internal game
   *   dimensions, recalculates the `itemMapContainer` position to keep the
   *   `currentCenterTile` centered, recreates the UI container and its
   *   elements (including wallet text), recreates sprite pools in
   *   `ItemRenderer`, re-renders the map, and re-applies tile highlights.
   *   Includes debouncing logic (`_lastResizeWidth`, `_lastResizeHeight`).
   * @param {number} width - The new canvas width.
   * @param {number} height - The new canvas height.
   * @returns {void}
   */
  resize(width, height) {
    // --- Check if dimensions actually changed --- //
    if (width === this._lastResizeWidth && height === this._lastResizeHeight) {
      return; // Dimensions are the same, no need to resize
    }

    // --- Update last known dimensions --- //
    this._lastResizeWidth = width;
    this._lastResizeHeight = height;
    // Also update the main gameWidth/Height used elsewhere
    this.gameWidth = width;
    this.gameHeight = height;
    // ------------------------------------ //

    if (!this.sys) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] Scene not ready for resize`
      );
      return;
    }

    if (
      this.isMapReady &&
      this.itemMapContainer &&
      this.currentCenterTile &&
      this.tileSizeX &&
      this.tileSizeY
    ) {
      // Get the logical center tile coordinates
      const targetContainerXStart = this.gameWidth / 2;
      const targetContainerYStart = this.gameHeight / 2;
      const tileOffsetX = this.tileSizeX / 2;
      const tileOffsetY = this.tileSizeY / 2;

      const targetContainerX =
        targetContainerXStart -
        (this.currentCenterTile.x * this.tileSizeX + tileOffsetX);
      const targetContainerY =
        targetContainerYStart -
        (this.currentCenterTile.y * this.tileSizeY + tileOffsetY);

      // Recreate the UI container
      this._recreateUiContainer();

      // Set position of the main map container
      this.itemMapContainer.setPosition(targetContainerX, targetContainerY);

      // Recreate the ItemRenderer Sprite Pool
      this.itemRenderer?.recreatePools();

      this.itemRenderer?.renderItemMap();

      // --- Reposition Wallet Balance Text if it exists --- //
      this._repositionWalletText();
      // --------------------------------------------------- //

      // --- Re-apply highlight state after resize ---
      if (this.inputHandler && this.itemRenderer) {
        const currentSelection = this.inputHandler.getSelectedTiles();
        // Ensure an empty array is passed if selection is null/undefined
        this.itemRenderer.setHighlightedTiles(currentSelection || []);
      }
      // -------------------------------------------

      // TEMP: Commented out to debug movement issues
      // this.inputHandler?.markGridCenter();
    }
  }

  /**
   * @method shutdown
   * @description Phaser scene lifecycle method called when the scene is shut
   *   down. Sets the `isShuttingDown` flag and calls helper methods to clean
   *   up socket listeners, EventBus listeners, managers (Crop, Rent, Input,
   *   ItemRenderer, MapService), and game objects (containers, graphics,
   *   text). Calls the base class shutdown and ensures the reload debounce
   *   status is reset.
   * @returns {void}
   */
  shutdown() {
    this.isShuttingDown = true; // Set flag immediately

    this._cleanupSocketListeners(this.game.registry.get('socket'));
    this._cleanupEventBusListeners();
    this._cleanupManagers();
    this._cleanupGameObjects();

    // Remove Phaser event listeners (specific to shutdown itself)
    this.events.off('shutdown', this.shutdown, this);

    // Call base shutdown
    super.shutdown();

    // --- Signal debounce status END (Safety) --- //
    EventBus.emit('reload-debounce-status', false);
    // ------------------------------------------ //
  }

  /**
   * @method _cleanupSocketListeners
   * @description Removes socket event listeners attached by this scene, both
   *   directly on the socket instance and indirectly via MapService's scene
   *   event emitter.
   * @param {Object|null|undefined} socket - The socket instance (can be null or undefined).
   * @private
   * @returns {void}
   */
  _cleanupSocketListeners(socket) {
    if (!socket) return;

    socket.off('initialMapData', this.handleInitialMapDataReceived);

    // Also remove listeners for MapService events from the scene's
    // event emitter
    if (this.mapService?.scene?.events) {
      // Explicitly remove the .once listener for initial map data
      this.mapService.scene.events.off(
        'initialMapData',
        this.handleInitialMapDataReceived,
        this
      );

      // Remove any potential lingering listener if setup failed midway
      this.mapService.scene.events.off('mapSocketConnected');

      this.mapService.scene.events.off(
        'tileUpdated',
        this.handleTileUpdate,
        this
      );
      this.mapService.scene.events.off(
        'mapSocketDisconnected',
        this.handleMapSocketDisconnect,
        this
      );
      // Added missing error listener removal
      this.mapService.scene.events.off(
        'mapSocketError',
        this.handleMapSocketError,
        this
      );
    }
  }

  /**
   * @method _cleanupEventBusListeners
   * @description Removes all global EventBus listeners attached by this scene
   *   by calling specific cleanup helper methods for movement, farming actions,
   *   and other miscellaneous listeners.
   * @private
   * @returns {void}
   */
  _cleanupEventBusListeners() {
    // Call helper methods to reduce complexity
    this._cleanupMovementListeners();
    this._cleanupFarmingActionListeners();
    this._cleanupOtherListeners();
  }

  /**
   * Removes movement-related listeners, including both EventBus listeners
   * ('move-up', etc.) and direct keyboard listeners (Arrow keys, WASD).
   * Nullifies bound handler references.
   * @private
   */
  _cleanupMovementListeners() {
    // Remove EventBus Movement Listeners
    if (this._boundMoveUpHandler) {
      EventBus.off('move-up', this._boundMoveUpHandler, this);
      this._boundMoveUpHandler = null;
    }
    if (this._boundMoveDownHandler) {
      EventBus.off('move-down', this._boundMoveDownHandler, this);
      this._boundMoveDownHandler = null;
    }
    if (this._boundMoveLeftHandler) {
      EventBus.off('move-left', this._boundMoveLeftHandler, this);
      this._boundMoveLeftHandler = null;
    }
    if (this._boundMoveRightHandler) {
      EventBus.off('move-right', this._boundMoveRightHandler, this);
      this._boundMoveRightHandler = null;
    }

    // Remove Direct Keyboard Movement Listeners
    if (this.input?.keyboard) { // Check if keyboard input exists
      this.input.keyboard.off('keydown-UP');
      this.input.keyboard.off('keydown-DOWN');
      this.input.keyboard.off('keydown-LEFT');
      this.input.keyboard.off('keydown-RIGHT');
      this.input.keyboard.off('keydown-W');
      this.input.keyboard.off('keydown-S');
      this.input.keyboard.off('keydown-A');
      this.input.keyboard.off('keydown-D');
    }
  }

  /**
   * Removes farming action-related EventBus listeners ('clear-rubble',
   * 'plant-crop', 'harvest-crop', 'speed-grow', 'lease-tile', 'pay-rent',
   * 'rent-due'). Nullifies bound handler references.
   * @private
   */
  _cleanupFarmingActionListeners() {
    if (this._boundHandleClearRubble) {
      EventBus.off('clear-rubble', this._boundHandleClearRubble);
      this._boundHandleClearRubble = null;
    }
    if (this._boundHandlePlantCrop) {
      EventBus.off('plant-crop', this._boundHandlePlantCrop);
      this._boundHandlePlantCrop = null;
    }
    if (this._boundHandleHarvestCrop) {
      EventBus.off('harvest-crop', this._boundHandleHarvestCrop);
      this._boundHandleHarvestCrop = null;
    }
    if (this._boundHandleSpeedGrow) {
      EventBus.off('speed-grow', this._boundHandleSpeedGrow);
      this._boundHandleSpeedGrow = null;
    }
    if (this._boundHandleLeaseTile) {
      EventBus.off('lease-tile', this._boundHandleLeaseTile);
      this._boundHandleLeaseTile = null;
    }
    if (this._boundHandlePayRent) {
      EventBus.off('pay-rent', this._boundHandlePayRent);
      this._boundHandlePayRent = null;
    }
    // Remove Rent-Due listener
    if (this._boundHandleRentDue) {
      EventBus.off('rent-due', this._boundHandleRentDue);
      this._boundHandleRentDue = null;
    }
  }

  /**
   * Removes miscellaneous listeners attached during scene setup, including:
   *   - 'tiles-selected' (EventBus)
   *   - 'reload-current-scene' (EventBus)
   *   - Phaser 'resize' listener
   *   - 'scene:requestCenterUpdate' (Scene Events)
   *   - 'set-map-title-visibility' (EventBus)
   *   - 'player-wallet-updated' (EventBus)
   * Also removes the wallet balance request timer. Nullifies bound handler
   * references.
   * @private
   */
  _cleanupOtherListeners() {
    // Remove tiles-selected listener
    // No need to check for function existence here, EventBus.off handles it
    EventBus.off('tiles-selected', this.handleTilesSelected, this);

    // Remove reload listener
    if (this.handleReloadRequest) {
      EventBus.off('reload-current-scene', this.handleReloadRequest, this);
      // It's good practice to nullify the reference after removal
      this.handleReloadRequest = null;
    }

    // Remove Phaser Scale Manager Listener
    if (this.scale && this.debouncedResizeHandler) {
      this.scale.off('resize', this.debouncedResizeHandler, this);
      // Nullify the debounced handler reference
      this.debouncedResizeHandler = null;
    }

    // Remove Listener for Center Update Requests
    if (this.events && this._boundHandleRequestCenterUpdate) {
      this.events.off(
        'scene:requestCenterUpdate',
        this._boundHandleRequestCenterUpdate
      );
      this._boundHandleRequestCenterUpdate = null;
    }

    // Remove Map Title Visibility Listener
    if (this._boundHandleSetMapTitleVisibility) {
      EventBus.off(
        'set-map-title-visibility',
        this._boundHandleSetMapTitleVisibility,
        this
      );
      this._boundHandleSetMapTitleVisibility = null;
    }

    // <-- ADDED: Cleanup wallet listener -->
    if (this._boundHandlePlayerWalletUpdated) {
      EventBus.off(
        'player-wallet-updated',
        this._boundHandlePlayerWalletUpdated,
        this
      );
      this._boundHandlePlayerWalletUpdated = null;
    }
    if (this.walletBalanceTimer) {
      this.time.removeEvent(this.walletBalanceTimer);
      this.walletBalanceTimer = null;
    }
    // <------------------------------------->
  }

  /**
   * @method _cleanupManagers
   * @description Destroys and nullifies references to all scene-specific
   *   managers: `InputHandler`, `CropManager`, `RentManager`, `ItemRenderer`,
   *   and `MapService`. Calls the `destroy` or `cleanup` method on each manager
   *   if it exists.
   * @private
   * @returns {void}
   */
  _cleanupManagers() {
    this.inputHandler?.destroy();
    this.inputHandler = null;
    this.cropManager?.destroy();
    this.cropManager = null;
    this.rentManager?.destroy();
    this.rentManager = null;
    this.itemRenderer?.destroy();
    this.itemRenderer = null;
    // --- Clean up MapService ---
    this.mapService?.cleanup();
    this.mapService = null;
    // --- End MapService Cleanup ---
  }

  /**
   * @method _cleanupGameObjects
   * @description Destroys and nullifies references to Phaser Game Objects
   *   created and managed directly by this scene, including containers
   *   (`uiContainer`, `itemMapContainer` and their children), graphics objects
   *   (`selectionGraphics`, `rulerGraphics`), text objects (`debugText`,
   *   `rulerTexts`, `centerText`, `mapNicknameText`, `walletBalanceText`), and
   *   the `centerMarker`. Sprite pool cleanup is handled by
   *   `ItemRenderer.destroy()`.
   * @private
   * @returns {void}
   */
  _cleanupGameObjects() {
    // Destroy containers and their children (this still implicitly destroys
    // sprites added to them if ItemRenderer failed, but ItemRenderer.destroy
    // should have already destroyed them explicitly).
    this.uiContainer?.destroy(true);
    this.uiContainer = null;
    this.itemMapContainer?.destroy(true); // true to destroy children
    this.itemMapContainer = null;

    // Destroy other scene objects managed directly by NewGame
    this.debugText?.destroy();
    this.debugText = null;

    this.selectionGraphics?.destroy();
    this.selectionGraphics = null;

    this.rulerGraphics?.destroy();
    this.rulerGraphics = null;
    this.rulerTexts.forEach((text) => text.destroy());
    this.rulerTexts = [];

    this.centerMarker?.destroy();
    this.centerMarker = null;
    this.centerText?.forEach((txt) => txt?.destroy()); // Handle potential nulls
    this.centerText = [];

    this.mapNicknameText?.destroy(); // Destroy nickname text
    this.mapNicknameText = null;

    // <-- ADDED: Cleanup wallet text -->
    this.walletBalanceText?.destroy();
    this.walletBalanceText = null;
    // <----------------------------------->
  }

  /**
   * Handles tile update data received via MapService events ('tileUpdated').
   * Parses the payload, determines if crop or rent data needs processing,
   * calls the relevant processing methods (`_processCropUpdate`,
   * `_processRentUpdate`), triggers visual updates via `_performVisualUpdate`,
   * and finally emits a global 'tileUpdated' event on the EventBus.
   * @param {object} payload - The update payload from MapService. Expected
   *   format: `{ x: number, y: number, updates: object }`.
   * @param {number} payload.x - The x-coordinate of the updated tile.
   * @param {number} payload.y - The y-coordinate of the updated tile.
   * @param {object} payload.updates - An object containing the changed tile
   *   properties (e.g., `{ type: 1, cropType: 'wheat', cropPlantedAt: ... }`).
   * @private
   */
  handleTileUpdate(payload) {
    const { x, y, updates } = payload || {};

    if (x === undefined || y === undefined || !updates) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame handleTileUpdate] ` +
        `Received invalid payload:`,
        payload
      );
      return;
    }

    let needsCropProcessing = false;

    // 1. Check if base tile type needs update
    let needsVisualRefresh = Object.hasOwn(updates, 'type');

    // 2. Check if any crop-related data needs processing
    const cropFields = ['cropType', 'cropPlantedAt', 'cropLevel'];
    if (cropFields.some(field =>
      Object.hasOwn(updates, field))) {
      needsCropProcessing = true;
    }

    // --- Process Data Updates First ---

    // 3. Process crop updates if necessary (updates CropManager state)
    let didProcessCrop = false; // Track if crop processing actually happened
    if (needsCropProcessing) {
      // This ensures CropManager's state (like timers based on
      // cropPlantedAt) is updated *before* the visual render.
      didProcessCrop = this._processCropUpdate(x, y, updates);
    }

    // Update RentManager
    // checks updates for solely nextRentDue
    // also checks if the tile was initially leased
    this._processRentUpdate(x, y, updates);

    // --- Perform Visual Updates ---
    this._performVisualUpdate(x, y, updates, needsVisualRefresh, didProcessCrop);

    // Emit the event on the global EventBus AFTER internal processing
    EventBus.emit('tileUpdated', payload);
  }

  /**
   * Processes crop-related updates for a specific tile based on data received
   * from the server (`handleTileUpdate`). Handles planting new crops, updating
   * existing crops (including SpeedGrow partial updates), or removing crops
   * based on the `updates` object, primarily checking the `cropType` field.
   * Interacts with `CropManager`.
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   * @param {object} updates - The update data object for the tile. May contain
   *   `cropType`, `cropLevel`, `cropPlantedAt`.
   * @returns {boolean} True if a crop state change (add, update, remove) was
   *   processed, false otherwise.
   * @private
   */
  _processCropUpdate(x, y, updates) {
    // 1. Check if cropType update exists. This field determines add/remove.
    if (!Object.hasOwn(updates, 'cropType')) {
      // If cropType isn't part of the update, check if ONLY cropPlantedAt 
      // changed (SpeedGrow)
      if (Object.keys(updates).length === 1 &&
        Object.hasOwn(updates, 'cropPlantedAt') &&
        this.cropManager) {
        // Directly update the specific crop data in CropManager
        this.cropManager.updateCropFromServer(x, y, updates);
        // Return true as we processed the crop update (even if partial)
        return true;
      } else {
        // If neither cropType nor cropPlantedAt (for existing crop) is present,
        // no crop-specific action needed here.
        return false;
      }
    }

    // 2. Handle Crop Removal
    if (updates.cropType === null) {
      if (this.cropManager) {
        this.cropManager.removeCrop(x, y);
        // Debugging: Remove Crop
        // console.debug(
        //   `[NewGame _processCropUpdate] Removed crop at ` + 
        //   `(${x},${y}) based on server update.`
        // );
        return true; // Crop removed successfully
      } else {
        console.warn(
          `[NewGame _processCropUpdate] CropManager not available, ` +
          `cannot remove crop at (${x},${y}).`
        );
        return false; // Failed to process
      }
    }

    // 3. Handle Crop Planting / Full Update (cropType is not null)
    // Server dictates the state. Plant/update based on received data.

    // Validate necessary fields for planting/updating
    if (!Object.hasOwn(updates, 'cropLevel')) {
      console.warn(
        `[NewGame _processCropUpdate] Missing cropLevel in plant/update ` +
        `for (${x},${y}). Skipping.`
      );
      return false;
    }
    if (!Object.hasOwn(updates, 'cropPlantedAt') || !updates.cropPlantedAt) {
      // Check for presence and non-null/non-empty value
      console.warn(
        `[NewGame _processCropUpdate] Invalid or missing cropPlantedAt ` +
        `in plant/update for (${x},${y}). Skipping.`
      );
      return false;
    }

    // Check managers before proceeding
    if (!this.cropManager || !this.itemRenderer) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame _processCropUpdate] ` +
        `CropManager or ItemRenderer missing. Cannot plant/update at (${x},${y}).`
      );
      return false;
    }

    // Check if a crop already exists locally
    if (this.cropManager.hasCrop(x, y)) {
      // --- Update Existing Crop --- //
      this.cropManager.updateCropFromServer(x, y, updates);
      // Debugging: Update Crop
      // console.debug(
      //   `[NewGame _processCropUpdate] Updated existing crop ` +
      //   `at (${x},${y}) based on server update.`, updates
      // );
    } else {
      // --- Plant New Crop --- //
      this.cropManager.plantCrop(
        x,
        y,
        updates.cropType,
        updates.cropPlantedAt,
        updates.cropLevel
      );
      // Debugging: Plant Crop
      // console.debug(
      //   `[NewGame _processCropUpdate] Planted new crop ` +
      //   `at (${x},${y}) based on server update.`, updates
      // );
    }

    return true; // Indicate successful processing
  }

  /**
   * Processes rent-related updates for a specific tile based on data received
   * from the server (`handleTileUpdate`). Specifically checks for changes to
   * `properties.nextRentDue`. If found and not null, updates the `RentManager`.
   * Also re-triggers final stage crop notifications in `ItemRenderer` if rent
   * was paid on a tile with a ready-to-harvest crop.
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   * @param {object} updates - The update data object for the tile. May contain
   *   `properties: { nextRentDue: string | null }`.
   * @private
   */
  _processRentUpdate(x, y, updates) {
    if (!this.rentManager) return;

    // quick check to see if the update is rent-based
    // also checks if the tile was initially leased
    if (Object.hasOwn(updates, 'properties') &&
      Object.hasOwn(updates.properties, 'nextRentDue') &&
      updates.properties.nextRentDue !== null) {
      // Rent paid, tile leased, or other update affecting due date
      this.rentManager.addOrUpdateTile(x, y, updates.properties.nextRentDue);

      // Re-trigger notification for final stage crops ---
      if (this.cropManager && this.itemRenderer) {
        const cropState = this.cropManager.getCrop(x, y);
        // Check if crop exists and is at the final stage (next stage is null)
        if (cropState && cropState.cropNextStage === null) {
          const key = `${x},${y}`;
          this.itemRenderer.finalStageCrops.add(key);
          // The ItemRenderer's render loop will now pick this up and show
          // the notification (unless the tile is highlighted).
        }
      }
      // -----------------------------------------------------------
    }
  }

  /**
   * Performs visual updates for a specific tile after its data has been
   * processed (e.g., by `_processCropUpdate`). If the base tile type changed
   * (`needsVisualRefresh` is true) and no crop processing handled the visual
   * update (`didProcessCrop` is false), it calls `ItemRenderer.updateTileVisual`
   * to refresh the tile's appearance.
   * @param {number} x - The x-coordinate of the tile.
   * @param {number} y - The y-coordinate of the tile.
   * @param {object} updates - The original update data object passed to
   *   `handleTileUpdate`.
   * @param {boolean} needsVisualRefresh - Flag indicating if the base tile
   *   property (e.g., 'type') changed, requiring a visual refresh.
   * @param {boolean} didProcessCrop - Flag indicating if `_processCropUpdate`
   *   handled the update for this tile (it might manage its own visuals).
   * @private
   */
  _performVisualUpdate(x, y, updates, needsVisualRefresh, didProcessCrop) {
    // If crop was processed, its visual update is handled internally or via 
    // events.
    // Only refresh here if base tile changed AND crop processing didn't happen.
    if (!didProcessCrop && needsVisualRefresh) {
      if (this.itemRenderer) {
        // Pass the full updates, ItemRenderer reads latest state
        this.itemRenderer.updateTileVisual({ x, y, ...updates });
      } else {
        console.warn(
          `[${new Date().toISOString()}] [WARN] ` +
          `[NewGame _performVisualUpdate] ` +
          `ItemRenderer not available, ` +
          `cannot visually update tile (${x},${y}).`
        );
      }
    }
  }

  /**
   * Handler for when the MapService socket disconnects unexpectedly. Logs the
   * reason, sets `isMapReady` to false, attempts to retrieve the
   * `audioHandler` from the registry, starts the `MainMenu` scene (passing the
   * audio handler if found), and emits 'stop-game' on the EventBus. Prevents
   * transition if the scene is already shutting down.
   * @param {string} _reason - The reason for disconnection provided by
   *   socket.io.
   * @private
   */
  handleMapSocketDisconnect(_reason) {
    // Prevent transition if disconnect happens during normal shutdown
    if (this.isShuttingDown) {
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [NewGame] ` +
        `Map socket disconnected during shutdown.`,
        _reason
      );
      return;
    }

    // Keep for debugging
    console.warn(
      `[${new Date().toISOString()}] [WARN] [NewGame] ` +
      `Map socket disconnected: ${_reason}. Transitioning to MainMenu.`
    );
    this.isMapReady = false;

    // Ensure audio handler exists before trying to pass it
    const audioHandler = this.registry.get('audioHandler');

    if (!audioHandler) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] ` +
        `AudioManager not found in registry. Cannot pass to MainMenu.`
      );
    }

    // Use the scene manager to start the MainMenu scene
    // Pass the audio handler if it exists
    this.scene.start(SCENES.MAIN_MENU, { audioHandler: audioHandler || null });

    // Note: We don't need to manually clean up this scene here.
    // Phaser's scene manager handles calling shutdown() on the old scene
    // when starting a new one.
    EventBus.emit('stop-game')
  }

  /**
   * Placeholder handler for errors emitted by the MapService socket. Updates
   * the loading text to display the error message.
   * @param {Error} error - The error object emitted by the socket.
   * @private
   */
  handleMapSocketError(error) {
    this.loadingText
      ?.setText(`Connection Error: ${error.message}`)
      .setVisible(true);
    console.error(
      `[NewGame] Map socket error:`,
      error
    );
  }

  /**
   * Handles the 'tiles-selected' event from the EventBus. Updates the
   * `ItemRenderer`'s highlighted tile state based on the received array of
   * selected tile coordinates.
   * @param {Array<{x: number, y: number}> | null} selectedTiles - An array of
   *   selected tile coordinate objects ({x, y}), or null if selection was
   *   cleared.
   */
  handleTilesSelected(selectedTiles) {
    // --- Update ItemRenderer's Highlight State --- //
    if (this.itemRenderer) {
      // Pass empty array if selectedTiles is null or empty,
      // otherwise pass the array itself.
      const tilesToHighlight = selectedTiles || [];
      this.itemRenderer.setHighlightedTiles(tilesToHighlight);
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame handleTilesSelected] ItemRenderer not available to update highlights.`
      );
    }
    // ------------------------------------------- //

    // TODO: Update UI with selectionInfo (e.g., emit event)
    // most UI should be processed by FarmingControls
    // if (selectedTiles && selectedTiles.length > 0) {
    //   // TODO: Update UI with selectionInfo (e.g., emit event)
    // } else {
    //   // Removed console.info here
    //   // TODO: Clear related UI info (e.g., emit event)
    // }
  }

  /**
   * Draws a debugging ruler along the top and left edges of the game view,
   * showing tile coordinates. Clears previous ruler graphics and text, then
   * calls helper methods to draw the horizontal and vertical components based
   * on the current camera/container position and game dimensions. Requires the
   * scene to be fully initialized and necessary registry items (graphics,
   * containers) to be available.
   * @private
   */
  _drawRuler() {
    // Guard: Only proceed if the scene is fully initialized
    if (!this.isFullyInitialized) {
      // Optional: Log a debug message if needed, but avoid spamming
      // console.debug(
      //   `[${new Date().toISOString()}] ` +
      //   `[DEBUG] [NewGame _drawRuler] Scene not fully initialized. ` +
      //   `Skipping draw.`
      // );
      return;
    }

    const rulerGraphics = this.registry.get('rulerGraphics');
    const itemMapContainer = this.registry.get('itemMapContainer');
    const uiContainer = this.registry.get('uiContainer');

    // Ensure scene properties tileSizeX/Y are available
    // Also ensure gameWidth/Height are available
    if (
      !rulerGraphics ||
      !itemMapContainer ||
      !uiContainer ||
      !this.tileSizeX ||
      !this.tileSizeY ||
      !this.gameWidth ||
      !this.gameHeight
    ) {
      // Keep original warn log if prerequisites fail anytime
      if (!this._warnedRulerPrereqs) {
        // Log only once per failure state
        console.warn(
          `[${new Date().toISOString()}] [WARN] [NewGame _drawRuler] Prerequisites not met.`,
          {
            rulerGraphics: !!rulerGraphics,
            itemMapContainer: !!itemMapContainer,
            uiContainer: !!uiContainer,
            tileSizeX: this.tileSizeX,
            tileSizeY: this.tileSizeY,
            gameWidth: this.gameWidth,
            gameHeight: this.gameHeight,
          }
        );
        this._warnedRulerPrereqs = true;
      }
      return; // Not ready
    } else {
      this._warnedRulerPrereqs = false; // Reset warning flag if prerequisites met
    }

    // 1. Clear previous ruler graphics and text
    rulerGraphics.clear();
    this.rulerTexts.forEach((text) => text.destroy());
    this.rulerTexts = [];

    // 2. Define styles
    const RULER_COLOR = 0xaaaaaa;
    const TICK_LENGTH_MAJOR = 10;
    const TICK_LENGTH_MINOR = 5;
    const LABEL_INTERVAL = 5; // Label every 5 tiles
    const textStyle = {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: { x: 1, y: 0 },
    };

    // 3. Get dimensions and positions
    // USE GAME DIMENSIONS
    const screenWidth = this.gameWidth;
    const screenHeight = this.gameHeight;
    const containerX = itemMapContainer.x;
    const containerY = itemMapContainer.y;
    const { tileSizeX, tileSizeY } = this; // Use scene properties

    // 4. Calculate top-left tile coordinates
    const topLeftWorldX = -containerX;
    const topLeftWorldY = -containerY;
    const topLeftTileX = Math.floor(topLeftWorldX / tileSizeX);
    const topLeftTileY = Math.floor(topLeftWorldY / tileSizeY);

    // 5. Calculate bottom-right tile coordinates
    const bottomRightWorldX = screenWidth - containerX;
    const bottomRightWorldY = screenHeight - containerY;
    const endTileX = Math.ceil(bottomRightWorldX / tileSizeX);
    const endTileY = Math.ceil(bottomRightWorldY / tileSizeY);

    // 6. Draw Rulers using helper methods
    // Pass game dimensions
    const positionParamsH = {
      startTileX: topLeftTileX,
      endTileX: endTileX,
      containerX,
      tileSizeX,
      screenWidth: this.gameWidth,
    };
    const positionParamsV = {
      startTileY: topLeftTileY,
      endTileY: endTileY,
      containerY,
      tileSizeY,
      screenHeight: this.gameHeight,
    };
    const styleParams = {
      textStyle,
      labelInterval: LABEL_INTERVAL,
      tickMajor: TICK_LENGTH_MAJOR,
      tickMinor: TICK_LENGTH_MINOR,
      rulerColor: RULER_COLOR,
    };

    this._drawHorizontalRulerHelper(
      rulerGraphics,
      positionParamsH,
      styleParams,
      uiContainer
    );
    this._drawVerticalRulerHelper(
      rulerGraphics,
      positionParamsV,
      styleParams,
      uiContainer
    );
  }

  /**
   * Helper method to draw the horizontal part of the debug ruler (top edge).
   * Draws the main line, tick marks (major and minor), and coordinate labels.
   * Ensures labels are added to the correct UI container.
   * @param {Phaser.GameObjects.Graphics} rulerGraphics - The graphics object
   *   to draw on.
   * @param {object} positionParams - Contains positioning and dimension info:
   *   `startTileX`, `endTileX`, `containerX`, `tileSizeX`, `screenWidth`.
   * @param {object} styleParams - Contains styling info: `textStyle`,
   *   `labelInterval`, `tickMajor`, `tickMinor`, `rulerColor`.
   * @param {Phaser.GameObjects.Container} uiContainer - The container to add
   *   text labels to.
   * @private
   */
  _drawHorizontalRulerHelper(
    rulerGraphics,
    // screenWidth is now gameWidth
    { startTileX, endTileX, containerX, tileSizeX, screenWidth },
    { textStyle, labelInterval, tickMajor, tickMinor, rulerColor },
    uiContainer
  ) {
    rulerGraphics.lineStyle(1, rulerColor, 1);
    // Use passed screenWidth (gameWidth)
    rulerGraphics.lineBetween(0, 0, screenWidth, 0);
    for (let tileX = startTileX; tileX <= endTileX + 1; tileX++) {
      const screenX = tileX * tileSizeX + containerX;

      const isInBounds = screenX >= 0 && screenX <= screenWidth;

      if (isInBounds) {
        // Use passed screenWidth (gameWidth)
        const isMajorTick = tileX % labelInterval === 0;
        const tickLength = isMajorTick ? tickMajor : tickMinor;
        rulerGraphics.lineBetween(screenX, 0, screenX, tickLength);

        if (isMajorTick) {
          try {
            const label = this.add
              .text(screenX + 2, 2, `${tileX}`, textStyle)
              .setOrigin(0, 0)
              .setScrollFactor(0)
              .setDepth(11);
            this.rulerTexts.push(label);
            // CRITICAL: Ensure added to correct container
            uiContainer.add(label);
          } catch (e) {
            console.error(
              `[${new Date().toISOString()}] [ERROR] [NewGame H Ruler] Error creating text label for tileX ${tileX}:`,
              e
            );
          }
        }
      }
    }
  }

  /**
   * Helper method to draw the vertical part of the debug ruler (left edge).
   * Draws the main line, tick marks (major and minor), and coordinate labels.
   * Ensures labels are added to the correct UI container.
   * @param {Phaser.GameObjects.Graphics} rulerGraphics - The graphics object
   *   to draw on.
   * @param {object} positionParams - Contains positioning and dimension info:
   *   `startTileY`, `endTileY`, `containerY`, `tileSizeY`, `screenHeight`.
   * @param {object} styleParams - Contains styling info: `textStyle`,
   *   `labelInterval`, `tickMajor`, `tickMinor`, `rulerColor`.
   * @param {Phaser.GameObjects.Container} uiContainer - The container to add
   *   text labels to.
   * @private
   */
  _drawVerticalRulerHelper(
    rulerGraphics,
    // screenHeight is now gameHeight
    { startTileY, endTileY, containerY, tileSizeY, screenHeight },
    { textStyle, labelInterval, tickMajor, tickMinor, rulerColor },
    uiContainer
  ) {
    rulerGraphics.lineStyle(1, rulerColor, 1);
    // Use passed screenHeight (gameHeight)
    rulerGraphics.lineBetween(0, 0, 0, screenHeight);
    for (let tileY = startTileY; tileY <= endTileY + 1; tileY++) {
      const screenY = tileY * tileSizeY + containerY;

      const isInBounds = screenY >= 0 && screenY <= screenHeight;

      if (isInBounds) {
        // Use passed screenHeight (gameHeight)
        const isMajorTick = tileY % labelInterval === 0;
        const tickLength = isMajorTick ? tickMajor : tickMinor;
        rulerGraphics.lineBetween(0, screenY, tickLength, screenY);

        if (isMajorTick) {
          try {
            const label = this.add
              .text(2, screenY + 2, `${tileY}`, textStyle)
              .setOrigin(0, 0)
              .setScrollFactor(0)
              .setDepth(11);
            this.rulerTexts.push(label);
            // CRITICAL: Ensure added to correct container
            uiContainer.add(label);
          } catch (e) {
            console.error(
              `[${new Date().toISOString()}] [ERROR] [NewGame V Ruler] Error creating text label for tileY ${tileY}:`,
              e
            );
          }
        }
      }
    }
  }

  /**
   * Clears the existing center marker circle and associated text objects from
   * the scene and nullifies their references.
   * @private
   */
  _clearCenterMarkers() {
    this.centerMarker?.destroy();
    this.centerMarker = null;
    this.centerText?.forEach((txt) => txt?.destroy());
    this.centerText = [];
  }

  /**
   * Calculates information needed for placing the debug center marker, including
   * screen position, logical tile coordinates, calculated absolute world
   * coordinates, and current game dimensions. Retrieves data using
   * `getGridCenter` and container/tile properties.
   * @returns {{x: number, y: number, tileXText: string, tileYText: string,
   *            absoluteXText: string, absoluteYText: string, gameWidth:
   *            number, gameHeight: number} | null} An object with center info,
   *   or null if prerequisites (like container) fail. Coordinates are formatted
   *   as strings ('?' if unavailable).
   * @private
   */
  _getCenterInfo() {
    let absoluteXText = '?';
    let absoluteYText = '?';

    const { x, y, tileX, tileY, gameWidth, gameHeight } = this.getGridCenter();

    const container = this.registry.get('itemMapContainer');
    if (
      container &&
      typeof tileX === 'number' &&
      typeof tileY === 'number' &&
      this.tileSizeX &&
      this.tileSizeY
    ) {
      absoluteXText = (
        container.x +
        (tileX * this.tileSizeX + this.tileSizeX / 2)
      ).toFixed(0);
      absoluteYText = (
        container.y +
        (tileY * this.tileSizeY + this.tileSizeY / 2)
      ).toFixed(0);
    }
    const tileXText = typeof tileX === 'number' ? tileX : '?';
    const tileYText = typeof tileY === 'number' ? tileY : '?';

    return {
      x,
      y,
      tileXText,
      tileYText,
      absoluteXText,
      absoluteYText,
      gameWidth,
      gameHeight,
    };
  }

  /**
   * Creates and adds the visual elements for the debug center marker (red
   * circle) and associated text labels (logical coords, absolute coords, canvas
   * size, window size) to the specified UI container. Handles potential errors
   * during text/circle creation.
   * @param {object | null} centerInfo - The calculated center information
   *   from `_getCenterInfo()`, or null.
   * @param {Phaser.GameObjects.Container} uiContainer - The container to add
   *   the visuals to.
   * @private
   */
  _createCenterVisuals(centerInfo, uiContainer) {
    if (!centerInfo) return;

    try {
      this.centerMarker = this.add
        .circle(centerInfo.x, centerInfo.y, 5, 0xff0000, 1.0)
        .setDepth(15);
      uiContainer.add(this.centerMarker);

      const textStyle = {
        fontSize: '12px',
        color: '#00FFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: { x: 2, y: 1 },
      };
      const text1 = this.add
        .text(
          centerInfo.x + 10,
          centerInfo.y,
          `Logical Center: (${centerInfo.tileXText}, ${centerInfo.tileYText})`,
          textStyle
        )
        .setDepth(16);
      this.centerText.push(text1);
      uiContainer.add(text1);
      const text2 = this.add
        .text(
          centerInfo.x + 10,
          centerInfo.y + 14,
          `Abs Pos (Tile Center): (${centerInfo.absoluteXText}, ${centerInfo.absoluteYText})`,
          textStyle
        )
        .setDepth(16);
      this.centerText.push(text2);
      uiContainer.add(text2);
      const text3 = this.add
        .text(
          centerInfo.x + 10,
          centerInfo.y + 28,
          `Canvas: (${this.gameWidth}, ${this.gameHeight})`,
          textStyle
        )
        .setDepth(16);
      this.centerText.push(text3);
      uiContainer.add(text3);

      const text4 = this.add
        .text(
          centerInfo.x + 10,
          centerInfo.y + 42,
          `Win: (${window.innerWidth}, ${window.innerHeight})`,
          textStyle
        )
        .setDepth(16);
      this.centerText.push(text4);
      uiContainer.add(text4);
      // ----------------------------------- //
    } catch (error) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] Failed to create center marker visuals:`,
        error
      );
      this.centerMarker?.destroy();
      this.centerMarker = null;
    }
  }

  /**
   * Creates or updates a visual marker (circle and text) at the calculated
   * grid center for debugging purposes. Requires the scene to be fully
   * initialized and the `uiContainer` to be available. Calls helper methods
   * to clear old markers, get center info, and create new visuals.
   * @returns {void}
   */
  markGridCenter() {
    // Guard: Only proceed if the scene is fully initialized
    if (!this.isFullyInitialized) {
      // Debugging: Mark Grid Center
      // console.debug(
      //   `[${new Date().toISOString()}] ` +
      //   `[DEBUG] [NewGame markGridCenter] ` +
      //   `Scene not fully initialized. ` +
      //   `Skipping mark.`
      // );
      return;
    }

    this._clearCenterMarkers();

    const uiContainer = this.registry.get('uiContainer');
    if (!uiContainer) {
      if (!this._warnedCenterMarkerContainer) {
        console.warn(
          `[${new Date().toISOString()}] [WARN] [NewGame] Cannot mark grid center: uiContainer not found.`
        );
        this._warnedCenterMarkerContainer = true;
      }
      return;
    }
    this._warnedCenterMarkerContainer = false; // Reset if container found

    const centerInfo = this._getCenterInfo();
    if (centerInfo) {
      this._createCenterVisuals(centerInfo, uiContainer);
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame] Failed to get center info for marker.`
      );
    }
  }

  /**
   * Handles the 'resize' event emitted by Phaser's Scale Manager. Simply calls
   * the scene's main `resize` method, passing the new width and height from the
   * `gameSize` object.
   * @param {Phaser.Structs.Size} gameSize - The current size object of the
   *   game canvas provided by the Scale Manager.
   * @param {number} gameSize.width - The current canvas width.
   * @param {number} gameSize.height - The current canvas height.
   */
  handlePhaserResize(gameSize) {
    this.resize(gameSize.width, gameSize.height);
  }

  /**
   * Debounce helper function. Creates and returns a new function that delays
   * invoking `func` until `wait` milliseconds have elapsed since the last time
   * the debounced function was invoked. Useful for rate-limiting events like
   * resize or input.
   * @param {Function} func - The function to debounce.
   * @param {number} wait - The debounce delay in milliseconds.
   * @returns {Function} The new debounced function.
   * @private
   */
  _debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Handles movement events triggered by EventBus or keyboard listeners.
   * Calculates the next target center tile coordinates based on the current
   * center and the delta (dx, dy). If the map is ready and `InputHandler`
   * exists, calls `inputHandler.updateCenter` to initiate the camera movement.
   * Includes NaN check for safety.
   * @param {number} dx - The change in the x tile coordinate (-1, 0, or 1).
   * @param {number} dy - The change in the y tile coordinate (-1, 0, or 1).
   * @private
   */
  _handleMoveEvent(dx, dy) {
    if (this.isMapReady && this.inputHandler) {
      const nextX = this.currentCenterTile.x + dx;
      const nextY = this.currentCenterTile.y + dy;

      if (isNaN(nextX) || isNaN(nextY)) {
        console.error(
          `[${new Date().toISOString()}] [ERROR] [NewGame _handleMoveEvent] ` +
          `Calculated next center is NaN! ` +
          `Current: (${this.currentCenterTile.x}, ${this.currentCenterTile.y}), dx=${dx}, dy=${dy}. ` +
          `Skipping updateCenter call.`
        );
        return;
      }

      this.inputHandler.updateCenter(nextX, nextY);
    } else {
      // Removed commented-out debug log
    }
  }

  // --- Farming Action Handlers --- //
  // --- Interfaces to MapService --- //

  /**
   * Handles the 'clear-rubble' event from the EventBus.
   * Calls the mapService to clear rubble on the specified tiles.
   * @param {Array<{x: number, y: number}>} tiles - The tiles to clear.
   * @private
   */
  _handleClearRubble(tiles) {
    if (!this.mapService) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [NewGame _handleClearRubble] MapService not available.`
      );
      return;
    }
    this.mapService.clearRubble(tiles);
  }

  /**
   * Handles the 'plant-crop' event from the EventBus.
   * Calls the mapService to plant a crop on the specified tiles.
   * @param {Array<{x: number, y: number}>} tiles - The tiles to plant on.
   * @param {string} cropType - The type of crop to plant.
   * @private
   */
  _handlePlantCrop(tiles, cropType) {
    if (!this.mapService) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[NewGame _handlePlantCrop] MapService not available.`
      );
      return;
    }
    this.mapService.plantCrop(tiles, cropType);
  }

  /**
   * Handles the 'harvest-crop' event from the EventBus.
   * Calls the mapService to harvest a crop from the specified tiles.
   * @param {Array<{x: number, y: number}>} tiles - The tiles to harvest from.
   * @param {string} cropType - The type of crop to harvest.
   * @private
   */
  _handleHarvestCrop(tiles, cropType) {
    if (!this.mapService) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[NewGame _handleHarvestCrop] MapService not available.`
      );
      return;
    }
    this.mapService.harvestCrop(tiles, cropType);
  }

  /**
   * Handles the 'speed-grow' event from the EventBus.
   * Calls the mapService to speed up growth on the specified tiles.
   * @param {Array<{x: number, y: number}>} tiles - The tiles to speed grow.
   * @private
   */
  _handleSpeedGrow(tiles) {
    if (!this.mapService) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[NewGame _handleSpeedGrow] MapService not available.`
      );
      return;
    }
    this.mapService.speedGrow(tiles);
  }

  /**
   * Handles the 'lease-tile' event from the EventBus.
   * Calls the mapService to lease a tile on the specified tiles.
   * @param {Array<{x: number, y: number}>} tiles - The tiles to lease.
   * @private
   */
  _handleLeaseTile(tiles) {
    if (!this.mapService) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[NewGame _handleLeaseTile] MapService not available.`
      );
      return;
    }
    this.mapService.leaseTile(tiles);
  }

  /**
   * Handles the 'pay-rent' event from the EventBus.
   * Calls the mapService to pay rent on the specified tiles.
   * @param {Array<{x: number, y: number}>} tiles - The tiles to pay rent.
   * @private
   */
  _handlePayRent(tiles) {
    if (!this.mapService) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[NewGame _handlePayRent] MapService not available.`
      );
      return;
    }
    this.mapService.payRent(tiles);
  }

  // --- End Farming Action Handlers --- //

  /**
   * Handles the 'rent-due' event emitted by the `RentManager` when a tile's
   * rent becomes due. Emits 'request-farming-controls-rerender' to potentially
   * update the UI if the affected tile is selected. Also emits
   * 'scene:tileActionabilityChanged' to notify other systems (like MapService)
   * that the state affecting actions might have changed for this tile.
   * @param {{x: number, y: number, nextRentDue: string}} payload - The event
   *   payload containing tile coordinates and the due date.
   * @private
   */
  _handleRentDueEvent(payload) {
    const { x, y } = payload;
    // Debugging: Rent Due
    // console.debug(`[NewGame] Received rent-due event for (${x},${y})`);

    // Emit an event specifically requesting FarmingControls to check for 
    // re-render
    // We don't check selection state here; FarmingControls will do that.
    EventBus.emit('request-farming-controls-rerender', { x, y });

    // Notify MapService that actionability might have changed for this tile
    this.events.emit('scene:tileActionabilityChanged', { x, y });
  }
  // <------------------------------------------>

  /**
   * Handles the restart scenario when a map reload is requested.
   * @param {object} selectionArray - Array of selected tiles
   * @private
   */
  _handleMapRestart(selectionArray = []) {
    // Prepare restart data with current state
    const restartData = {
      mapId: this.mapId,
      previousCenterTile: { ...this.currentCenterTile },
      previousSelection: selectionArray,
    };

    // Restart scene with the prepared data
    this.scene.restart(restartData);
  }

  /**
   * Emits map nickname via EventBus and updates scene text.
   * @param {string|null} mapNickname - The nickname of the map
   * @private
   */
  _emitMapNickname(mapNickname) {
    // Update the internal state regardless
    this.mapNickname = mapNickname || 'Unnamed Map';

    // Ensure the UI Container and Text object exist before trying to update
    if (this.uiContainer && this.mapNicknameText) {
      this.mapNicknameText.setText(this.mapNickname);
      // Optional: Adjust visibility based on the flag
      this.mapNicknameText.setVisible(this.isMapTitleVisible);
    } else {
      // Log if attempting to update too early - helps debugging race conditions
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [_emitMapNickname] ` +
      //   `UI not ready, cannot set map nickname text yet.`
      // );
    }

    // The creation logic below is removed, as it should only happen in _setupUiContainer
    // if (this.uiContainer) {
    //   if (!this.mapNicknameText) {
    //     // Create the text object if it doesn't exist
    //     this.mapNicknameText = this.add
    //       .text(10, 10, this.mapNickname, {
    //         fontFamily: '"Roboto", Arial, sans-serif',
    //         fontSize: '18px', // Slightly smaller for less intrusion
    //         color: '#FFFF00', // Yellow color
    //         backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black bg
    //         padding: { left: 5, right: 5, top: 2, bottom: 2 },
    //         // Fixed size to prevent layout shifts? Maybe not needed.
    //         // fixedWidth: 200,
    //         // fixedHeight: 24,
    //         align: 'left', // Align text to the left within its bounds
    //       })
    //       .setDepth(1000) // Ensure it's on top
    //       .setScrollFactor(0); // Make it fixed relative to the camera
    //     this.uiContainer.add(this.mapNicknameText);
    //   } else {
    //     // Update existing text object
    //     this.mapNicknameText.setText(this.mapNickname);
    //   }
    //   // Set visibility based on the flag
    //   this.mapNicknameText.setVisible(this.isMapTitleVisible);
    // } else {
    //   // Log if the container isn't ready yet (might indicate call order issue)
    //   console.warn('UI container not ready when trying to set map nickname.');
    // }
  }

  /**
   * Recreates the main UI container (`this.uiContainer`) during a resize event.
   * This involves destroying the existing container and its children, nullifying
   * references, removing related items from the scene registry, and then
   * calling `_setupUiContainer` to create a fresh container and its base
   * elements. Finally, sets the size of the new container.
   * @private
   */
  _recreateUiContainer() {
    // Destroy the old uiContainer and recreate it
    this.uiContainer?.destroy(true); // Destroy container and children
    this.uiContainer = null; // Nullify reference
    this.registry.remove('uiContainer'); // Remove from registry
    this.registry.remove('selectionGraphics'); // Remove graphics from registry
    this.registry.remove('rulerGraphics'); // Remove graphics from registry

    // Recreate the UI container and its base elements
    this._setupUiContainer();

    // Set the size of the newly created UI container
    if (this.uiContainer) {
      this.uiContainer.setSize(this.gameWidth, this.gameHeight);
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[NewGame resize] Failed to recreate UI container.`
      );
    }
  }

  /**
   * Repositions the wallet balance text element after a resize event. Ensures
   * it's positioned correctly relative to the new game dimensions (bottom-right
   * corner with padding) and re-adds it to the `uiContainer` if the container
   * was recreated.
   * @private
   */
  _repositionWalletText() {
    if (this.walletBalanceText && this.uiContainer) {
      this.walletBalanceText.setPosition(
        this.gameWidth - 16, // Padding from right edge
        this.gameHeight - 16 // Padding from bottom edge
      );
      // Ensure it's added to the new uiContainer if it was recreated
      if (!this.uiContainer.exists(this.walletBalanceText)) {
        this.uiContainer.add(this.walletBalanceText);
      }
    }
  }

  /**
   * Sets up the wallet balance display. Creates the text object, adds it to the
   * UI container, registers it, sets up an EventBus listener for
   * 'player-wallet-updated' events, and schedules an initial request to fetch
   * the balance via `MapService` after a short delay. Only proceeds if the
   * `uiContainer` exists.
   * @private
   */
  _setupWalletDisplay() {
    // Wallet Balance Text
    if (this.uiContainer && !this.walletBalanceText) {
      this.walletBalanceText = this.add.text(
        this.gameWidth - 16, // Position initially
        this.gameHeight - 16,
        'Wallet: $0',        // Initial text
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '14px',
          color: '#FFD700', // Gold color
          align: 'right',
          // stroke: '#000000',
          // strokeThickness: 1,
        }
      ).setOrigin(1, 1); // Align bottom-right
      this.walletBalanceText.setDepth(12);
      this.walletBalanceText.setScrollFactor(0);
      this.uiContainer.add(this.walletBalanceText);
      this.registry.set('walletBalanceText', this.walletBalanceText);

      // Listener for Wallet Updates
      this._boundHandlePlayerWalletUpdated = (balance) => {
        if (this.walletBalanceText) {
          this.walletBalanceText.setText(`Wallet: $${balance}`);
        }
      };
      EventBus.on(
        'player-wallet-updated',
        this._boundHandlePlayerWalletUpdated,
        this
      );

      // Initial Wallet Request (with delay to allow UI setup)
      // Use a short timer to ensure MapService is fully ready
      this.walletBalanceTimer = this.time.delayedCall(500, () => {
        this.mapService?.requestWalletBalance();
      });

    } else if (!this.uiContainer) {
      console.warn('[NewGame _setupWalletDisplay] UI Container not ready.');
    }
  }
}
