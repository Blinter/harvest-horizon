/**
 * @file SoundEffectsManager.js
 * @description Manages playback of short sound effects, volume, and muting.
 */

/**
 * Manages playback and control of short sound effects within the game.
 * Handles volume adjustments, muting, and stopping of individual or all
 * effects. Requires an initialized audio context and a cache of loaded
 * sound assets.
 *
 * @class SoundEffectsManager
 */
export class SoundEffectsManager {
  /**
   * Creates an instance of SoundEffectsManager.
   *
   * @param {object} sounds - A cache object where keys are sound asset keys
   *   (strings) and values are the corresponding loaded Phaser sound
   *   instances.
   * @param {Function} initializeAudioContext - An asynchronous function that
   *   must be called to ensure the browser's AudioContext is ready before
   *   playing any sound. It should return a Promise that resolves to `true`
   *   if the context is ready, and `false` otherwise.
   * @param {number} [initialVolume=0.4] - The initial volume level for all
   *   sound effects, ranging from 0.0 (silent) to 1.0 (full volume).
   *   Defaults to 0.4.
   * @throws {Error} If the `sounds` cache object is missing or if
   *   `initializeAudioContext` is not a valid function.
   * @property {object} sounds Reference to the provided sound cache object.
   * @property {Function} initializeAudioContext Reference to the function for
   *   initializing the audio context.
   * @property {number} volume The current global volume setting for sound
   *   effects (0.0 to 1.0).
   * @property {boolean} isMuted Flag indicating if sound effects are currently
   *   globally muted (`true`) or not (`false`).
   * @property {boolean} isStopped Flag indicating if all sound effect playback
   *   is currently stopped (`true`) or allowed (`false`).
   * @property {string[]} soundEffectKeys An array of string keys identifying
   *   the sound effects managed by this instance (e.g., 'plantSound').
   */
  constructor(sounds, initializeAudioContext, initialVolume = 0.4) {
    if (!sounds || typeof initializeAudioContext !== 'function') {
      console.error(
        `[${new Date().toISOString()}] [SoundEffectsManager] Constructor ` +
        `failed: Invalid sounds cache or initializeAudioContext ` +
        `function.`
      );
      throw new Error(
        'SoundEffectsManager requires sounds cache and ' +
        'initializeAudioContext function.'
      );
    }
    this.sounds = sounds;
    this.initializeAudioContext = initializeAudioContext;
    this.volume = initialVolume;
    this.isMuted = false;
    this.isStopped = false;

    // Define which keys are SFX
    this.soundEffectKeys = ['testSound', 'plantSound', 'harvestSound'];
  }

