/**
 * @file InputHandler.js
 * @description Manages user input (pointer events) for tile selection and
 *   potentially map dragging within a Phaser scene in the Harvest Horizon game.
 *   Handles conversion between screen coordinates and tile coordinates, as well
 *   as visual feedback through highlighting.
 * @module InputHandler
 */

import { EventBus } from './EventBus.js';

/**
 * Handles pointer input for selecting tiles on the game map.
 *
 * Contains inactive logic for drag-based map panning. Interacts with the
 * parent Phaser scene for coordinate conversion and graphics rendering. Emits
 * 'tiles-selected' events via the EventBus.
 * @class InputHandler
 */
export class InputHandler {
  /**
   * Creates an InputHandler instance.
   * @param {Phaser.Scene} scene - The Phaser scene this handler is associated
   *   with. Must provide `tileSizeX`, `tileSizeY`,
   *   `getItemMapContainerPosition`, `mapService.isWithinBounds`,
   *   `updateCenter`, `currentCenterTile`, and `itemMapContainer`.
   */
  constructor(scene) {
    /** @property {Phaser.Scene} scene The associated Phaser scene instance. */
    this.scene = scene;

    // Dragging state (Currently inactive - listeners not registered)
    /**
     * Flag indicating if a drag operation is in progress.
     * @property {boolean} isDragging
     */
    this.isDragging = false;
    /**
     * Screen coordinates where dragging started.
     * @property {{x: number, y: number} | null} dragStart
     */
    this.dragStart = null;
    /**
     * Last recorded pointer position during drag.
     * @property {{x: number, y: number} | null} lastDragPos
     */
    this.lastDragPos = null;
    /**
     * Calculated drag velocity.
     * @property {{x: number, y: number}} dragVelocity
     */
    this.dragVelocity = { x: 0, y: 0 };
    /**
     * Timestamp of the last drag position update.
     * @property {number} lastDragTime
     */
    this.lastDragTime = 0;
    /**
     * Minimum time (ms) between drag updates (throttle). ~60fps.
     * @property {number} dragThrottleMS
     */
    this.dragThrottleMS = 16; // ~60fps
    /**
     * Factor for drag inertia calculation (0-1).
     * @property {number} dragInertia
     */
    this.dragInertia = 0.92;
    /**
     * Minimum pixel distance required to register as a drag movement.
     * @property {number} minDragDistance
     */
    this.minDragDistance = 1;

    // Selection state
    /**
     * Flag indicating if a selection operation is in progress.
     * @property {boolean} isSelecting
     */
    this.isSelecting = false;
    /**
     * World coordinates (relative to container) where selection started.
     * @property {{x: number, y: number}} selectionStart
     */
    this.selectionStart = { x: 0, y: 0 };
    /**
     * Current/end world coordinates (relative to container) during selection.
     * @property {{x: number, y: number}} selectionEnd
     */
    this.selectionEnd = { x: 0, y: 0 };
    /**
     * Screen coordinates where selection started.
     * @property {{x: number, y: number} | null} initialPointerScreenPos
     */
    this.initialPointerScreenPos = null;
    /**
     * Set containing the keys ("x,y") of the currently finalized selected
     * tiles.
     * @property {Set<string>} selectedTiles
     */
    this.selectedTiles = new Set();
    /**
     * Graphics object for highlights. Managed by the Scene.
     * @property {Phaser.GameObjects.Graphics | null} highlightGraphics
     */
    /**
     * Graphics object for the selection rectangle. Managed by the Scene.
     * @property {Phaser.GameObjects.Graphics} selectionGraphics
     */
    /**
     * Minimum time (ms) between selection box updates (debounce). ~60fps.
     * @property {number} selectionDebounceMS
     */
    this.selectionDebounceMS = 16; // ~60fps
    /**
     * Timestamp of the last selection update.
     * @property {number} lastSelectionUpdateTime
     */
    this.lastSelectionUpdateTime = 0;

    // Register input listeners
    this.registerInputEvents();

    this.cursors = this.scene.input.keyboard.createCursorKeys();
  }

