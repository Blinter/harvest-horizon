/**
 * @file AmbienceManager.js
 * @description Manages ambient sound playback, volume, and muting.
 *   Provides environmental background sounds based on the current game scene.
 * @module AmbienceManager
 */

/**
 * Handles playback and control of ambient sound tracks.
 * @class AmbienceManager
 */
export class AmbienceManager {
  /**
   * Creates an AmbienceManager instance.
   *
   * @param {object} sounds - Cache of initialized Phaser sound objects
   *   (e.g., `{ key: Phaser.Sound.BaseSound }`).
   * @param {Function} initializeAudioContext - Async function to ensure the
   *   AudioContext is ready. Returns a Promise.
   * @param {object} [sceneNameAudioMatchAmbience={}] - Optional mapping from
   *   scene names (string) to ambience track keys (string).
   * @param {number} [initialVolume=0.5] - Optional initial base volume level
   *   (0.0 to 1.0). Default is 0.5.
   * @throws {Error} If `sounds` or `initializeAudioContext` is invalid.
   * @property {object} sounds - The shared sounds cache.
   * @property {Function} initializeAudioContext - Function to initialize
   *   audio.
   * @property {object} sceneNameAudioMatchAmbience - Map of scene names to
   *   ambience keys.
   * @property {string|null} currentAmbienceKey - Key of the currently
   *   assigned ambience track.
   * @property {string|null} currentSceneName - Name of the current scene.
   * @property {number} volume - Base volume level (0.0-1.0).
   * @property {number} volumeScale - Scaling factor applied to the base
   *   volume for ambience tracks.
   * @property {boolean} isMuted - Flag indicating if ambience is muted.
   * @property {string|null} lastPlayedTrackKey - Key of the last track that
   *   was playing before stopping.
   * @property {number} lastPlayedSeekTime - Seek time (position in seconds)
   *   where the last track stopped.
   */
  constructor(
    sounds,
    initializeAudioContext,
    sceneNameAudioMatchAmbience,
    initialVolume = 0.5
  ) {
    if (!sounds || typeof initializeAudioContext !== 'function') {
      console.error(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `Constructor failed: Invalid sounds cache or ` +
        `initializeAudioContext function.`
      );
      throw new Error(
        `AmbienceManager requires sounds cache and initializeAudioContext ` +
        `function.`
      );
    }
    this.sounds = sounds;
    this.initializeAudioContext = initializeAudioContext;
    this.sceneNameAudioMatchAmbience = sceneNameAudioMatchAmbience || {};
    this.currentAmbienceKey = null;
    this.currentSceneName = null;
    // Volume scale is used to scale the base volume to a more reasonable range
    // for the ambience.
    this.volumeScale = 0.1;
    this.volume = initialVolume;
    this.isMuted = false;
    this.lastPlayedTrackKey = null;
    this.lastPlayedSeekTime = 0;
  }

  /**
   * Updates the current scene. Sets the appropriate ambience track based on
   * the scene name, stopping the previous track if necessary.
   *
   * @param {string} sceneName - The name of the new scene.
   * @returns {void}
   */
  setScene(sceneName) {
    this.currentSceneName = sceneName;

    const newAmbienceKey = this._getSceneAmbienceKey(sceneName);

    if (newAmbienceKey !== this.currentAmbienceKey) {
      if (this.currentAmbienceKey) {
        this.stopAmbience(); // Stops only the current key
      }
      this.currentAmbienceKey = newAmbienceKey;
    }
  }

  /**
   * Plays the ambience track associated with the current scene. Ensures the
   * audio context is ready before playback. Does nothing if ambience is
   * muted or if no track is assigned to the current scene.
   *
   * @returns {void}
   */
  playAmbience() {
    if (this.isMuted) {
      console.warn(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `Playback aborted: Ambience is currently muted.`
      );
      return;
    }

    if (!this.currentAmbienceKey) {
      console.warn(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `No ambience key currently assigned ` +
        `(Scene: '${this.currentSceneName}'). Cannot play.`
      );
      return;
    }

    this.initializeAudioContext()
      .then((contextReady) => {
        if (contextReady) {
          this._playInternal(this.currentAmbienceKey);
        } else {
          console.warn(
            `[${new Date().toISOString()}] [AmbienceManager] ` +
            `Playback aborted: AudioContext initialization reported failure.`
          );
        }
      })
      .catch((err) => {
        console.error(
          `[${new Date().toISOString()}] [AmbienceManager] ` +
          `Playback aborted: Failed to initialize AudioContext.`,
          err
        );
      });
  }

