/**
 * @module game/scenes/unused/DemoInterface
 * @description Defines the DemoInterface Phaser Scene, likely an unused
 *   or experimental scene for map interaction demonstrations.
 */
import { EventBus } from '../../EventBus.js';
import { Scene } from 'phaser';

/**
 * @class DemoInterface
 * @extends Phaser.Scene
 * @classdesc An experimental Phaser Scene demonstrating map rendering, panning,
 *   dragging with inertia, and sprite pooling. This scene appears to be
 *   unused or a demo, located in the 'unused' directory.
 *   It handles displaying a grid-based map and allows navigation via
 *   keyboard arrows and mouse dragging.
 *
 * @param {string} key - The unique key for this Scene ('DemoInterface').
 */
export class DemoInterface extends Scene {
  /**
   * Initializes the DemoInterface scene, setting up properties for tile size,
   * viewport, map boundaries, drag mechanics, object pools, and initial state.
   */
  constructor() {
    super('DemoInterface');
    /**
     * The horizontal size of each map tile in pixels.
     * @type {number}
     * @default 64
     */
    this.tileSizeX = 64;
    /**
     * The vertical size of each map tile in pixels.
     * @type {number}
     * @default 64
     */
    this.tileSizeY = 64;
    /**
     * A visual marker (Phaser Graphics object) for the center of the grid.
     * @type {?Phaser.GameObjects.Graphics}
     * @default null
     */
    this.centerMarker = null;
    /**
     * Text displaying the coordinates of the center marker.
     * @type {?Phaser.GameObjects.Text}
     * @default null
     */
    this.centerText = null;

    /**
     * Buffer zone (in tiles) around the viewport for pre-rendering tiles.
     * Helps smooth panning by rendering tiles slightly outside the view.
     * @type {number}
     * @default 2
     */
    this.viewportBuffer = 2;
    /**
     * The current center tile coordinates of the viewport.
     * @type {{x: number, y: number}}
     * @default { x: 16, y: 16 }
     */
    this.currentCenterTile = { x: 16, y: 16 };

    /**
     * A map to keep track of active Phaser tweens, using unique keys.
     * @type {Map<string, Phaser.Tweens.Tween>}
     */
    this.activeTweens = new Map();
    /**
     * Object pool for reusing map tile sprites to improve performance.
     * Keys are coordinate strings 'x,y'.
     * @type {Map<string, Phaser.GameObjects.Sprite>}
     */
    this.spritePool = new Map();
    /**
     * Object pool for reusing text objects (if any were used).
     * Keys are coordinate strings 'x,y'.
     * @type {Map<string, Phaser.GameObjects.Text>}
     */
    this.textPool = new Map();

    /**
     * The maximum valid coordinate (inclusive) for the map grid.
     * Defines the boundaries (0 to maxCoord).
     * @type {number}
     * @default 32
     */
    this.maxCoord = 32;

    // --- Dragging Properties ---
    /**
     * Minimum time interval (in milliseconds) between processing drag events.
     * Throttles drag updates for performance.
     * @type {number}
     * @default 16 // (approx 60 FPS)
     */
    this.dragThrottleMS = 16;
    /**
     * Current velocity of the map drag, used for inertia.
     * @type {{x: number, y: number}}
     * @default { x: 0, y: 0 }
     */
    this.dragVelocity = { x: 0, y: 0 };
    /**
     * The last recorded pointer position during a drag.
     * @type {?{x: number, y: number}}
     * @default null
     */
    this.lastDragPos = null;
    /**
     * Factor controlling how quickly drag inertia decays (0 to 1).
     * Closer to 1 means longer inertia.
     * @type {number}
     * @default 0.95
     */
    this.dragInertia = 0.95;
    /**
     * The minimum distance (in grid tiles) the pointer must move during
     * a drag update to trigger a map recentering.
     * @type {number}
     * @default 1
     */
    this.minDragDistance = 1;
    /**
     * Flag indicating if a drag operation is currently active.
     * @type {boolean}
     * @private
     * @default false
     */
    this.isDragging = false;
    /**
     * The starting pointer position when a drag begins.
     * @type {?{x: number, y: number}}
     * @private
     * @default null
     */
    this.dragStart = null;
    /**
     * Timestamp of the last processed drag event.
     * @type {number}
     * @private
     * @default 0
     */
    this.lastDragTime = 0;
    /**
     * Flag indicating if a map panning animation (tween) is active.
     * Prevents conflicting movements.
     * @type {boolean}
     * @private
     * @default false
     */
    this.isAnimating = false;
    /**
     * Reference to the Phaser keyboard cursor keys object.
     * @type {?Phaser.Types.Input.Keyboard.CursorKeys}
     */
    this.cursors = null;
    /**
     * Configuration object for items, primarily the map tile sprite details.
     * @type {?object}
     */
    this.items = null;
    /**
     * Phaser Container holding all the map tile sprites. Panning is achieved
     * by moving this container.
     * @type {?Phaser.GameObjects.Container}
     */
    this.itemMapContainer = null;
    /**
     * Background image object.
     * @type {?Phaser.GameObjects.Image}
     */
    this.bg = null;
  }

