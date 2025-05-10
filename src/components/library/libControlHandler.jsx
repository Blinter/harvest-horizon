/**
 * @file libControlHandler.jsx
 * @description Provides event handlers for game controls via the EventBus.
 *   Contains functions for handling movement, game lifecycle events (start,
 *   stop, menu navigation), and audio playback controls (music, sounds,
 *   ambience). These functions emit specific events that are listened to by
 *   other components or game scenes to trigger corresponding actions.
 * @module components/library/libControlHandler
 */
import { EventBus } from '../../game/EventBus';
import * as SCENES from '../../game/constants/scenes'; // Import scene keys

/**
 * Handles movement input ('up', 'down', 'left', 'right') and emits a
 * corresponding event via EventBus (e.g., 'move-up'). Logs an error if an
 * unrecognized direction is provided.
 *
 * @param {'up'|'down'|'left'|'right'} direction - The intended direction of
 *   movement.
 * @emits move-up
 * @emits move-down
 * @emits move-left
 * @emits move-right
 */
const handleMove = (direction) => {
  if (!['up', 'down', 'left', 'right'].includes(direction)) {
    console.error(
      `[${new Date().toISOString()}] [ERROR]: Unknown move direction`,
      { direction }
    );
    return;
  }
  EventBus.emit(`move-${direction}`);
};

/**
 * Emits the 'start-game' event via EventBus to signal the initiation of the
 * main game scene. Optionally accepts map and character IDs to load specific
 * configurations.
 *
 * @param {object} options - Configuration options for starting the game.
 * @param {string} [options.mapId] - Optional ID of the map to load.
 * @param {string} [options.characterId] - Optional ID of the character to use.
 * @emits start-game
 */
const startGame = ({ mapId, characterId }) => {
  EventBus.emit('start-game', { mapId, characterId });
};

/**
 * Emits the 'start-menu' event via EventBus, typically instructing the game
 * manager or scene controller to transition to the main menu scene.
 *
 * @emits start-menu
 */
const startMenu = () => {
  EventBus.emit('start-menu');
};

/**
 * Attempts to stop the currently active game scene (`SCENES.NEW_GAME`) and
 * start the main menu scene (`SCENES.MAIN_MENU`). Accesses the global Phaser
 * game instance (`window.phaserGame`). Logs warnings or errors if the game
 * instance or the target scene is not found or active. The 'stop-game' event
 * emission is handled within the `NewGame.js` scene's shutdown method itself.
 *
 * @emits stop-game - (Note: Emitted by NewGame.js shutdown, not directly here)
 */
const stopGame = () => {
  const game = window.phaserGame; // Access the global Phaser game instance
  if (game?.scene.isActive(SCENES.NEW_GAME)) {
    // Stop the current game scene
    game.scene.stop(SCENES.NEW_GAME);
    // The 'stop-game' event will now be emitted by NewGame.js's shutdown method

    // Directly start the MainMenu scene
    game.scene.start(SCENES.MAIN_MENU);
  } else {
    console.warn(
      `[${new Date().toISOString()}] [WARN] [libControlHandler]: ` +
      `Could not stop game - Phaser game instance not found or ` +
      `${SCENES.NEW_GAME} not active.`
    );
    // If the game or scene wasn't active, 
    // attempt to start MainMenu as a fallback
    if (game) {
      game.scene.start(SCENES.MAIN_MENU);
    } else {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [libControlHandler]: ` +
        `Phaser game instance not available for fallback scene start.`
      );
    }
  }
};

/**
 * Emits the 'playTestSound' event via EventBus, usually instructing the
 * AudioManager to play a predefined sound identified by the key 'testSound'.
 * Primarily used for debugging or testing audio playback functionality.
 *
 * @emits playTestSound
 */
const playTestSound = () => {
  EventBus.emit('playTestSound', 'testSound');
};

/**
 * Emits the 'stopSounds' event via EventBus, instructing the AudioManager to
 * halt all currently playing sound effects, excluding music and ambience.
 *
 * @emits stopSounds
 */
const stopSounds = () => {
  EventBus.emit('stopSounds');
};

/**
 * Emits the 'stopMusic' event via EventBus, instructing the AudioManager to
 * stop the currently playing background music track.
 *
 * @emits stopMusic
 */
const stopMusic = () => {
  EventBus.emit('stopMusic');
};

/**
 * Emits the 'stopAmbience' event via EventBus, instructing the AudioManager
 * to stop the currently playing ambient sound track.
 *
 * @emits stopAmbience
 */
const stopAmbience = () => {
  EventBus.emit('stopAmbience');
};

/**
 * Emits the 'playSounds' event via EventBus. This typically signals the
 * AudioManager to resume playing sound effects if they were previously
 * stopped or muted, or potentially to start default sounds if none were
 * playing. The specific behavior depends on the AudioManager's implementation.
 *
 * @emits playSounds
 */
const playSounds = () => {
  EventBus.emit('playSounds');
};

/**
 * Emits the 'playMusic' event via EventBus, instructing the AudioManager to
 * start or resume playing the background music track for the current context
 * (e.g., scene, game state).
 *
 * @emits playMusic
 */
const playMusic = () => {
  EventBus.emit('playMusic');
};

/**
 * Emits the 'playAmbience' event via EventBus, instructing the AudioManager
 * to start or resume playing the ambient sound track appropriate for the
 * current context.
 *
 * @emits playAmbience
 */
const playAmbience = () => {
  EventBus.emit('playAmbience');
};

export {
  handleMove,
  startGame,
  startMenu,
  stopGame,
  playTestSound,
  stopMusic,
  stopSounds,
  playMusic,
  playSounds,
  playAmbience,
  stopAmbience,
};