  /**
   * Internal helper to handle the playback logic for a specific ambience
   * track key. Retrieves the sound object, ensures no other ambience tracks
   * are playing, and then plays the specified track with the correct loop
   * and volume settings. Adjusts volume if the track is already playing.
   * Resumes from `lastPlayedSeekTime` if applicable.
   *
   * @param {string} key - The key identifying the ambience track to play.
   * @private
   * @returns {void}
   */
  _playInternal(key) {
    const ambience = this.sounds[key];

    if (!ambience) {
      console.error(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `_playInternal failed: Sound object for key '${key}' not found.`
      );
      return;
    }

    this._stopOtherAmbienceTracks(key);

    if (typeof ambience.play !== 'function') {
      console.error(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `_playInternal failed: Sound object for '${key}' has no play method.`
      );
      return;
    }

    const calculatedVolume = this.isMuted ? 0 : this.volume * this.volumeScale;

    try {
      let startSeek = 0;
      if (key === this.lastPlayedTrackKey && this.lastPlayedSeekTime > 0) {
        startSeek = this.lastPlayedSeekTime;
        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}] [AmbienceManager] Resuming track ` +
        //   `'${key}' from seek time: ${startSeek}`
        // );
      } else {
        this.lastPlayedSeekTime = 0;
      }

      if (!ambience.isPlaying) {
        const playConfig = { loop: true, volume: calculatedVolume, seek: startSeek };
        ambience.play(playConfig);
      } else if (ambience.volume !== calculatedVolume) {
        ambience.setVolume(calculatedVolume);
      }
      this.lastPlayedTrackKey = key;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `Error during playback/volume adjustment for '${key}':`,
        error
      );
    }
  }

  /**
   * Stops the currently playing ambience track, if one is active. Stores the
   * current seek time before stopping so playback can potentially be resumed.
   *
   * @returns {void}
   */
  stopAmbience() {
    if (this.currentAmbienceKey) {
      const ambience = this.sounds[this.currentAmbienceKey];
      if (ambience?.isPlaying) {
        if (typeof ambience.seek === 'number') {
          this.lastPlayedSeekTime = ambience.seek;
          // Keep for debugging
          // console.debug(
          //   `[${new Date().toISOString()}] [AmbienceManager] ` +
          //   `Storing seek time ${this.lastPlayedSeekTime} for track ` +
          //   `'${this.currentAmbienceKey}'.`
          // );
        } else {
          console.warn(
            `[${new Date().toISOString()}] [AmbienceManager] ` +
            `Could not get valid ` +
            `seek time for track '${this.currentAmbienceKey}' ` +
            `before stopping.`
          );
          this.lastPlayedSeekTime = 0;
        }
        ambience.stop();
      }
    }
  }

  /**
   * Stops all ambience tracks defined in the `sceneNameAudioMatchAmbience`
   * mapping, except for the track specified by `exceptKey`.
   *
   * @param {string|null} [exceptKey=null] - The key of the track to exclude
   *   from stopping. If null, stops all tracks.
   * @private
   * @returns {void}
   */
  _stopOtherAmbienceTracks(exceptKey = null) {
    for (const sceneName in this.sceneNameAudioMatchAmbience) {
      const ambienceKey = this.sceneNameAudioMatchAmbience[sceneName];
      if (ambienceKey && ambienceKey !== exceptKey) {
        const ambience = this.sounds[ambienceKey];
        if (ambience?.isPlaying) {
          try {
            ambience.stop();
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [AmbienceManager] ` +
              `Error stopping other ambience track '${ambienceKey}':`,
              error
            );
          }
        }
      }
    }
  }

  /**
   * Mutes ambience playback. Sets the `isMuted` flag to true and sets the
   * volume of the currently playing ambience track (if any) to 0.
   *
   * @returns {void}
   */
  mute() {
    if (!this.isMuted) {
      this.isMuted = true;
      if (this.currentAmbienceKey) {
        const ambience = this.sounds[this.currentAmbienceKey];
        if (ambience?.isPlaying) {
          try {
            ambience.setVolume(0);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [AmbienceManager] ` +
              `Error setting volume to 0 for mute on track ` +
              `'${this.currentAmbienceKey}':`,
              error
            );
          }
        }
      }
    }
  }

  /**
   * Unmutes ambience playback. Sets the `isMuted` flag to false and restores
   * the volume of the currently playing ambience track (if any) to the
   * calculated scaled volume.
   *
   * @returns {void}
   */
  unmute() {
    if (this.isMuted) {
      this.isMuted = false;
      const calculatedVolume = this.volume * this.volumeScale;

      if (this.currentAmbienceKey) {
        const ambience = this.sounds[this.currentAmbienceKey];
        if (ambience?.isPlaying) {
          try {
            ambience.setVolume(calculatedVolume);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [AmbienceManager] ` +
              `Error restoring volume on unmute for track ` +
              `'${this.currentAmbienceKey}':`,
              error
            );
          }
        }
      }
    }
  }

  /**
   * Sets the base ambience volume level. Clamps the input volume between 0.0
   * and 1.0. If ambience is not muted, applies the new scaled volume to the
   * currently playing track, if one exists.
   *
   * @param {number} volume - The new base volume level (0.0 to 1.0).
   * @returns {void}
   */
  setVolume(volume) {
    // Clamp base volume
    const newVolume = Math.max(0, Math.min(1, volume));
    this.volume = newVolume;
    const calculatedVolume = this.getScaledVolume(this.volume);

    if (!this.isMuted) {
      if (this.currentAmbienceKey) {
        const ambience = this.sounds[this.currentAmbienceKey];
        if (ambience?.isPlaying) {
          try {
            ambience.setVolume(calculatedVolume);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [AmbienceManager] ` +
              `Error applying volume change to track ` +
              `'${this.currentAmbienceKey}':`,
              error
            );
          }
        }
      }
    }
  }

  /**
   * Calculates the scaled volume based on the base volume and the instance's
   * `volumeScale`. Ensures the result is clamped between 0.0 and 1.0.
   *
   * @param {number} volume - The base volume level (0.0 to 1.0).
   * @returns {number} The calculated scaled volume (0.0 to 1.0).
   */
  getScaledVolume = volume =>
    Math.max(0, Math.min(1, volume)) * (this.volumeScale || 0.1);

  /**
   * Retrieves the ambience track key associated with a given scene name from
   * the `sceneNameAudioMatchAmbience` mapping. Logs a warning if no key is
   * found.
   *
   * @param {string} sceneName - The name/key of the scene.
   * @returns {string|null} The corresponding ambience key, or null if no
   *   mapping exists for the scene name.
   * @private
   */
  _getSceneAmbienceKey(sceneName) {
    const key = this.sceneNameAudioMatchAmbience[sceneName] || null;
    if (!key) {
      console.warn(
        `[${new Date().toISOString()}] [AmbienceManager] ` +
        `_getSceneAmbienceKey: No ambience key defined for scene ` +
        `'${sceneName}'.`
      );
    }
    return key;
  }

  /**
   * Cleans up resources used by the AmbienceManager. Stops any currently
   * playing ambience track and resets internal state variables related to
   * the current scene and track playback position.
   *
   * @returns {void}
   */
  cleanup() {
    this.stopAmbience(); // Ensure current track is stopped
    this.currentAmbienceKey = null;
    this.currentSceneName = null;
    this.lastPlayedTrackKey = null;
    this.lastPlayedSeekTime = 0;
  }
}

export default AmbienceManager;
