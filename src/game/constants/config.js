/**
 * @file config.js
 * @description Game configuration constants. Contains settings like game
 *   dimensions, debug mode, audio levels, UI styles, and physics
 *   configuration.
 *
 * @module game/constants/config
 */

/** Default game width in pixels. Used for canvas setup. */
export const GAME_WIDTH = 800;

/** Default game height in pixels. Used for canvas setup. */
export const GAME_HEIGHT = 600;

/** Debug mode flag. Enables features like physics debugging. */
export const DEBUG_MODE = process.env.NODE_ENV === 'development';

/** Contains default settings for audio levels and playback. */
export const AUDIO = {
  /** Default volume level for background music, range 0 to 1. */
  MUSIC_VOLUME: 0.21,

  /** Default volume level for sound effects, range 0 to 1. */
  SOUND_VOLUME: 0.15,

  /** Default volume level for ambient sounds, range 0 to 1. */
  AMBIENCE_VOLUME: 0.3,

  /** Determines if all audio channels should start muted. */
  START_MUTED: false,
};

/** Defines standard text styles for user interface elements. */
export const UI = {
  /**
   * Text style configuration for the main game title display. Includes font,
   * size, color, stroke, and shadow properties.
   */
  TITLE_FONT: {
    fontFamily: '"Press Start 2P", "Courier New", monospace',
    fontSize: '32px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 6,
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: '#000',
      blur: 2,
      stroke: true,
      fill: true,
    },
  },

  /**
   * Text style configuration for standard UI buttons. Includes font, size,
   * and color properties.
   */
  BUTTON_FONT: {
    fontFamily: '"sans-serif", "Courier New", monospace',
    fontSize: '16px',
    color: '#ffffff',
  },
};

/** General game engine settings, including physics and FPS. */
export const SETTINGS = {
  /** Configuration object for the Phaser physics engine. */
  PHYSICS: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: DEBUG_MODE,
    },
  },

  /** Target frame rate (Frames Per Second) for the game loop. */
  FPS: 60,
};