  /**
   * Converts screen coordinates (e.g., pointer position) to game tile
   * coordinates.
   *
   * Relies on the scene providing `getItemMapContainerPosition`, `tileSizeX`,
   * and `tileSizeY`.
   * @param {number} x - Screen x-coordinate.
   * @param {number} y - Screen y-coordinate.
   * @returns {{x: number, y: number}} Tile coordinates (integers).
   */
  screenToTileCoordinates(x, y) {
    if (
      !this.scene?.getItemMapContainerPosition ||
      !this.scene?.tileSizeX ||
      !this.scene?.tileSizeY
    ) {
      console.error(
        `Scene context or required properties/methods are missing for ` +
        `screenToTileCoordinates.`
      );
      return { x: 0, y: 0 };
    }

    try {
      // Gets the container's TOP-LEFT corner position in screen space
      const containerPos = this.scene.getItemMapContainerPosition();
      if (!containerPos) {
        console.error(
          `[InputHandler screenToTileCoordinates] ` +
          `getItemMapContainerPosition returned null/undefined.`
        );
        return { x: 0, y: 0 };
      }
      const { x: containerX, y: containerY } = containerPos;

      const tileSizeX = this.scene.tileSizeX;
      const tileSizeY = this.scene.tileSizeY;

      // Calculate pointer position RELATIVE to the container's top-left corner
      const worldX = x - containerX;
      const worldY = y - containerY;

      // Divide the relative position by tile size to get the tile index
      const tileX = Math.floor(worldX / tileSizeX);
      const tileY = Math.floor(worldY / tileSizeY);

      return { x: tileX, y: tileY };
    } catch (error) {
      console.error('Error in screenToTileCoordinates:', error);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Registers Phaser input event listeners for tile selection.
   *
   * Note: Drag listeners are currently not registered here.
   * @private
   */
  registerInputEvents() {
    const { input } = this.scene;

    input.on('pointerdown', this.handlePointerDownSelect, this);
    input.on('pointermove', this.handlePointerMoveSelect, this);
    input.on('pointerup', this.handlePointerUpSelect, this);
    input.on('gameout', this.handlePointerUpSelect, this);
  }

  // --- Movement Handlers (Currently Inactive) ---
  /**
   * Handler for pointer down event (for dragging).
   * @param {Phaser.Input.Pointer} pointer The initiating pointer.
   * @private
   */
  handlePointerDownMovement(pointer) {
    this.startDrag(pointer);
  }
  /**
   * Handler for pointer move event (for dragging).
   * @param {Phaser.Input.Pointer} pointer The moving pointer.
   * @private
   */
  handlePointerMoveMovement(pointer) {
    if (this.isDragging) this.doDrag(pointer);
  }
  /**
   * Handler for pointer up event (for dragging).
   * @param {Phaser.Input.Pointer} pointer The ending pointer.
   * @private
   */
  handlePointerUpMovement(pointer) {
    if (this.isDragging) this.stopDrag(pointer);
  }
  // --- Selection Handlers (Active) ---
  /**
   * Handler for pointer down event (starts selection).
   * @param {Phaser.Input.Pointer} pointer The initiating pointer.
   * @private
   */
  handlePointerDownSelect(pointer) {
    this.startSelection(pointer);
  }
  /**
   * Handler for pointer move event (updates selection box).
   * @param {Phaser.Input.Pointer} pointer The moving pointer.
   * @private
   */
  handlePointerMoveSelect(pointer) {
    if (this.isSelecting) this.updateSelection(pointer);
  }
  /**
   * Handler for pointer up or game out event (ends selection).
   * @param {Phaser.Input.Pointer} _pointer The ending pointer (unused).
   * @private
   */
  handlePointerUpSelect(_pointer) {
    if (this.isSelecting) {
      this.endSelection(_pointer);
    }
  }
  // --- Drag Logic (Currently Inactive) ---
  /**
   * Initializes drag state on pointer down.
   * @param {Phaser.Input.Pointer} pointer The initiating pointer.
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
   * Updates map center based on drag movement, applying throttling
   * and scaling.
   * @param {Phaser.Input.Pointer} pointer The moving pointer.
   * @private
   */
  doDrag(pointer) {
    if (!this.isDragging || !this.dragStart || !this.scene.currentCenterTile)
      return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastDragTime;

    if (deltaTime < this.dragThrottleMS) return;

    try {
      const deltaX = pointer.x - this.lastDragPos.x;
      const deltaY = pointer.y - this.lastDragPos.y;

      const moveLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (moveLength < this.minDragDistance) return;

      const normalizedDeltaX = deltaX / moveLength;
      const normalizedDeltaY = deltaY / moveLength;

      this.dragVelocity.x = (normalizedDeltaX * moveLength) / deltaTime;
      this.dragVelocity.y = (normalizedDeltaY * moveLength) / deltaTime;

      const angle = Math.atan2(Math.abs(deltaY), Math.abs(deltaX));
      const dragScale = 2 + Math.sin(angle) * 2;

      const deltaGridX = Math.round(
        (normalizedDeltaX * dragScale * moveLength) / this.scene.tileSizeX
      );
      const deltaGridY = Math.round(
        (normalizedDeltaY * dragScale * moveLength) / this.scene.tileSizeY
      );

      const newCenterX = this.scene.currentCenterTile.x - deltaGridX;
      const newCenterY = this.scene.currentCenterTile.y - deltaGridY;

      const maxCoord = this.scene.maxCoord ?? Infinity;

      const clampedX = Math.max(0, Math.min(maxCoord, newCenterX));
      const clampedY = Math.max(0, Math.min(maxCoord, newCenterY));

      if (
        clampedX !== this.scene.currentCenterTile.x ||
        clampedY !== this.scene.currentCenterTile.y
      )
        this.scene.updateCenter(clampedX, clampedY);

      this.lastDragPos = { x: pointer.x, y: pointer.y };
      this.lastDragTime = currentTime;
    } catch (error) {
      console.error('Error in doDrag:', error);

      this.stopDrag(pointer);
    }
  }
  /**
   * Calculates and applies inertial scrolling after drag ends.
   * @private
   */
  applyDragInertia() {
    const inertiaDecay = () => {
      if (
        Math.abs(this.dragVelocity.x) < 0.01 &&
        Math.abs(this.dragVelocity.y) < 0.01
      )
        return;

      const deltaGridX = Math.round(
        (this.dragVelocity.x * this.scene.tileSizeX) / 60
      );

      const deltaGridY = Math.round(
        (this.dragVelocity.y * this.scene.tileSizeY) / 60
      );

      const newCenterX = this.scene.currentCenterTile.x - deltaGridX;
      const newCenterY = this.scene.currentCenterTile.y - deltaGridY;

      if (Math.abs(deltaGridX) > 0 || Math.abs(deltaGridY) > 0)
        this.scene.updateCenter(newCenterX, newCenterY);

      this.dragVelocity.x *= this.dragInertia;
      this.dragVelocity.y *= this.dragInertia;

      if (
        Math.abs(this.dragVelocity.x) > 0.01 ||
        Math.abs(this.dragVelocity.y) > 0.01
      )
        requestAnimationFrame(inertiaDecay);
    };

    requestAnimationFrame(inertiaDecay);
  }
  /**
   * Stops the drag operation and potentially applies inertia.
   * @param {Phaser.Input.Pointer} _pointer The ending pointer (unused).
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
    )
      this.applyDragInertia();
    this.isDragging = false;
    this.dragStart = null;
    this.lastDragPos = null;
    this.lastDragTime = 0;
  }
  // --- Selection Logic (Active) ---
  /**
   * Starts the tile selection process on pointer down.
   *
   * Initializes selection state and graphics.
   * @param {Phaser.Input.Pointer} pointer - The pointer object from the input
   *   event.
   * @private
   */
  startSelection(pointer) {
    if (this.scene?.disableInput) return;

    try {
      this.isSelecting = true;

      // Calculate world coordinates relative to container
      const containerPos = this.scene.getItemMapContainerPosition();
      const containerX = containerPos.x;
      const containerY = containerPos.y;

      this.selectionStart = {
        x: pointer.x - containerX,
        y: pointer.y - containerY,
      };
      this.selectionEnd = { ...this.selectionStart }; // Start and end are same initially

      // Store Initial Screen Position
      this.initialPointerScreenPos = { x: pointer.x, y: pointer.y };

      this.lastSelectionUpdateTime = performance.now();

      this.selectedTiles.clear();

      // Access selectionGraphics from registry
      const selectionGraphics = this.scene.registry.get('selectionGraphics');
      if (selectionGraphics) {
        selectionGraphics.clear().setVisible(true);
      } else {
        console.warn(
          `[InputHandler startSelection] selectionGraphics not found in registry!`
        );
      }
      this.updateSelectionBox(); // Initial draw without pointer needed here
    } catch (error) {
      console.error('Error starting selection:', error);
      this.isSelecting = false;
    }
  }

  /**
   * Updates the selection end coordinates and redraws the selection box
   * during pointer move. Debounced based on `selectionDebounceMS`.
   * @param {Phaser.Input.Pointer} pointer - The pointer object from the input
   *   event.
   * @private
   */
  updateSelection(pointer) {
    const currentTime = performance.now();
    if (
      currentTime - this.lastSelectionUpdateTime >=
      this.selectionDebounceMS
    ) {
      // Calculate world coordinates relative to container
      const containerPos = this.scene.getItemMapContainerPosition();
      const containerX = containerPos.x;
      const containerY = containerPos.y;
      const newSelectionEndX = pointer.x - containerX;
      const newSelectionEndY = pointer.y - containerY;

      // Store Current Screen Position (Overwrites initial if moved)
      this.initialPointerScreenPos = { x: pointer.x, y: pointer.y };

      this.selectionEnd = { x: newSelectionEndX, y: newSelectionEndY };

      this.updateSelectionBox(); // Redraw based on updated selectionEnd
      this.lastSelectionUpdateTime = currentTime;
    }
  }

  /**
   * Ends selection, finalizes selected tiles, fetches their data, emits events,
   * and updates visuals.
   * @param {Phaser.Input.Pointer} _pointer - The pointer event that triggered
   *   the end of selection (unused).
   * @private
   */
  endSelection(_pointer) {
    if (this.scene?.disableInput) return;

    try {
      const selectionGraphics = this.scene.registry.get('selectionGraphics');
      if (selectionGraphics) {
        selectionGraphics.setVisible(false);
      } else {
        console.warn(
          `[InputHandler endSelection] selectionGraphics not found in registry!`
        );
      }

      // Get coordinates [{x, y}, ...]
      const selectedCoords = this.getSelectedTiles();

      this.isSelecting = false; // Set selecting to false AFTER calculation

      // Clear previous logical selection
      this.selectedTiles.clear();

      // Fetch full tile data from MapService
      const mapService = this.scene.mapService;
      const finalSelectedTileData = [];
      if (mapService) {
        selectedCoords.forEach((coord) => {
          const tileData = mapService.getTile(coord.x, coord.y);
          if (tileData) {
            // Ensure x, y are included with the fetched data
            finalSelectedTileData.push({ ...tileData, x: coord.x, y: coord.y });
            // Add to internal Set for consistency (if needed, using key)
            this.selectedTiles.add(`${coord.x},${coord.y}`);
          } else {
            // Optionally log if a selected coord didn't have data
            // console.warn(`[InputHandler endSelection] No tile data found for coord (${coord.x}, ${coord.y})`);
          }
        });
      } else {
        console.warn(
          `[InputHandler endSelection] MapService not available,` +
          ` cannot fetch tile data.`
        );
        // Fallback? Emit coords? Or emit null?
        EventBus.emit('tiles-selected', null);
        return;
      }

      // Emit the array of full tile data objects
      EventBus.emit(
        'tiles-selected',
        finalSelectedTileData.length > 0 ? finalSelectedTileData : null
      );
    } catch (error) {
      console.error('Error ending selection:', error);

      // Ensure cleanup on error
      this.isSelecting = false;
      const selectionGraphics = this.scene.registry.get('selectionGraphics');
      if (selectionGraphics) {
        selectionGraphics.setVisible(false);
      }
      this.selectedTiles.clear();
      EventBus.emit('tiles-selected', null); // Emit null on error
    }
  }

  /**
   * Redraws the rectangular selection box based on current start/end
   * coordinates (relative to the container).
   * @private
   */
  updateSelectionBox() {
    const selectionGraphics = this.scene.registry.get('selectionGraphics');
    if (!this.isSelecting || !selectionGraphics) {
      return;
    }

    const bounds = this.getSelectionBounds(); // These are relative to container

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    if (width > 0 && height > 0) {
      const containerPos = this.scene.getItemMapContainerPosition();

      // Calculate screen coordinates for drawing in UI container
      const screenRectX = bounds.minX + containerPos.x;
      const screenRectY = bounds.minY + containerPos.y;

      if (width > 0 && height > 0) {
        // Check again after potential float issues
        selectionGraphics.setVisible(true);
        selectionGraphics.clear();

        // Fill and stroke styles are set in NewGame
        // Draw using screen coordinates
        selectionGraphics.fillRect(screenRectX, screenRectY, width, height);
        selectionGraphics.strokeRect(screenRectX, screenRectY, width, height);
      } else {
        selectionGraphics.setVisible(false);
      }
    } else {
      selectionGraphics.setVisible(false);
    }
  }

  /**
   * Calculates the bounds of the current selection rectangle relative to the
   * item map container.
   * @returns {{minX: number, minY: number, maxX: number, maxY: number}} The
   *   selection bounds (relative coordinates).
   * @private
   */
  getSelectionBounds() {
    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);
    return {
      minX,
      minY,
      maxX,
      maxY,
    };
  }

  /**
   * Calculates and returns an array of tile coordinates ({x, y}) within the
   * current selection bounds.
   * @returns {Array<{x: number, y: number}>} Array of selected tile
   *   coordinates.
   */
  getSelectedTiles() {
    // Allow calling this after selection ends by checking the finalized set too
    if (!this.isSelecting && this.selectedTiles.size === 0) {
      return [];
    }

    const bounds = this.getSelectionBounds(); // Bounds relative to itemMapContainer

    // Convert Bounds to Absolute Screen Coords for tile calculation
    const containerPos = this.scene.getItemMapContainerPosition();
    const screenMinX = bounds.minX + containerPos.x;
    const screenMinY = bounds.minY + containerPos.y;
    const screenMaxX = bounds.maxX + containerPos.x;
    const screenMaxY = bounds.maxY + containerPos.y;

    // Pass absolute screen coords to the conversion function
    const startTile = this.screenToTileCoordinates(screenMinX, screenMinY);
    const endTile = this.screenToTileCoordinates(screenMaxX, screenMaxY);

    const selectedTilesResult = [];

    // Ensure start/end are ordered correctly, regardless of drag direction
    const minTileX = Math.min(startTile.x, endTile.x);
    const maxTileX = Math.max(startTile.x, endTile.x);
    const minTileY = Math.min(startTile.y, endTile.y);
    const maxTileY = Math.max(startTile.y, endTile.y);

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        // Use scene's mapService for bounds checking
        if (this.scene?.mapService?.isWithinBounds(x, y)) {
          selectedTilesResult.push({ x, y });
        }
      }
    }

