import { EventBus } from '../../EventBus.js';
import { Scene } from 'phaser';

/**
 * @typedef {object} TileConfig
 * @property {number} frame - The frame index from the 'tiles' spritesheet.
 * @property {number} [x=0] - Relative x position within a grouped item.
 * @property {number} [y=0] - Relative y position within a grouped item.
 * @property {number} [width=32] - Display width of the tile sprite.
 * @property {number} [height=32] - Display height of the tile sprite.
 * @property {number} [cropX] - X coordinate to start cropping from the frame.
 * @property {number} [cropY] - Y coordinate to start cropping from the frame.
 * @property {number} [cropWidth] - Width of the cropped area.
 * @property {number} [cropHeight] - Height of the cropped area.
 * @property {boolean} [isUnique] - Custom data flag (purpose unclear).
 */

/**
 * @typedef {object} ItemConfig
 * @property {string} name - Display name of the item.
 * @property {string} description - Description of the item.
 * @property {number} [frame] - Frame index (if single sprite).
 * @property {number} [width=32] - Display width (if single sprite).
 * @property {number} [height=32] - Display height (if single sprite).
 * @property {number} [cropX] - Crop X (if single sprite).
 * @property {number} [cropY] - Crop Y (if single sprite).
 * @property {number} [cropWidth] - Crop Width (if single sprite).
 * @property {number} [cropHeight] - Crop Height (if single sprite).
 * @property {TileConfig[]} [tiles] - Array of tile configs for grouped items.
 */

/**
 * @class MainMenu
 * @extends Phaser.Scene
 * @classdesc A sandbox or unused Main Menu scene demonstrating item rendering,
 *   sprite grouping, cropping, bounds calculation, and debug outlines.
 *   Located in the 'unused' directory.
 *
 * @param {string} key - The unique key for this Scene ('MainMenu').
 */
export class MainMenu extends Scene {
  /**
   * Initializes the MainMenu sandbox scene.
   * @constructor
   */
  constructor() {
    super('MainMenu');
    /**
     * Background image.
     * @type {?Phaser.GameObjects.Image}
     */
    this.bg = null;
    /**
     * Graphics object used for drawing debug outlines.
     * @type {?Phaser.GameObjects.Graphics}
     */
    this.debugGraphics = null;
    /**
     * Configuration object defining the items to be displayed. The keys are
     * item identifiers, and values are ItemConfig objects.
     * @type {?Record<string, ItemConfig>}
     */
    this.items = null;
    /**
     * Container to hold all the rendered item sprites and text.
     * @type {?Phaser.GameObjects.Container}
     */
    this.itemMapContainer = null;
    /**
     * Potential reference to a logo tween (seems unused/incomplete).
     * @type {?Phaser.Tweens.Tween}
     */
    this.logoTween = null;
  }

  /**
   * Phaser Scene method. Preloads assets like the tileset and map data.
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
   * Phaser Scene method. Creates game objects, defines items, sets up the
   * container, renders items, and initializes event listeners.
   * @override
   */
  create() {
    this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0).setAlpha(0.55);

    this.debugGraphics = this.add.graphics({
      lineStyle: {
        width: 2,
        color: 0x000000,
      },
    });
    this.cameras.main.setBackgroundColor(0xff0000);
    const width = window.innerWidth;
    const height = Math.floor(window.innerHeight / 2);

    this.items = {
      cow2: {
        name: 'CHECK BOUNDS',
        description: 'BOUNDS',
        tiles: [
          {
            frame: 2,
            x: 0,
            y: 0,
            width: 256,
            height: 256,
            cropX: 6,
            cropY: 0,
            cropWidth: 32,
            cropHeight: 32,
            isUnique: true,
          },
          {
            frame: 3,
            x: 256,
            y: 0,
            width: 256,
            height: 256,
            cropX: 0,
            cropY: 0,
            cropWidth: 16,
            cropHeight: 32,
            isUnique: true,
          },
        ],
      },
      potion: {
        name: 'Potion',
        description: 'A healing potion',

        frame: 4,
        width: 256,
        height: 256,
        cropX: 0,
        cropY: 0,
        cropWidth: 32,
        cropHeight: 32,
      },
    };

    this.itemMapContainer = this.add
      .container()
      .setPosition(width / 2, height / 2);

    this.renderItemMap();

    console.debug(
      'Item Map Container position:',
      this.itemMapContainer.x,
      this.itemMapContainer.y
    );

    EventBus.emit('current-scene-ready', this);

    EventBus.on('window-resize', this.resize.bind(this));

