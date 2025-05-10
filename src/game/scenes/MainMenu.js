import { SceneBase } from './SceneBase.js';
import { AudioManager } from '../audio/AudioManager.js';
import { EventBus } from '../EventBus.js';
import * as CONFIG from '../constants/config.js';
import * as SCENES from '../constants/scenes.js';

/**
 * @typedef {object} CloudData
 * @property {Phaser.GameObjects.Image} sprite The cloud image game object.
 * @property {number} speed The horizontal movement speed of the cloud.
 * @property {Phaser.Tweens.Tween | null} tween The animation tween for the
 *   cloud.
 */

/**
 * @typedef {object} LetterData
 * @property {Phaser.GameObjects.Text} text The text game object for the
 *   letter.
 * @property {Phaser.Tweens.Tween | null} tween The animation tween for the
 *   letter.
 */

/**
 * @class MainMenu
 * @extends {SceneBase}
 * @classdesc
 * The main menu scene of the game. It displays the game title, background
 * animations (clouds), and menu buttons. Handles user interaction to start
 * the game or potentially access other options. Manages audio initialization
 * and responsive resizing.
 */
export class MainMenu extends SceneBase {

  /**
   * First part of the game title text ("Harvest").
   * @type {string}
   * @private
   */
  gameText = 'Harvest';

  /**
   * Second part of the game title text ("Horizon").
   * @type {string}
   * @private
   */
  gameText2 = 'Horizon';

  /**
   * Flag indicating if resizing is currently enabled for this scene.
   * @type {boolean}
   */
  resizeEnabled = true;

  /**
   * Instance of the AudioManager for handling sound and music.
   * @type {AudioManager | null}
   */
  audioHandler = null;

  /**
   * The background image game object.
   * @type {Phaser.GameObjects.Image | null}
   * @private
   */
  bgImage = null;

  /**
   * Container for the main title text elements.
   * @type {Phaser.GameObjects.Container | null}
   * @private
   */
  titleContainer = null;

  /**
   * Container for the interactive menu buttons.
   * @type {Phaser.GameObjects.Container | null}
   * @private
   */
  buttonContainer = null;

  /**
   * Array storing data for each cloud animation.
   * @type {CloudData[]}
   * @private
   */
  clouds = [];

  /**
   * Array storing data for each letter's animations (can hold multiple
   * tweens).
   * @type {Array<{text: Phaser.GameObjects.Text, tweens: Phaser.Tweens.Tween[]}>}
   * @private
   */
  letterAnimData = []; // Renamed from letterData to reflect multiple tweens

  /**
   * Tween for the floating title container animation.
   * @type {Phaser.Tweens.Tween | null}
   * @private
   */
  floatingContainerTween = null;

  // Store the handler function reference for removal
  handleRequestAudioInit = null;

  /**
   * Stores the unsubscribe function for the 'start-game' event listener.
   * @type {Function | null}
   * @private
   */
  unsubscribeStartGame = null;

  /**
   * Stores the unsubscribe function for the 'stop-game' event listener.
   * @type {Function | null}
   * @private
   */
  unsubscribeStopGame = null;

  /**
   * Instance of the MapService for handling map data socket connection.
   * @type {MapService | null}
   */
  mapService = null;

  // Add class property for the debounced handler
  debouncedHandleResize = null; // Property to hold the debounced function

  /**
   * Data passed to this scene during initialization.
   * May contain an existing AudioManager instance.
   * @type {object | null}
   * @private
   */
  initData = null;

  /**
   * Creates an instance of MainMenu scene.
   */
  constructor() {
    super('MainMenu');

    this.backgroundMusic = null;
  }