    return selectedTilesResult;
  }

  /**
   * Determines if a given Phaser GameObject is a valid target for selection
   * based on various criteria.
   *
   * Requires the scene context to have necessary properties like grid, map,
   * and tile sizes.
   * @param {Phaser.GameObjects.GameObject} gameObject - The GameObject to
   *   check.
   * @return {boolean} True if the object is a valid target, false otherwise.
   */
  isValidSelectionTarget(gameObject) {
    // Return true only if all conditions are met.
    // Ensures gameObject and scene are valid for selection.
    return !!(
      gameObject?.visible &&
      gameObject?.active &&
      gameObject?.input &&
      this._isSceneValidForSelection()
      // Add other game-specific checks here if needed, e.g.:
      // && gameObject.getData('isSelectable')
    );
  }

  /**
   * Checks if the scene has the necessary properties for selection logic.
   * @private
   * @returns {boolean} True if the scene context is valid for selection.
   */
  _isSceneValidForSelection() {
    // Combine all checks into a single boolean expression
    return !!(
      this.scene?.grid &&
      this.scene?.map?.tileWidth &&
      this.scene?.map?.tileHeight &&
      this.scene?.tileSizeX &&
      this.scene?.tileSizeY
    );
  }

  /**
   * Creates/updates a visual marker and text at the calculated grid center.
   * Delegates the actual creation/update to the scene.
   * For debugging purposes. Requires `markGridCenter` method on the scene.
   * @deprecated Debugging method, should not be used in production.
   */
  markGridCenter() {
    if (!this.scene || typeof this.scene.markGridCenter !== 'function') {
      console.warn(
        `[InputHandler] Cannot mark grid center: ` +
        `Scene or scene.markGridCenter method missing.`
      );
      return;
    }
    // Delegate to the scene
    this.scene.markGridCenter();
  }

  /**
   * Removes event listeners and cleans up resources.
   */
  destroy() {
    // Remove input listeners
    this.scene.input.off('pointerdown', this.handlePointerDownSelect, this);
    this.scene.input.off('pointermove', this.handlePointerMoveSelect, this);
    this.scene.input.off('pointerup', this.handlePointerUpSelect, this);
    this.scene.input.off('gameout', this.handlePointerUpSelect, this);

    // Movement listeners cleanup (if ever activated)
    // this.scene.input.off('pointerdown', this.handlePointerDownMovement, this);
    // this.scene.input.off('pointermove', this.handlePointerMoveMovement, this);
    // this.scene.input.off('pointerup', this.handlePointerUpMovement, this);

    // Center marker cleanup responsibility moved to NewGame scene shutdown.

    // Clear sets
    this.selectedTiles.clear();

    // Nullify scene reference (helps garbage collection)
    this.scene = null;
  }

  /**
   * Programmatically sets the selected tiles. Clears previous selection.
   * @param {Array<{x: number, y: number}>} tilesArray - An array of tile
   *   coordinates to select.
   */
  setSelectedTiles(tilesArray) {
    if (!Array.isArray(tilesArray)) {
      console.warn(`[InputHandler] setSelectedTiles received invalid input.`);
      tilesArray = []; // Default to empty array
    }
    // Clear previous selection (both logical and visual)
    this.selectedTiles.clear();

    // Add new tiles to the selection set
    tilesArray.forEach((tile) => {
      if (typeof tile?.x === 'number' && typeof tile?.y === 'number') {
        this.selectedTiles.add(`${tile.x},${tile.y}`);
      }
    });
  }

  /**
   * Validates the input parameters for the updateCenter method.
   * @param {number} newCenterX - The target center tile X coordinate.
   * @param {number} newCenterY - The target center tile Y coordinate.
   * @returns {boolean} True if inputs are valid numbers, false otherwise.
   * @private
   */
  _validateUpdateCenterInput(newCenterX, newCenterY) {
    if (
      typeof newCenterX !== 'number' ||
      isNaN(newCenterX) ||
      typeof newCenterY !== 'number' ||
      isNaN(newCenterY)
    ) {
      console.error(
        `[InputHandler updateCenter] Invalid input parameters received! ` +
        `newCenterX=${newCenterX} (${typeof newCenterX}), ` +
        `newCenterY=${newCenterY} (${typeof newCenterY}). Aborting update.`
      );
      return false;
    }
    return true;
  }

  /**
   * Checks if the map service is available and logs a warning if not.
   * @returns {Object|null} The map service instance or null.
   * @private
   */
  _getMapService() {
    if (!this.scene?.mapService) {
      console.warn(
        `[InputHandler] mapService not available on the scene. ` +
        `Cannot perform map-related operations.`
      );
      return null;
    }
    return this.scene.mapService;
  }

  /**
   * Determines the appropriate clamping bounds for map movement.
   * Prefers non-leasable bounds if available, otherwise uses overall map
   * bounds.
   * @param {Object} mapService - The map service instance.
   * @returns {{minBoundX: number, maxBoundX: number, minBoundY: number, maxBoundY: number}} The calculated bounds for clamping.
   * @private
   */
  _getClampingBounds(mapService) {
    const maxCoordX = mapService.maxCoord?.x ?? 0;
    const maxCoordY = mapService.maxCoord?.y ?? 0;

    const { x: minActionableX, y: minActionableY } =
      mapService.minActionableCoord ?? { x: Infinity, y: Infinity };
    const { x: maxActionableX, y: maxActionableY } =
      mapService.maxActionableCoord ?? { x: -Infinity, y: -Infinity };

    let minBoundX = 0;
    let maxBoundX = maxCoordX;
    let minBoundY = 0;
    let maxBoundY = maxCoordY;

    if (minActionableX !== Infinity && maxActionableX !== -Infinity) {
      minBoundX = minActionableX;
      maxBoundX = maxActionableX;
    }
    if (minActionableY !== Infinity && maxActionableY !== -Infinity) {
      minBoundY = minActionableY;
      maxBoundY = maxActionableY;
    }

    return { minBoundX, maxBoundX, minBoundY, maxBoundY };
  }

  /**
   * Calculates the target screen position for the itemMapContainer based on the
   * target center tile.
   * @param {number} targetTileX - The target tile X coordinate.
   * @param {number} targetTileY - The target tile Y coordinate.
   * @returns {{x: number, y: number} | null} The target screen coordinates
   *   ({x, y}) or null if calculation results in NaN.
   * @private
   */
  _calculateContainerTargetPosition(targetTileX, targetTileY) {
    const width = this.scene.gameWidth;
    const height = this.scene.gameHeight;
    const tileOffsetX = this.scene.tileSizeX / 2;
    const tileOffsetY = this.scene.tileSizeY / 2;

    const targetX =
      width / 2 - (targetTileX * this.scene.tileSizeX + tileOffsetX);
    const targetY =
      height / 2 - (targetTileY * this.scene.tileSizeY + tileOffsetY);

    if (isNaN(targetX) || isNaN(targetY)) {
      console.error(
        `[InputHandler updateCenter] Calculated target position is NaN! ` +
        `Target=(${targetX}, ${targetY}). Inputs: ` +
        `Screen=(${width}x${height}), Tile=(${targetTileX},${targetTileY}), ` +
        `Size=(${this.scene.tileSizeX}x${this.scene.tileSizeY}), ` +
        `Offset=(${tileOffsetX},${tileOffsetY}). Aborting move.`
      );
      return null;
    }

    return { x: targetX, y: targetY };
  }

  /**
   * Moves the itemMapContainer instantly to the target position.
   * @param {Phaser.GameObjects.Container} container - The container to move.
   * @param {number} targetX - The target X screen coordinate.
   * @param {number} targetY - The target Y screen coordinate.
   * @param {number} targetTileX - The final target tile X coordinate.
   * @param {number} targetTileY - The final target tile Y coordinate.
   * @private
   */
  _moveContainerInstantly(
    container,
    targetX,
    targetY,
    targetTileX,
    targetTileY
  ) {
    this.scene.isAnimating = false; // Ensure scene knows it's not animating
    container.setPosition(targetX, targetY);
    this.scene.itemRenderer?.renderItemMap(); // Render immediately
    this.scene.events.emit('centerUpdated', targetTileX, targetTileY);
  }

  /**
   * Tweens the itemMapContainer to the target position.
   * @param {Phaser.GameObjects.Container} container - The container to tween.
   * @param {number} targetX - The target X screen coordinate.
   * @param {number} targetY - The target Y screen coordinate.
   * @param {number} targetTileX - The final target tile X coordinate.
   * @param {number} targetTileY - The final target tile Y coordinate.
   * @private
   */
  _tweenContainer(container, targetX, targetY, targetTileX, targetTileY) {
    const renderer = this.scene.itemRenderer;
    this.scene.isAnimating = true; // Mark as animating
    this.scene.tweens.add({
      targets: container,
      x: targetX,
      y: targetY,
      duration: 166, // Approx 10 frames at 60fps
      ease: 'Sine.out', // Smooth ease-out
      onStart: () => {
        this.scene.isAnimating = true; // Re-affirm
      },
      onUpdate: () => {
        renderer?.renderItemMap(); // Continuous rendering during tween
      },
      onComplete: () => {
        this.scene.isAnimating = false; // Mark animation as complete
        renderer?.renderItemMap(); // Final render
        this.scene.events.emit('centerUpdated', targetTileX, targetTileY);
      },
      onStop: () => {
        this.scene.isAnimating = false; // Mark animation as stopped
        container.setPosition(targetX, targetY); // Snap to final position
        renderer?.renderItemMap(); // Render final state
        this.scene.events.emit('centerUpdated', targetTileX, targetTileY);
      },
    });
  }

  /**
   * Updates the logical center tile and moves the itemMapContainer smoothly
   * (or instantly) to center the view on the new tile.
   * Requires scene properties: isAnimating, mapService, currentCenterTile,
   * tileSizeX, tileSizeY, itemMapContainer, tweens, itemRenderer, events.
   * @param {number} newCenterX - The target center tile X coordinate.
   * @param {number} newCenterY - The target center tile Y coordinate.
   * @param {boolean} [instant=false] - If true, move instantly; otherwise,
   *   tween.
   */
  updateCenter(newCenterX, newCenterY, instant = false) {
    if (!this.scene) {
      console.warn(
        `[InputHandler updateCenter] Scene is not available. ` +
        `Cannot update center.`
      );
      return;
    }

    // Validate Input
    if (!this._validateUpdateCenterInput(newCenterX, newCenterY)) {
      return;
    }

    // Get Map Service and Boundaries
    const mapService = this._getMapService();
    if (!mapService) {
      return; // Map service unavailable, cannot proceed.
    }
    const { minBoundX, maxBoundX, minBoundY, maxBoundY } =
      this._getClampingBounds(mapService);

    // Clamp the target coordinates using the determined bounds
    const clampedX = Math.max(minBoundX, Math.min(maxBoundX, newCenterX));
    const clampedY = Math.max(minBoundY, Math.min(maxBoundY, newCenterY));

    // Use rounded clamped values as the final target tile
    const targetTileX = Math.round(clampedX);
    const targetTileY = Math.round(clampedY);

    // Calculate Target Position using clamped tile coordinates
    const targetPosition = this._calculateContainerTargetPosition(
      targetTileX,
      targetTileY
    );
    if (!targetPosition) {
      return; // Error already logged in helper
    }
    const { x: targetX, y: targetY } = targetPosition;

    // Get Container
    const container = this.scene.registry.get('itemMapContainer');
    if (!container) {
      console.warn(
        `[InputHandler updateCenter] itemMapContainer not found in registry.`
      );
      return;
    }

    // Store Logical Center
    this.scene.currentCenterTile = { x: targetTileX, y: targetTileY };

    // Move Container
    if (instant) {
      this._moveContainerInstantly(
        container,
        targetX,
        targetY,
        targetTileX,
        targetTileY
      );
    } else {
      this._tweenContainer(
        container,
        targetX,
        targetY,
        targetTileX,
        targetTileY
      );
    }
  }
}
