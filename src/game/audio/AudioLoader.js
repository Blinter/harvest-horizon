/**
 * @file AudioLoader.js
 * @description Handles loading audio assets for Phaser scenes. Loads sound
 *   effects, ambient sounds, and music tracks.
 * @module AudioLoader
 */

/**
 * Manages the loading and initialization of audio assets within a Phaser
 * scene. This includes sound effects, ambient sounds, and music tracks.
 * It ensures required sounds are available before signaling readiness.
 *
 * @class AudioLoader
 * @property {Phaser.Scene} scene The Phaser scene instance used for
 *   loading assets and managing sounds.
 * @property {Object<string, Phaser.Sound.BaseSound>} sounds A cache mapping
 *   logical sound keys (e.g., 'plantSound') to their initialized Phaser
 *   sound objects. Populated after `loadAssets`.
 * @property {boolean} allSoundsLoaded A flag indicating whether all sounds
 *   listed in `requiredSounds` have been successfully loaded and
 *   initialized. Checked within `_initializeSounds`.
 * @property {Object<string, string>} assetsToLoad An object mapping the
 *   logical keys used within the game code (e.g., 'mainMenuMusic') to
 *   the file paths of the audio assets.
 * @property {string[]} requiredSounds An array of sound keys that are
 *   considered essential for the core functionality of the scene or game
 *   area using this loader. Used to verify readiness.
 */
export class AudioLoader {
  /**
   * Creates an AudioLoader instance and initializes its properties.
   *
   * @param {Phaser.Scene} scene The Phaser scene instance. This is crucial
   *   for accessing the loader and sound manager.
   * @throws {Error} If `scene` is not provided or is invalid.
   */
  constructor(scene) {
    if (!scene) {
      // Log error and throw, as scene is critical
      console.error(`${new Date().toISOString()} AudioLoader: Scene required.`);
      throw new Error('AudioLoader requires a valid Phaser scene.');
    }
    /** @type {Phaser.Scene} */
    this.scene = scene;
    /** @type {object} */
    this.sounds = {};
    /** @type {boolean} */
    this.allSoundsLoaded = false;

    // Define the assets to be loaded
    /** @type {object} */
    this.assetsToLoad = {
      // Sounds
      testSound: 'assets/sound/Coin Dropped on Ceramic Dish.wav',
      plantSound: 'assets/sound/Receipt Handled 03.wav',
      harvestSound: 'assets/sound/Coins_Bottlecaps_Drop.wav',
      // Ambience
      mainMenuAmbience: 'assets/music/ambience/tundra-loop.mp3',
      // Music
      mainMenuMusic: 'assets/music/07-Alpenglow.mp3',
      newGameMusic: 'assets/music/game/04-Blue-Forest.mp3',
    };

    /** @type {string[]} */
    this.requiredSounds = [
      'testSound',
      'plantSound',
      'harvestSound',
      'mainMenuAmbience',
      'mainMenuMusic',
      'newGameMusic',
    ];
  }

