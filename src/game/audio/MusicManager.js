/**
 * @file MusicManager.js
 * @description Manages background music playback, including scene transitions,
 *   volume, and muting.
 */

import { MAIN_MENU, NEW_GAME } from '../constants/scenes';

/**
 * Handles playback and control of background music tracks within the game.
 * Requires access to initialized sound objects and scene information.
 * @class MusicManager
 */
export class MusicManager {
  /**
   * Creates a MusicManager instance. Requires a cache of sound objects, a
   * function to ensure the AudioContext is ready, and a mapping defining which
   * music track belongs to which scene.
   *
   * @param {object} sounds - The cache of initialized Phaser sound objects
   *   (e.g., `{ key: Phaser.Sound.BaseSound }`). Keys are sound asset keys,
   *   values are Phaser sound instances.
   * @param {Function} initializeAudioContext - Async function to call to
   *   ensure the AudioContext is resumed/ready before playback attempts.
   *   Should return a Promise resolving to true on success.
   * @param {number} [initialVolume=0.21] - The initial volume level for music
   *   (0.0 to 1.0).
   * @throws {Error} If `sounds` cache or `initializeAudioContext` function is
   *   not provided or invalid.
   * @property {object} sounds - Reference to the shared sounds cache.
   * @property {Function} initializeAudioContext - Reference to the audio
   *   context initialization function.
   * @property {object} sceneNameAudioMatch - Mapping of scene names to music
   *   keys.
   * @property {string|null} currentMusicKey - The key of the currently
   *   playing or intended music track.
   * @property {string|null} currentSceneName - The name of the current scene
   *   associated with the music.
   * @property {number} volume - The current volume level for music (0.0 to
   *   1.0).
   * @property {boolean} isMuted - Whether music is currently muted.
   * @property {object.<string, {seekTime: number, timestamp: number|null}>}
   *   lastPlayedData - Stores the last known seek time and timestamp for each
   *   music track key.
   */
  constructor(sounds, initializeAudioContext, initialVolume = 0.21) {
    if (!sounds || typeof initializeAudioContext !== 'function') {
      console.error(
        `[${new Date().toISOString()}] [MusicManager] Constructor failed: ` +
        `Invalid sounds cache or initializeAudioContext function ` +
        `provided.`
      );
      throw new Error(
        `MusicManager requires sounds cache and initializeAudioContext ` +
        `function.`
      );
    }
    this.sounds = sounds;
    this.initializeAudioContext = initializeAudioContext;
    this.currentMusicKey = null;
    this.currentSceneName = null;
    this.volume = initialVolume;
    this.isMuted = false;
    this.lastPlayedData = {}; // Store data per music key

    // Map scene names to their corresponding music keys
    this.sceneNameAudioMatch = {
      [MAIN_MENU]: 'mainMenuMusic',
      // Assuming this exists now or change as needed
      [NEW_GAME]: 'newGameMusic',
    };
    // Derive the list of keys managed by this MusicManager
    this.musicKeys = Object.values(this.sceneNameAudioMatch);
  }

  /**
   * Updates the current scene context for the music manager. Determines the
   * correct music track for the new scene and stops the previous track if
   * changing.
   *
   * @param {string} sceneName - The name/key of the new scene.
   */
  setScene(sceneName) {
    this.currentSceneName = sceneName;

    const newMusicKey = this._getSceneMusicKey(sceneName);

    // Check if the new music key is different from the current one
    if (newMusicKey !== this.currentMusicKey) {
      if (this.currentMusicKey) {
        this.stopMusic(); // Stop previous music if changing tracks
      }
      this.currentMusicKey = newMusicKey;
      // Note: Playback is typically initiated by a separate playMusic() call
      //  after scene change.
    }
  }