  /**
   * Phaser scene lifecycle method. Initializes the scene with data passed
   * from the previous scene.
   * @param {object} data - Data passed from the calling scene.
   */
  init(data) {
    this.initData = data;
    if (!this.initData) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [MainMenu] ` +
        `Scene initialized with no data!!!.`
      );
      throw new Error('Scene initialized with no data!!!.');
    }
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
    //   `Scene initialized with initData:`, this.initData
    // );
  }

  /**
   * Phaser scene lifecycle method. Loads assets needed for the Main Menu.
   * @override
   */
  preload() {
    this.load.setPath('assets');

    //Background2 - AI Generated Image
    this.load.image('bg2', 'bg2.png');

    //Clouds - Photographer - Free to distribute
    this.load.image('cloud', 'clouds3-mini2.jpg');

    //Ambience - Free to distribute
    this.load.audio('mainMenuAmbience', 'music/ambience/tundra-loop.mp3');

    //Music - Free to distribute
    this.load.audio('mainMenuMusic', 'music/07-Alpenglow.mp3');
  }

  /**
   * Creates or updates the background image. Scales and positions it to
   * cover the game area based on current dimensions.
   * @private
   * @param {number} width - The target width.
   * @param {number} height - The target height.
   */
  createBgImage(width, height) {
    if (this.bgImage) {
      this.bgImage.destroy();
    }
    this.bgImage = this.add.image(0, 0, 'bg2').setOrigin(0, 0).setDepth(0);

    const scaleX = width / this.bgImage.width;
    const scaleY = height / this.bgImage.height;
    const scale = Math.max(scaleX, scaleY);
    this.bgImage.setScale(scale);
  }

  /**
   * Creates cloud game objects and adds them to the scene.
   * @private
   * @param {number} width - The current game width.
   * @param {number} height - The current game height.
   */
  createClouds(width, height) {
    // Clear existing clouds and tweens
    if (this.clouds) {
      this.clouds.forEach((cloud) => {
        cloud.tween?.stop();
        cloud.sprite.destroy();
      });
    }
    this.clouds = [];

    // Create more clouds with varying properties
    const numClouds = 35; // Increased number of clouds

    // Calculate cloud distribution
    const cloudSpacing = width / (numClouds / 2); // Space clouds evenly across width
    const startOffset = -width * 0.5; // Start clouds before the screen

    for (let i = 0; i < numClouds; i++) {
      // Distribute clouds more evenly across the width
      const baseX = startOffset + i * cloudSpacing;
      const startX =
        baseX + Phaser.Math.Between(-cloudSpacing / 2, cloudSpacing / 2);
      const startY = Phaser.Math.Between(0, height);

      // Create cloud with varying scale and alpha
      const cloudSprite = this.add
        .image(startX, startY, 'cloud')
        .setOrigin(0.5, 0.5)
        .setScale(Phaser.Math.FloatBetween(1.5, 3.5)) // Larger scale range
        .setAlpha(Phaser.Math.FloatBetween(0.05, 0.12)) // Increased alpha range for better visibility
        .setDepth(1); // Above background, below title

      // Vary the speed more for more natural movement
      const speed = Phaser.Math.FloatBetween(0.15, 0.45); // Increased speed range

      const cloudData = {
        sprite: cloudSprite,
        speed: speed,
        initialX: startX,
        initialY: startY,
      };
      this.clouds.push(cloudData);

      // Add subtle vertical movement
      this.tweens.add({
        targets: cloudSprite,
        y: startY + Phaser.Math.Between(-20, 20),
        duration: Phaser.Math.Between(8000, 12000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /**
   * Creates the container for the main title text.
   * @private
   */
  createTitleContainer() {
    if (this.titleContainer) {
      this.titleContainer.destroy();
    }
    this.titleContainer = this.add.container(0, 0).setDepth(10);
  }

  /**
   * Creates and animates the individual letters of the game title.
   * @private
   * @param {number} centerX - The horizontal center position for the title.
   * @param {number} startY - The vertical starting position for the title.
   * @param {number} scale - The scale factor for the title text.
   */
  createTitleText(centerX, startY, scale) {
    // Clear existing letters and tweens
    this.letterAnimData.forEach((letterInfo) => {
      letterInfo.tweens.forEach((tween) => tween?.stop());
      letterInfo.text.destroy();
    });
    this.letterAnimData = [];

    // Calculate responsive font size based on screen width
    const baseFontSize = 65; // Reduced from 80
    const minFontSize = 35; // Reduced from 40
    const responsiveScale = Math.max(0.4, Math.min(1, scale * 1.1)); // Adjusted scale range
    const fontSize = Math.max(minFontSize, baseFontSize * responsiveScale);

    // --- First Line: "Harvest" ---
    const textStyleHarvest = {
      fontFamily: CONFIG.UI.TITLE_FONT.fontFamily,
      fontSize: `${fontSize}px`,
      fill: '#ffffff',
      stroke: '#D4AF37', // Gold stroke from old version
      strokeThickness: 2 * scale,
    };

    let currentXHarvest = 0;
    const letterSpacingHarvest = -6 * scale; // Reduced from -8 for tighter spacing

    this.gameText.split('').forEach((char, index) => {
      const letterText = this.add
        .text(currentXHarvest, 0, char, textStyleHarvest)
        .setOrigin(0.5, 0.5);

      this.titleContainer?.add(letterText);

      const letterWidth = letterText.width;
      // Calculate offset *before* updating currentXHarvest
      const initialOffsetX = currentXHarvest + letterWidth / 2;
      currentXHarvest += letterWidth + letterSpacingHarvest;

      const letterInfo = {
        text: letterText,
        tweens: {},
        originalData: {
          originalX: initialOffsetX, // Store initial centered X relative to line start
          originalY: 0,
          index: index,
          isSecondLayer: false,
          initialScale: scale,
          initialOffsetX: initialOffsetX, // Store the offset from line start
        },
      };
      this.letterAnimData.push(letterInfo);

      // Initial position/alpha (will be animated in)
      letterText.setY(-100);
      letterText.setAlpha(0);

      this.animateTitleLetter(letterInfo, 0);
    });

    // Center the first line roughly
    const harvestLineWidth = currentXHarvest - letterSpacingHarvest;
    this.letterAnimData.slice(0, this.gameText.length).forEach((info) => {
      info.text.x -= harvestLineWidth / 2;
      info.originalData.originalX -= harvestLineWidth / 2; // Adjust originalX for centering
    });

    // --- Second Line: "Horizon" ---
    const textStyleHorizon = {
      fontFamily: CONFIG.UI.TITLE_FONT.fontFamily,
      fontSize: `${fontSize}px`,
      fill: '#ffffff',
      stroke: '#D4AF37',
      strokeThickness: 2 * scale,
    };

    let currentXHorizon = 0;
    const letterSpacingHorizon = -6 * scale; // Reduced from -8 for tighter spacing
    const secondLineYOffset = 85 * scale; // Reduced from 100 for closer line spacing

    this.gameText2.split('').forEach((char, index) => {
      const letterText = this.add
        .text(currentXHorizon, secondLineYOffset, char, textStyleHorizon)
        .setOrigin(0.5, 0.5);

      this.titleContainer?.add(letterText);

      const letterWidth = letterText.width;
      // Calculate offset *before* updating currentXHorizon
      const initialOffsetX = currentXHorizon + letterWidth / 2;
      currentXHorizon += letterWidth + letterSpacingHorizon;

      const letterInfo = {
        text: letterText,
        tweens: {},
        originalData: {
          originalX: initialOffsetX, // Store initial centered X relative to line start
          originalY: secondLineYOffset,
          index: index,
          isSecondLayer: true,
          initialScale: scale,
          initialOffsetX: initialOffsetX, // Store the offset from line start
        },
      };
      this.letterAnimData.push(letterInfo);

      // Initial position/alpha (will be animated in)
      letterText.setY(secondLineYOffset - 100);
      letterText.setAlpha(0);

      this.animateTitleLetter(letterInfo, secondLineYOffset);
    });

    // Center the second line roughly
    const horizonLineWidth = currentXHorizon - letterSpacingHorizon;
    this.letterAnimData.slice(this.gameText.length).forEach((info) => {
      info.text.x -= horizonLineWidth / 2;
      info.originalData.originalX -= horizonLineWidth / 2; // Adjust originalX for centering
    });

    // Center the entire container
    this.titleContainer?.setPosition(centerX, startY);

    // Add floating animation to the container after creation
    this.addFloatingContainerAnimation();
  }

  /**
   * Creates and runs the entry animation for a single title letter.
   * @private
   * @param {LetterData} letterInfo - The data object for the letter.
   * @param {number} index - The index of the letter in the title string.
   * @param {number} targetY - The target vertical position within the
   *   container.
   */
  animateTitleLetter(letterInfo, targetY) {
    const { text, originalData } = letterInfo;
    const { index, isSecondLayer, initialScale } = originalData;

    // --- Initial Drop/Fade Animation ---
    const entryTween = this.tweens.add({
      targets: text,
      y: targetY,
      alpha: 1,
      ease: 'Bounce.easeOut',
      duration: 1000,
      delay: index * 50,
    });
    letterInfo.tweens.entry = entryTween;

    // --- Complex Animations (from old commit) ---
    const baseDelay = (this.gameText + this.gameText2).length * 50 + 200; // Start after entry

    // Define color sequences
    const colorsHarvest = [0x4df7ff, 0x32cd32, 0xffd700, 0x4169e1]; // Cyan, Green, Yellow, Blue
    const colorsHorizon = [0xb20800, 0xcd32cd, 0x0028ff, 0xbe961e]; // Red, Magenta, Blue, Gold-ish

    const colors = isSecondLayer ? colorsHorizon : colorsHarvest;

    // Color Tween
    const colorTween = this.tweens.add({
      targets: { progress: isSecondLayer ? 1 : 0 }, // Dummy target with progress
      progress: isSecondLayer ? 0 : 1,
      duration: isSecondLayer ? 10000 : 4000,
      repeat: -1,
      delay: baseDelay + index * 100, // Stagger color start
      onUpdate: (tween) => {
        const progress = tween.getValue();
        const colorIndex = Math.floor(progress * colors.length);
        const nextColorIndex = (colorIndex + 1) % colors.length;
        const subProgress = (progress * colors.length) % 1;

        const currentColor = this.lerpColor(
          colors[colorIndex],
          colors[nextColorIndex],
          subProgress
        );

        text.setTint(currentColor);

        // Animate shadow color and blur (glow effect)
        const hexColor = `#${currentColor.toString(16).padStart(6, '0')}`;

        // Pulsing glow
        const glowBlur = 5 + 5 * (1 + Math.sin(progress * Math.PI * 2));
        text.setShadow(
          text.style.shadowOffsetX,
          text.style.shadowOffsetY,
          hexColor,
          glowBlur,
          text.style.shadowStroke,
          text.style.shadowFill
        );
      },
    });
    letterInfo.tweens.color = colorTween;

    // Wave and Morph Animation
    const waveMorphTween = this.tweens.add({
      targets: text,
      y: targetY + 80 * initialScale, // Simplified: Wave target offset Y
      duration: isSecondLayer ? 8000 : 5000,
      delay: baseDelay + index * 250,
      yoyo: true,
      repeat: -1,
      ease: isSecondLayer ? 'Expo.InOut' : 'Sine.easeInOut',
      onUpdate: (tween, target) => {
        const progress = tween.progress; // Use tween's progress (0 to 1)
        target.setRotation(
          Phaser.Math.DegToRad(Math.sin(progress * Math.PI * 2) * 5)
        );
        const breatheScaleFactor = 1 + Math.sin(progress * Math.PI * 2) * 0.15;
        target.setScale(initialScale * breatheScaleFactor);
      },
    });
    letterInfo.tweens.waveMorph = waveMorphTween;

    // Subtle Hover/Scale Animation
    const hoverTween = this.tweens.add({
      targets: text,
      scale: initialScale * 1.1, // Scale up slightly
      duration: 1500 + index * (isSecondLayer ? 150 : 100),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: baseDelay + index * 200,
    });
    letterInfo.tweens.hover = hoverTween;
  }

  /**
   * Sets up the EventBus listener to handle external requests for audio
   * initialization.
   * Stores the handler reference for later removal.
   * @private
   */
  setupExternalAudioListener() {
    // Ensure we don't add multiple listeners if create is called again somehow
    if (this.handleRequestAudioInit) {
      EventBus.off('requestAudioInit', this.handleRequestAudioInit);
    }

    // Define the handler function
    this.handleRequestAudioInit = () => {
      // initAudio already checks this.audioInitialized, 
      // so no need to check here
      this.initAudio().catch((error) => {
        console.error(
          '[MainMenu] Error initializing audio via EventBus event:',
          error
        );
      });
    };

    // Listen ONCE for the external trigger
    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
      `Setting up listener for 'requestAudioInit'.`
    );
    EventBus.once('requestAudioInit', this.handleRequestAudioInit);
  }

  /**
   * Initializes the AudioManager after the first user interaction.
   * @private
   * @async
   */
  async initAudio() {
    if (this.audioHandler?.audioInitialized) return;
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
    //   `Attempting to initialize audio...`
    // );

    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
    //   `Audio was NOT initialized, restarting AudioManager...`
    // );
    // Instantiate AudioManager using 'new' and pass scene + scene key
    this.audioHandler = new AudioManager(this, this.scene.key);
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
    //   `AudioManager instance created.`
    // );

    try {
      // Wait for AudioManager to load assets and initialize sub-managers
      await this.audioHandler.init();

      // --- Emit initial volume settings via EventBus ---
      const initialSoundsVolume = 15 / 100; // Default from MainMenuControls
      const initialMusicVolume = 21 / 100; // Default from MainMenuControls
      const initialAmbienceVolume = 30 / 100; // Default from MainMenuControls

      EventBus.emit('setSoundsVolume', initialSoundsVolume);
      EventBus.emit('setMusicVolume', initialMusicVolume);
      EventBus.emit('setAmbienceVolume', initialAmbienceVolume);
      // --------------------------------------------------

      this.audioHandler.audioInitialized = true;

      // Store the AudioManager instance in the registry
      this.registry.set('audioHandler', this.audioHandler);
      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
      //   `AudioManager stored in scene registry under key 'audioHandler'.`
      // );

      if (this.audioHandler?.music) {
        this.playBackgroundMusic();
      } else {
        console.warn('MainMenu: Music manager not available to play sound.');
      }

      if (this.audioHandler?.ambience) {
        this.audioHandler.ambience.playAmbience();
      } else {
        console.warn('MainMenu: Ambience manager not available to play sound.');
      }

      // -----------------------------------------------------------------
    } catch (error) {
      console.error(
        '[MainMenu] initAudio: Caught error during initialization:',
        error
      );
      // Handle initialization error appropriately (e.g., disable audio features)
      throw error; // Re-throw so the caller (button handler) can catch it
    }
  }

  /**
   * Starts playing the background music for the main menu.
   * Ensures music is loaded and audio is initialized.
   * @private
   */
  playBackgroundMusic() {
    // Ensure audioHandler and its music sub-manager are ready
    if (!this.audioHandler.audioInitialized) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [MainMenu] ` +
        `Audio/Music manager not ready, cannot play music.`
      );
      return;
    }
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
    //   `Playing background music via audioHandler.` +
    //   `This should call only ONCE`
    // );
    this.audioHandler.music.playMusic();
    // The original code checked the Phaser cache, which is not relevant
    // if AudioManager uses its own loading/playback mechanism (e.g., Howler).
    // if (this.cache.audio.has('mainMenuMusic')) {
    //   this.audioHandler.playMusic('mainMenuMusic', {
    //     loop: true,
    //     volume: 0.5,
    //   });
    // } else {
    //   console.error('Main menu music not loaded!');
    // }
  }

  /**
   * Phaser scene lifecycle method. Called once assets are loaded.
   * Sets up the main menu elements, animations, and event listeners.
   * @override
   */
  create() {
    // Check if an AudioManager instance was passed from another scene
    if (this.initData?.audioHandler instanceof AudioManager) {
      this.audioHandler = this.initData.audioHandler;
      // Assume it's already initialized if passed
      this.audioHandler.audioInitialized = true;
      this.registry.set('audioHandler', this.audioHandler);

      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
      //   `Reusing existing AudioManager instance from initData.`
      // );

      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
      //   `Calling audioHandler.changeScenes for ` +
      //   `${SCENES.MAIN_MENU}...`
      // );
      this.audioHandler.changeScenes(this, SCENES.MAIN_MENU);
      // *****************************************************************
    } else {

      this.audioHandler = new AudioManager(this, this.scene.key);
      this.registry.set('audioHandler', this.audioHandler);
      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
      //   `No existing AudioManager found, created new instance in create().`
      // );
      // Setup listener for first interaction to fully initialize audio
      this.input.once('pointerdown', () => {
        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}] [DEBUG] [MainMenu] ` +
        //   `First pointerdown detected, calling initAudio().`
        // );
        this.initAudio().catch((error) => {
          console.error(
            '[MainMenu] Error initializing audio on interaction:',
            error
          );
        });
      });
    }

    // Error handling for constructor failure (e.g., invalid scene)
    // is inside AudioManager

    // Background
    const gameWidth = window.innerWidth;
    const gameHeight = window.innerHeight / 2;
    const centerX = gameWidth / 2;
    const centerY = gameHeight / 2;

    // Create background image with proper positioning and scaling
    this.bgImage = this.add
      .image(centerX, centerY, 'bg2')
      .setOrigin(0.5, 0.5)
      .setDepth(-555)
      .setAlpha(0.92);

    // Calculate proper scaling to cover the screen
    const imageWidth = this.bgImage.width;
    const imageHeight = this.bgImage.height;
    const screenAspectRatio = gameWidth / gameHeight;
    const imageAspectRatio = imageWidth / imageHeight;

    let scale = 1;
    if (screenAspectRatio > imageAspectRatio) {
      // Screen is wider than image, scale horizontally
      scale = gameWidth / imageWidth;
    } else {
      // Screen is taller than image, scale vertically
      scale = gameHeight / imageHeight;
    }

    // Apply the scale
    this.bgImage.setScale(scale);

    // Create cloud background
    if (this.clouds) {
      this.clouds.forEach((cloud) => {
        cloud.tween?.stop();
        cloud.sprite.destroy();
      });
    }
    this.clouds = [];

    // Create more clouds with varying properties
    const numClouds = 35; // Increased number of clouds
    for (let i = 0; i < numClouds; i++) {
      // Randomize starting position with wider spread
      const startX = Phaser.Math.Between(-500, gameWidth + 500);
      const startY = Phaser.Math.Between(0, gameHeight);

      // Create cloud with varying scale and alpha
      const cloudSprite = this.add
        .image(startX, startY, 'cloud')
        .setOrigin(0.5, 0.5)
        .setScale(Phaser.Math.FloatBetween(1.5, 3.5)) // Larger scale range
        .setAlpha(Phaser.Math.FloatBetween(0.05, 0.12)) // Increased alpha range for better visibility
        .setDepth(1); // Above background, below title

      // Vary the speed more for more natural movement
      const speed = Phaser.Math.FloatBetween(0.15, 0.45); // Increased speed range

      const cloudData = {
        sprite: cloudSprite,
        speed: speed,
        initialX: startX,
        initialY: startY,
      };
      this.clouds.push(cloudData);

      // Add subtle vertical movement
      this.tweens.add({
        targets: cloudSprite,
        y: startY + Phaser.Math.Between(-20, 20),
        duration: Phaser.Math.Between(8000, 12000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Create title container with adjusted position
    this.titleContainer = this.add
      .container(gameWidth / 2, gameHeight * 0.4)
      .setDepth(10);

    // Create the debounced handler
    const debounceDelay = 250; // Delay in milliseconds
    this.debouncedHandleResize = debounce(
      this.handleSceneResize.bind(this), // Ensure 'this' context is correct
      debounceDelay
    );

    // Remove the initial manual call to resize() if it exists
    // this.resize(); // <-- Remove this line if present

    // Add the scale manager resize listener with the debounced handler
    this.scale.on('resize', this.debouncedHandleResize, this);

    // --- Add the start-game listener ---
    // Store the unsubscribe function for cleanup
    // No need to store unsubscribe for .on if cleaned in shutdown
    EventBus.once('start-game', data => {
      const timestamp = new Date().toISOString();
      const receivedMapId = data?.mapId; // Safely access mapId
      const receivedCharacterId = data?.characterId;
      // Log the received event and data for debugging
      // console.log(
      //   `[${timestamp}] [DEBUG] [MainMenu Listener]: ` +
      //     `Received 'start-game' event! mapId: ${receivedMapId}`,
      //   data // Log the full data object
      // );

      if (receivedMapId && receivedCharacterId) {
        // Log the scene change action for debugging
        // Keep for debugging
        // console.debug(
        //   `[${timestamp}] [DEBUG] [MainMenu Listener]: ` +
        //   `Calling changeScene to start '${SCENES.NEW_GAME}' with mapId: ${receivedMapId}`
        // );
      } else {
        console.warn(
          `[${timestamp}] [WARN] [MainMenu Listener]: Received 'start-game' ` +
          `but mapId was missing or null. ` +
          `Starting '${SCENES.NEW_GAME}' without mapId.`
        );
      }
      this.changeScene(SCENES.NEW_GAME, {
        mapId: receivedMapId,
        characterId: receivedCharacterId,
      });
    });
    // --- End start-game listener ---

    // Initial title creation with sans-serif
    this._recreateTitleWithFont();
  }

  /**
   * Recreates the title text layers with the sans-serif font.
   * This is called during create and resize.
   * @private
   */
  _recreateTitleWithFont() {
    const fontFamily = 'sans-serif'; // Always use sans-serif
    if (!this.titleContainer) {
      console.error('Title container not found during font recreation.');
      return;
    }
    // Clear existing text layers and animations first
    this.letterTextsAnimations?.forEach((tween) => tween?.stop());
    this.letterTextsAnimations = [];
    this.titleContainer.removeAll(true); // Remove and destroy children
    this.letterTexts = [];

    // Stop container float tween separately if it exists
    this.floatingContainerTween?.stop();
    this.floatingContainerTween = null;

    // Get initial scale based on current game width
    const baseWidth = 640;
    const initialScale = Math.min(this.sys.game.config.width / baseWidth, 1);
    const layers = 5; // Assuming this is constant

    // --- Recreate text layers with the specified font ---
    for (let i = 0; i < layers; i++) {
      // --- First Line: Harvest ---
      const letters = this.gameText.split('');
      letters.forEach((letter, index) => {
        const letterX = i + (index - letters.length / 2) * 50;
        const letterText = this.add
          .text(letterX, 0, letter, {
            fontFamily: fontFamily, // Use the provided font family
            fontSize: 64,
            color: '#ffffff',
            stroke: '#D4AF37',
            strokeThickness: 2,
            shadow: {
              offsetX: 4,
              offsetY: 4,
              color: '#000000',
              blur: 2,
              stroke: true,
              fill: true,
            },
          })
          .setOrigin(0.5, 0.5)
          .setDepth(5)
          .setScale(initialScale)
          .setData('original', { originalX: letterX, originalY: 0, index });
        this.letterTexts.push(letterText);
        this.titleContainer.add(letterText);

        // --- Recreate Animations for Harvest ---
        const colorsHarvest = [0x4df7ff, 0x32cd32, 0xffd700, 0x4169e1];
        const newColorTweenConfig = {
          targets: {},
          progress: { from: 0, to: 1 },
          duration: 4000,
          repeat: -1,
          onUpdate: (tween) => {
            const progress = tween.getValue();
            const colorIndex = Math.floor(progress * colorsHarvest.length);
            const nextColorIndex = (colorIndex + 1) % colorsHarvest.length;
            const subProgress = (progress * colorsHarvest.length) % 1;
            const currentColor = this.lerpColor(
              colorsHarvest[colorIndex],
              colorsHarvest[nextColorIndex],
              subProgress
            );
            letterText.setTint(currentColor);
            const hexColor = `#${currentColor.toString(16).padStart(6, '0')}`;
            letterText.style.setShadow(
              0.5,
              0.5,
              hexColor,
              5 * (1 + Math.sin(progress * Math.PI))
            );
          },
        };
        this.letterTextsAnimations.push(this.tweens.add(newColorTweenConfig));

        const newWaveMorphAnimationConfig = {
          targets: letterText,
          y: 80 * initialScale,
          duration: 5000,
          delay: index * 250,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onUpdate: (tween, target) => {
            const progress = tween.getValue();
            target.setRotation(progress * 0.05);
            const breatheScale =
              initialScale + Math.sin(progress * Math.PI) * (0.55 * initialScale);
            target.setScale(breatheScale);
            const glowIntensity = 8 + Math.sin(progress * Math.PI) * 4;
            target.style.shadowBlur = glowIntensity;
          },
        };
        this.letterTextsAnimations.push(this.tweens.add(newWaveMorphAnimationConfig));

        const newHoverAnimationConfig = {
          targets: letterText,
          scaleX: initialScale * 1.2,
          scaleY: initialScale * 1.2,
          duration: 1000 + index * 300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: index * 200,
        };
        this.letterTextsAnimations.push(this.tweens.add(newHoverAnimationConfig));
      });

      // --- Second Line: Horizon ---
      const letters2 = this.gameText2.split('');
      const secondLineYOffset = 120 * initialScale;
      letters2.forEach((letter2, index) => {
        const letterX2 = (index - letters2.length / 2) * 50;
        const letterText2 = this.add
          .text(letterX2, secondLineYOffset, letter2, {
            fontFamily: fontFamily, // Use the provided font family
            fontSize: 64,
            color: '#ffffff',
            stroke: '#D4AF37',
            strokeThickness: 2,
            shadow: {
              offsetX: 2,
              offsetY: 2,
              color: '#000000',
              blur: 5,
              stroke: true,
              fill: true,
            },
          })
          .setOrigin(0.5, 0.5)
          .setScale(initialScale)
          .setData('original', {
            originalX: letterX2,
            originalY: secondLineYOffset,
            index,
          });
        this.letterTexts.push(letterText2);
        this.titleContainer.add(letterText2);

        // --- Recreate Animations for Horizon ---
        const colorsHorizon = [0xb20800, 0xcd32cd, 0x0028ff, 0xbe961e];
        const newColorTweenConfig2 = {
          targets: {},
          progress: { from: 1, to: 0 },
          duration: 10000,
          repeat: -1,
          onUpdate: (tween) => {
            const progress = tween.getValue();
            const colorIndex = Math.floor(progress * colorsHorizon.length);
            const nextColorIndex = (colorIndex + 1) % colorsHorizon.length;
            const subProgress = (progress * colorsHorizon.length) % 1;
            const currentColor = this.lerpColor(
              colorsHorizon[colorIndex],
              colorsHorizon[nextColorIndex],
              subProgress
            );
            letterText2.setTint(currentColor);
            const hexColor = `#${currentColor.toString(16).padStart(6, '0')}`;
            letterText2.style.setShadow(
              0.5,
              0.5,
              hexColor,
              5 * (1 + Math.sin(progress * Math.PI))
            );
          },
        };
        this.letterTextsAnimations.push(this.tweens.add(newColorTweenConfig2));

        const newWaveMorphAnimationConfig2 = {
          targets: letterText2,
          y: secondLineYOffset + 80 * initialScale,
          duration: 8000,
          delay: index * 250,
          yoyo: true,
          repeat: -1,
          ease: 'Expo.InOut',
          onUpdate: (tween, target) => {
            const progress = tween.getValue();
            target.setRotation(progress * 0.05);
            const breatheScale =
              initialScale + Math.sin(progress * Math.PI) * (0.55 * initialScale);
            target.setScale(breatheScale);
            const glowIntensity = 8 + Math.sin(progress * Math.PI) * 4;
            target.style.shadowBlur = glowIntensity;
          },
        };
        this.letterTextsAnimations.push(this.tweens.add(newWaveMorphAnimationConfig2));

        const newHoverAnimationConfig2 = {
          targets: letterText2,
          scaleX: initialScale * 1.2,
          scaleY: initialScale * 1.2,
          duration: 1000 + index * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Cubic.easeOut',
          delay: index * 200,
        };
        this.letterTextsAnimations.push(this.tweens.add(newHoverAnimationConfig2));
      });
    } // End of layers loop

    // --- Recreate Floating Animation for Container ---
    this.addFloatingContainerAnimation(); // Re-adds the float tween

    // Ensure all text is visible
    this.titleContainer.each((child) => {
      if (child?.setVisible) {
        child.setVisible(true);
      }
    });
  }

  /**
   * Handles the game resize event triggered by the Scale Manager.
   * Recalculates layout and scales elements.
   * @param {Phaser.Structs.Size} gameSize - The new size of the game canvas.
   * @override
   */
  handleSceneResize(gameSize) {
    const { width: gameWidth, height: gameHeight } = gameSize;
    const centerX = gameWidth / 2;
    const centerY = gameHeight / 2;

    // 1. Resize Background Image
    if (this.bgImage) {
      const imageWidth = this.bgImage.width;
      const imageHeight = this.bgImage.height;
      const screenAspectRatio = gameWidth / gameHeight;
      const imageAspectRatio = imageWidth / imageHeight;

      let scale = 1;
      if (screenAspectRatio > imageAspectRatio) {
        scale = gameWidth / imageWidth; // Scale by width
      } else {
        scale = gameHeight / imageHeight; // Scale by height
      }
      this.bgImage.setScale(scale);
      this.bgImage.setPosition(centerX, centerY); // Ensure it stays centered
    }

    // 2. Reposition Each letter and update animations for new sizes
    if (this.titleContainer) {
      // Destroy existing elements and tweens first
      this.letterTextsAnimations?.forEach((tween) => tween?.stop());
      this.letterTextsAnimations = []; // Clear the tween array

      // Stop the container float tween separately
      this.floatingContainerTween?.stop();
      this.floatingContainerTween = null;

      // 2. Destroy text GameObjects via container
      this.titleContainer.removeAll(true); // Remove and destroy children text objects
      this.letterTexts = []; // Clear the text object reference array

      // Recalculate scale and positions
      const newTitleY = gameHeight * 0.4;
      this.titleContainer.setPosition(centerX, newTitleY);

      // --- Recreate title using the determined font ---
      // Call the refactored function, passing the correct font
      // NOTE: _recreateTitleWithFont now handles clearing/recreating
      // We only need to call it once here with the correct font.
      this._recreateTitleWithFont();
    }

    // 3. Reposition Clouds
    // Need previous height for relative calc
    const previousHeight = this.sys.game.config.height;
    this.clouds.forEach((cloud) => {
      if (cloud.sprite && previousHeight > 0) {
        // Check for sprite existence and avoid division by zero
        const relativeY = cloud.sprite.y / previousHeight;
        cloud.sprite.y = relativeY * gameHeight;
      }
    });
    // Horizontal wrapping is handled in update() based on current game width

    // Stop the single debounced resize listener added in 'create'
    //   if (this.debouncedHandleResize) {
    //     this.scale.off('resize', this.debouncedHandleResize, this);
    //     this.debouncedHandleResize = null;
    //   }
    // }
  }

  /**
   * Phaser scene lifecycle method. Called every frame.
   * Updates the position of the background clouds.
   * @override
   * @param {number} _time - The current simulation time in milliseconds.
   * @param {number} _delta - The delta time in milliseconds since the last frame.
   */
  update(_time, _delta) {
    // Animate clouds with improved movement
    this.clouds.forEach((cloud) => {
      cloud.sprite.x += cloud.speed;

      // Reset position when cloud moves off screen
      if (cloud.sprite.x > this.sys.game.config.width + 500) {
        cloud.sprite.x = -500; // Start from further left
        cloud.sprite.y = Phaser.Math.Between(0, this.sys.game.config.height);
        // Randomize speed and alpha on reset
        cloud.speed = Phaser.Math.FloatBetween(0.15, 0.45); // Match the increased speed range
        cloud.sprite.setAlpha(Phaser.Math.FloatBetween(0.05, 0.12));
      }
    });
  }

  /**
   * Phaser scene lifecycle method. Called when the scene is shut down.
   * Cleans up resources: stops tweens, destroys game objects, removes listeners.
   * @override
   */
  shutdown() {
    // Stop and remove all tweens associated with this scene
    this.tweens.killAll();

    // Remove the scale manager resize listener using the debounced handler reference
    if (this.debouncedHandleResize) {
      this.scale.off('resize', this.debouncedHandleResize, this);
      // Optional: If the debounce function had a cancel method, call it here
      // e.g., this.debouncedHandleResize.cancel?.();
      this.debouncedHandleResize = null; // Clear the reference
    } else {
      // Fallback in case debounced handler wasn't created (shouldn't happen)
      this.scale.off('resize', this.handleSceneResize, this);
      console.warn(
        '[MainMenu] Debounced resize handler not found, removing original listener as fallback.'
      );
    }

    // Destroy containers and their children
    this.titleContainer?.destroy(true); // true to destroy children
    this.titleContainer = null;
    this.buttonContainer?.destroy(true);
    this.buttonContainer = null;

    // Destroy individual game objects managed in arrays
    this.clouds.forEach((cloud) => cloud.sprite?.destroy());
    this.clouds = [];
    this.letterAnimData.forEach((letterInfo) => letterInfo.text?.destroy());
    this.letterAnimData = [];

    // Destroy background image
    this.bgImage?.destroy();
    this.bgImage = null;

    // Remove the external audio init listener
    if (this.handleRequestAudioInit) {
      EventBus.off('requestAudioInit', this.handleRequestAudioInit);
      this.handleRequestAudioInit = null; // Clear the reference
    }

    // Remove the start-game listener
    if (this.unsubscribeStartGame) {
      this.unsubscribeStartGame();
      this.unsubscribeStartGame = null;
    }

    // Cleanup MapService if it exists
    this.mapService?.cleanup();
    this.mapService = null;

    // Stop music managed by this scene (optional, depends on audio strategy)
    this.audioHandler?.stopMusic();

    // Call SceneBase shutdown
    super.shutdown();
  }

  /**
   * Phaser scene lifecycle method. Called when the scene is destroyed.
   * Performs final cleanup. Usually handled by shutdown in Phaser 3 scenes.
   * @override
   */
  destroy() {
    // SceneBase might have its own destroy logic
    super.destroy();
  }

  /**
   * Handles the transition to a new scene.
   * Includes fade-out effect and passes the AudioManager instance.
   * @param {string} sceneKey - The key of the scene to transition to.
   * @param {object} [data={}] - Optional data to pass to the new scene's
   *   init or create method.
   */
  changeScene(sceneKey, data = {}) {
    // Create the final data object, merging provided data with audioHandler
    const finalData = {
      ...data,
      audioHandler: this.registry.get('audioHandler'),
    };

    // Remove the start-game listener
    EventBus.off('start-game', this.handleStartGame);

    if (this.cameras?.main) {
      this.scene.start(sceneKey, finalData);
    }
  }

  /**
   * Adds the floating animation to the title container.
   * Stops the existing one if present.
   * @private
   */
  addFloatingContainerAnimation() {
    if (this.floatingContainerTween) {
      this.floatingContainerTween.stop();
      this.floatingContainerTween = null;
    }
    if (this.titleContainer) {
      const startY = this.titleContainer.y; // Get current Y
      this.floatingContainerTween = this.tweens.add({
        targets: this.titleContainer,
        y: startY + 20, // Float down
        duration: 6000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut', // Smoother than linear
      });
    }
  }

  /**
   * Linearly interpolates between two colors.
   * @private
   * @param {number} color1 - First color value (hex number)
   * @param {number} color2 - Second color value (hex number)
   * @param {number} t - Interpolation factor (0 to 1)
   * @returns {number} Interpolated color value (hex number)
   */
  lerpColor(color1, color2, t) {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.floor(r1 + (r2 - r1) * t);
    const g = Math.floor(g1 + (g2 - g1) * t);
    const b = Math.floor(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
  }

  handleQuitClick() {
    this.sound.play('button_click');
    // In a real game, you might need confirmation or platform-specific quit logic
  }
}

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
function debounce(func, wait) {
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