  /**
   * Checks if the given grid coordinates are within the defined map
   * boundaries (0 to `maxCoord`).
   *
   * @param {number} x The x-coordinate (tile index) to check.
   * @param {number} y The y-coordinate (tile index) to check.
   * @returns {boolean} True if the coordinates are within bounds, false
   *   otherwise.
   */
  isWithinBounds(x, y) {
    return x >= 0 && x <= this.maxCoord && y >= 0 && y <= this.maxCoord;
  }

  /**
   * Retrieves a sprite for the given tile coordinates from the sprite pool
   * or creates a new one if it doesn't exist. Manages sprite visibility
   * and basic properties.
   *
   * @param {number} x The x-coordinate (tile index) of the desired sprite.
   * @param {number} y The y-coordinate (tile index) of the desired sprite.
   * @returns {Phaser.GameObjects.Sprite} The pooled or newly created sprite.
   */
  getSprite(x, y) {
    const key = `${x},${y}`;
    if (this.spritePool.has(key)) {
      return this.spritePool.get(key);
    }

    const sprite = this.add.sprite(
      x * this.tileSizeX,
      y * this.tileSizeY,
      'tiles',
      this.items.mapTile.frame
    );

    sprite.setCrop(
      this.items.mapTile.cropX,
      this.items.mapTile.cropY,
      this.items.mapTile.cropWidth,
      this.items.mapTile.cropHeight
    );
    sprite.setOrigin(0, 0);
    sprite.setDisplaySize(this.tileSizeX, this.tileSizeY);
    sprite.setInteractive();

    this.spritePool.set(key, sprite);
    return sprite;
  }

  /**
   * Phaser Scene update loop. Called every frame.
   * Handles keyboard input for panning the map (arrow keys).
   * @override
   */
  update() {
    if (this.cursors.left.isDown) {
      this.updateCenter(this.currentCenterTile.x - 1, this.currentCenterTile.y);
    } else if (this.cursors.right.isDown) {
      this.updateCenter(this.currentCenterTile.x + 1, this.currentCenterTile.y);
    } else if (this.cursors.up.isDown) {
      this.updateCenter(this.currentCenterTile.x, this.currentCenterTile.y - 1);
    } else if (this.cursors.down.isDown) {
      this.updateCenter(this.currentCenterTile.x, this.currentCenterTile.y + 1);
    }
  }

  /**
   * Called when a pointerdown event occurs (mouse click or touch start).
   * Initiates the map dragging state.
   *
   * @param {Phaser.Input.Pointer} pointer The pointer that triggered the event.
   * @private
   */
  startDrag(pointer) {
    this.isDragging = true;
    this.dragStart = { x: pointer.x, y: pointer.y };
    this.lastDragPos = { x: pointer.x, y: pointer.y };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastDragTime = performance.now();
  }