  /**
   * Determines the appropriate music key for a given scene name.
   *
   * @param {string} sceneName - The key/name of the scene.
   * @returns {string|null} The music asset key, or null if no specific music.
   * @private
   */
  _getSceneMusicKey(sceneName) {
    const musicKey = this.sceneNameAudioMatch[sceneName];
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [MusicManager] _getSceneMusicKey ` +
    //   `sceneName: '${sceneName}', musicKey: '${musicKey}'.`
    // );

    if (musicKey) {
      return musicKey;
    } else {
      console.warn(
        `[${new Date().toISOString()}] [MusicManager] ` +
        `No specific music key defined for scene: '${sceneName}' ` +
        `in sceneNameAudioMatch map. Returning null.`
      );
      return null;
    }
  }

  /**
   * Plays the music track associated with the current scene. Ensures the
   * AudioContext is ready before attempting playback. Logs warnings if muted,
   * no track is assigned, or context initialization fails. Does not proceed
   * with playback if muted or no track found.
   *
   * @param {object} [options={}] - Optional playback configuration.
   * @param {boolean} [options.loop=true] - Whether the track should loop.
   * @param {number} [options.volume=this.volume] - Specific volume for this
   *   playback instance.
   */
  playMusic(options = {}) {
    // Keep for debugging 
    // console.debug(
    //   `[${new Date().toISOString()}] [MusicManager] ` + 
    //   `playMusic called with options:`,
    //   options
    // );
    if (this.isMuted) {
      console.warn(
        `[${new Date().toISOString()}] [MusicManager] Playback aborted: Music is currently muted.`
      );
      return;
    }

    if (!this.currentMusicKey) {
      console.warn(
        `[${new Date().toISOString()}] [MusicManager] No music key ` +
        `currently assigned (Scene: '${this.currentSceneName}'). ` +
        `Cannot play.`
      );
      return;
    }

    // Ensure Audio Context is ready
    this.initializeAudioContext()
      .then((contextReady) => {
        if (contextReady) {
          // Keep for debugging
          // console.debug(
          //   `[${new Date().toISOString()}] [MusicManager] ` +
          //   `AudioContext ready. ` +
          //   `Playing music: '${this.currentMusicKey}'.`
          // );
          this._playInternal(this.currentMusicKey, options);
        } else {
          console.warn(
            `[${new Date().toISOString()}] [MusicManager] Playback aborted: ` +
            `AudioContext initialization reported failure.`
          );
        }
      })
      .catch((err) => {
        console.error(
          `[${new Date().toISOString()}] [MusicManager] Playback aborted: ` +
          `Failed to initialize AudioContext.` +
          `Error:`,
          err
        );
      });
  }

  /**
   * Internal logic to play a specific music track key using Phaser's sound
   * manager. Stops other music tracks, ensures the target track exists,
   * retrieves the sound object, and delegates to _handleMusicPlayback. Logs
   * errors if the sound object is missing or invalid.
   *
   * @param {string} key - The key of the music track to play.
   * @param {object} [options={}] - Playback options (e.g., loop, volume
   *   passed from caller).
   * @private
   */
  _playInternal(key, options = {}) {
    const music = this.sounds[key];

    if (!music) {
      console.error(
        `[${new Date().toISOString()}] [MusicManager] _playInternal ` +
        `failed: Sound object for key '${key}' not found in cache.`
      );
      return;
    }

    // Stop other music tracks first
    this._stopOtherMusicTracks(key);

    // Delegate actual playback/volume handling
    if (typeof music.play === 'function') {
      const targetVolume = this.isMuted ? 0 : (options.volume ?? this.volume);
      const loop = options.loop ?? true; // Default loop to true

      // *** Add seek logic with elapsed time and duration wrap ***
      let startSeek = 0; // Default to start from beginning
      const resumeData = this.lastPlayedData[key];

      // Log values *before* the check      
      // console.debug(
      //   `[${new Date().toISOString()}] [MusicManager] ` + 
      //   `_playInternal Check: ` +
      //   `key='${key}', resumeData=`,
      //   resumeData
      // );

      if (
        resumeData && // Check if data exists for this key
        resumeData.timestamp !== null // Check if it was actually stopped (not just initialized)
      ) {
        // Keep for debugging
        // const currentTime = Date.now();
        // const elapsedTimeMs = currentTime - resumeData.timestamp;
        //const elapsedTimeSec = elapsedTimeMs / 1000;
        // Don't adjust seek time based on elapsed time.
        // const adjustedSeek = resumeData.seekTime + elapsedTimeSec;
        const adjustedSeek = resumeData.seekTime;

        // Get duration from the sound object
        const trackDuration = music.duration;

        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}] [MusicManager] ` +
        //   `Resuming track '${key}': ` +
        //   `elapsedTime=${elapsedTimeSec.toFixed(2)}s, ` +
        //   `adjustedSeek=${adjustedSeek.toFixed(2)}s, ` +
        //   `duration=${trackDuration ? trackDuration.toFixed(2) : 'N/A'}s`
        // );

        if (trackDuration && trackDuration > 0) {
          startSeek = adjustedSeek % trackDuration;
        } else {
          console.warn(
            `[${new Date().toISOString()}] [MusicManager] Invalid or zero ` +
            `duration for track '${key}'. Cannot apply modulo wrap. ` +
            `Falling back to last raw seek time.`
          );
          startSeek = resumeData.seekTime; // Fallback if duration is invalid
        }

        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}] [MusicManager] Final calculated ` +
        //   `startSeek: ${startSeek.toFixed(2)}`
        // );

      } else {
        // Reset seek time and timestamp if it's a different track, never played, or timestamp missing
        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}] [MusicManager]` + 
        //   `No valid resume data for '${key}'. Starting from beginning.`
        // );
        // Ensure the entry exists but is marked as not resumable
        this.lastPlayedData[key] = { seekTime: 0, timestamp: null };
      }
      // **********************************************************

      this._handleMusicPlayback(music, key, targetVolume, loop, startSeek);
    } else {
      console.error(
        `[${new Date().toISOString()}] [MusicManager] _playInternal failed: ` +
        `Sound object for '${key}' is invalid (no play method).`
      );
    }
  }

  /**
   * Handles the actual playback initiation or volume adjustment for a given
   * music track. If the track isn't playing, it starts it with the specified
   * loop, volume, and seek time. If it is playing, it ensures the volume
   * matches the target volume.
   *
   * @param {Phaser.Sound.BaseSound} music - The Phaser sound object to
   *   play/adjust.
   * @param {string} key - The key of the music track (for logging purposes).
   * @param {number} targetVolume - The calculated target volume (0 if muted,
   *   otherwise current/option volume).
   * @param {boolean} loop - Whether the music should loop.
   * @param {number} [seek=0] - The time in seconds to start playback from.
   * @private
   */
  _handleMusicPlayback(music, key, targetVolume, loop, seek = 0) {
    try {
      // Log the final calculated seek value before playing
      // console.debug(
      //   `[${new Date().toISOString()}] [MusicManager] ` +
      //   `_handleMusicPlayback: ` +
      //   `Attempting to play '${key}' with seek=${seek}, ` +
      //   `volume=${targetVolume}, loop=${loop}`
      // );

      if (!music.isPlaying) { // Check if the track needs to be started
        music.setVolume(targetVolume); // Set volume before playing

        // Play configuration
        const playConfig = { loop, seek };

        if (seek > 0) { // Specific handling for resuming with seek
          // Start muted to potentially mask seek artifact
          playConfig.volume = 0;
          // Keep for debugging
          // console.debug(
          //   `[${new Date().toISOString()}] [MusicManager] ` +
          //   `_handleMusicPlayback: Resuming '${key}' ` +
          //   `at seek=${seek.toFixed(2)}s, starting muted.`
          // );
          music.play(playConfig); // Play starts muted
          // Immediately set the actual target volume
          music.setVolume(targetVolume);
          // Keep for debugging
          // console.debug(
          //   `[${new Date().toISOString()}] [MusicManager] ` +
          //   `_handleMusicPlayback: Immediately setting volume ` +
          //   `for '${key}' to ${targetVolume}.`
          // );
        } else { // Start from beginning (seek = 0)
          playConfig.volume = targetVolume; // Start with target volume
          // Keep for debugging
          // console.debug(
          //   `[${new Date().toISOString()}] [MusicManager] ` +
          //   `_handleMusicPlayback: Playing '${key}' from beginning ` +
          //   `with volume ${targetVolume}.`
          // );
          music.play(playConfig);
        }
      } else if (music.volume !== targetVolume) {
        // If already playing, just ensure the volume is correct (e.g., after mute/unmute)
        music.setVolume(targetVolume);
        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}] [MusicManager] ` +
        //   `_handleMusicPlayback: Adjusting volume for already ` +
        //   `playing track '${key}' to ${targetVolume}.`
        // );
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [MusicManager] Error during playback/` +
        `volume adjustment for '${key}': Error:`,
        error
      );
    }
  }

  /**
   * Stops the currently playing music track identified by `currentMusicKey`.
   * Stores the current playback position (seek time) and timestamp before
   * stopping to allow for potential resuming later.
   */
  stopMusic() {
    if (this.currentMusicKey) {
      const music = this.sounds[this.currentMusicKey];
      if (music?.isPlaying) {
        try {
          // *** Store seek time before stopping ***
          const currentSeek = typeof music.seek === 'number' ? music.seek : 0;
          const currentTimestamp = Date.now();

          // Log the seek value retrieved *before* assigning and stopping
          // console.debug(
          //   `[${new Date().toISOString()}] [MusicManager] stopMusic: ` +
          //   `Track '${this.currentMusicKey}' is playing. ` +
          //   `Retrieved seek value: ${currentSeek}, ` +
          //   `Timestamp: ${currentTimestamp}`
          // );

          // Store the data associated with the key being stopped
          this.lastPlayedData[this.currentMusicKey] = {
            seekTime: currentSeek,
            timestamp: currentTimestamp,
          };

          // Keep for debugging
          // console.debug(
          //   `[${new Date().toISOString()}] [MusicManager] Stored seek ` +
          //   `time ${currentSeek} and timestamp ${currentTimestamp} ` +
          //   `for track '${this.currentMusicKey}'.`
          // );
          music.stop();
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] [MusicManager] Error stopping ` +
            `music track '${this.currentMusicKey}': Error:`,
            error
          );
        }
      }
    }
  }

  /**
   * Stops all managed music tracks except for the one specified. Used to ensure
   * only one track plays at a time when switching tracks.
   *
   * @param {string} keyToKeepPlaying - The key of the music track that should
   *   *not* be stopped.
   * @private
   */
  _stopOtherMusicTracks(keyToKeepPlaying) {
    for (const musicKey of this.musicKeys) {
      // Skip the track we want to keep playing
      if (musicKey === keyToKeepPlaying) {
        continue;
      }

      // Get the sound object for this music key
      const sound = this.sounds[musicKey];

      // Check if it's a valid sound object and is currently playing
      if (sound?.isPlaying) {
        try {
          sound.stop();
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] [MusicManager] ` +
            `Error stopping music track '${musicKey}':` +
            `Error:`,
            error
          );
        }
      }
    }
  }

  /**
   * Sets the volume for the music category. Updates the internal volume
   * property and adjusts the volume of the currently playing music track if it
   * is not muted. Clamps the volume between 0.0 and 1.0.
   *
   * @param {number} volume - The desired volume level (0.0 to 1.0).
   */
  setVolume(volume) {
    const timestamp = new Date().toISOString();

    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (clampedVolume !== volume) {
      console.warn(
        `[${timestamp}] [MusicManager] Volume ${volume} clamped to ` +
        `${clampedVolume}.`
      );
    }
    this.volume = clampedVolume;

    // If muted, only update the internal volume property, don't change sound
    if (this.isMuted) {
      return;
    }

    // Apply volume to the currently playing track, if any
    if (this.currentMusicKey) {
      const music = this.sounds[this.currentMusicKey];
      if (music?.isPlaying) {
        try {
          music.setVolume(this.volume);
        } catch (error) {
          console.error(
            `[${timestamp}] [MusicManager] Error setting volume on ` +
            `playing track '${this.currentMusicKey}': Error:`,
            error
          );
        }
      } else if (music) {
        // console.debug removed
      } else {
        console.warn(
          `[${timestamp}] [MusicManager] Could not find sound object for ` +
          `current key '${this.currentMusicKey}' to apply volume.`
        );
      }
    }
  }

  /**
   * Mutes the music. Sets the volume of the currently playing track to 0 and
   * sets the internal mute flag. Does nothing if already muted.
   */
  mute() {
    const timestamp = new Date().toISOString();

    if (this.isMuted) {
      console.warn(`[${timestamp}] [MusicManager] Already muted.`);
      return;
    }

    this.isMuted = true;

    // Set volume of currently playing track to 0
    if (this.currentMusicKey) {
      const music = this.sounds[this.currentMusicKey];
      if (music?.isPlaying) {
        try {
          music.setVolume(0);
        } catch (error) {
          console.error(
            `[${timestamp}] [MusicManager] Error setting volume to 0 ` +
            `on track '${this.currentMusicKey}': Error:`,
            error
          );
        }
      }
    }
  }

  /**
   * Unmutes the music. Restores the volume of the currently playing track to
   * the stored volume level and clears the internal mute flag. Does nothing if
   * already unmuted.
   */
  unmute() {
    const timestamp = new Date().toISOString();

    if (!this.isMuted) {
      console.warn(`[${timestamp}] [MusicManager] Already unmuted.`);
      return;
    }

    this.isMuted = false;

    // Restore volume of currently playing track
    if (this.currentMusicKey) {
      const music = this.sounds[this.currentMusicKey];
      if (music?.isPlaying) {
        try {
          music.setVolume(this.volume); // Use the stored volume
        } catch (error) {
          console.error(
            `[${timestamp}] [MusicManager] Error restoring volume on ` +
            `track '${this.currentMusicKey}': Error:`,
            error
          );
        }
      }
    }
  }

  /**
   * Cleans up resources used by the MusicManager. Stops any currently playing
   * music tracks and resets the internal state, including scene association
   * and playback position data.
   *
   * @returns {Promise<void>} Resolves when cleanup is complete.
   * @async
   */
  async cleanup() {
    try {
      // Stop any playing music
      this.stopMusic();

      // Reset state variables
      this.currentMusicKey = null;
      this.currentSceneName = null;
      this.lastPlayedData = {};
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [MusicManager] Error during cleanup:`,
        error
      );
    }
  }
}