  /**
   * Plays a specific sound effect identified by its key. Ensures the audio
   * context is ready before attempting playback. Applies current volume and
   * mute settings unless overridden by the optional config.
   *
   * @param {string} key - The asset key of the sound effect to play. This key
   *   must exist within the `sounds` cache provided to the constructor.
   * @param {object} [config={}] - Optional Phaser sound configuration object
   *   to override default playback settings. Can include properties like
   *   `volume` (0.0-1.0) or `loop` (boolean). If volume is provided, it
   *   overrides the manager's global volume for this specific playback.
   * @returns {void} Does not return a value. Logs warnings or errors if
   *   playback cannot proceed.
   */
  playSound(key, config = {}) {
    if (this.isStopped) {
      console.warn(
        `[${new Date().toISOString()}] [SoundEffectsManager] Playback ` +
        `aborted: All sounds are currently stopped.`
      );
      return;
    }

    const sound = this.sounds[key];
    if (!sound) {
      console.warn(
        `[${new Date().toISOString()}] [SoundEffectsManager] Playback ` +
        `aborted: Sound effect with key '${key}' not found in cache.`
      );
      return;
    }

    if (typeof sound.play !== 'function') {
      console.error(
        `[${new Date().toISOString()}] [SoundEffectsManager] Playback ` +
        `aborted: Sound object for '${key}' is invalid (no play ` +
        `method).`
      );
      return;
    }

    this.initializeAudioContext()
      .then((contextReady) => {
        if (!contextReady) {
          console.warn(
            `[${new Date().toISOString()}] [SoundEffectsManager] ` +
            `Playback aborted for '${key}': AudioContext ` +
            `initialization reported failure.`
          );
          return;
        }

        try {
          const effectVolume = config.volume ?? this.volume;
          const finalVolume = this.isMuted ? 0 : effectVolume;

          const playConfig = {
            ...config,
            volume: finalVolume,
            loop: config.loop === true, // Explicit false default
          };

          sound.play(playConfig);
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] [SoundEffectsManager] ` +
            `Error during playback attempt for '${key}': Error:`,
            error
          );
        }
      })
      .catch((err) => {
        console.error(
          `[${new Date().toISOString()}] [SoundEffectsManager] ` +
          `Playback failed for '${key}': Could not initialize ` +
          `AudioContext. Error:`,
          err
        );
      });
  }

  /**
   * Stops playback of a specific, currently playing sound effect.
   *
   * @param {string} key - The asset key of the sound effect to stop.
   * @returns {void} Does not return a value. Logs warnings if the key is
   *   not found or the sound object is invalid. Logs errors if stopping fails.
   */
  stopSound(key) {
    const sound = this.sounds[key];
    if (sound && typeof sound.stop === 'function') {
      if (sound.isPlaying) {
        try {
          sound.stop();
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] [SoundEffectsManager] Error ` +
            `stopping sound effect '${key}': Error:`,
            error
          );
        }
      }
    } else if (sound) {
      console.warn(
        `[${new Date().toISOString()}] [SoundEffectsManager] Cannot stop ` +
        `sound '${key}': Invalid sound object (no stop method).`
      );
    } else {
      console.warn(
        `[${new Date().toISOString()}] [SoundEffectsManager] Cannot stop ` +
        `sound '${key}': Key not found in cache.`
      );
    }
  }

  /**
   * Immediately stops playback of all managed sound effects that are
   * currently playing. Sets the `isStopped` flag to `true`.
   *
   * @returns {void} Does not return a value. Logs errors if stopping any
   * individual sound fails.
   */
  stopAllSounds() {
    if (!this.isStopped) {
      this.isStopped = true;
      this.soundEffectKeys.forEach((key) => {
        const sound = this.sounds[key];
        if (sound?.isPlaying && typeof sound.stop === 'function') {
          try {
            sound.stop();
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [SoundEffectsManager] Error ` +
              `stopping SFX '${key}': Error:`,
              error
            );
          }
        }
      });
    }
  }

  /**
   * Stops all currently playing managed sound effects, similar to
   * `stopAllSounds`, but preserves the original `isStopped` state. This is
   * useful for temporarily pausing sounds without changing the overall stopped
   * status.
   *
   * @returns {void} Does not return a value. Logs errors if stopping fails.
   */
  resetAllSounds() {
    const previousIsStopped = this.isStopped;
    if (!previousIsStopped) {
      this.isStopped = true;
      this.soundEffectKeys.forEach((key) => {
        const sound = this.sounds[key];
        if (sound?.isPlaying && typeof sound.stop === 'function') {
          try {
            sound.stop();
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [SoundEffectsManager] Error ` +
              `stopping SFX '${key}': Error:`,
              error
            );
          }
        }
      });
    }
    this.isStopped = previousIsStopped
  }

  /**
   * Mutes all managed sound effects by setting their individual volumes to 0.
   * Sets the `isMuted` flag to `true`. Affects future plays and currently
   * playing sounds.
   *
   * @returns {void} Does not return a value. Logs errors if setting volume
   *   fails for any sound.
   */
  mute() {
    if (!this.isMuted) {
      this.isMuted = true;
      this.soundEffectKeys.forEach((key) => {
        const sound = this.sounds[key];
        // Adjust volume even if not playing, to ensure mute state persists
        if (sound && typeof sound.setVolume === 'function') {
          try {
            // Store original volume before muting if needed for restore?
            // Currently, unmute uses the global `this.volume`.
            sound.setVolume(0);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [SoundEffectsManager] Error ` +
              `setting volume to 0 for mute on SFX '${key}': Error:`,
              error
            );
          }
        }
      });
    }
  }

  /**
   * Unmutes all managed sound effects, restoring their volume to the current
   * global `this.volume` setting. Resets the `isMuted` and `isStopped` flags
   * to `false`.
   *
   * @returns {void} Does not return a value. Logs errors if restoring volume
   *   fails for any sound.
   */
  unmute() {
    if (this.isMuted || this.isStopped) {
      this.isMuted = false;
      this.isStopped = false;
      const restoreVolume = this.volume;
      this.soundEffectKeys.forEach((key) => {
        const sound = this.sounds[key];
        // Adjust volume even if not playing, to restore state correctly
        if (sound && typeof sound.setVolume === 'function') {
          try {
            sound.setVolume(restoreVolume);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [SoundEffectsManager] Error ` +
              `restoring volume on unmute for SFX '${key}': Error:`,
              error
            );
          }
        }
      });
    }
  }

  /**
   * Sets the global volume for all managed sound effects. Clamps the input
   * value between 0.0 and 1.0. If not muted, applies the new volume to
   * currently playing sounds.
   *
   * @param {number} volume - The desired new volume level (0.0 to 1.0).
   *   Values outside this range will be clamped.
   * @returns {void} Does not return a value. Logs errors if applying volume
   *   change fails.
   */
  setVolume(volume) {
    const newVolume = Math.max(0, Math.min(1, volume));
    this.volume = newVolume;

    // Only apply volume change to active sounds if not muted
    if (!this.isMuted) {
      this.soundEffectKeys.forEach((key) => {
        const sound = this.sounds[key];
        if (sound?.isPlaying && typeof sound.setVolume === 'function') {
          try {
            sound.setVolume(this.volume);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] [SoundEffectsManager] Error ` +
              `applying volume change to SFX '${key}': Error:`,
              error
            );
          }
        }
      });
    }
  }

  /**
   * A convenience method to play the predefined 'testSound' effect using the
   * current manager settings.
   *
   * @returns {void} Does not return a value.
   */
  playTestSound() {
    this.playSound('testSound');
  }

  /**
   * Performs cleanup by stopping all currently playing managed sound effects.
   * This should be called when the manager is no longer needed, for instance,
   * when changing scenes or shutting down the game. Note: This does not
   * destroy the sound objects themselves, as they are managed externally.
   *
   * @returns {void} Does not return a value.
   */
  cleanup() {
    this.stopAllSounds();
  }

  /**
   * Placeholder for potential future logic related to resuming sounds.
   * Currently, `unmute()` handles the necessary state changes for resumption
   * after a mute or stop action.
   *
   * @returns {void} Does not return a value.
   */
  resumeSounds() {
    // Future implementation if complex resume logic is required.
  }
}

export default SoundEffectsManager;