  /**
   * Called when a pointermove event occurs while dragging is active.
   * Calculates the drag distance and velocity, throttles updates, and calls
   * `updateCenter` to pan the map based on the drag movement.
   *
   * @param {Phaser.Input.Pointer} pointer The pointer that triggered the event.
   * @private
   */
  doDrag(pointer) {
    if (!this.isDragging || !this.dragStart) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastDragTime;

    if (deltaTime < this.dragThrottleMS) {
      return;
    }

    const deltaX = pointer.x - this.lastDragPos.x;
    const deltaY = pointer.y - this.lastDragPos.y;

    this.dragVelocity.x = deltaX / deltaTime;
    this.dragVelocity.y = deltaY / deltaTime;

    const dragScale = 2;
    const deltaGridX = Math.round((deltaX * dragScale) / this.tileSizeX);
    const deltaGridY = Math.round((deltaY * dragScale) / this.tileSizeY);

    if (
      Math.abs(deltaGridX) < this.minDragDistance &&
      Math.abs(deltaGridY) < this.minDragDistance
    ) {
      return;
    }

    const newCenterX = this.currentCenterTile.x - deltaGridX;
    const newCenterY = this.currentCenterTile.y - deltaGridY;

    const clampedX = Math.max(0, Math.min(this.maxCoord, newCenterX));
    const clampedY = Math.max(0, Math.min(this.maxCoord, newCenterY));

    if (
      clampedX !== this.currentCenterTile.x ||
      clampedY !== this.currentCenterTile.y
    ) {
      this.updateCenter(clampedX, clampedY);
    }

    this.lastDragPos = { x: pointer.x, y: pointer.y };
    this.lastDragTime = currentTime;
  }