  /**
   * Initiates the asynchronous loading of all audio assets defined in
   * `this.assetsToLoad` using the Phaser scene's loader. It sets up
   * listeners for completion and handles potential loading errors. Once
   * loading is complete, it calls `_initializeSounds`.
   *
   * @returns {Promise<Object<string, Phaser.Sound.BaseSound>>} A promise
   *   that resolves with the `this.sounds` object containing initialized
   *   sound instances upon successful loading and initialization. It
   *   resolves even if *non-required* sounds fail, but logs warnings.
   *   Rejects if a critical error occurs during the loading phase (e.g.,
   *   invalid scene context).
   * @throws {Error} Propagates errors occurring during the loading initiation
   *   phase (e.g., accessing `this.scene.load` if scene is invalid). Note
   *   that Phaser loader errors might be handled internally or via events.
   * @async
   */
  loadAssets() {
    return new Promise((resolve, reject) => {
      if (!this.scene) {
        console.error(
          `${new Date().toISOString()} AudioLoader: Scene invalid on load.`
        );
        return reject(new Error('Invalid Scene'));
      }

      try {
        Object.entries(this.assetsToLoad).forEach(([key, path]) => {
          this.scene.load.audio(key, path);
        });

        let assetsLoaded = false;
        const onLoadComplete = () => {
          if (assetsLoaded) return;
          assetsLoaded = true;

          this._initializeSounds();

          this.scene.load.off('complete', onLoadComplete);

          if (this.allSoundsLoaded) {
            resolve(this.sounds);
          } else {
            console.warn(
              `${new Date().toISOString()} AudioLoader: Not all required ` +
              `sounds were initialized.`
            );
            resolve(this.sounds); // Still resolve, but warn
          }
        };

        this.scene.load.on('complete', onLoadComplete);
        this.scene.load.start();
      } catch (error) {
        console.error(
          `${new Date().toISOString()} AudioLoader: Error during asset ` +
          `loading phase:`,
          error
        );
        // Reject with the original error for better stack trace
        reject(error instanceof Error ? error : new Error(error));
      }
    });
  }

  /**
   * Initializes Phaser sound objects for all assets that have been loaded
   * into the scene's audio cache. It populates the `this.sounds` object,
   * reusing existing sound instances from the sound manager if available to
   * prevent duplicates. It also checks if all sounds listed in
   * `this.requiredSounds` were successfully initialized and updates the
   * `this.allSoundsLoaded` flag accordingly.
   *
   * @private
   * @returns {void}
   * @throws {Error} If the scene context, sound manager, or audio cache is
   *   invalid during the initialization process.
   */
  _initializeSounds() {
    if (!this.scene?.sound || !this.scene.sys?.game?.cache?.audio) {
      console.error(
        `${new Date().toISOString()} AudioLoader: Scene, sound manager, or ` +
        `audio cache invalid during sound initialization.`
      );
      throw new Error('Invalid Scene context during sound initialization');
    }

    this.sounds = {}; // Clear previous sounds if any

    Object.keys(this.assetsToLoad).forEach((key) => {
      if (this.scene.sys.game.cache.audio.has(key)) {
        try {
          // Check if sound already exists in the sound manager
          const existingSound = this.scene.sound.get(key);
          if (!existingSound) {
            this.sounds[key] = this.scene.sound.add(key);
          } else {
            // Reuse existing sound to avoid duplicates
            this.sounds[key] = existingSound;
          }
        } catch (e) {
          console.error(
            `${new Date().toISOString()} AudioLoader: Error adding or ` +
            `getting sound '${key}':`,
            e
          );
          // Continue initializing other sounds
        }
      } else {
        console.warn(
          `${new Date().toISOString()} AudioLoader: Sound asset '${key}' not ` +
          `found in cache. Skipping initialization.`
        );
      }
    });

    // Verify all required sounds are now in the sounds object
    this.allSoundsLoaded = this.requiredSounds.every((key) => {
      if (!this.sounds[key]) {
        console.warn(
          `${new Date().toISOString()} AudioLoader: Required sound '${key}' ` +
          `failed to initialize or was not found.`
        );
        return false;
      }
      return true;
    });

    if (!this.allSoundsLoaded) {
      console.warn(
        `${new Date().toISOString()} AudioLoader: Not all required sounds ` +
        `were initialized successfully.`
      );
    }
  }

  /**
   * Retrieves the cache of initialized sound objects.
   *
   * @returns {Object<string, Phaser.Sound.BaseSound>} The `sounds` object,
   *   mapping sound keys to their Phaser sound instances.
   */
  getSounds() {
    return this.sounds;
  }

  /**
   * Checks if all required sounds have been loaded and initialized.
   *
   * @returns {boolean} True if all required sounds are ready, false otherwise.
   */
  isReady() {
    return this.allSoundsLoaded;
  }
}

export default AudioLoader;
