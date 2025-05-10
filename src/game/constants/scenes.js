/**
 * @file scenes.js
 * @description Defines constant keys representing the different scenes
 *   used throughout the Phaser game instance. These keys ensure
 *   consistent referencing of scenes when starting or switching
 *   between them.
 * @module game/constants/scenes
 */

/**
 * Key for the Boot scene. This scene is responsible for the
 * earliest game initialization steps before assets are loaded.
 */
export const BOOT = 'Boot';

/**
 * Key for the Preloader scene. Handles the loading bar and queuing
 * of all necessary game assets (images, audio, data).
 */
export const PRELOADER = 'Preloader';

/**
 * Key for the Main Menu scene. Displays the game title, start options,
 * settings access, etc., after assets are loaded.
 */
export const MAIN_MENU = 'MainMenu';

/**
 * Key for the New Game scene. This is the primary scene where
 * core gameplay mechanics take place.
 */
export const NEW_GAME = 'NewGame';

/**
 * Key for the Game Over scene. Displayed to the player upon
 * reaching a game failure condition.
 */
export const GAME_OVER = 'GameOver';

/**
 * Key for the Settings scene. Allows players to adjust game
 * configurations like volume, controls, etc.
 */
export const SETTINGS = 'Settings';
