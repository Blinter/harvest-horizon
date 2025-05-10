/**
 * @file PhaserGame.jsx
 * @description React component integrating a Phaser 3 game instance. Handles
 *   initialization, configuration, and cleanup.
 * @module components/game/PhaserGame
 */
import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Phaser from 'phaser';

/**
 * Embeds and manages a Phaser 3 game instance.
 *
 * Initializes the game with dimensions, scenes, and configuration. Handles
 * game instance creation and destruction.
 *
 * @param {object} props - Component props.
 * @param {number} props.width - Game canvas width.
 * @param {number} props.height - Game canvas height.
 * @param {Phaser.Types.Scenes.SceneType[]} [props.scenes=[]] - Optional array
 *   of scene classes/configs to add to the game. Defaults to empty.
 * @param {Phaser.Types.Core.GameConfig} [props.gameConfig={}] - Additional
 *   Phaser config options to merge with defaults. Defaults to empty.
 * @returns {React.ReactElement} A div element that will contain the Phaser
 *   game canvas.
 */
const PhaserGame = ({ width, height, scenes = [], gameConfig = {} }) => {
  /**
   * @ref {React.RefObject<HTMLDivElement>} Ref attached to the container div
   *   element where the Phaser canvas will be rendered.
   */
  const gameContainerRef = useRef(null);
  /**
   * @ref {React.RefObject<Phaser.Game | null>} Ref holding the active Phaser
   *   game instance, or null if not initialized or destroyed.
   */
  const gameInstanceRef = useRef(null);

  useEffect(() => {
    if (!gameContainerRef.current) {
      const timestamp = new Date().toISOString();
      console.warn(
        `[${timestamp}] [WARN] [PhaserGame] Game container ref is not available`
      );
      return;
    }

    const defaultConfig = {
      type: Phaser.AUTO,
      parent: gameContainerRef.current,
      width,
      height,
      backgroundColor: '#ADD8E6', // lightblue
      scene: scenes,
      audio: {
        disableWebAudio: false,
      },
      autoFocus: true,
      pauseOnBlur: false,
      pauseOnHide: false,
      render: {
        pixelArt: true,
        antialias: false,
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      log: {
        showBanner: true,
        level: Phaser.Core.Scale.LOG_DEBUG,
      },
    };

    const finalConfig = { ...defaultConfig, ...gameConfig };

    try {
      gameInstanceRef.current = new Phaser.Game(finalConfig);
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(
        `[${timestamp}] [ERROR] [PhaserGame] Failed to initialize Phaser ` +
        `game: ${error.message}`
      );
    }

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, [width, height, scenes, gameConfig]);

  return (
    <div
      ref={gameContainerRef}
      className="gameContainer"
      data-testid="gameContainer"
    />
  );
};

PhaserGame.propTypes = {
  /** Required: Game canvas width in pixels. */
  width: PropTypes.number.isRequired,

  /** Required: Game canvas height in pixels. */
  height: PropTypes.number.isRequired,

  /** Optional: Array of scene classes or scene configuration objects to
   *  add to the Phaser game instance upon initialization. */
  scenes: PropTypes.array,

  /** Optional: Additional Phaser game configuration options. These will be
   *  merged with the default configuration. */
  gameConfig: PropTypes.object,
};

export default PhaserGame;
