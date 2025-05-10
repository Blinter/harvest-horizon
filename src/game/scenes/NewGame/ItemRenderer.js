/**
 * @file ItemRenderer.js
 * @description Manages rendering of game map items including tiles, crops,
 *   and overlays. Uses object pools for efficient sprite reuse and handles
 *   rendering of visible areas only.
 * @module ItemRenderer
 */

// eslint-disable-next-line no-unused-vars -- Used in JSDoc types
import Phaser from 'phaser';
import {
  mapTileProgress,
  getTextureKey,
  getCropFrames,
  isActionAllowed,
  canPayRent
} from '../../../library/gameData.js';
import { EventBus } from '../../EventBus.js';
// eslint-disable-next-line no-unused-vars -- Used in JSDoc types
import { CropState } from '../../types/CropState.js';

/**
 * @typedef {object} DepthLevels - Defines depth constants for rendering layers.
 * @property {number} BASE - Depth for base map tiles.
 * @property {number} HIGHLIGHT - Depth for highlight overlays.
 * @property {number} CROP_BASE - Depth for base crop sprites.
 * @property {number} CROP_OVERLAY - Depth for crop overlay sprites (above
 *   base).
 * @property {number} NOTIFICATION - Depth for notification icons/effects.
 * @property {number} ICON - Depth for general icons (like warnings).
 * @property {number} OVERLAY - General overlay depth.
 * @property {number} SELECTION - Depth for selection indicators.
 * @property {number} UI - Depth for UI elements above the map.
 * @property {number} RULER - Depth for measurement tools (like rulers).
 */
const DEPTH_LEVELS = {
  BASE: 0,

  HIGHLIGHT: 1,

  CROP_BASE: 2,
  CROP_OVERLAY: 3,

  // icons like warning signs
  NOTIFICATION: 4,
  ICON: 6,

  OVERLAY: 5,


  // selection
  SELECTION: 12,
  UI: 13,
  RULER: 14,
};

// Notification visual constants
/** @const {Array} NOTIFICATION_COLORS - Colors for notification pulse effect. */
const NOTIFICATION_COLORS = [0xffff00, 0xffffff]; // Yellow to White cycle
/** @const {number} NOTIFICATION_CYCLE_DURATION - Duration (ms) for one pulse cycle. */
const NOTIFICATION_CYCLE_DURATION = 750; // ms for one way of the cycle

/**
 * @typedef {Object} TilePosition - Represents tile coordinates.
 */

/**
 * Represents the Phaser Scene context, extended with expected properties
 * used by ItemRenderer.
 * @typedef {Object} GameScene - A Phaser scene with additional Harvest Horizon properties.
 */

/**
 * @class ItemRenderer
 * @description Responsible for rendering and managing visual elements on the
 *   game map, including base tiles, crops, and overlays. Utilizes object
 *   pools for sprite reuse and optimizes rendering based on the visible
 *   area. Handles highlights, notifications, and warning signs.
 */
export class ItemRenderer {
  /**
   * The Phaser scene instance this renderer belongs to.
   * @type {GameScene}
   * @private
   */
  scene;

  /**
   * Pool for reusing base map tile sprites. Keys are "x,y" strings.
   * @type {Map<string, Phaser.GameObjects.Sprite>}
   * @private
   */
  spriteMapPool = new Map();

  /**
   * Pool for reusing base crop sprites. Keys are "x,y" strings.
   * @type {Map<string, Phaser.GameObjects.Sprite>}
   * @private
   */
  spriteCropPool = new Map();

  /**
   * Tracks overlay sprites associated with base crop sprites. Keys are "x,y".
   * Values are arrays of overlay Sprite objects.
   * @type {Map<string, Phaser.GameObjects.Sprite[]>}
   * @private
   */
  overlaySpriteMap = new Map();

  /**
   * Single graphics object for the merged highlight area. Added directly to
   * the scene, independent of itemMapContainer.
   * @type {Phaser.GameObjects.Graphics | null}
   * @private
   */
  mergedHighlightGraphic = null; // Keep initialization here

  /**
   * @type {Object|null}
   * @private
   */
  highlightBoundingBox = null;

  /**
   * Queue for sprite creation requests [x, y] made before scene readiness.
   * @type {Array}
   * @private
   */
  spriteCreationQueue = [];

  /**
   * Buffer of extra tiles rendered around the visible viewport edge.
   * @type {number}
   * @private
   */
  viewportBuffer = 0;

  /**
   * Flag indicating if a critical rendering error occurred (e.g., NaN camera).
   * @type {boolean}
   * @private
   */
  hasRenderingError = false;

  /**
   * Unique identifier for this renderer instance. Used for debugging.
   * @type {string}
   * @private
   */
  rendererId = `Renderer-${Math.random().toString(36).substring(2, 9)}`;

  /**
   * Pool for notification outline graphics and their tweens.
   * Keys are "x,y", values are { graphic: Graphics, tween: Tween | null }.
   * @type {Map<string, {
   *   graphic: Phaser.GameObjects.Graphics,
   *   tween: Phaser.Tweens.Tween | null
   * }>}
   * @private
   */
  notificationOutlinePool = new Map();

  /**
   * Set of coordinates ("x,y") for tiles with final stage crops needing
   * notification.
   * @type {Set<string>}
   * @private
   */
  finalStageCrops = new Set();

  /**
   * Pool for reusing warning sign icons (Text objects). Keys are "x,y".
   * @type {Map<string, Phaser.GameObjects.Text>}
   * @private
   */
  warningSignPool = new Map();

  /**
   * Single tween controlling the alpha pulse for all active highlights.
   * @type {Phaser.Tweens.Tween | null}
   * @private
   */
  masterHighlightTween = null;

  /**
   * Dummy object whose 'value' property is tweened by masterHighlightTween
   * to control the alpha of the merged highlight graphic.
   * @type {{ value: number } | null}
   * @private
   */
  masterHighlightAlpha = null; // Initialize as null

  /**
   * Text object to display the player's current coin balance.
   * @type {Phaser.GameObjects.Text | null}
   * @private
   */
  walletBalanceText = null;

  /**
   * Timer event for automatically hiding the wallet balance text.
   * @type {Phaser.Time.TimerEvent | null}
   * @private
   */
  walletBalanceTimer = null;

  /**
   * Bound reference to the wallet update handler for listener removal.
   * Needs to be stored to correctly remove the listener later.
   * @type {Function | null}
   * @private
   */
  _boundHandlePlayerWalletUpdated = null;

  /**
   * Creates an instance of ItemRenderer. Initializes properties, graphics,
   * and sets up event listeners. Creates the merged highlight graphic
   * directly on the scene.
   * @param {GameScene} scene - The NewGame scene instance.
   * @throws {Error} If the scene instance is not provided.
   */
  constructor(scene) {
    if (!scene) {
      throw new Error('ItemRenderer requires a valid scene instance.');
    }
    this.scene = scene;

    // *** Initialize Dummy Tween Targets in Constructor ***
    this.masterHighlightAlpha = { value: 0.1 };
    // *****************************************************

    // *** Initialize Highlight Graphic Directly on Scene ***
    if (this.scene.add) {
      this.mergedHighlightGraphic = this.scene.add.graphics();
      this.mergedHighlightGraphic.setDepth(DEPTH_LEVELS.HIGHLIGHT);
      this.mergedHighlightGraphic.setVisible(false);
    } else {
      console.warn('[ItemRenderer constructor] Scene.add not ready, highlight graphic will be created lazily.');
    }
    // ****************************************************

    this._setupEventListeners();
    this._initializeMasterHighlightTween();
  }

  /**
   * Sets up EventBus listeners for crop updates and wallet changes.
   * Also registers scene destroy listener for cleanup.
   * @private
   */
  _setupEventListeners() {
    // Ensure listeners are removed if the scene is destroyed or restarted
    this.scene.events.on('destroy', this._removeEventListeners, this);

    // Listen for crop stage updates - Use .bind(this) to ensure context
    EventBus.on('crop-stage-updated', this._handleCropStageUpdate.bind(this));

    // Listen for crops reaching final stage
    EventBus.on('crop-final-stage', this._handleCropFinalStage.bind(this));

    // Listen for crop harvesting to hide notifications
    EventBus.on('crop-harvested', this._handleCropHarvested.bind(this));

    // Listen for player wallet updates
    this._boundHandlePlayerWalletUpdated = this._handlePlayerWalletUpdated.bind(this);
    EventBus.on(
      'playerWalletUpdated',
      this._boundHandlePlayerWalletUpdated,
      this
    );
  }

  /**
   * Removes EventBus listeners associated with this renderer.
   * Intended to be called when the scene is destroyed.
   * @private
   */
  _removeEventListeners() {
    // Let's keep the original removal call structure for now, hoping the EventBus handles it or relying on the ItemRenderer destruction.
    EventBus.off('crop-stage-updated', this._handleCropStageUpdate, this);
    EventBus.off('crop-final-stage', this._handleCropFinalStage, this);
    EventBus.off('crop-harvested', this._handleCropHarvested, this);

    // Remove wallet listener
    if (this._boundHandlePlayerWalletUpdated) {
      EventBus.off(
        'playerWalletUpdated',
        this._boundHandlePlayerWalletUpdated,
        this
      );
      this._boundHandlePlayerWalletUpdated = null;
    }
  }

