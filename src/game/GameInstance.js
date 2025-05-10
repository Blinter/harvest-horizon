/**
 * @file GameInstance.js
 * @description Utility functions for accessing the global Phaser game instance
 *   and managing scenes in the Harvest Horizon game. Provides methods to
 *   retrieve the game instance, assumed to be attached as `gameInstance` to
 *   the DOM element with ID 'gameContainer'.
 * @module GameInstance
 */

import { switchScene } from './main.js';

/**
 * Attempts to retrieve the active Phaser game instance from the DOM.
 *
 * Assumes the instance is stored on the element with ID 'gameContainer'. It
 * checks for the existence of the container before attempting to access the
 * `gameInstance` property.
 *
 * @returns {Phaser.Game | null} The Phaser game instance if found and
 *   accessible, otherwise logs a warning and returns null.
 */
const getGameInstance = () => {
  const gameContainer = document.getElementById('gameContainer');
  if (!gameContainer) {
    console.warn('Game container not found');
    return null;
  }
  return gameContainer.gameInstance;
};

/**
 * Attempts to retrieve the game instance associated with a given container
 * element.
 *
 * Note: This function primarily calls `getGameInstance` and does not perform
 * initialization. Its name might be misleading.
 *
 * @param {HTMLElement | null} gameContainer - The container DOM element. If
 *   null, a warning is logged. Although passed, this parameter is not directly
 *   used to locate the instance within this function; `getGameInstance` handles
 *   locating it via the DOM ID 'gameContainer'.
 * @returns {Phaser.Game | null} The Phaser game instance if found, otherwise
 *   logs an error or warning and returns null.
 * @deprecated Consider using `getGameInstance` directly as this function's
 *   name can be confusing and it doesn't add significant value over calling
 *   `getGameInstance`.
 */
const initializeGame = (gameContainer) => {
  if (!gameContainer) {
    console.warn('Game container reference not provided to initializeGame');
    return null;
  }

  const gameInstance = getGameInstance();
  if (!gameInstance) {
    console.error('Game instance not found');
    return null;
  }

  return gameInstance;
};

/**
 * Re-exports utility functions related to retrieving the game instance and
 * switching scenes. This provides a central access point for these core
 * game management utilities.
 */
export { getGameInstance, initializeGame, switchScene };
