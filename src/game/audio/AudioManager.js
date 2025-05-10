import { EventBus } from '../EventBus'; // Adjusted path
import AudioLoader from './AudioLoader';
import { MusicManager } from './MusicManager';
import AmbienceManager from './AmbienceManager';
import SoundEffectsManager from './SoundEffectsManager';
import { MAIN_MENU, NEW_GAME } from '../constants/scenes'; // Update import

/**
 * @file AudioManager.js
 * @description Manages game audio: loading, playback, control via
 *   sub-managers.
 */

/**
 * Orchestrates audio operations using sub-managers for loading and playback.
 * Delegates events via EventBus and manages the AudioContext.
 *
 * @class AudioManager
 */
export class AudioManager {
  /**
   * Creates an AudioManager instance. Initializes basic properties and loader.
   * Does not create AudioContext or start loading immediately. Call `init()`
   * to start the audio system.
   *
   * @param {Phaser.Scene} scene - The initial Phaser scene.
   * @param {string} sceneKey - The name of the initial scene.
   * @param {object} [initialVolumes={ music: 0.48, ambience: 0.48, sfx: 0.48 }]
   *   - Initial volumes for music, ambience, and sfx.
   * @throws {Error} If scene or sceneKey is not provided.
   * @property {Phaser.Scene|null} scene - Current Phaser scene. Null after
   *   cleanup.
   * @property {string} sceneKey - Current scene name.
   * @property {AudioContext|null} audioContext - Web Audio API context.
   * @property {boolean} audioInitialized - Is the audio context ready?
   * @property {AudioLoader|null} loader - Manages audio asset loading. Null
   *   after cleanup.
   * @property {MusicManager|null} music - Music playback manager. Null after
   *   cleanup.
   * @property {AmbienceManager|null} ambience - Ambience playback manager.
   *   Null after cleanup.
   * @property {SoundEffectsManager|null} sfx - Sound effect playback manager.
   *   Null after cleanup.
   * @property {object} initialVolumes - Stores the initial volume settings.
   * @property {object} sceneNameAudioMatch - Maps scene names to music tracks.
   * @property {object} sceneNameAudioMatchAmbience - Maps scene names to
   *   ambience tracks.
   * @property {Promise<boolean>|null} initPromise - Tracks ongoing `init()`.
   * @property {Promise<object>|null} loadPromise - Tracks asset loading.
   * @property {object|null} loadedSounds - Stores loaded sound objects.
   */
  constructor(
    scene,
    sceneKey,
    initialVolumes = { music: 0.52, ambience: 0.25, sfx: 0.55 }
  ) {
    try {
      this.instanceId =
        `AudioManager-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      // Keep for debugging
      // console.info(
      //   `[${new Date().toISOString()}] [INFO] [${this.instanceId}] ` +
      //   `Constructor called for scene: ${sceneKey}`
      // );

      if (!scene || !sceneKey) {
        console.error(
          `[${new Date().toISOString()}] [AudioManager] Constructor failed: ` +
          `Missing scene or sceneKey.`
        );
        throw new Error(
          'AudioManager requires a valid initial scene and scene name.'
        );
      }

      this.scene = scene;
      this.sceneKey = sceneKey;
      this.initialVolumes = initialVolumes;

      this.audioContext = null;
      this.audioInitialized = false;
      this.music = null;
      this.sfx = null;
      this.ambience = null;
      this.initPromise = null;
      this.loadPromise = null;
      this.loadedSounds = null;

      // Scene mappings
      this.sceneNameAudioMatch = {
        [MAIN_MENU]: {
          music: ['mainMenuMusic'],
          ambience: ['mainMenuAmbience'],
        },
        [NEW_GAME]: {
          music: ['gameMusic'],
          ambience: ['mainMenuAmbience'],
        },
      };

      this.sceneNameAudioMatchAmbience = {
        [MAIN_MENU]: 'mainMenuAmbience',
        [NEW_GAME]: 'mainMenuAmbience',
      };

      this.loader = new AudioLoader(this.scene);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [AudioManager] Constructor Error: `,
        error
      );
      throw error; // Re-throw sync errors
    }
  }

  /**
   * Initializes the audio system: Creates AudioContext, loads assets, sets
   * up listeners, initializes sub-managers. Handles concurrent calls.
   *
   * @returns {Promise<boolean>} Resolves true on success, false on failure.
   * @async
   */
  async init() {
    const timestamp = new Date().toISOString();

    // Prevent concurrent initializations
    if (this.initPromise) {
      // Already initialized, from other scene
      // console.warn(
      //   `[${timestamp}] [WARN] [AudioManager] Initialization already in ` +
      //   `progress.`
      // );
      return this.initPromise;
    }

    // Guard against re-initialization if already successful
    if (this.audioInitialized) {
      // Already initialized, from other scene.
      // console.warn(
      //   `[${timestamp}] [WARN] [AudioManager]  ` +
      //   `Audio system already initialized.`
      // );
      return true;
    }

    this.initPromise = (async () => {
      try {
        // 1. Create AudioContext
        this.createAudioContext();
        if (!this.audioContext) {
          throw new Error('Failed to create AudioContext during init.');
        }

        // 2. Load Assets
        this.loadPromise = this.loader.loadAssets();
        this.loadedSounds = await this.loadPromise;
        if (!this.loadedSounds || Object.keys(this.loadedSounds).length === 0) {
          throw new Error('Asset loading failed or yielded no sounds.');
        }

        // 3. Setup Event Listeners
        this.setupEventListeners();

        // 4. Skip - Let sub-managers handle resume on play
        // await this.initializeAudioContext();

        // 5. Initialize Sub-managers
        this.music = new MusicManager(
          this.loadedSounds,
          this.initializeAudioContext.bind(this),
          this.initialVolumes.music
        );
        this.ambience = new AmbienceManager(
          this.loadedSounds,
          this.initializeAudioContext.bind(this),
          this.sceneNameAudioMatchAmbience,
          this.initialVolumes.ambience
        );
        this.sfx = new SoundEffectsManager(
          this.loadedSounds,
          this.initializeAudioContext.bind(this),
          this.initialVolumes.sfx
        );

        // 6. Set initial scene for managers
        this.music.setScene(this.sceneKey);
        this.ambience.setScene(this.sceneKey);

        // 7. Mark as initialized
        this.audioInitialized = true;
        return true; // Indicate success
      } catch (error) {
        console.error(
          `[${timestamp}] [AudioManager] Initialization failed.`,
          error
        );
        this.audioInitialized = false; // Ensure state reflects failure
        return false; // Indicate failure
      } finally {
        this.initPromise = null; // Clear the promise guard
      }
    })();

    return this.initPromise;
  }

  /**
   * Sets up EventBus listeners for audio control, delegating to sub-managers.
   * @private
   * @returns {void}
   */
  setupEventListeners() {
    // Keep for debugging
    // console.info(
    //   `[${new Date().toISOString()}] [INFO] [${this.instanceId}] ` +
    //   `Setting up EventBus listeners...`
    // );
    try {
      // --- Playback ---
      // Bind handlers and store references
      this._boundEventHandlers = {
        handlePlayMusic: this._handlePlayMusic.bind(this),
        handlePlayAmbience: this._handlePlayAmbience.bind(this),
        handlePlayTestSound: this._handlePlayTestSound.bind(this),
        handlePlaySound: this._handlePlaySound.bind(this),
        handleStopMusic: this._handleStopMusic.bind(this),
        handleStopAmbience: this._handleStopAmbience.bind(this),
        handleStopSounds: this._handleStopSounds.bind(this),
        handleResumeSounds: this._handleResumeSounds.bind(this),
        handleStopSound: this._handleStopSound.bind(this),
        handleMuteMusic: this._handleMuteMusic.bind(this),
        handleUnmuteMusic: this._handleUnmuteMusic.bind(this),
        handleMuteAmbience: this._handleMuteAmbience.bind(this),
        handleUnmuteAmbience: this._handleUnmuteAmbience.bind(this),
        handleMuteSounds: this._handleMuteSounds.bind(this),
        handleUnmuteSounds: this._handleUnmuteSounds.bind(this),
        handleSetMusicVolume: this._handleSetMusicVolume.bind(this),
        handleSetAmbienceVolume: this._handleSetAmbienceVolume.bind(this),
        handleSetSoundsVolume: this._handleSetSoundsVolume.bind(this),
        handleInitializeAudioContext: this.initializeAudioContext.bind(this), // Reuse existing method
        handleCleanupAudio: this.cleanup.bind(this), // Reuse existing method
        handleStopGame: this._handleStopGame.bind(this),
      };

      EventBus.on('playMusic', this._boundEventHandlers.handlePlayMusic);
      EventBus.on('playAmbience', this._boundEventHandlers.handlePlayAmbience);
      EventBus.on('playTestSound', this._boundEventHandlers.handlePlayTestSound);
      EventBus.on('playSound', this._boundEventHandlers.handlePlaySound);

      // --- Stopping ---
      EventBus.on('stopMusic', this._boundEventHandlers.handleStopMusic);
      EventBus.on('stopAmbience', this._boundEventHandlers.handleStopAmbience);
      EventBus.on('stopSounds', this._boundEventHandlers.handleStopSounds);
      EventBus.on('resumeSounds', this._boundEventHandlers.handleResumeSounds);
      EventBus.on('stopSound', this._boundEventHandlers.handleStopSound);

      // --- Muting ---
      EventBus.on('muteMusic', this._boundEventHandlers.handleMuteMusic);
      EventBus.on('unmuteMusic', this._boundEventHandlers.handleUnmuteMusic);
      EventBus.on('muteAmbience', this._boundEventHandlers.handleMuteAmbience);
      EventBus.on('unmuteAmbience', this._boundEventHandlers.handleUnmuteAmbience);
      EventBus.on('muteSounds', this._boundEventHandlers.handleMuteSounds);
      EventBus.on('unmuteSounds', this._boundEventHandlers.handleUnmuteSounds);

      // --- Volume Changes ---
      EventBus.on('setMusicVolume', this._boundEventHandlers.handleSetMusicVolume);
      EventBus.on('setAmbienceVolume', this._boundEventHandlers.handleSetAmbienceVolume);
      EventBus.on('setSoundsVolume', this._boundEventHandlers.handleSetSoundsVolume);

      // --- System Events ---
      EventBus.on('initializeAudioContext', this._boundEventHandlers.handleInitializeAudioContext);
      EventBus.on('cleanupAudio', this._boundEventHandlers.handleCleanupAudio);
      EventBus.on('stop-game', this._boundEventHandlers.handleStopGame);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [AudioManager] Error setting up ` +
        `EventBus listeners:`,
        error
      );
    }
  }

  /**
   * Creates the Web Audio API AudioContext if needed.
   * @private
   * @returns {void}
   */
  createAudioContext() {
    const timestamp = new Date().toISOString();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      console.warn(
        `[${timestamp}] [WARN] [AudioManager] Existing AudioContext found ` +
        `(State: ${this.audioContext.state}). Reusing.`
      );
      return;
    }

    try {
      this.audioContext = new window.AudioContext();
    } catch (error) {
      console.error(
        `[${timestamp}] [AudioManager] Error creating AudioContext:`,
        error
      );
      this.audioContext = null;
    }
  }

  /**
   * Initializes or resumes the Web Audio API AudioContext. Ensures it's
   * running for playback. Often requires user interaction to resume.
   *
   * @returns {Promise<boolean>} Resolves true if context is running, rejects
   *   or resolves false on failure.
   * @throws {Error} If context creation or resume fails critically.
   * @async
   */
  async initializeAudioContext() {
    const timestamp = new Date().toISOString();

    try {
      // 1. Ensure AudioContext exists or create it
      if (!this.audioContext || this.audioContext.state === 'closed') {
        console.warn(
          `[${timestamp}] [WARN] [AudioManager] AudioContext is ` +
          `${this.audioContext ? 'closed' : 'null'}. Attempting creation...`
        );
        this.createAudioContext();
        if (!this.audioContext) {
          throw new Error('Failed to create AudioContext.');
        }
      }

      // 2. Check and handle current state
      const currentState = this.audioContext.state;

      switch (currentState) {
        case 'suspended':
          try {
            await this.audioContext.resume();
            this.audioInitialized = true;
            return true;
          } catch (resumeError) {
            console.error(
              `[${timestamp}] [AudioManager] Failed to resume AudioContext:`,
              resumeError
            );
            throw new Error('Failed to resume suspended AudioContext.');
          }

        case 'running':
          this.audioInitialized = true;
          return true;

        case 'closed':
          console.error(
            `[${timestamp}] [AudioManager] AudioContext is closed. ` +
            `Cannot initialize.`
          );
          throw new Error('Cannot initialize a closed AudioContext.');

        default:
          console.error(
            `[${timestamp}] [AudioManager] AudioContext in unexpected state: ` +
            `'${currentState}'.`
          );
          throw new Error(`AudioContext in unexpected state: ${currentState}`);
      }
    } catch (error) {
      console.error(
        `[${timestamp}] [AudioManager] Overall AudioContext ` +
        `initialization failed:`,
        error
      );
      this.audioInitialized = false;
      throw error; // Rethrow for callers like init() or ensureAudioContextIsReady
    }
  }

  /**
   * Handles scene transitions: updates scene reference, notifies music/ambience
   * managers, and ensures audio system is initialized first.
   *
   * @param {Phaser.Scene} newScene - The new Phaser scene instance.
   * @param {string} sceneName - The name/key of the new scene.
   * @returns {Promise<void>}
   * @async
   */
  async changeScenes(newScene, sceneName) {
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] [AudioManager] ` +
    //   `changeScenes called with sceneName: ${sceneName}.`
    // );
    try {
      if (!newScene || !sceneName) {
        console.error(
          `[${new Date().toISOString()}] [AudioManager] ` +
          `Change scenes failed: ` +
          `Invalid newScene or sceneName provided.`,
          { newScene, sceneName }
        );
        return;
      }

      this.scene = newScene;
      this.sceneKey = sceneName;

      // Ensure audio is initialized before proceeding
      if (!this.audioInitialized) {
        const timestamp = new Date().toISOString();
        // Already initialized, usually calls from scene switch
        // console.warn(
        //   `[${timestamp}] [WARN] [AudioManager] Audio system not fully ` +
        //   `initialized. Triggering init() before proceeding with scene ` +
        //   `change logic.`
        // );
        try {
          await this.init();
        } catch (initError) {
          console.error(
            `[${timestamp}] [AudioManager] CRITICAL: Failed to initialize ` +
            `audio during scene change. Scene change audio updates ` +
            `might be incomplete.`,
            initError
          );
          // Decide if this is recoverable or should halt the change
          throw new Error(
            'Critical: Audio initialization failed during scene change.'
          );
        }
      }

      // Notify relevant sub-managers
      this.music?.setScene(sceneName);
      this.ambience?.setScene(sceneName);

      // *** Immediately trigger playback for the new scene ***
      this.music?.playMusic();
      this.ambience?.playAmbience();

    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [AudioManager] Error during ` +
        `changeScenes:`,
        error
      );
      // Handle error appropriately, maybe log and continue if non-critical
    }
  }

  /**
   * Cleans up resources: removes EventBus listeners, cleans up sub-managers,
   * closes the AudioContext, and resets internal state.
   * @returns {Promise<void>}
   * @async
   */
  async cleanup() {
    try {
      console.info(
        `[${new Date().toISOString()}] [INFO] [${this.instanceId}] ` +
        `Cleanup started.`
      );

      // 1. Remove EventBus listeners
      console.info(
        `[${new Date().toISOString()}] [INFO] [${this.instanceId}] ` +
        `Removing all EventBus listeners.`
      );

      // Manually remove each listener using the stored bound handler references
      if (this._boundEventHandlers) {
        EventBus.off('playMusic', this._boundEventHandlers.handlePlayMusic);
        EventBus.off('playAmbience', this._boundEventHandlers.handlePlayAmbience);
        EventBus.off('playTestSound', this._boundEventHandlers.handlePlayTestSound);
        EventBus.off('playSound', this._boundEventHandlers.handlePlaySound);
        EventBus.off('stopMusic', this._boundEventHandlers.handleStopMusic);
        EventBus.off('stopAmbience', this._boundEventHandlers.handleStopAmbience);
        EventBus.off('stopSounds', this._boundEventHandlers.handleStopSounds);
        EventBus.off('resumeSounds', this._boundEventHandlers.handleResumeSounds);
        EventBus.off('stopSound', this._boundEventHandlers.handleStopSound);
        EventBus.off('muteMusic', this._boundEventHandlers.handleMuteMusic);
        EventBus.off('unmuteMusic', this._boundEventHandlers.handleUnmuteMusic);
        EventBus.off('muteAmbience', this._boundEventHandlers.handleMuteAmbience);
        EventBus.off('unmuteAmbience', this._boundEventHandlers.handleUnmuteAmbience);
        EventBus.off('muteSounds', this._boundEventHandlers.handleMuteSounds);
        EventBus.off('unmuteSounds', this._boundEventHandlers.handleUnmuteSounds);
        EventBus.off('setMusicVolume', this._boundEventHandlers.handleSetMusicVolume);
        EventBus.off('setAmbienceVolume', this._boundEventHandlers.handleSetAmbienceVolume);
        EventBus.off('setSoundsVolume', this._boundEventHandlers.handleSetSoundsVolume);
        EventBus.off('initializeAudioContext', this._boundEventHandlers.handleInitializeAudioContext);
        EventBus.off('cleanupAudio', this._boundEventHandlers.handleCleanupAudio);
        EventBus.off('stop-game', this._boundEventHandlers.handleStopGame);
      }
      this._boundEventHandlers = {}; // Clear the stored handlers

      // 2. Cleanup sub-managers concurrently
      const cleanupPromises = [];
      if (this.music) cleanupPromises.push(this.music.cleanup());
      if (this.ambience) cleanupPromises.push(this.ambience.cleanup());
      if (this.sfx) cleanupPromises.push(this.sfx.cleanup());

      const results = await Promise.allSettled(cleanupPromises);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const managerName = [
            this.music ? 'MusicManager' : null,
            this.ambience ? 'AmbienceManager' : null,
            this.sfx ? 'SoundEffectsManager' : null,
          ].filter(Boolean)[index];
          console.error(
            `[${new Date().toISOString()}] [AudioManager] Error during ` +
            `${managerName} cleanup:`,
            result.reason
          );
        }
      });

      this.music = null;
      this.ambience = null;
      this.sfx = null;

      // 3. Close AudioContext
      const contextToClose = this.audioContext;
      this.audioContext = null; // Clear reference immediately

      if (contextToClose && contextToClose.state !== 'closed') {
        const closeTimestamp = new Date().toISOString();
        try {
          await contextToClose.close();
        } catch (closeError) {
          console.error(
            `[${closeTimestamp}] [AudioManager] Error closing AudioContext:`,
            closeError
          );
        }
      }

      // 4. Reset state
      this.audioInitialized = false;
      this.loader = null;
      this.scene = null;
      console.info(
        `[${new Date().toISOString()}] [INFO] [${this.instanceId}] ` +
        `Cleanup finished.`
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [AudioManager] Error during cleanup:`,
        error
      );
    }
  }

  /**
   * Ensures the AudioContext is ready (running). If suspended, attempts
   * resume. If not initialized, calls `init()`. Manages concurrency via
   * `initPromise`.
   *
   * @returns {Promise<boolean>} Resolves true if context is ready, false if
   *   initialization or resume fails.
   * @async
   */
  async ensureAudioContextIsReady() {
    const timestamp = new Date().toISOString();
    try {
      // Already running? Great.
      if (this.audioInitialized && this.audioContext?.state === 'running') {
        return true;
      }

      // Not initialized and no init in progress? Start it.
      if (!this.audioInitialized && !this.initPromise) {
        console.warn(
          `[${timestamp}] [WARN] [AudioManager] Audio system not initialized. ` +
          `Calling init().`
        );
        return await this.init(); // Await the full init process
      }

      // Init already in progress? Await it.
      if (this.initPromise) {
        return await this.initPromise; // Wait for ongoing initialization
      }

      // Initialized but suspended? Attempt resume via initializeAudioContext.
      if (this.audioInitialized && this.audioContext?.state === 'suspended') {
        console.warn(
          `[${timestamp}] [WARN] [AudioManager] AudioContext became suspended ` +
          `after init. Attempting resume.`
        );
        // initializeAudioContext handles the resume logic and state check
        // Let the outer catch handle failures from initializeAudioContext
        return await this.initializeAudioContext();
      }

      // Unexpected state if none of the above conditions match
      const contextState = this.audioContext?.state;
      console.error(
        `[${timestamp}] [AudioManager] Unexpected state in ` +
        `ensureAudioContextIsReady. Initialized: ${this.audioInitialized}, ` +
        `Context State: ${contextState}`
      );
      return false;
    } catch (error) {
      // Catch errors from init() or initializeAudioContext() calls within
      console.error(
        `[${timestamp}] [AudioManager] Error in ensureAudioContextIsReady:`,
        error
      );
      return false; // General catch-all failure
    }
  }

  // --- Private Event Handlers (bound in setupEventListeners) ---

  _handlePlayMusic() {
    this.music?.playMusic();
  }

  _handlePlayAmbience() {
    this.ambience?.playAmbience();
  }

  _handlePlayTestSound() {
    this.sfx?.playTestSound();
  }

  _handlePlaySound(key, config) {
    this.sfx?.playSound(key, config);
  }

  _handleStopMusic() {
    this.music?.stopMusic();
  }

  _handleStopAmbience() {
    this.ambience?.stopAmbience();
  }

  _handleStopSounds() {
    this.sfx?.stopAllSounds();
  }

  _handleResumeSounds() {
    this.sfx?.unmute(); // Assuming unmute handles resuming/playing
  }

  _handleStopSound(key) {
    this.sfx?.stopSound(key);
  }

  _handleMuteMusic() {
    this.music?.mute();
  }

  _handleUnmuteMusic(volume) {
    this.music?.unmute(volume);
  }

  _handleMuteAmbience() {
    this.ambience?.mute();
  }

  _handleUnmuteAmbience(volume) {
    this.ambience?.unmute(volume);
  }

  _handleMuteSounds() {
    this.sfx?.mute();
  }

  _handleUnmuteSounds(volume) {
    this.sfx?.unmute(volume);
  }

  _handleSetMusicVolume(volume) {
    if (volume > 1.0)
      console.warn("Music volume is greater than 1.0. Clamping to 1.0.");
    this.music?.setVolume(volume);
  }

  _handleSetAmbienceVolume(volume) {
    if (volume > 1.0)
      console.warn("Ambience volume is greater than 1.0. Clamping to 1.0.");
    this.ambience?.setVolume(volume);
  }

  _handleSetSoundsVolume(volume) {
    if (volume > 1.0)
      console.warn("Sounds volume is greater than 1.0. Clamping to 1.0.");
    this.sfx?.setVolume(volume);
  }

  _handleStopGame() {
    this.music?.stopMusic();
    this.ambience?.stopAmbience();
    this.sfx?.resetAllSounds();
  }
}