    EventBus.emit('window-resize');
  }

  /**
   * Placeholder method to switch to the 'Game' scene.
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
   * Renders the items defined in `this.items` into the `itemMapContainer`.
   * Handles creation of single sprites or groups of sprites based on item
   * configuration. Calculates layout, positioning, adds hover text, and
   * triggers the drawing of debug outlines.
   * @private
   */
  renderItemMap() {
    const margin = 0;
    const maxItemsPerRow = 1;

    const phaserItems = {};
    Object.entries(this.items).forEach(([key, item]) => {
      let sprite;
      if (item.tiles) {
        const group = this.add.group();
        item.tiles.forEach((tile, _tileIndex) => {
          let tileSprite;
          if (tile instanceof Phaser.GameObjects.Sprite) {
            tileSprite = tile;
          } else {
            tileSprite = this.add.sprite(
              tile.x || 0,
              tile.y || 0,
              'tiles',
              tile.frame
            );

            if (
              tile.cropX !== undefined &&
              tile.cropY !== undefined &&
              tile.cropWidth !== undefined &&
              tile.cropHeight !== undefined
            ) {
              tileSprite.setCrop(
                tile.cropX,
                tile.cropY,
                tile.cropWidth,
                tile.cropHeight
              );

              tileSprite.setDisplaySize(tile.width, tile.height);
            } else {
              tileSprite.setDisplaySize(tile.width || 32, tile.height || 32);
            }
          }
          tileSprite.setInteractive();
          if (tile.isUnique) {
            tileSprite.setData('isUnique', true);
          }
          group.add(tileSprite);
        });

        sprite = group;
        console.debug(sprite);
        this.add.existing(sprite);
      } else {
        if (item instanceof Phaser.GameObjects.Sprite) sprite = item;
        else {
          sprite = this.add.sprite(0, 0, 'tiles', item.frame);

          if (
            item.cropX !== undefined &&
            item.cropY !== undefined &&
            item.cropWidth !== undefined &&
            item.cropHeight !== undefined
          ) {
            sprite.setCrop(
              item.cropX,
              item.cropY,
              item.cropWidth,
              item.cropHeight
            );
          }

          sprite.setDisplaySize(item.width || 32, item.height || 32);
        }
        sprite.setInteractive();
      }
      phaserItems[key] = sprite;
    });

    let maxWidth = 0;
    let maxHeight = 0;

    Object.values(phaserItems).forEach((item) => {
      let bounds;
      if (item instanceof Phaser.GameObjects.Group)
        bounds = item.getChildren().reduce(
          (acc, child) => {
            const childBounds = child.getBounds();
            console.debug(childBounds);
            return {
              width: Math.max(acc.width, childBounds.width),
              height: Math.max(acc.height, childBounds.height),
            };
          },
          { width: 0, height: 0 }
        );
      else bounds = item.getBounds();

      maxWidth = Math.max(maxWidth, bounds.width);
      maxHeight = Math.max(maxHeight, bounds.height);
    });

    let x = 0;
    let y = 0;

    Object.entries(this.items).forEach(([key, item], index) => {
      let sprite = phaserItems[key];
      let tileCount = Array.isArray(item.tiles) ? item.tiles.length : 1;

      let bounds;
      if (sprite instanceof Phaser.GameObjects.Group)
        bounds = sprite.getChildren().reduce(
          (acc, child) => {
            const childBounds = child.getBounds();
            return {
              width: Math.max(acc.width, childBounds.width),
              height: Math.max(acc.height, childBounds.height),
            };
          },
          { width: 0, height: 0 }
        );
      else bounds = sprite.getBounds();

      const offsetX = (maxWidth - bounds.width) / 2;
      const offsetY = (maxHeight - bounds.height) / 2;

      if (sprite instanceof Phaser.GameObjects.Group) {
        let groupBounds = {
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        };

        sprite.getChildren().forEach((child, childIndex) => {
          const tile = item.tiles[childIndex];
          const tileX = tile.x || 0;
          const tileY = tile.y || 0;
          groupBounds.minX = Math.min(groupBounds.minX, tileX);
          groupBounds.maxX = Math.max(groupBounds.maxX, tileX);
          groupBounds.minY = Math.min(groupBounds.minY, tileY);
          groupBounds.maxY = Math.max(groupBounds.maxY, tileY);
        });

        const groupCenterX = (groupBounds.maxX + groupBounds.minX) / 2;
        const groupCenterY = (groupBounds.maxY + groupBounds.minY) / 2;

        sprite.getChildren().forEach((child, childIndex) => {
          const tile = item.tiles[childIndex];
          const finalX = x + offsetX + (tile.x || 0) - groupCenterX;
          const finalY = y + offsetY + (tile.y || 0) - groupCenterY;
          child.setPosition(finalX, finalY);
        });
      } else {
        sprite.setPosition(x + offsetX, y + offsetY);
      }

      if (sprite instanceof Phaser.GameObjects.Group) {
        sprite.getChildren().forEach((child) => {
          this.itemMapContainer.add(child);
        });
      } else {
        this.itemMapContainer.add(sprite);
      }

      const outlineWidth = Math.max(1, Math.floor(Math.sqrt(tileCount)));
      if (sprite instanceof Phaser.GameObjects.Group)
        sprite.getChildren().forEach((child) => {
          this.drawSpriteOutline(child, false, outlineWidth);
        });
      else this.drawSpriteOutline(sprite, false, outlineWidth);

      const text = this.add
        .text(x, y + maxHeight + margin, item.name, {
          fill: '#fff',
          fontSize: '12px',
        })
        .setVisible(false);

      if (sprite instanceof Phaser.GameObjects.Group)
        sprite.getChildren().forEach((child) => {
          child.on('pointerover', () => {
            text.setVisible(true);
          });
          child.on('pointerout', () => {
            text.setVisible(false);
          });
        });
      else {
        sprite.on('pointerover', () => {
          text.setVisible(true);
        });
        sprite.on('pointerout', () => {
          text.setVisible(false);
        });
      }

      this.itemMapContainer.add(text);

      x += maxWidth + margin;

      if ((index + 1) % maxItemsPerRow === 0) {
        x = 0;
        y -= maxHeight + margin * 2;
      }
    });

    this.debugGraphics.clear();
    this.redrawOutlines();
  }

  /**
   * Handles window resize events. Adjusts background scale, recenters the
   * item container, and redraws debug outlines.
   * @private
   */
  resize() {
    console.debug('resize sandbox');
    if (!this?.bg) return;

    if (this.bg?.active)
      this.bg.setScale(
        window.innerWidth / this.sys.game.config.width,
        window.innerHeight / this.sys.game.config.height
      );

    if (this.itemMapContainer)
      this.itemMapContainer.setPosition(
        window.innerWidth / 2,
        window.innerHeight / 2
      );

    this.redrawOutlines();

    this.children?.each((child) => {
      child?.setVisible(true);
    });
  }

  /**
   * Draws a rectangular outline around a given sprite using the
   * `debugGraphics` object. Can optionally clear previous drawings. Attempts
   * to adjust outline size based on sprite's potential crop data.
   *
   * @param {Phaser.GameObjects.Sprite} sprite - The sprite to outline.
   * @param {boolean} [clearPrevious=false] - Whether to clear the graphics
   *   object before drawing.
   * @param {number} [lineWidth=1] - The thickness of the outline.
   * @private
   */
  drawSpriteOutline(sprite, clearPrevious = false, lineWidth = 1) {
    const bounds = sprite.getBounds();

    let cropWidth;
    for (const item of Object.values(this.items)) {
      if (Array.isArray(item.tiles)) {
        const spriteFrameIndex = parseInt(sprite.frame.name, 10);
        const matchingTile = item.tiles.find(
          (tile) =>
            tile.frame === spriteFrameIndex && tile.cropWidth !== undefined
        );
        if (matchingTile) {
          cropWidth = matchingTile.cropWidth;
          break;
        }
      }
    }

    if (clearPrevious) this.debugGraphics.clear();

    this.debugGraphics.lineStyle(lineWidth, 0xffffff);

    if (cropWidth !== undefined) {
      const ratio = cropWidth / sprite.width;
      this.debugGraphics.strokeRect(
        bounds.x,
        bounds.y,
        bounds.width * ratio,
        bounds.height
      );
    } else {
      this.debugGraphics.strokeRect(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height
      );
    }
  }

  /**
   * Clears the debug graphics and redraws outlines for all sprites and
   * grouped sprites within the `itemMapContainer`.
   * @private
   */
  redrawOutlines() {
    this.debugGraphics.clear();

    const sprites = this.itemMapContainer.getAll();

    sprites.forEach((sprite) => {
      if (sprite instanceof Phaser.GameObjects.Sprite)
        this.drawSpriteOutline(sprite);
      else if (sprite instanceof Phaser.GameObjects.Group) {
        const tileCount = sprite.getChildren().length;
        const outlineWidth = Math.max(1, Math.floor(Math.sqrt(tileCount)));
        sprite.getChildren().forEach((child) => {
          if (child instanceof Phaser.GameObjects.Sprite)
            this.drawSpriteOutline(child, false, outlineWidth);
        });
      }
    });
  }
}