  /**
   * Initializes or restarts the single master tween responsible for pulsing
   * the alpha of the merged highlight graphic. Ensures the alpha target
   * exists and resets the start value before creating the tween.
   * @private
   */
  _initializeMasterHighlightTween() {
    // Check if the target exists before using it
    if (!this.masterHighlightAlpha) {
      console.error("[ItemRenderer] Cannot initialize highlight tween: masterHighlightAlpha is null.");
      return;
    }
    if (this.masterHighlightTween) {
      this.masterHighlightTween.stop();
    }
    if (!this.scene?.tweens) return;

    // Reset alpha start value
    this.masterHighlightAlpha.value = 0.1; // Reset value

    this.masterHighlightTween = this.scene.tweens.add({
      targets: this.masterHighlightAlpha, // Should exist now
      value: 0.55,
      ease: 'Quadratic.Out',
      duration: 600,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        if (this.mergedHighlightGraphic?.scene && this.mergedHighlightGraphic.visible) {
          // Check masterHighlightAlpha exists before accessing value
          if (this.masterHighlightAlpha) {
            this.mergedHighlightGraphic.setAlpha(this.masterHighlightAlpha.value);
          }
        }
      },
    });
  }

  /**
   * Handles the 'crop-stage-updated' event from the EventBus. Locates the
   * relevant crop sprite and updates its texture based on the new state.
   * @private
   * @param {object} data - The event data.
   * @param {number} data.x - The x-coordinate of the updated crop tile.
   * @param {number} data.y - The y-coordinate of the updated crop tile.
   * @param {CropState} data.cropState - The full updated crop state object.
   */
  _handleCropStageUpdate(data) {
    if (!this.scene) {
      return;
    }

    // Destructure the data
    const { x, y, cropState } = data;

    // Get the existing sprite (it should exist if the crop was planted)
    // Pass type in case sprite needs creation
    const cropSprite = this.getCropSprite(x, y, cropState.cropType);

    if (cropSprite) {
      // Update the texture/frame based on the new state
      this.setCropTexture(cropSprite, cropState);
    } else {
      console.warn(
        `[ItemRenderer _handleCropStageUpdate] Could not find or create ` +
        `crop sprite for (${x},${y}) to update.`
      );
    }
  }

  /**
   * Handles the 'crop-final-stage' event from the EventBus. Marks the crop
   * tile for notification rendering in the main render loop by adding its
   * coordinates to the `finalStageCrops` set.
   * @private
   * @param {object} data - The event data.
   * @param {number} data.x - The x-coordinate of the final stage crop tile.
   * @param {number} data.y - The y-coordinate of the final stage crop tile.
   * @param {object} data.cropState - The crop state data (unused here but
   *   part of event).
   */
  _handleCropFinalStage(data) {
    if (!this.scene) {
      return;
    }

    const { x, y } = data;
    const key = `${x},${y}`;

    // Add to tracking set. The render loop will handle showing it.
    this.finalStageCrops.add(key);
  }

  /**
   * Handles the 'crop-harvested' event from the EventBus. Removes the tile
   * from the final stage tracking set (`finalStageCrops`) and hides its
   * notification graphic.
   * @private
   * @param {object} data - The event data.
   * @param {number} data.x - The x-coordinate of the harvested crop tile.
   * @param {number} data.y - The y-coordinate of the harvested crop tile.
   */
  _handleCropHarvested(data) {
    if (!this.scene) return;

    const { x, y } = data;
    const key = `${x},${y}`;

    if (this.finalStageCrops.has(key)) {
      this.finalStageCrops.delete(key);
      this.hideNotification(x, y);
    }
  }

  /**
   * Retrieves or creates a sprite for a base map tile at given coordinates.
   * Uses the `spriteMapPool` for reuse. If the scene systems are not ready,
   * the request is queued. Sets initial frame based on current map state
   * or crop presence.
   * @param {number} x - The tile x-coordinate.
   * @param {number} y - The tile y-coordinate.
   * @returns {Phaser.GameObjects.Sprite | null} The tile sprite or null if
   *   creation fails or is queued.
   */
  getMapSprite(x, y) {
    const key = `${x},${y}`;
    // Check pool first
    if (this.spriteMapPool.has(key)) {
      const sprite = this.spriteMapPool.get(key);
      sprite?.setVisible(true); // Ensure it's visible when retrieved
      return sprite || null; // Return null if pool entry is invalid
    }

    // If scene systems not ready, queue the request
    if (!this.scene.sys || !this.scene.add) {
      // Avoid duplicate queue entries
      if (
        !this.spriteCreationQueue.some((pos) =>
          pos[0] === x && pos[1] === y)
      ) {
        this.spriteCreationQueue.push([x, y]);
      }
      return null;
    }

    // Create new sprite - ALWAYS START WITH FRAME 0 initially
    try {
      const frameIndex = 0; // Default initial frame

      const sprite = this.scene.add.sprite(
        x * this.scene.tileSizeX,
        y * this.scene.tileSizeY,
        'farmableGround',
        frameIndex // Use dynamic frame index based on tile type
      );

      sprite.setDepth(DEPTH_LEVELS.BASE); // Ensure map tiles are at base depth
      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(this.scene.tileSizeX, this.scene.tileSizeY);
      sprite.setInteractive(); // Enable input events
      // Store tile position data for potential future use
      // (e.g., visibility checks)
      sprite.setData('tilePosition', { x, y });

      this.spriteMapPool.set(key, sprite); // Add to pool
      this.scene.itemMapContainer?.add(sprite); // Add to the scene container

      // Immediately set frame based on current MapService state
      const currentTileData = this.scene.mapService?.getTile(x, y);
      const hasCrop = this.scene.cropManager?.hasCrop(x, y);

      if (hasCrop) {
        // Force cleared frame if crop exists
        sprite.setFrame(mapTileProgress.at(4));
      } else if (currentTileData && typeof currentTileData.type === 'number') {
        sprite.setFrame(currentTileData.type);
      }

      return sprite;
    } catch (error) {
      console.error(`Failed to create map sprite at ${x},${y}:`, error);
      return null;
    }
  }

  /**
   * Processes any queued sprite creation requests from the
   * `spriteCreationQueue`. Typically called once the scene is fully booted
   * and ready for sprite creation.
   * @returns {void}
   */
  processSpriteCreationQueue() {
    if (this.spriteCreationQueue.length === 0) return;

    // Use a copy and clear original to prevent potential modification issues
    const queue = [...this.spriteCreationQueue];
    this.spriteCreationQueue = [];

    for (const [x, y] of queue) {
      this.getMapSprite(x, y); // Attempt to create the queued sprite
    }
  }

  /**
   * Retrieves or creates a sprite for a crop at given coordinates.
   * Uses the `spriteCropPool` for reuse. The texture key might be updated
   * later by `setCropTexture`. Uses frame 0 initially.
   * @param {number} x - The tile x-coordinate.
   * @param {number} y - The tile y-coordinate.
   * @param {string} [defaultTextureKey='cropsWheat'] - A default texture key
   *   to use initially if creating a new sprite.
   * @returns {Phaser.GameObjects.Sprite | null} The crop sprite or null if
   *   creation fails.
   */
  getCropSprite(
    x,
    y,
    defaultTextureKey = 'cropsWheat'
  ) {
    const key = `${x},${y}`;

    // Check pool first
    if (this.spriteCropPool.has(key)) {
      const sprite = this.spriteCropPool.get(key);
      sprite?.setVisible(true); // Ensure visible
      return sprite || null;
    }

    // Create new sprite
    try {
      // Use frame 0 initially, setCropTexture will set the correct one
      const initialFrame = 0;

      const sprite = this.scene.add.sprite(
        x * this.scene.tileSizeX,
        y * this.scene.tileSizeY,
        defaultTextureKey,
        initialFrame
      );

      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(this.scene.tileSizeX, this.scene.tileSizeY);
      sprite.setData('tilePosition', { x, y });
      sprite.setDepth(DEPTH_LEVELS.CROP_BASE);

      this.spriteCropPool.set(key, sprite);
      this.scene.itemMapContainer?.add(sprite); // Add to the scene container
      return sprite;
    } catch (error) {
      console.error(
        `[ItemRenderer getCropSprite] Failed to create crop sprite at ` +
        `${x},${y}:`,
        error
      );
      return null;
    }
  }

  /**
   * Updates the texture and manages overlay sprites for a crop based on its
   * data and current growth stage frame index. Sets the texture key, base
   * frame, and creates/removes necessary overlay sprites. Validates frame
   * data before applying.
   * @param {Phaser.GameObjects.Sprite} baseSprite - The base crop sprite to
   *   update. Must have 'tilePosition' data set.
   * @param {CropState} cropState - Current crop data (must have cropType,
   *   cropStage, cropLevel).
   * @returns {void}
   */
  setCropTexture(baseSprite, cropState) {
    const tilePos =
      baseSprite.getData('tilePosition') || { x: '?', y: '?' };
    const logPrefix =
      `[ItemRenderer setCropTexture (${tilePos.x},${tilePos.y})]`;

    // 1. Determine texture key from crop type
    const cropType = cropState?.cropType || 'unknown';
    if (cropType === 'unknown') {
      console.warn(
        `${logPrefix} Unknown crop type in state. Hiding sprite.`,
        cropState
      );
      baseSprite.setVisible(false);
      this.removeOverlaySprites(baseSprite);
      return;
    }
    // Assuming convention: e.g., 'wheat' -> 'cropsWheat', 'corn' -> 'cropsCorn'
    const textureKey = getTextureKey(cropType);

    // 2. Validate frame data
    if (!this.validateCropFrameData(baseSprite, cropState)) {
      console.warn(`${logPrefix} Validation failed. Hiding sprite.`);
      return; // Validation failed, sprite hidden (inside validator)
    }

    // Access frame data from the cropState object
    const cropFrameData = getCropFrames(
      cropState.cropType, cropState.cropLevel);

    const frameData = cropFrameData[cropState.cropStage];

    this.removeOverlaySprites(baseSprite); // Clear previous overlays first

    try {
      if (typeof frameData === 'number') {
        // Simple, single frame
        baseSprite.setTexture(textureKey, frameData);

      } else if (Array.isArray(frameData)) {
        // Multi-part frame (simple array: [base, overlay1, ...])
        baseSprite.setTexture(textureKey, frameData[0]);
        // Add overlays using the helper
        this._applyOverlaySprites(
          baseSprite,
          textureKey,
          frameData,
          logPrefix
        );

      } else if (typeof frameData === 'object' &&
        frameData !== null &&
        Array.isArray(frameData.frames)) {
        // Multi-part frame (object: { frames: [base, overlay1, ...] })
        const framesArray = frameData.frames;
        if (framesArray.length === 0) {
          console.error(
            `${logPrefix} Invalid frameData object: frames array is empty.`,
            frameData
          );
          baseSprite.setVisible(false);
          return;
        }

        baseSprite.setTexture(textureKey, framesArray[0]);
        // Add overlays using the helper
        this._applyOverlaySprites(
          baseSprite,
          textureKey,
          framesArray,
          logPrefix
        );

      } else {
        console.error(`${logPrefix} Invalid frameData format:`, frameData);
        baseSprite.setVisible(false);
        return;
      }

      // Ensure final state is correct
      baseSprite.setDisplaySize(this.scene.tileSizeX, this.scene.tileSizeY);
      baseSprite.setVisible(true);
    } catch (error) {
      console.error(
        `${logPrefix} Error during setTexture/overlay creation:`,
        error
      );
      baseSprite.setVisible(false);
      this.removeOverlaySprites(baseSprite); // Clean up on error
    }
  }

  /**
   * Helper method to create and add overlay sprites based on frame data.
   * Adds overlays positioned vertically above the base sprite. Uses the same
   * texture key as the base sprite.
   * @param {Phaser.GameObjects.Sprite} baseSprite - The base sprite.
   * @param {string} textureKey - The texture key for the spritesheet.
   * @param {number[]} framesArray - Array containing base frame [0] and
   *   overlay frames [1...].
   * @param {string} logPrefix - Prefix for logging messages.
   * @private
   * @returns {void}
   */
  _applyOverlaySprites(
    baseSprite,
    textureKey,
    framesArray,
    logPrefix
  ) {
    // Add overlay sprites if defined (start from index 1)
    for (let i = 1; i < framesArray.length; i++) {
      const overlayFrame = framesArray[i];
      // Calculate overlay position: Directly above the previous part
      const overlayY = baseSprite.y - i * this.scene.tileSizeY;

      const overlaySprite = this.createOverlaySprite(
        baseSprite.x, // Same X as base
        overlayY,     // Calculated Y
        overlayFrame,
        textureKey    // Use the same texture key
      );

      if (overlaySprite) {
        this.addOverlaySprite(baseSprite, overlaySprite);
      } else {
        console.warn(
          `${logPrefix} Failed to create overlay ${i} with ` +
          `frame ${overlayFrame}. ` +
          `Format: ${Array.isArray(framesArray) ? 'array' : 'object'}`
        );
      }
    }
  }

  /**
   * Validates crop state and frame data before attempting to set texture.
   * Checks for valid crop stage, frame index, and frame data structure
   * (single number, simple array, or object with frames array). Hides
   * sprite and removes overlays if validation fails.
   * @param {Phaser.GameObjects.Sprite} sprite - The sprite being updated.
   * @param {CropState} cropState - The current state of the crop, including
   *   x, y, cropType, cropLevel, and cropStage.
   * @returns {boolean} True if data is valid, false otherwise.
   * @private
   */
  validateCropFrameData(sprite, cropState) {
    if (!Object.hasOwn(cropState, 'cropStage')) {
      console.warn(
        `[ItemRenderer validateCropFrameData] Missing cropStage in cropState:`,
        cropState
      );
      return false;
    }
    if (!sprite) return false;
    const logPrefix =
      `[ItemRenderer validateCropFrameData (${cropState.x},${cropState.y})]`;

    const cropFrameData = getCropFrames(
      cropState.cropType,
      cropState.cropLevel
    );

    // Use optional chaining on cropState
    if (
      !cropFrameData.length ||
      cropState.cropStage < 0 ||
      cropState.cropStage >= cropFrameData.length
    ) {
      console.warn(
        `${logPrefix} Invalid crop data or frameIndex.`,
        {
          tile: `(${cropState.x},${cropState.y})`,
          framesLength: cropFrameData.length,
          cropStage: cropState.cropStage,
        }
      );
      sprite.setVisible(false); // Hide sprite if data is invalid
      this.removeOverlaySprites(sprite); // Clean up any old overlays
      return false;
    }

    // Also validate the specific frame data structure
    const frameStageData = cropFrameData[cropState.cropStage];
    const isSingleNumber = typeof frameStageData === 'number';

    // Check for simple array of numbers OR the { frames: [...] } structure
    const isValidMultiFrame = (
      // Simple array: [num1, num2, ...]
      (Array.isArray(frameStageData) &&
        frameStageData.length > 0 &&
        frameStageData.every(f => typeof f === 'number')) ||
      // Object structure: { frames: [num1, num2, ...] }
      (typeof frameStageData === 'object' &&
        frameStageData !== null && // Ensure it's not null
        Array.isArray(frameStageData.frames) &&
        frameStageData.frames.length > 0 &&
        frameStageData.frames.every(f => typeof f === 'number'))
    );

    if (!isSingleNumber && !isValidMultiFrame) {
      console.warn(
        `${logPrefix} Invalid frame data structure at index ` +
        `${cropState.cropStage}.`, frameStageData);
      sprite.setVisible(false);
      this.removeOverlaySprites(sprite);
      return false;
    }

    return true;
  }

  /**
   * Creates a single overlay sprite at a specified world position using the
   * given texture key and frame. Adds it to the `itemMapContainer`.
   * @param {number} x - World x position.
   * @param {number} y - World y position.
   * @param {number} frame - Frame index for the overlay.
   * @param {string} textureKey - The spritesheet key to use.
   * @returns {Phaser.GameObjects.Sprite | null} The created sprite or null
   *   on error.
   * @private
   */
  createOverlaySprite(x, y, frame, textureKey) {
    try {
      const overlaySprite = this.scene.add
        .sprite(x, y, textureKey, frame)
        .setOrigin(0, 0)
        .setDepth(DEPTH_LEVELS.OVERLAY)
        .setDisplaySize(this.scene.tileSizeX, this.scene.tileSizeY);

      this.scene.itemMapContainer?.add(overlaySprite); // Add to main container
      return overlaySprite;
    } catch (error) {
      console.error(
        `[ItemRenderer createOverlaySprite] Failed to create overlay ` +
        `sprite frame ${frame} with key ${textureKey}:`,
        error
      );
      return null;
    }
  }

  /**
   * Removes and destroys all overlay sprites associated with a base sprite.
   * Uses the 'tilePosition' data from the base sprite to find the correct
   * overlays in the `overlaySpriteMap`.
   * @param {Phaser.GameObjects.Sprite} baseSprite - The base sprite whose
   *   overlays should be removed. Must have 'tilePosition' data.
   * @private
   * @returns {void}
   */
  removeOverlaySprites(baseSprite) {
    const tilePos = baseSprite.getData('tilePosition');
    if (!tilePos) return; // Cannot find overlays without position
    const key = `${tilePos.x},${tilePos.y}`;
    const logPrefix = `[ItemRenderer removeOverlaySprites (${key})]`;

    if (this.overlaySpriteMap.has(key)) {
      const overlays = this.overlaySpriteMap.get(key) || [];
      overlays.forEach(sprite => {
        try {
          sprite.destroy(); // Destroy each overlay
        } catch (e) {
          // Keep for debugging
          console.warn(`${logPrefix} Error destroying overlay:`, e);
          // Ignore errors if sprite was already destroyed elsewhere
          // console.warn(`${logPrefix} Error destroying overlay:`, e);
        }
      });
      this.overlaySpriteMap.delete(key); // Remove entry from map
    } else {
      // Keep for debugging - Commenting out to reduce console spam
      // console.debug(`${logPrefix} No overlays found to remove.`);
    }
  }

  /**
   * Associates an overlay sprite with a base crop sprite for tracking. Uses
   * the base sprite's 'tilePosition' data as the key in `overlaySpriteMap`.
   * @param {Phaser.GameObjects.Sprite} baseSprite - The base sprite. Must have
   *   'tilePosition' data.
   * @param {Phaser.GameObjects.Sprite} overlaySprite - The overlay sprite to
   *   associate.
   * @private
   * @returns {void}
   */
  addOverlaySprite(baseSprite, overlaySprite) {
    const tilePos = baseSprite.getData('tilePosition');
    if (!tilePos) return; // Cannot associate without position
    const key = `${tilePos.x},${tilePos.y}`;

    if (!this.overlaySpriteMap.has(key)) {
      this.overlaySpriteMap.set(key, []);
    }
    this.overlaySpriteMap.get(key)?.push(overlaySprite);
  }

  /**
   * Checks if essential scene components (systems, camera, map object) are
   * ready and available. Logs a warning if not.
   * @returns {boolean} True if prerequisites are met, false otherwise.
   * @private
   */
  _validatePrerequisites() {
    if (!this.scene?.sys || !this.scene.cameras?.main) {
      console.warn(
        '[ItemRenderer] _validatePrerequisites: Scene systems or camera not ready.'
      );
      return false; // Indicate failure
    }
    if (!this.scene.map) {
      console.warn(
        '[ItemRenderer] _validatePrerequisites: this.scene.map is not available.'
      );
      return false; // Indicate failure
    }
    return true; // Prerequisites met
  }

  /**
   * Validates the map's tile dimensions retrieved from the map object. Logs
   * an error and sets the `hasRenderingError` flag if dimensions are invalid
   * (zero or negative) to halt rendering.
   * @param {Phaser.Tilemaps.Tilemap} map - The game's tilemap instance.
   * @returns {boolean} True if dimensions are valid, false otherwise.
   * @private
   */
  _validateMapDimensions(map) {
    if (
      !map.tileWidth ||
      map.tileWidth <= 0 ||
      !map.tileHeight ||
      map.tileHeight <= 0
    ) {
      if (!this.hasRenderingError) {
        // Log only once
        console.error(
          '[ItemRenderer] Critical Error: Invalid map tile dimensions. Halting rendering.',
          { tileWidth: map.tileWidth, tileHeight: map.tileHeight }
        );
        this.hasRenderingError = true;
      }
      return false; // Invalid dimensions
    }
    return true; // Dimensions are valid
  }

  /**
   * Calculates the range of tile coordinates currently visible within the
   * game window. Considers the position of the `itemMapContainer`, game
   * dimensions, and tile sizes. Includes a buffer around the edges.
   * @returns {{startX: number, endX: number, startY: number, endY: number}}
   *   The visible tile range. Returns an invalid range
   *   ({startX: 0, endX: -1, startY: 0, endY: -1}) if required scene
   *   properties are missing or invalid.
   */
  calculateVisibleRange() {
    const tileSizeX = this.scene.tileSizeX;
    const tileSizeY = this.scene.tileSizeY;

    const container = this.scene.registry.get('itemMapContainer');
    const gameWidth = this.scene.gameWidth;
    const gameHeight = this.scene.gameHeight;

    if (!container || !tileSizeX || !tileSizeY || !gameWidth || !gameHeight) {
      // Return a default or invalid range to prevent errors
      return { startX: 0, endX: -1, startY: 0, endY: -1 };
    }

    // Calculate the world coordinates of the top-left visible point
    // (screen top-left is (0,0), so world = 0 - container offset)
    const topLeftWorldX = -container.x;
    const topLeftWorldY = -container.y;

    // Calculate the world coordinates of the bottom-right visible point
    // (screen bottom-right is (gameWidth, gameHeight))
    const bottomRightWorldX = gameWidth - container.x;
    const bottomRightWorldY = gameHeight - container.y;

    // Convert world coordinates to tile coordinates
    const startTileX = Math.floor(topLeftWorldX / tileSizeX);
    const startTileY = Math.floor(topLeftWorldY / tileSizeY);
    // Use ceil for end tiles to include partially visible ones, or floor + 1
    const endTileX = Math.ceil(bottomRightWorldX / tileSizeX);
    const endTileY = Math.ceil(bottomRightWorldY / tileSizeY);

    // Apply buffer
    return {
      startX: startTileX - this.viewportBuffer,
      endX: endTileX + this.viewportBuffer,
      startY: startTileY - this.viewportBuffer,
      endY: endTileY + this.viewportBuffer,
    };
  }

  /**
   * Calculates the visible tile range using `calculateVisibleRange` and
   * clamps it to the map boundaries defined by MapService (mapWidth,
   * mapHeight).
   * @returns {{startX: number, endX: number, startY: number, endY: number} |
   *            null}
   *   The clamped range, or null if map dimensions from MapService are
   *   invalid (<= 0).
   * @private
   */
  _getClampedVisibleRange() {
    const mapWidth = this.scene.mapService?.mapWidth ?? 0;
    const mapHeight = this.scene.mapService?.mapHeight ?? 0;

    if (mapWidth <= 0 || mapHeight <= 0) {
      console.warn(
        `[ItemRenderer] Cannot calculate range: Invalid map dimensions.`
      );
      return null;
    }

    const visibleRange = this.calculateVisibleRange();

    const startX = Math.max(0, visibleRange.startX);
    const endX = Math.min(mapWidth - 1, visibleRange.endX);
    const startY = Math.max(0, visibleRange.startY);
    const endY = Math.min(mapHeight - 1, visibleRange.endY);

    return { startX, endX, startY, endY };
  }

  /**
   * Iterates through the calculated visible tile range and calls
   * `_renderTile` for each tile within the bounds to update its visual state.
   * @param {{startX: number, endX: number, startY: number, endY: number}} range -
   *   The clamped visible tile range.
   * @param {Set<string>} renderedKeys - A set to track the keys ("type_x,y")
   *   of sprites rendered in this pass. This set is modified by `_renderTile`.
   * @private
   * @returns {void}
   */
  _renderVisibleTilesInRange(range, renderedKeys) {
    if (range.startY <= range.endY && range.startX <= range.endX) {
      for (let y = range.startY; y <= range.endY; y++) {
        for (let x = range.startX; x <= range.endX; x++) {
          this._renderTile(x, y, renderedKeys);
        }
      }
    }
  }

  /**
   * Renders the visible portion of the tile map and associated items (crops,
   * notifications, warnings, highlights) based on the current viewport.
   * Manages sprite visibility by hiding sprites outside the visible range and
   * showing/updating those within it. Also updates the merged highlight
   * graphic and wallet text position. Halts if a critical rendering error
   * (`hasRenderingError`) has occurred. Processes the sprite creation queue
   * first.
   * @returns {void}
   */
  renderItemMap() {
    // --- Check if rendering is halted due to error --- //
    if (this.hasRenderingError) {
      return; // Stop processing if a critical error occurred
    }
    // ------------------------------------------------- //

    // Ensure scene components are ready
    if (
      !this.scene?.itemMapContainer || // Still need container for other items
      !this.scene?.cropManager ||
      !this.scene?.map
    ) {
      // Keep original warn log
      console.warn(
        '[ItemRenderer] renderItemMap called before dependencies ready.',
        {
          container: !!this.scene?.itemMapContainer,
          cropManager: !!this.scene?.cropManager,
          map: !!this.scene?.map,
        }
      );
      return;
    }

    // Process any queued sprites before rendering
    this.processSpriteCreationQueue();

    const clampedRange = this._getClampedVisibleRange();
    if (!clampedRange) {
      return; // Stop if range calculation failed
    }

    const renderedKeys = new Set(); // Track keys of rendered sprites

    // Iterate through the clamped visible tile range and render base tiles,
    // crops, notifications, warning signs.
    this._renderVisibleTilesInRange(clampedRange, renderedKeys);

    // --- Handle Merged Highlight ---
    // Highlight graphic is independent of the container and the loop above
    if (this.highlightBoundingBox) {
      this._updateMergedHighlight(); // Create/update and show the graphic
      renderedKeys.add('highlight_merged'); // Mark it as rendered (still useful for hideOutOfRange logic)
    } else {
      this._hideMergedHighlight(); // Hide the graphic if no bounding box
    }
    // -------------------------------

    // Hide sprites that are pooled but outside the visible range
    // This will still correctly hide the merged highlight if needed,
    // based on the 'highlight_merged' key check.
    this.hideOutOfRangeSprites(renderedKeys);

    // Update wallet text position after other rendering
    this._updateWalletTextPosition();

    this.hasRenderingError = false; // Reset error flag if successful
  }

  /**
   * Updates the frame and tint of the base map sprite based on tile data
   * (type, properties) and whether the tile is highlighted. Shows/hides
   * warning signs based on tile properties (`canPayRent`) and whether the
   * tile is currently highlighted (hides warning if highlighted).
   * @param {Phaser.GameObjects.Sprite} mapSprite - The base map sprite.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @param {Set<string>} renderedKeys - Set to track rendered sprite keys
   *   (used for warning signs).
   * @private
   * @returns {void}
   */
  _updateMapSpriteVisuals(mapSprite, x, y, renderedKeys) {
    const tileData = this.scene.mapService?.getTile(x, y);
    const frame = (tileData && typeof tileData.type === 'number')
      ? tileData.type
      : 0; // Default frame
    mapSprite.setFrame(frame);

    // Check if this tile is inside the current highlight bounds
    const isHighlighted = this.highlightBoundingBox &&
      x >= this.highlightBoundingBox.minX &&
      x <= this.highlightBoundingBox.maxX &&
      y >= this.highlightBoundingBox.minY &&
      y <= this.highlightBoundingBox.maxY;

    // Set Tint #1: set danger red color for tiles that have to pay rent
    // Set Tint #2: gray out tiles that are not leased or have not paid rent
    if (canPayRent(tileData?.properties)) {
      mapSprite.setTint(0xFF0000);
      // Show warning sign ONLY if NOT highlighted
      if (!isHighlighted) {
        this._showWarningSign(x, y, renderedKeys);
      } else {
        this._hideWarningSign(x, y);
      }
    } else {
      this._hideWarningSign(x, y); // Hide warning sign
      // Handle gray tint if not payable and also not allowed action
      if (!isActionAllowed(tileData?.properties)) {
        mapSprite.setTint(0x808080);
      } else {
        mapSprite.clearTint();
      }
    }
  }

  /**
   * Determines if a crop exists at the given coordinates based on `cropState`
   * from CropManager. Calls the appropriate rendering function
   * (`_renderExistingCrop`) if a crop exists, or the hiding/cleanup function
   * (`_handleNoCropAt`) otherwise.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @param {CropState | null | undefined} cropState - Current crop data from
   *   CropManager, or null/undefined if no crop exists.
   * @param {Set<string>} renderedKeys - Set to track rendered sprite keys.
   * @private
   * @returns {void}
   */
  _renderOrHideCrop(x, y, cropState, renderedKeys) {
    if (cropState?.cropType) {
      this._renderExistingCrop(x, y, cropState, renderedKeys);
    } else {
      this._handleNoCropAt(x, y);
    }
  }

  /**
   * Renders a single tile at the given coordinates. This involves:
   * 1. Retrieving/updating the base map sprite.
   * 2. Updating its visuals (frame, tint, warning sign) via
   *    `_updateMapSpriteVisuals`.
   * 3. Rendering or hiding the crop sprite via `_renderOrHideCrop`.
   * 4. Showing or hiding the final stage notification based on
   *    `finalStageCrops` set and highlight status (hides if highlighted).
   * Marks rendered items in the `renderedKeys` set.
   * @param {number} x - The tile x-coordinate.
   * @param {number} y - The tile y-coordinate.
   * @param {Set<string>} renderedKeys - Set to track keys of rendered sprites.
   * @private
   * @returns {void}
   */
  _renderTile(x, y, renderedKeys) {
    const key = `${x},${y}`;
    const mapSprite = this.getMapSprite(x, y);
    const cropState = this.scene.cropManager?.getCrop(x, y);

    // Check if this tile is highlighted
    // Check if this tile is inside the current highlight bounds
    const isHighlighted = this.highlightBoundingBox &&
      x >= this.highlightBoundingBox.minX &&
      x <= this.highlightBoundingBox.maxX &&
      y >= this.highlightBoundingBox.minY &&
      y <= this.highlightBoundingBox.maxY;

    // Handle base map sprite visuals (includes warning signs check based on highlight)
    if (mapSprite) {
      // Pass renderedKeys to _updateMapSpriteVisuals
      this._updateMapSpriteVisuals(mapSprite, x, y, renderedKeys);
      mapSprite.setVisible(true);
      renderedKeys.add(`map_${key}`);
    } else {
      // If map sprite doesn't exist, ensure warning sign is also hidden
      this._hideWarningSign(x, y);
    }

    // Handle crop rendering or hiding
    this._renderOrHideCrop(x, y, cropState, renderedKeys);

    // Handle notification rendering or hiding (hide if highlighted)
    if (this.finalStageCrops.has(key) && !isHighlighted) {
      // DEBUG: Log when notification is marked for rendering
      // console.debug(
      //   `[ItemRenderer _renderTile (${key})] ` + 
      //   `Marking notification as rendered.`
      // );
      this.showNotification(x, y); // Ensure it's visible & tweening
      renderedKeys.add(`notification_${key}`);
    } else {
      // DEBUG: Log why notification is being hidden
      // if (this.finalStageCrops.has(key)) {
      //   console.debug(
      //     `[ItemRenderer _renderTile (${key})] ` +
      //     `Hiding notification (highlighted).`
      //   );
      // }
      // If not in final stage set OR if highlighted, 
      // ensure notification is hidden
      this.hideNotification(x, y);
    }
  }

  /**
   * Renders an existing crop at the specified tile coordinates.
   * 1. Retrieves or creates the base crop sprite using `getCropSprite`.
   * 2. If successful, delegates texture/frame/overlay setting to
   *    `setCropTexture` using the provided `cropState`.
   * 3. Marks the base sprite and any active overlays (found via
   *    `overlaySpriteMap`) as rendered in `renderedKeys` if the sprite is
   *    visible after `setCropTexture`.
   * @param {number} x - The tile x-coordinate.
   * @param {number} y - The tile y-coordinate.
   * @param {CropState} cropState - The state of the crop.
   * @param {Set<string>} renderedKeys - Set to track keys of rendered sprites.
   * @private
   * @returns {void}
   */
  _renderExistingCrop(x, y, cropState, renderedKeys) {
    const key = `${x},${y}`;
    const logPrefix = `[ItemRenderer _renderExistingCrop (${key})]`;

    // 1. Get/create the base crop sprite. Use a default texture initially;
    //    setCropTexture will apply the correct one based on cropState.type.
    const cropSprite = this.getCropSprite(
      x,
      y,
      cropState.cropType
    ); // Use default texture for now

    // 2. Check if sprite retrieval/creation succeeded
    if (!cropSprite) {
      console.warn(
        `${logPrefix} Failed to get/create base crop sprite.`);
      this._handleNoCropAt(x, y); // Ensure cleanup if sprite existed before
      return;
    }

    // 3. Delegate to setCropTexture to handle texture, frame, and overlays
    this.setCropTexture(cropSprite, cropState);

    // 4. Mark base sprite and overlays as rendered (if setCropTexture succeeded)
    if (cropSprite.visible) { // Check visibility as indicator of success
      renderedKeys.add(`crop_${key}`);
      // This draws outside of the original tile area!
      // Also mark overlays managed by overlaySpriteMap as rendered
      if (this.overlaySpriteMap.has(key)) {
        this.overlaySpriteMap.get(key)?.forEach((overlay, i) => {
          // Check overlay visibility as well, though less critical
          if (overlay.visible) {
            renderedKeys.add(`overlay_${key}_${i}`);
          }
        });
      }
    } else {
      console.warn(
        `${logPrefix} Crop sprite was hidden after setCropTexture call. ` +
        `Not marking as rendered.`
      );
    }
  }

  /**
   * Handles the case where there is no crop at the given tile coordinates.
   * Ensures any pooled crop sprite for this location is hidden and its
   * overlays are removed (via `removeOverlaySprites`). Also clears any final
   * stage notification (`finalStageCrops`, `hideNotification`). Removes any
   * potentially orphaned overlays from `overlaySpriteMap`.
   * @param {number} x - The tile x-coordinate.
   * @param {number} y - The tile y-coordinate.
   * @private
   * @returns {void}
   */
  _handleNoCropAt(x, y) {
    const key = `${x},${y}`;
    // No crop here, ensure any existing crop sprite is hidden/removed
    if (this.spriteCropPool.has(key)) {
      const sprite = this.spriteCropPool.get(key);
      if (sprite) {
        // Check if sprite actually exists
        sprite.setVisible(false);
        this.removeOverlaySprites(sprite);
      }
    }
    // Also ensure no orphaned overlays exist in the map
    if (this.overlaySpriteMap.has(key)) {
      // This case shouldn't ideally happen if removeOverlaySprites works,
      // but good for robustness.
      console.warn(
        `[ItemRenderer _handleNoCropAt] Found orphaned overlays for ` +
        `(${key}). Removing.`
      );
      const overlays = this.overlaySpriteMap.get(key) || [];
      overlays.forEach(s => s.destroy());
      this.overlaySpriteMap.delete(key);
    }

    // Clear any notifications for this tile
    if (this.finalStageCrops.has(key)) {
      this.finalStageCrops.delete(key);
      this.hideNotification(x, y);
    }
  }

  /**
   * Hides sprites in the various pools (map, crop, warning, notification)
   * and any managed overlays that were *not* rendered in the current frame
   * (i.e., their keys are not present in `renderedKeys`). Also hides the
   * merged highlight graphic if its key ('highlight_merged') is absent.
   * Stops tweens for hidden notifications. Checks if display objects still
   * exist in the scene before attempting to hide them.
   * @param {Set<string>} renderedKeys - Keys of sprites/graphics rendered
   *   this frame.
   * @private
   * @returns {void}
   */
  hideOutOfRangeSprites(renderedKeys) {
    // Helper to check visibility and hide
    const checkAndHide = (pool, prefix, isGraphic = false) => {
      pool.forEach((item, key) => {
        const fullKey = `${prefix}_${key}`;
        let displayObject = item; // Assume item is the display object by default

        // Special handling for pools containing graphics or complex objects
        if (prefix === 'notification') {
          displayObject = item.graphic; // Get the actual graphics object
        } else if (isGraphic) {
          // General purpose flag for graphics pools (like highlight)
          displayObject = item;
        }

        // Only hide if it *wasn't* rendered this frame
        if (displayObject && !renderedKeys.has(fullKey)) {
          // Check if displayObject still exists before setting visibility
          if (displayObject.scene) {
            displayObject.setVisible(false);
          }

          // If hiding a notification, stop its tween too
          if (prefix === 'notification' && item.tween?.isPlaying()) {
            item.tween.stop();
          }
        }
      });
    };

    checkAndHide(this.spriteMapPool, 'map');
    checkAndHide(this.spriteCropPool, 'crop');
    checkAndHide(this.warningSignPool, 'warning'); // Handle warning signs
    // Notifications are special
    checkAndHide(this.notificationOutlinePool, 'notification');

    // Hide merged highlight if it wasn't marked as rendered this frame
    // This logic remains valid as we still track 'highlight_merged' in renderedKeys
    if (this.mergedHighlightGraphic && !renderedKeys.has('highlight_merged')) {
      // Check scene existence before hiding
      if (this.mergedHighlightGraphic.scene) {
        this._hideMergedHighlight();
      } else {
        this.mergedHighlightGraphic = null; // Clear reference if destroyed elsewhere
      }
    }


    // Hide out-of-range *managed* overlay sprites
    this.overlaySpriteMap.forEach((overlayArray, key) => {
      const baseCropKey = `crop_${key}`;
      if (renderedKeys.has(baseCropKey)) {
        overlayArray.forEach((sprite, index) => {
          const fullKey = `overlay_${key}_${index}`;
          if (!renderedKeys.has(fullKey)) {
            // Check scene existence before hiding
            if (sprite.scene) {
              sprite.setVisible(false);
            }
          }
        });
      } else {
        // If the base crop wasn't rendered, hide all its overlays
        overlayArray.forEach((sprite) => {
          if (sprite.scene) {
            sprite.setVisible(false);
          }
        });
      }
    });
  }

  /**
   * Populates the initial visual state of the map layer based on data usually
   * received from the server (e.g., on game start or map load). Iterates
   * through `initialTiles`, creates base tiles, renders crops based on
   * CropManager's state (which should be populated beforehand), sets up
   * initial notifications for final stage crops, and adds warning signs.
   * Clears previous highlights and final stage crop tracking before starting.
   * @param {Object<string, object>} initialTiles - An object where keys are
   *   "x,y" coordinate strings and values are tile data objects containing at
   *   least `{ type: number }` and optionally `cropType` and `properties`.
   * @returns {void}
   */
  populateInitialMapLayer(initialTiles) {
    if (!initialTiles) {
      console.warn(
        `[ItemRenderer] populateInitialMapLayer: initialTiles data is missing.`
      );
      return;
    }

    if (!this.scene?.cropManager) {
      console.warn(
        `[ItemRenderer] populateInitialMapLayer: ` +
        `CropManager not available on scene.`
      );
      // Proceeding without crop checks, might render base tiles incorrectly
    }

    this.highlightBoundingBox = null; // Clear highlights before population
    this.finalStageCrops.clear(); // Clear final stage crop tracking

    // Use a dummy set for population phase
    const initialRenderedKeys = new Set();

    for (const coordString in initialTiles) {
      // 1. Parse coordinates
      const [xStr, yStr] = coordString.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);

      // 2. Validate coordinates
      if (isNaN(x) || isNaN(y)) {
        console.warn(
          `[ItemRenderer] Invalid coordinate key found: ${coordString}`
        );
        continue;
      }

      // 3. Get tile data
      const tileData = initialTiles[coordString];
      const key = `${x},${y}`;

      // 4. Validate base tile data
      if (!tileData ||
        typeof tileData.type !== 'number') {
        console.warn(
          `[ItemRenderer] populateInitialMapLayer: Missing or invalid base ` +
          `tile 'type' for key ${coordString}. Received:`,
          tileData
        );
        // Continue processing other aspects like potential crops if tileData exists
      }

      // Populate base tile visuals (needs renderedKeys)
      // This now also handles showing/hiding initial warning signs
      this._populateBaseTileVisuals(
        x,
        y,
        tileData,
        initialRenderedKeys // Pass the set
      );

      // Populate crop visuals (if exists according to CropManager)
      if (tileData?.cropType) {
        this._populateCropVisuals(
          x,
          y,
          tileData
        );

        // Check if crop is at final stage and needs notification
        const cropState = this.scene.cropManager?.getCrop(x, y);
        if (cropState && cropState.cropNextStage === null) {
          this.finalStageCrops.add(key);
          this.showNotification(x, y);
        }
      } else {
        // No crop at this tile, handle accordingly.
        this._handleNoCropAt(x, y);
      }

      // --- Handle Highlighting --- //
      // Rendered locally client-side for now.
      // --- REMOVED call to _populateHighlightVisuals ---

      // Note: Overlays are handled implicitly within setCropTexture
    }
  }

  /**
   * Populates the visual representation of a single base map tile during
   * initial setup (`populateInitialMapLayer`).
   * 1. Gets/creates the sprite using `getMapSprite`.
   * 2. Sets its frame based on `tileData.type`.
   * 3. Applies initial tint/warning signs based on properties (assuming
   *    not highlighted initially).
   * 4. Marks the sprite in `renderedKeys`.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @param {object | null | undefined} tileData - Data for the tile, expected
   *   to have `type` and potentially `properties`.
   * @param {Set<string>} renderedKeys - Set to track rendered sprite keys.
   * @private
   * @returns {void}
   */
  _populateBaseTileVisuals(x, y, tileData, renderedKeys) {
    const mapSprite = this.getMapSprite(x, y);

    if (!mapSprite) {
      console.warn(
        `[ItemRenderer] Failed to get/create map sprite for (${x},${y}) ` +
        `during initial population.`
      );
      // Ensure warning is hidden if map sprite fails
      this._hideWarningSign(x, y);
      return;
    }

    mapSprite.setFrame(tileData?.type || 0); // Use default if type missing
    renderedKeys.add(`map_${x},${y}`); // Mark map sprite as rendered

    // --- Highlighting is NOT handled here during population ---

    // Set Tint and Warning Sign (Assume not highlighted during population)
    if (canPayRent(tileData?.properties)) {
      mapSprite.setTint(0xFF0000);
      this._showWarningSign(x, y, renderedKeys); // Show warning initially
    } else {
      this._hideWarningSign(x, y); // Hide warning
      // Handle gray tint if not payable and also not allowed action
      if (!isActionAllowed(tileData?.properties)) {
        mapSprite.setTint(0x808080);
      } else {
        mapSprite.clearTint();
      }
    }
  }

  /**
   * Updates the visual representation (frame) of a single base map tile
   * based on received `tileData` (e.g., from a server `tileUpdate` event).
   * Retrieves or creates the sprite using `getMapSprite`. If a crop exists
   * at the location (checked via `cropManager.hasCrop`), ensures the
   * 'cleared' tile frame (index 4) is used; otherwise, uses the frame type
   * from `tileData`.
   * @param {object} tileData - The updated tile data (must include x, y,
   *   type).
   * @returns {void}
   */
  updateTileVisual(tileData) {
    const { x, y, type } = tileData;

    // Validate input
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof type !== 'number'
    ) {
      console.warn(
        `[ItemRenderer] updateTileVisual: Invalid coordinates or type in ` +
        `tileData:`,
        tileData
      );
      return;
    }

    // Ensure the sprite exists (gets from pool or creates)
    // getMapSprite internally handles setting the frame based on mapService upon creation
    const sprite = this.getMapSprite(x, y);

    if (sprite) {
      // Update the frame of the potentially newly created/retrieved sprite
      // Only update if there's no crop currently on this tile
      if (!this.scene.cropManager?.hasCrop(x, y)) {
        sprite.setFrame(type);
      } else {
        // If there IS a crop, ensure the base tile shows the 'cleared' state
        sprite.setFrame(mapTileProgress.at(4));
      }
    } else {
      console.warn(
        `[ItemRenderer] updateTileVisual: Failed to get/create map sprite ` +
        `for (${x},${y})`
      );
    }
  }

  /**
   * Populates the visual representation of a crop during initial setup
   * (`populateInitialMapLayer`).
   * 1. Retrieves/creates the crop sprite using `getCropSprite`.
   * 2. Gets the corresponding `CropState` from `CropManager` (assumes it's
   *    already loaded).
   * 3. If state exists, calls `setCropTexture` to set the correct visuals.
   * 4. If state doesn't exist (e.g., data inconsistency), ensures any
   *    existing sprite is hidden using `_handleNoCropAt`.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @param {object | null | undefined} tileData - Data for the tile (used to
   *   get default texture key if creating sprite).
   * @private
   * @returns {void}
   */
  _populateCropVisuals(x, y, tileData) {
    // Get/create sprite
    const cropSprite = this.getCropSprite(
      x,
      y,
      tileData.cropType
    );

    if (!cropSprite) {
      console.warn(
        `[ItemRenderer] Failed to get/create crop sprite for (${x},${y}) ` +
        `during initial population.`
      );
      return;
    }

    // Get Crop State - It should exist now if loadCrops ran successfully
    let cropState = this.scene.cropManager?.getCrop(x, y);

    // If cropState still doesn't exist after loadCrops, it means there's
    // no crop data for this tile, or CropManager failed.
    // Do not attempt to plant again here.
    if (!cropState) {
      // Ensure any potentially existing sprite (if pool was reused wrongly) 
      // is hidden
      console.warn(
        `[ItemRenderer _populateCropVisuals] No crop state found for ` +
        `(${x},${y}) after loadCrops. Ensuring sprite is hidden.`
      );
      this._handleNoCropAt(x, y); // Use helper to hide/cleanup visuals
      return;
    }

    // Use cropStage from the loaded CropManager state
    this.setCropTexture(
      cropSprite,
      cropState,
    );
  }

  /**
   * Updates the position of the `walletBalanceText` relative to the game
   * window dimensions (bottom-right corner). Ensures it's added to the
   * scene's `uiContainer`. Called during the render loop or after resize
   * events. Exits early if scene or uiContainer is not available.
   * @private
   * @returns {void}
   */
  _updateWalletTextPosition() {
    // Add checks here to prevent errors if scene or container is gone
    if (!this.scene || !this.scene.uiContainer) {
      // Scene might be destroyed or container not ready, exit early
      return;
    }

    if (this.walletBalanceText && this.scene?.uiContainer) {
      // Use scene's game dimensions
      const gameWidth = this.scene.gameWidth ?? 0;
      const gameHeight = this.scene.gameHeight ?? 0;

      this.walletBalanceText.setPosition(
        gameWidth - 16, // Padding from right edge
        gameHeight - 16 // Padding from bottom edge
      );

      // Ensure it's added to the scene's UI container
      if (!this.scene.uiContainer.exists(this.walletBalanceText)) {
        this.scene.uiContainer.add(this.walletBalanceText);
      }
    }
  }

  /**
   * Cleans up resources used by the ItemRenderer. Stops tweens, destroys
   * pooled sprites, graphics, and text objects, clears pools and maps,
   * nullifies scene reference, and removes event listeners. Checks if items
   * still have a scene before attempting destruction.
   * @returns {void}
   */
  destroy() {
    // Stop master tweens
    if (this.masterHighlightTween) {
      this.masterHighlightTween.stop();
      this.masterHighlightTween = null;
    }

    // Helper to clear pools
    const clearPool = (poolMap) => {
      poolMap.forEach((item) => {
        try {
          // Check if destroy exists before calling
          if (item && typeof item.destroy === 'function') {
            // Check if scene exists (already destroyed?)
            if (item.scene) {
              item.destroy();
            }
          }
        } catch (e) {
          console.warn(`[ItemRenderer destroy] Error destroying item:`, e);
        }
      });
      poolMap.clear();
    };

    // Clear main sprite pools (excluding notification pool)
    clearPool(this.spriteMapPool);
    clearPool(this.spriteCropPool);
    clearPool(this.warningSignPool);

    // Destroy merged graphics
    try {
      if (this.mergedHighlightGraphic?.scene) {
        this.mergedHighlightGraphic.destroy();
      }
    } catch (e) {
      console.warn('[ItemRenderer destroy] Error destroying mergedHighlightGraphic:', e);
    }
    this.mergedHighlightGraphic = null;

    this.highlightBoundingBox = null;

    // Clear overlay sprites
    this.overlaySpriteMap.forEach((overlayArray) => {
      overlayArray.forEach((sprite) => {
        try {
          if (sprite?.scene && typeof sprite.destroy === 'function') {
            sprite.destroy();
          }
        } catch { /* ignore */ }
      });
    });
    this.overlaySpriteMap.clear();

    // Handle notification destruction explicitly
    this.notificationOutlinePool.forEach((entry) => {
      try {
        // Stop any active tweens
        if (entry.tween?.isPlaying()) {
          entry.tween.stop();
        }
        // Destroy graphics object
        if (entry.graphic?.scene) {
          entry.graphic.destroy();
        }
      } catch (e) {
        console.warn(`[ItemRenderer destroy] Error destroying notification:`, e);
      }
    });
    this.notificationOutlinePool.clear();

    this.finalStageCrops.clear(); // Clear the set
    this.spriteCreationQueue = [];
    this.scene = null;
    this._removeEventListeners();

    // Clean up wallet display
    if (this.walletBalanceTimer) {
      this.walletBalanceTimer.remove();
      this.walletBalanceTimer = null;
    }
    if (this.walletBalanceText?.scene) {
      this.walletBalanceText.destroy();
    }
    this.walletBalanceText = null;
  }

  // --- Highlight Management --- //

  /**
   * Sets the tiles to be highlighted. Calculates the bounding box of the
   * provided coordinates (min/max X and Y) and stores it in
   * `highlightBoundingBox`. If the array is empty or contains no valid
   * coordinate objects {x, y}, clears the bounding box. The actual visual
   * update happens in the next `renderItemMap` call via
   * `_updateMergedHighlight`.
   * @param {Array<{x: number, y: number}>} [tileCoordsArray=[]] - An array
   *   of tile coordinate objects {x, y} to highlight. Clears highlight if
   *   empty or invalid.
   * @returns {void}
   */
  setHighlightedTiles(tileCoordsArray = []) {
    this.highlightBoundingBox = null; // Clear previous box

    if (Array.isArray(tileCoordsArray) && tileCoordsArray.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      tileCoordsArray.forEach((coord) => {
        if (typeof coord?.x === 'number' && typeof coord?.y === 'number') {
          minX = Math.min(minX, coord.x);
          minY = Math.min(minY, coord.y);
          maxX = Math.max(maxX, coord.x);
          maxY = Math.max(maxY, coord.y);
        }
      });

      // Only set if we found valid coordinates
      if (minX !== Infinity) {
        this.highlightBoundingBox = { minX, minY, maxX, maxY };
      }
    }
    // The next call to renderItemMap() will handle creating/updating/hiding
    // the merged highlight based on the new bounding box.
  }

  /**
   * Updates the merged highlight graphic (`mergedHighlightGraphic`).
   * 1. Creates the graphic if needed (lazy creation).
   * 2. Clears previous drawing.
   * 3. Calculates position based on `highlightBoundingBox` minimums and
   *    `itemMapContainer` offset.
   * 4. Redraws the filled rectangle (green) and grid lines (white) relative
   *    to the graphic's local origin (0,0).
   * 5. Sets alpha based on `masterHighlightAlpha.value` (controlled by tween).
   * 6. Makes the graphic visible.
   * Called internally by `renderItemMap` when `highlightBoundingBox` is set.
   * @private
   * @returns {void}
   */
  _updateMergedHighlight() {
    if (!this.highlightBoundingBox) {
      this._hideMergedHighlight();
      return;
    }

    const { minX, minY, maxX, maxY } = this.highlightBoundingBox;
    const container = this.scene?.itemMapContainer; // Get the container

    // *** Check if scene, add method, and container are available ***
    if (!this.scene?.add || !container) {
      console.warn(
        `[ItemRenderer _updateMergedHighlight] Scene.add or itemMapContainer not ready.`
      );
      return; // Cannot proceed
    }
    // ***********************************************************


    // --- Lazy Creation if needed ---
    if (!this.mergedHighlightGraphic?.scene) {
      this.mergedHighlightGraphic = this.scene.add.graphics();
      this.mergedHighlightGraphic.setDepth(DEPTH_LEVELS.HIGHLIGHT);
    }
    // -------------------------------------------------------------


    // Calculate base world position from tile coordinates
    const tileWorldX = minX * this.scene.tileSizeX;
    const tileWorldY = minY * this.scene.tileSizeY;

    // *** Calculate the final position including container offset ***
    const graphicX = tileWorldX + container.x;
    const graphicY = tileWorldY + container.y;
    // *************************************************************

    // Calculate dimensions (NO CHANGE NEEDED HERE)
    const width = (maxX - minX + 1) * this.scene.tileSizeX;
    const height = (maxY - minY + 1) * this.scene.tileSizeY;

    // Clear previous drawing, set position, and redraw
    this.mergedHighlightGraphic.clear();
    // *** Set position using the calculated graphicX, graphicY ***
    this.mergedHighlightGraphic.setPosition(graphicX, graphicY);

    // *** Draw relative to the graphic's own (0,0) origin
    // Draw the green fill
    this.mergedHighlightGraphic.fillStyle(0x00ff00, 0.65);
    this.mergedHighlightGraphic.fillRect(0, 0, width, height); // Use 0,0

    // Draw the white grid lines
    this.mergedHighlightGraphic.lineStyle(1, 0xffffff, 0.4);
    for (let tileX = minX; tileX <= maxX; tileX++) {
      for (let tileY = minY; tileY <= maxY; tileY++) {
        const relativeX = (tileX - minX) * this.scene.tileSizeX;
        const relativeY = (tileY - minY) * this.scene.tileSizeY;
        this.mergedHighlightGraphic.strokeRect(
          relativeX,
          relativeY,
          this.scene.tileSizeX,
          this.scene.tileSizeY
        );
      }
    }

    // Set alpha based on master tween and make visible
    this.mergedHighlightGraphic.setAlpha(this.masterHighlightAlpha.value);
    this.mergedHighlightGraphic.setVisible(true);
  }


  /**
   * Hides the merged highlight graphic (`mergedHighlightGraphic`). Sets its
   * visibility to false. If the graphic no longer has a scene (likely
   * destroyed elsewhere), clears the local reference 
   * (`this.mergedHighlightGraphic = null`).
   * 
   * Called internally by `renderItemMap` or `_updateMergedHighlight` when no
   * highlight is active.
   * @private
   * @returns {void}
   */
  _hideMergedHighlight() {
    // Check if the graphic exists and is still part of a scene
    if (this.mergedHighlightGraphic?.scene) {
      this.mergedHighlightGraphic.setVisible(false);
      // Optional: Clear graphics to prevent ghosting if alpha tween causes issues
      // this.mergedHighlightGraphic.clear();
    } else if (this.mergedHighlightGraphic) {
      // If it exists but has no scene, it was likely destroyed elsewhere
      this.mergedHighlightGraphic = null; // Clear the reference
    }
  }

  // --- Highlight Management --- //

  /**
   * Destroys all sprites and graphics currently managed in the pools (map,
   * crop, warning, notification, overlays, highlight) and clears the
   * associated pools and maps. Forces recreation of visuals on the next
   * `renderItemMap` call. Re-initializes the master highlight tween. Useful
   * after events like resize or major state changes requiring a full visual 
   * reset.
   * @returns {void}
   */
  recreatePools() {
    // Helper to clear pools (implementation as before)
    const clearPool = (poolMap) => {
      poolMap.forEach((item) => {
        try {
          if (item?.scene && typeof item.destroy === 'function') {
            item.destroy();
          }
        } catch (e) {
          console.warn(`[ItemRenderer recreatePools] Error destroying item:`, e);
        }
      });
      poolMap.clear();
    };

    // Clear sprite pools (excluding notification pool)
    clearPool(this.spriteMapPool);
    clearPool(this.spriteCropPool);
    clearPool(this.warningSignPool);

    // Destroy merged graphics
    try {
      if (this.mergedHighlightGraphic?.scene) {
        this.mergedHighlightGraphic.destroy();
      }
    } catch (e) {
      console.warn('[ItemRenderer recreatePools] Error destroying mergedHighlightGraphic:', e);
    }
    this.mergedHighlightGraphic = null;

    this.highlightBoundingBox = null;

    // Clear overlay sprites (as before)
    this.overlaySpriteMap.forEach((overlayArray) => {
      overlayArray.forEach((sprite) => {
        try {
          if (sprite?.scene && typeof sprite.destroy === 'function') {
            sprite.destroy();
          }
        } catch { /* ignore */ }
      });
    });
    this.overlaySpriteMap.clear();

    // Handle notification destruction explicitly
    this.notificationOutlinePool.forEach((entry) => {
      try {
        // Stop any active tweens
        if (entry.tween?.isPlaying()) {
          entry.tween.stop();
        }
        // Destroy graphics object
        if (entry.graphic?.scene) {
          entry.graphic.destroy();
        }
      } catch (e) {
        console.warn(`[ItemRenderer recreatePools] Error destroying notification:`, e);
      }
    });
    this.notificationOutlinePool.clear();

    // Don't clear finalStageCrops here, it represents state
    this.spriteCreationQueue = [];

    // Re-initialize tweens as they were stopped in destroy
    // (This assumes recreatePools is called after a scenario where destroy might have been called indirectly, like resize)
    this._initializeMasterHighlightTween();
  }

  /**
   * Activates a color-cycling notification outline for a specific tile.
   * Retrieves from or adds to the `notificationOutlinePool`. Creates the
   * graphic (if needed) and starts a looping color tween between
   * `NOTIFICATION_COLORS` if not already active. Adds the graphic to the
   * `itemMapContainer`.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @returns {void}
   */
  showNotification(x, y) {
    const key = `${x},${y}`;
    let poolEntry = this.notificationOutlinePool.get(key);
    let graphic;

    if (poolEntry) {
      graphic = poolEntry.graphic;
      graphic.setVisible(true); // Ensure visible if reused
    } else {
      // Create new graphic
      const targetContainer = this.scene?.itemMapContainer;
      if (!this.scene?.add || !targetContainer) {
        console.warn(
          `[ItemRenderer showNotification] Scene.add or ` +
          `itemMapContainer not ready.`
        );
        return;
      }

      graphic = this.scene.add.graphics();
      graphic.setPosition(x * this.scene.tileSizeX, y * this.scene.tileSizeY);
      graphic.setDepth(DEPTH_LEVELS.NOTIFICATION);
      graphic.setData('tilePosition', { x, y }); // Store position

      // Initial style (will be tweened)
      graphic.lineStyle(
        3,
        NOTIFICATION_COLORS[0],
        0.4
      ); // Thickness, color, alpha
      graphic.strokeRect(
        3,
        3,
        this.scene.tileSizeX - 6,
        this.scene.tileSizeY - 6
      );

      targetContainer.add(graphic);
      poolEntry = { graphic, tween: null }; // Create entry
      this.notificationOutlinePool.set(key, poolEntry);
    }

    // Start tween if not already running
    if (!poolEntry?.tween?.isPlaying()) {
      // If a previous tween existed but finished/was stopped, remove it
      if (poolEntry.tween) {
        poolEntry.tween.remove();
      }

      // Target the graphic's internal color representation for stroke
      // Phaser Graphics objects don't directly expose a 'strokeColor' property
      // for tweening. We need to tween a dummy object and update the graphic
      // in the 'onUpdate' callback.
      const colorProxy = { color: NOTIFICATION_COLORS[0] }; // Start color

      poolEntry.tween = this.scene.tweens.add({
        targets: colorProxy,
        color: NOTIFICATION_COLORS[1], // End color
        duration: NOTIFICATION_CYCLE_DURATION,
        yoyo: true,
        repeat: -1, // Loop indefinitely
        ease: 'Linear',
        onUpdate: (tweenInstance) => {
          // Ensure graphic still exists
          if (!graphic.scene) {
            tweenInstance.stop(); // Stop if graphic is destroyed
            poolEntry.tween = null;
            return;
          }
          // Clear previous graphics instructions and redraw with new color
          graphic.clear();
          graphic.lineStyle(3, colorProxy.color, 0.4);
          graphic.strokeRect(
            3,
            3,
            this.scene.tileSizeX - 6,
            this.scene.tileSizeY - 6
          );
        },
        onStop: () => {
          // Clear reference when stopped naturally or manually
          if (poolEntry) poolEntry.tween = null;
        },
        onComplete: () => {
          // Clear reference when completed (though unlikely with repeat: -1)
          if (poolEntry) poolEntry.tween = null;
        }
      });
    }
  }

  /**
   * Deactivates the notification outline for a specific tile. Retrieves the
   * entry from `notificationOutlinePool`, stops the associated tween (if
   * running), and hides the graphic. Clears the tween reference in the pool
   * entry.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @returns {void}
   */
  hideNotification(x, y) {
    const key = `${x},${y}`;
    const poolEntry = this.notificationOutlinePool.get(key);

    if (poolEntry) {
      const { graphic, tween } = poolEntry;

      // Stop the tween if it's running
      if (tween?.isPlaying()) {
        tween.stop();
        // onStop callback should nullify poolEntry.tween
      }
      // Ensure the reference is cleared even if tween wasn't active
      poolEntry.tween = null;


      // Hide the graphic
      if (graphic) {
        graphic.setVisible(false);
        graphic.clear(); // Clear drawing for cleanliness when hidden
      }
    }
  }

  // --- End Notification Management --- //

  /**
   * Handles the `playerWalletUpdated` event from the EventBus.
   * 1. Validates the incoming payload against the current scene's mapId and
   *    characterId using `_validateWalletUpdateData`.
   * 2. If valid, creates or updates the `walletBalanceText` display in the
   *    bottom-right corner using `_createOrUpdateWalletText`.
   * 3. Sets a timer (`_setWalletTextHideTimer`) to auto-hide the text after 5s.
   * @param {object} payload - The event payload.
   * @param {number} payload.coins - The updated wallet balance.
   * @param {string} payload.mapId - The ID of the map this update is for.
   * @param {string} payload.characterId - ID of the character this update
   *   is for.
   * @private
   * @returns {void}
   */
  _handlePlayerWalletUpdated({ coins, mapId, characterId }) {
    if (!this._validateWalletUpdateData(coins, mapId, characterId)) {
      return;
    }

    // Clear any existing hide timer
    this.walletBalanceTimer?.remove();
    this.walletBalanceTimer = null;

    // Create or update the wallet text
    this._createOrUpdateWalletText(coins);

    // Set auto-hide timer
    this._setWalletTextHideTimer();
  }

  /**
   * Validates the data received in the `playerWalletUpdated` event payload.
   * Checks if:
   * - `mapId` matches the current `scene.mapId`.
   * - `characterId` matches the current `scene.characterId` 
   *    (logs warning if not).
   * - `coins` is a valid number.
   * - Required scene components (`uiContainer`, `time`, `add`) are available.
   * @param {number | any} coins - The updated wallet balance from the payload.
   * @param {string | any} mapId - The ID of the map from the payload.
   * @param {string | any} characterId - ID of the character from the payload.
   * @returns {boolean} True if data is valid for processing, false otherwise.
   * @private
   */
  _validateWalletUpdateData(coins, mapId, characterId) {
    // Check mapId validity
    if (mapId !== this.scene?.mapId) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[ItemRenderer _handlePlayerWalletUpdated] Received invalid mapId:`,
        mapId
      );
      return false;
    }

    // Check characterId validity
    if (characterId !== this.scene?.characterId) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[ItemRenderer _handlePlayerWalletUpdated] Received invalid characterId:`,
        characterId
      );
      // Don't return false, might still want to show balance for debugging
    }

    // Check coins validity
    if (typeof coins !== 'number' || isNaN(coins)) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[ItemRenderer _handlePlayerWalletUpdated] Received invalid balance:`,
        coins
      );
      return false;
    }

    // Check scene components
    if (!this.scene?.uiContainer || !this.scene?.time || !this.scene?.add) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[ItemRenderer _handlePlayerWalletUpdated] Scene components ` +
        `(uiContainer, time, add) not ready. Cannot display wallet balance.`
      );
      return false;
    }

    return true;
  }

  /**
   * Creates or updates the `walletBalanceText` object. If it doesn't exist,
   * calls `_createWalletTextObject` to initialize it. Sets the text content
   * to display the coin amount and ensures the text object is visible.
   * @param {number} coins - The current wallet balance to display.
   * @private
   * @returns {void}
   */
  _createOrUpdateWalletText(coins) {
    if (!this.walletBalanceText) {
      this._createWalletTextObject();
    }

    if (this.walletBalanceText) {
      this.walletBalanceText.setText(`Coins: ${coins}`).setVisible(true);
    }
  }

  /**
   * Creates the `walletBalanceText` Phaser Text object. Sets its style
   * (font, size, color, alignment), origin (bottom-right), depth, and makes
   * it ignore camera scroll. Adds it to the scene's `uiContainer`. Handles
   * potential errors during creation.
   * @private
   * @returns {void}
   */
  _createWalletTextObject() {
    try {
      const gameWidth = this.scene.gameWidth ?? 0;
      const gameHeight = this.scene.gameHeight ?? 0;

      this.walletBalanceText = this.scene.add.text(
        gameWidth - 16,
        gameHeight - 16,
        '',
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '16px',
          color: '#FFD700',
          align: 'right',
        }
      )
        .setOrigin(1, 1)
        .setDepth(DEPTH_LEVELS.UI + 1)
        .setScrollFactor(0);

      this.scene.uiContainer.add(this.walletBalanceText);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] ` +
        `[ItemRenderer _handlePlayerWalletUpdated] Failed to create wallet text:`,
        error
      );
      this.walletBalanceText = null;
    }
  }

  /**
   * Sets a Phaser delayed call timer (`walletBalanceTimer`) to hide the
   * `walletBalanceText` after a fixed duration (5000 milliseconds). Clears
   * the timer reference when the callback executes.
   * @private
   * @returns {void}
   */
  _setWalletTextHideTimer() {
    this.walletBalanceTimer = this.scene.time.delayedCall(
      5000,
      () => {
        this.walletBalanceText?.setVisible(false);
        this.walletBalanceTimer = null;
      },
      [],
      this
    );
  }

  /**
   * Removes the visual representation of a crop from the specified tile
   * coordinates. This is typically called when server updates indicate a crop
   * is no longer present (e.g., harvested by another player). Uses
   * `_handleNoCropAt` to hide the sprite and remove overlays. Also ensures
   * any final stage notification for this tile is cleared.
   * @param {number} x - The x-coordinate of the crop tile to remove.
   * @param {number} y - The y-coordinate of the crop tile to remove.
   * @returns {void}
   */
  removeCrop(x, y) {
    const key = `${x},${y}`;

    // Handle crop sprite removal via existing _handleNoCropAt
    this._handleNoCropAt(x, y);

    // Ensure notification is cleared if this was a final stage crop
    if (this.finalStageCrops.has(key)) {
      this.finalStageCrops.delete(key);
      this.hideNotification(x, y);
    }
  }

  // --- Warning Sign Management --- //

  /**
   * Shows or creates a warning sign icon ('⚠️') for a specific tile.
   * Retrieves from or adds to the `warningSignPool`. Positions the Text object
   * at the center of the tile and adds it to the `itemMapContainer`. Marks the
   * sign as rendered in the `renderedKeys` set for the current frame.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @param {Set<string>} renderedKeys - Set to track rendered sprite keys.
   * @private
   * @returns {void}
   */
  _showWarningSign(x, y, renderedKeys) {
    const key = `${x},${y}`;
    let warningSign = this.warningSignPool.get(key);

    const tileWidth = this.scene.tileSizeX || 32;
    const tileHeight = this.scene.tileSizeY || 32;
    const targetContainer = this.scene?.itemMapContainer;

    if (!targetContainer || !this.scene?.add) {
      console.warn(`[ItemRenderer _showWarningSign] Scene/Container not ready for (${key}).`);
      return;
    }

    if (warningSign) {
      // Reuse existing sign
      warningSign.setVisible(true);
    } else {
      // Create new warning sign (Text object)
      warningSign = this.scene.add.text(
        x * tileWidth + tileWidth / 2, // Center X
        y * tileHeight + tileHeight / 2, // Center Y
        '⚠️', // Warning emoji
        {
          fontSize: `${Math.floor(tileHeight * 0.6)}px`,
          color: '#000000',
          align: 'center',
        }
      );
      warningSign.setOrigin(0.5, 0.5);
      warningSign.setDepth(DEPTH_LEVELS.ICON);
      warningSign.setData('tilePosition', { x, y });

      targetContainer.add(warningSign);
      this.warningSignPool.set(key, warningSign);
    }
    // Mark as rendered this frame
    renderedKeys.add(`warning_${key}`);
  }

  /**
   * Hides the warning sign icon for a specific tile by setting its
   * visibility to false. Retrieves the Text object from `warningSignPool`.
   * @param {number} x - Tile x-coordinate.
   * @param {number} y - Tile y-coordinate.
   * @private
   * @returns {void}
   */
  _hideWarningSign(x, y) {
    const key = `${x},${y}`;
    const warningSign = this.warningSignPool.get(key);
    if (warningSign) {
      warningSign.setVisible(false);
    }
  }

  // --- End Warning Sign Management --- //
}

