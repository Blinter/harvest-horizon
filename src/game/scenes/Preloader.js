/**
 * @file Preloader.js
 * @description Defines the Preloader scene for the Harvest Horizon game. This
 *              scene handles loading all necessary game assets before
 *              transitioning to the main menu or game scene.
 * @module scenes/Preloader
 */
import { Scene } from 'phaser';

/**
 * @class Preloader
 * @extends {Phaser.Scene}
 * @description A Phaser scene responsible for loading all game assets (images,
 *              audio, spritesheets, tilemaps) before transitioning to the
 *              MainMenu scene. It displays a loading progress indicator.
 */
export class Preloader extends Scene {
  /**
   * @constructor
   * @description Sets the key for this scene.
   */
  constructor() {
    super('Preloader');
  }

  /**
   * @method preload
   * @description Phaser scene lifecycle method. Called before 'create'. Loads
   *              all required game assets using Phaser's LoaderPlugin.
   *              Displays a gradient background, loading text, and a progress bar.
   */
  preload() {
    const { width, height } = this.cameras.main;

    // Create a blue gradient background
    const gradientBackground = this.add.graphics();
    // Define gradient colors (e.g., dark blue to a lighter blue)
    // fillGradientStyle(topLeftColor, topRightColor, bottomLeftColor, bottomRightColor, alphaTopLeft, alphaTopRight, alphaBottomLeft, alphaBottomRight)
    // For a vertical gradient, topLeftColor and topRightColor are the same, and bottomLeftColor and bottomRightColor are the same.
    gradientBackground.fillGradientStyle(0x000033, 0x000033, 0x000088, 0x000088, 1);
    gradientBackground.fillRect(0, 0, width, height);

    const progressBarWidth = 240;
    const progressBarHeight = 50;
    const progressBarX = (width - progressBarWidth) / 2;
    const progressBarY = height / 2 + 50; // Position below text

    // Background for the progress bar
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);

    // The actual progress bar
    const progressBar = this.add.graphics();

    // Loading text
    this.add
      .text(
        width / 2,
        height / 2, // Positioned above the progress bar
        'Loading...',
        {
          color: '#ffffff',
          fontSize: '48px',
        },
      )
      .setOrigin(0.5, 0.5);

    // Listen to the 'progress' event to update the progress bar
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(
        progressBarX + 10, // Add some padding
        progressBarY + 0,
        (progressBarWidth - 20) * value, // Adjust width based on progress
        progressBarHeight - 10,
      );
    });

    // Listen to the 'complete' event to remove the progress bar and start next scene
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      // The gradientBackground can also be destroyed if not needed in the next 
      // scene,
      // but typically the scene transition handles clearing previous scene's 
      // elements.
    });

    // Set the base path for assets
    this.load.setPath('assets');

    // Load images
    this.load.image('bg2', 'bg2.png');

    // Load ground tiles spritesheet and map data
    this.load.spritesheet('tiles', 'tilesets/farmableGround.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.tilemapTiledJSON('map', 'tilesets/farmableGround.json');

    // Load wheat crops spritesheet and map data
    this.load.spritesheet('cropsWheat', 'tilesets/cropsWheat.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.tilemapTiledJSON('cropsWheatMap', 'tilesets/cropsWheat.json');

    // Load audio files
    this.load.audio('testSound', 'sound/Coin Dropped on Ceramic Dish.wav');
    this.load.audio('plantSound', 'sound/Receipt Handled 03.wav');
    this.load.audio('harvestSound', 'sound/Coins_Bottlecaps_Drop.wav');
    this.load.audio('mainMenuAmbience', 'music/ambience/tundra-loop.mp3');
    this.load.audio('mainMenuMusic', 'music/07-Alpenglow.mp3');
    this.load.audio('newGameMusic', 'music/game/04-Blue-Forest.mp3');
  }

  /**
   * @method create
   * @description Phaser scene lifecycle method. Called once assets in 'preload'
   *              are loaded. Transitions to the MainMenu scene, passing along
   *              the `instantStart` flag if provided during scene start.
   */
  create() {
    this.scene.start('MainMenu');
  }
}
