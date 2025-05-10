/**
 * @file PhaserGame.jsx
 * @description React component that integrates the Phaser game engine with the
 *   React application in Harvest Horizon. Handles initialization, cleanup,
 *   and communication between React and Phaser through refs and event
 *   listeners.
 * @module PhaserGame
 */

import { forwardRef, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { EventBus } from './EventBus.js';
import { MainMenu } from './scenes/MainMenu.js';
import { NewGame } from './scenes/NewGame.js';

/**
 * Checks if a Phaser scene object matches an expected scene name (key).
 *
 * @param {Object} scene - The Phaser scene instance or an object with a `name` property.
 * @param {string} expectedName - The expected scene name (key).
 * @returns {boolean} True if the scene's name matches the expected name.
 */
const sceneMatch = (scene, expectedName) => {
  return getNameFromScene(scene) === expectedName;
};

/**
 * Extracts a scene name (key) from a Phaser scene instance.
 *
 * Attempts to use `scene.name` first, then checks specific scene classes.
 *
 * @param {Object} phaserScene - The Phaser scene instance or an object with a `name` property.
 * @returns {string} The determined scene name or 'Unknown Scene'.
 */
export const getNameFromScene = (phaserScene) => {
  if (typeof phaserScene.name === 'string') {
    return phaserScene.name;
  }

  if (phaserScene instanceof MainMenu) return 'MainMenu';

  if (phaserScene instanceof NewGame) return 'NewGame';

  console.warn('No scene found for', phaserScene);
  return 'Unknown Scene';
};

/**
 * React component that wraps and manages the Phaser game instance.
 *
 * @component
 * @param {object} props - Component props.
 * @param {object} props.dimensions - Dimensions for the game (not directly
 *   used currently).
 * @param {React.RefObject} props.refContainer - Ref to the container element
 *   (not directly used currently).
 * @param {React.RefObject} props.refController - Ref to a controller object
 *   (not directly used currently).
 * @param {boolean} props.instantStart - Passed to the game initialization
 *   to potentially skip intros.
 * @param {function(Phaser.Scene, boolean): void} [props.currentActiveScene] -
 *   Callback function triggered when a scene becomes ready.
 * @param {React.Ref} ref - Forwarded ref to access the Phaser game instance
 *   and current scene.
 * @returns {React.ReactElement} The div container for the Phaser game canvas.
 */
export const PhaserGame = forwardRef(function PhaserGame(
  {
    dimensions: _dimensions,
    refContainer: _refContainer,
    refController: _refController,
    instantStart: _instantStart,
    currentActiveScene,
  },
  ref
) {
  /**
   * @property {React.RefObject<HTMLDivElement>} containerRef
   * Reference to the container div element.
   */
  const containerRef = useRef(null);

  // Effect for handling scene changes
  useEffect(() => {
    /**
     * EventBus listener for 'current-scene-ready' event.
     *
     * Updates the forwarded ref and calls the `currentActiveScene` prop
     * callback.
     *
     * @param {Phaser.Scene} currentScene - The scene instance that just became
     *   ready.
     * @param {boolean} [quickLoaded=false] - Flag indicating if the scene was
     *   quick-loaded (specific use case).
     */
    const currentSceneListener = (currentScene, quickLoaded = false) => {
      if (quickLoaded && !sceneMatch(currentScene, 'NewGame')) return;

      if (currentActiveScene instanceof Function)
        currentActiveScene(currentScene);

      if (ref.current) ref.current.scene = currentScene;
    };

    EventBus.on('current-scene-ready', currentSceneListener);
    return () => {
      EventBus.removeListener('current-scene-ready', currentSceneListener);
    };
  }, [currentActiveScene, ref]);

  return <div id="gameContainer" ref={containerRef}></div>;
});

PhaserGame.propTypes = {
  dimensions: PropTypes.object.isRequired,
  refContainer: PropTypes.object.isRequired,
  refController: PropTypes.object.isRequired,
  instantStart: PropTypes.bool.isRequired,
  currentActiveScene: PropTypes.func,
};