  /**
   * Updates the logical center of the map view (`currentCenterTile`) and
   * initiates a smooth tween animation to pan the `itemMapContainer` to the
   * new position. Clamps coordinates within bounds and prevents overlapping
   * animations. Re-renders the map during and after the animation.
   *
   * @param {number} newCenterX The target center x-coordinate (tile index).
   * @param {number} newCenterY The target center y-coordinate (tile index).
   * @private
   */
  updateCenter(newCenterX, newCenterY) {
    if (this.isAnimating) return;

    const oldCenter = { ...this.currentCenterTile };

    newCenterX = Math.max(0, Math.min(this.maxCoord, newCenterX));
    newCenterY = Math.max(0, Math.min(this.maxCoord, newCenterY));

    if (newCenterX === oldCenter.x && newCenterY === oldCenter.y) return;

    this.currentCenterTile = { x: newCenterX, y: newCenterY };

    const deltaX = (oldCenter.x - newCenterX) * this.tileSizeX;
    const deltaY = (oldCenter.y - newCenterY) * this.tileSizeY;

    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

    this.isAnimating = true;

    this.add.tween({
      targets: this.itemMapContainer,
      x: this.itemMapContainer.x + deltaX,
      y: this.itemMapContainer.y + deltaY,
      duration: 200,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        requestAnimationFrame(() => {
          if (!this.isAnimating) return;
          this.renderItemMap();
        });
      },
      onComplete: () => {
        this.isAnimating = false;
        this.renderItemMap();
      },
    });
  }

  /**
   * Applies inertial movement to the map after a drag ends (if velocity is
   * sufficient). Uses `requestAnimationFrame` to create a smooth decay effect,
   * repeatedly calling `updateCenter` with decreasing velocity until the map
   * stops.
   * @private
   */
  applyDragInertia() {
    const inertiaDecay = () => {
      if (
        !this.isDragging &&
        (this.dragVelocity.x !== 0 || this.dragVelocity.y !== 0)
      ) {
        this.dragVelocity.x *= this.dragInertia;
        this.dragVelocity.y *= this.dragInertia;

        // Calculate the implied center tile movement from velocity
        const dxTiles = -this.dragVelocity.x / this.tileSizeX;
        const dyTiles = -this.dragVelocity.y / this.tileSizeY;
        const newCenterX = this.currentCenterTile.x + dxTiles;
        const newCenterY = this.currentCenterTile.y + dyTiles;

        this.updateCenter(newCenterX, newCenterY);

        // Stop inertia if velocity is negligible
        if (
          Math.abs(this.dragVelocity.x) < 0.1 &&
          Math.abs(this.dragVelocity.y) < 0.1
        ) {
          this.dragVelocity.x = 0;
          this.dragVelocity.y = 0;
        } else {
          requestAnimationFrame(inertiaDecay);
        }
      }
    };

    // Start the inertia decay loop if needed
    if (
      !this.isDragging &&
      (this.dragVelocity.x !== 0 || this.dragVelocity.y !== 0)
    ) {
      console.debug(
        `[DemoInterface] Applying drag inertia with initial velocity: ` +
        `x=${this.dragVelocity.x.toFixed(2)}, ` +
        `y=${this.dragVelocity.y.toFixed(2)}`
      );
      requestAnimationFrame(inertiaDecay);
    }
  }

  /**
   * Called when a pointerup or pointerout event occurs.
   * Ends the current drag operation, calculates final velocity, and potentially
   * triggers inertia if the drag was fast enough. Resets drag state variables.
   *
   * @param {Phaser.Input.Pointer} _pointer The pointer that triggered the
   *   event.
   * @private
   */
  stopDrag(_pointer) {
    if (!this.isDragging) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastDragTime;

    if (
      deltaTime < 100 &&
      (Math.abs(this.dragVelocity.x) > 0.1 ||
        Math.abs(this.dragVelocity.y) > 0.1)
    ) {
      this.applyDragInertia();
    }

    this.isDragging = false;
    this.dragStart = null;
    this.lastDragPos = null;
    this.lastDragTime = 0;

    // Log the stop drag event
    console.debug(
      `[DemoInterface] Stop drag. Final drag distance: ` +
      `x=${this.dragVelocity.x.toFixed(2)}, ` +
      `y=${this.dragVelocity.y.toFixed(2)}`
    );

    // Apply inertia only if the drag resulted in some movement
    if (this.dragVelocity.x !== 0 || this.dragVelocity.y !== 0) {
      this.renderItemMap(); // Initial render

      // Log initial state
      console.info(
        `[DemoInterface] Scene created. ` +
        `Map Size: ${this.maxCoord + 1}x${this.maxCoord + 1}. ` +
        `Initial Center: (${this.currentCenterTile.x}, ${this.currentCenterTile.y})`
      );
    }
  }

  /**
   * Calculates the range of tile coordinates (startX, endX, startY, endY)
   * that should be visible based on the current window size, tile size,
   * center tile, and viewport buffer.
   *
   * @returns {{startX: number, endX: number, startY: number, endY: number}}
   *   The calculated visible range in tile coordinates.
   * @private
   */
  calculateVisibleRange() {
    const width = window.innerWidth;
    const height = window.innerHeight / 2;

    const visibleTilesX = Math.ceil(width / this.tileSizeX);
    const visibleTilesY = Math.ceil(height / this.tileSizeY);

    const centerTileX = this.currentCenterTile.x;
    const centerTileY = this.currentCenterTile.y;

    return {
      startX: centerTileX - Math.floor(visibleTilesX / 2) - this.viewportBuffer,
      endX: centerTileX + Math.ceil(visibleTilesX / 2) + this.viewportBuffer,
      startY: centerTileY - Math.floor(visibleTilesY / 2) - this.viewportBuffer,
      endY: centerTileY + Math.ceil(visibleTilesY / 2) + this.viewportBuffer,
    };
  }

  /**
   * Calculates the pixel coordinates of the visual center of the screen
   * and relates it to the current logical center tile coordinates and the
   * absolute position within the map container.
   *
   * @returns {{x: number, y: number, tileX: number, tileY: number,
   *   absoluteX: number, absoluteY: number}} An object containing center
   *   coordinates in different systems.
   * @private
   */
  getGridCenter() {
    const width = window.innerWidth;
    const height = window.innerHeight / 2;

    return {
      x: width / 2,
      y: height / 2,
      tileX: this.currentCenterTile.x,
      tileY: this.currentCenterTile.y,
      absoluteX:
        this.itemMapContainer.x + this.currentCenterTile.x * this.tileSizeX,
      absoluteY:
        this.itemMapContainer.y + this.currentCenterTile.y * this.tileSizeY,
    };
  }

  /**
   * Creates or updates a visual marker (circle and text) at the calculated
   * absolute center position of the grid view within the map container.
   * Handles potential errors during object creation.
   *
   * @returns {?{marker: Phaser.GameObjects.Graphics,
   *   centerText: Phaser.GameObjects.Text}}
   *   The created marker and text objects, or null if creation failed.
   * @private
   */
  markGridCenter() {
    if (!this.scene || !this.scene.isActive() || !this.add) {
      return null;
    }

    if (this.centerMarker) {
      this.centerMarker.destroy();
      this.centerMarker = null;
    }
    if (this.centerText) {
      this.centerText.destroy();
      this.centerText = null;
    }

    const center = this.getGridCenter();

    try {
      this.centerMarker = this.add.circle(
        center.absoluteX,
        center.absoluteY,
        10,
        0xffffff,
        1
      );

      this.centerText = this.add.text(
        center.absoluteX + 15,
        center.absoluteY,
        `Center: (${center.tileX}, ${center.tileY})`,
        {
          fontSize: '16px',
          color: '#00FFFF',
          backgroundColor: '#000000',
          padding: { x: 2, y: 2 },
        }
      );

      return { marker: this.centerMarker, centerText: this.centerText };
    } catch (error) {
      console.warn('Failed to mark grid center:', error);
      return null;
    }
  }

  /**
   * Phaser Scene method. Preloads assets required for this scene, such as
   * the tileset spritesheet and the Tiled map data (though the Tiled map
   * data doesn't seem to be directly used for rendering here).
   * @override
   */
  preload() {
    this.load.spritesheet('tiles', 'assets/tilesets/tileset.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.tilemapTiledJSON('map', 'assets/maps/map.json');
  }

  /**
   * Phaser Scene method. Creates game objects and sets up the scene's initial
   * state after assets are preloaded. Initializes input handlers (drag,
   * keyboard), defines item properties, creates the main container,
   * performs the initial render, and sets up event listeners for resize
   * and external 'move' events.
   * @override
   */
  create() {
    this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0).setAlpha(0.55);

    this.input.on('pointerdown', this.startDrag, this);
    this.input.on('pointermove', this.doDrag, this);
    this.input.on('pointerup', this.stopDrag, this);
    this.input.on('pointerout', this.stopDrag, this);
    this.input.on('gameout', this.stopDrag, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.items = {
      mapTile: {
        frame: 0,
        x: 0,
        y: 0,
        width: this.tileSizeX,
        height: this.tileSizeY,
        cropX: 0,
        cropY: 0,
        cropWidth: 32,
        cropHeight: 32,
      },
    };
    const width = window.innerWidth;
    const height = Math.floor(window.innerHeight / 2);
    this.itemMapContainer = this.add
      .container()
      .setPosition(width / 2, height / 2);
    this.renderItemMap();
    EventBus.emit('current-scene-ready', this);
    EventBus.on('window-resize', this.resize.bind(this));
    EventBus.emit('window-resize');
    EventBus.on('move', (direction) => {
      switch (direction) {
        case 'left':
          this.updateCenter(
            this.currentCenterTile.x - 1,
            this.currentCenterTile.y
          );
          break;
        case 'right':
          this.updateCenter(
            this.currentCenterTile.x + 1,
            this.currentCenterTile.y
          );
          break;
        case 'up':
          this.updateCenter(
            this.currentCenterTile.x,
            this.currentCenterTile.y - 1
          );
          break;
        case 'down':
          this.updateCenter(
            this.currentCenterTile.x,
            this.currentCenterTile.y + 1
          );
          break;
        default:
          break;
      }
    });

    // Only log if the center actually changes
    if (this.currentCenterTile.x !== 16 || this.currentCenterTile.y !== 16) {
      console.debug(
        `[DemoInterface] Center tile updated to ` +
        `(${this.currentCenterTile.x}, ${this.currentCenterTile.y})`
      );
    }
  }

  /**
   * Placeholder method to change to the 'Game' scene. Stops any active logo
   * tween before switching. Appears potentially related to a transition not
   * fully implemented or used elsewhere.
   */
  changeScene() {
    if (!this) return;
    if (this.logoTween) {
      this.logoTween.stop();
      this.logoTween = null;
    }
    this.scene.start('Game');
  }

  /**
   * Core rendering logic. Calculates the visible tile range, repositions the
   * main container (`itemMapContainer`), iterates through the visible tiles,
   * gets sprites from the pool (`getSprite`), adds new sprites to the
   * container, positions them correctly, and manages the visibility of pooled
   * sprites (hiding those outside the visible range). Also updates the center
   * marker.
   * @private
   */
  renderItemMap() {
    if (!this.sys || !this.scene || !this.itemMapContainer) {
      console.warn('Scene not ready for rendering');
      return;
    }

    const visibleRange = this.calculateVisibleRange();
    const width = window.innerWidth;
    const height = window.innerHeight / 2;

    const containerOffsetX =
      width / 2 - this.currentCenterTile.x * this.tileSizeX;
    const containerOffsetY =
      height / 2 - this.currentCenterTile.y * this.tileSizeY;

    if (!this.isAnimating) {
      this.itemMapContainer.setPosition(containerOffsetX, containerOffsetY);
    }

    const visibleTiles = new Set();
    try {
      for (let y = visibleRange.startY; y <= visibleRange.endY; y++) {
        for (let x = visibleRange.startX; x <= visibleRange.endX; x++) {
          if (!this.isWithinBounds(x, y)) continue;

          const key = `${x},${y}`;
          visibleTiles.add(key);

          const sprite = this.getSprite(x, y);

          if (!this.itemMapContainer.list.includes(sprite)) {
            this.itemMapContainer.add(sprite);
          }

          sprite.setPosition(x * this.tileSizeX, y * this.tileSizeY);
        }
      }
    } catch (error) {
      console.error('Error in renderItemMap:', error);
    }

    this.spritePool.forEach((sprite, key) => {
      const [x, y] = key.split(',').map(Number);
      if (!visibleTiles.has(key) || !this.isWithinBounds(x, y)) {
        sprite.setVisible(false);
      } else {
        sprite.setVisible(true);
      }
    });

    this.textPool.forEach((text, key) => {
      const [x, y] = key.split(',').map(Number);
      if (!visibleTiles.has(key) || !this.isWithinBounds(x, y)) {
        text.setVisible(false);
      } else {
        text.setVisible(true);
      }
    });

    this.markGridCenter();
  }

  /**
   * Calculates a dynamic easing value based on the delta.
   * Seems unused in the current implementation.
   *
   * @param {number} delta The difference value.
   * @returns {number} The calculated easing value (clamped between 0.1 and 1).
   * @deprecated Seems unused.
   */
  getDynamicEasing(delta) {
    return Math.min(Math.max(Math.abs(delta) * 0.01, 0.1), 1);
  }

  /**
   * Checks if a given tile coordinate is within a specified radius of the
   * current center tile.
   *
   * @param {number} tileX The x-coordinate (tile index) to check.
   * @param {number} tileY The y-coordinate (tile index) to check.
   * @param {number} [radius=1] The radius (in tiles) around the center.
   * @returns {boolean} True if the tile is within the radius of the center.
   */
  isInCenter(tileX, tileY, radius = 1) {
    const center = this.getGridCenter();
    const dx = Math.abs(tileX - center.tileX);
    const dy = Math.abs(tileY - center.tileY);
    return dx <= radius && dy <= radius;
  }

  /**
   * Handles the window resize event. Adjusts the background scale, destroys
   * old center markers (as their position depends on screen size), re-renders
   * the item map to calculate new visible ranges, and ensures all children
   * are visible.
   * @param {object} [_gameSize] - Phaser game size object (width, height).
   *   Currently unused.
   * @private
   */
  resize(_gameSize) {
    console.debug('resize DemoInterface');

    if (!this.sys) {
      console.warn('Scene not ready for resize');
      return;
    }

    if (this.bg?.active && !this.bg.destroyed) {
      this.bg.setScale(
        window.innerWidth / this.sys.game.config.width,
        window.innerHeight / this.sys.game.config.height
      );
    }

    if (this.centerMarker?.destroy) {
      this.centerMarker.destroy();
      this.centerMarker = null;
    }
    if (this.centerText?.destroy) {
      this.centerText.destroy();
      this.centerText = null;
    }

    if (this.itemMapContainer && !this.itemMapContainer.destroyed) {
      this.renderItemMap();
    }

    if (this.children) {
      this.children.each((child) => {
        if (child?.setVisible) child.setVisible(true);
      });
    }
  }

  /**
   * Cleans up resources used by the scene, specifically clearing the object
   * pools and active tweens map. Called during shutdown.
   * @private
   */
  cleanup() {
    this.spritePool.clear();
    this.textPool.clear();
    this.activeTweens.clear();
  }

  /**
   * Phaser Scene method. Called when the scene is shut down. Removes event
   * listeners, calls the `cleanup` method to release resources, and calls
   * the parent Scene's shutdown method. Includes basic error handling.
   * @override
   */
  shutdown() {
    try {
      EventBus.off('window-resize', this.resize);
      EventBus.off('move');

      this.cleanup();

      super.shutdown();
    } catch (error) {
      console.warn('Error during scene shutdown:', error);
    }
  }
}
