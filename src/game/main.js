/**
 * @file main.js
 * @description Main entry point for the Phaser game component of Harvest
 *   Horizon. Handles game initialization, configuration, scene management, and
 *   provides utility functions for scene switching and debugging.
 * @module main
 */

import Phaser from 'phaser';
import { Boot } from './scenes/Boot.js';
import { MainMenu } from './scenes/MainMenu.js';
import { NewGame } from './scenes/NewGame.js';
import { Preloader } from './scenes/Preloader.js';

/**
 * Holds the current Phaser Game instance.
 * @type {Phaser.Game | null}
 */
let gameInstance = null;

/**
 * Phaser game configuration object.
 *
 * Defines core settings like renderer type, dimensions, scenes, audio, and
 * input behavior.
 *
 * **Important:** Do not modify this configuration object unless you are certain
 * of the implications. Revert to a previous commit if changes cause issues.
 *
 * @type {Phaser.Types.Core.GameConfig}
 */
const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 1280,
  parent: 'gameContainer',
  backgroundColor: '#000000',
  scene: [Boot, Preloader, MainMenu, NewGame],
  audio: {
    disableWebAudio: false,
  },
  autoFocus: true,
  pauseOnBlur: false,
  pauseOnHide: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: {
    activePointers: 1,
    dragDistanceThreshold: 0,
    dragTimeThreshold: 0,
  },
};

/**
 * Switches the active Phaser scene.
 *
 * Stops all currently active scenes and starts the target scene immediately.
 * Includes debug logging for scene transitions.
 *
 * **Note:** This function currently requires `instantStart` to be true.
 *
 * @param {string} sceneName - The key of the scene to switch to (e.g.,
 *   'MainMenu', 'NewGame').
 * @param {boolean} [instantStart=true] - If true, the scene starts
 *   immediately. Setting this to `false` will throw an error.
 * @throws {Error} If `instantStart` is explicitly set to false, as this mode
 *   is not currently supported.
 */
const switchScene = (sceneName, instantStart = true) => {
  if (!gameInstance?.isRunning || !gameInstance?.scene) {
    console.error(
      'Game instance not found, not running, or scene system not available'
    );
    return;
  }
  if (!instantStart)
    throw new Error(
      `switchScene called for '${sceneName}' with instantStart=false. ` +
      `This function currently requires instantStart=true.`
    );

  const currentActiveScenes = [];
  gameInstance.scene.scenes.forEach((scene) => {
    if (scene.scene.systems.isActive()) {
      currentActiveScenes.push(scene.scene.key);
    }
  });

  console.debug('==== SCENE CHANGE ====');
  console.debug('Current active scenes:', currentActiveScenes);
  console.debug('Switching to scene:', sceneName);

  gameInstance.scene.start(sceneName, { instantStart });

  setTimeout(() => {
    const newActiveScenes = [];
    gameInstance.scene.scenes.forEach((scene) => {
      if (scene.scene.systems.isActive()) {
        newActiveScenes.push(scene.scene.key);
      }
    });
    console.debug('New active scenes after switch:', newActiveScenes);
    console.debug('==== SCENE CHANGE COMPLETE ====');
  }, 100);
};

/**
 * Retrieves and logs information about the current state of Phaser scenes.
 *
 * Categorizes scenes based on their status (active, sleeping, paused) and
 * provides a summary string.
 *
 * @returns {{activeScenes: Array<object>,
 *            sleepingScenes: Array<object>,
 *            pausedScenes: Array<object>,
 *            summary: string}
 *           | {error: string}} An object containing arrays of scene data by
 *             status and a summary string, or an error object if the game
 *             instance is unavailable.
 */
const getActiveSceneInfo = () => {
  if (!gameInstance?.isRunning || !gameInstance.scene) {
    return { error: 'Game instance not found or not running' };
  }

  const sceneInfo = {
    activeScenes: [],
    sleepingScenes: [],
    pausedScenes: [],
  };

  gameInstance.scene.scenes.forEach((scene) => {
    const sceneData = {
      key: scene.scene.key,
      status: scene.scene.systems.status,
      isActive: scene.scene.systems.isActive(),
      isVisible: scene.scene.systems.isVisible(),
      isSleeping: scene.scene.systems.isSleeping(),
    };

    if (sceneData.isActive) {
      sceneInfo.activeScenes.push(sceneData);
    } else if (sceneData.isSleeping) {
      sceneInfo.sleepingScenes.push(sceneData);
    } else if (scene.scene.systems.isPaused()) {
      sceneInfo.pausedScenes.push(sceneData);
    }
  });

  const activeSceneNames = sceneInfo.activeScenes.map((s) => s.key).join(', ');
  sceneInfo.summary = `Active scene(s): ${activeSceneNames || 'None'}`;

  return sceneInfo;
};

/**
 * Initializes and starts the Phaser game instance within a given container
 * element.
 *
 * Configures the game using the predefined `config` object and starts the
 * initial 'Boot' scene. Attaches the game instance to the container element
 * and the global window (`window.phaserGame`).
 *
 * @param {HTMLElement} gameContainer - The DOM element designated to hold the
 *   Phaser canvas.
 * @param {boolean} instantStart - A flag passed to the initial 'Boot' scene's
 *   start method, indicating whether to bypass any preloading or transition
 *   logic within the Boot scene itself.
 * @returns {Phaser.Game | undefined} The created Phaser game instance, or
 *   `undefined` if the provided `gameContainer` element is not found in the
 *   DOM.
 */
const StartGame = (gameContainer, instantStart) => {
  if (!gameContainer) {
    console.error('Game container not found');
    return;
  }

  if (gameInstance) gameInstance = null;
  const game = new Phaser.Game(config);

  game.scene.start('Boot', { instantStart });

  gameInstance = game;

  // Add reference to the Phaser game instance in libControlHandler
  window.phaserGame = game;

  gameContainer.gameInstance = game;

  return game;
};

export default StartGame;
export { switchScene, getActiveSceneInfo };
