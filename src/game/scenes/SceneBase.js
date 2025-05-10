/**
 * @file SceneBase.js
 * @description Provides a base Scene class for Harvest Horizon game scenes,
 *   offering common functionalities like cleanup.
 * @module scenes/SceneBase
 */
import Phaser from 'phaser';

/**
 * @class SceneBase
 * @extends {Phaser.Scene}
 * @description A base class for other Phaser scenes in the game. Provides
 *   common functionality like tween management and standardized cleanup.
 */
export class SceneBase extends Phaser.Scene {
  /**
   * @constructor
   * @param {string} key - The unique key for the scene.
   */
  constructor(key) {
    super(key);
    /**
     * @property {Map<string, Phaser.Tweens.Tween>} activeTweens
     * @description A map to potentially store and manage active tweens within
     *   the scene.
     * @note Current implementation uses a Map, but it's not actively used to
     *   store/manage tweens in the provided methods. Consider using a Set or
     *   revising tween management if this property is intended for tracking.
     */
    this.activeTweens = new Map();
    // Consider if Map is the best structure here.
  }

  /**
   * @method cleanup
   * @description Performs common cleanup tasks for the scene. Currently clears
   *   the `activeTweens` map. Subclasses can override this to add specific
   *   cleanup logic, ensuring they call `super.cleanup()`.
   */
  cleanup() {
    // Clear the map (though it might not hold active tweens currently)
    this.activeTweens.clear();
    // Add other common cleanup logic here if needed
    // (e.g., removing global listeners)
  }

  /**
   * @method shutdown
   * @description Phaser scene lifecycle method called when the scene shuts
   *   down. Ensures `cleanup` is called before the default Phaser shutdown
   *   process.
   */
  shutdown() {
    this.cleanup(); // Call custom cleanup logic
  }
}

