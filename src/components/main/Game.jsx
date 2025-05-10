import { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { EventBus } from '../../game/EventBus';
import usePhaserErrorHandling from '../../hooks/usePhaserErrorHandling';
import { withErrorBoundary } from '../errorBoundary/ErrorBoundary';
import '../../styles/App.css';

import StartGame from '../../game/main';

/**
 * Fallback component for fatal Game errors.
 *
 * @param {object} props - Component props.
 * @param {Error} [props.error] - The error object.
 * @returns {React.ReactElement} The fallback UI.
 */
const GameErrorFallback = ({ error }) => {
  const timestamp = new Date().toISOString();
  console.error(
    `[${timestamp}] [ERROR] [GameErrorFallback] Fatal game error: ` +
    `${error?.message || 'Unknown error'}`
  );
  if (error?.stack) {
    console.error(
      `[${timestamp}] [ERROR] [GameErrorFallback] Stack trace:`,
      error.stack
    );
  }

  return (
    <div className="game-error-fallback">
      <h3>Game Error</h3>
      <p>
        There was a problem loading the game:{' '}
        {error?.message || 'Unknown error'}
      </p>
      <p>Please try refreshing the page or use a different browser.</p>
      <button
        onClick={() => window.location.reload()}
        className="reload-button"
      >
        Reload Game
      </button>
    </div>
  );
};

GameErrorFallback.propTypes = {
  /** The error object passed from the ErrorBoundary. */
  error: PropTypes.instanceOf(Error),
};

/**
 * Manages the Phaser game lifecycle and container. Handles initialization,
 * destruction, error handling, and communication with the Phaser instance.
 *
 * @param {object} props - Component props.
 * @param {object} props.dimensions - Game dimensions {width, height}.
 * @param {React.RefObject} props.refContainer - Ref to expose the game
 *   instance and primary scene to parent components.
 * @param {React.RefObject} props.refController - Unused ref, kept for API
 *   consistency.
 * @param {boolean} [props.instantStart=false] - If true, the game attempts
 *   to initialize immediately on mount after a brief loading period, rather
 *   than waiting for an explicit start event.
 * @returns {React.ReactElement} A container div for the Phaser game, a
 *   loading indicator, or an error fallback UI.
 */
function Game({
  dimensions,
  refContainer,
  refController: _refController,
  instantStart,
}) {
  const [gameStarted, setGameStarted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(false);
  const [gameError, setGameError] = useState(null);
  const directContainerRef = useRef(null);
  const [gameInstance, setGameInstance] = useState(null);
  const gameInitializedRef = useRef(false);

  const _createPhaserInstance = (containerElement, timestamp) => {
    try {
      const gameInst = StartGame(containerElement, instantStart);

      if (gameInst) {
        setGameInstance(gameInst);
        setGameStarted(true);
        gameInitializedRef.current = true;

        if (refContainer) {
          refContainer.current = {
            game: gameInst,
            scene: null,
          };
        }

        window.HarvestHorizonGame = gameInst;
      } else {
        const error = new Error('Game initialization failed');
        console.error(`[${timestamp}] [ERROR] [Game] ${error.message}`);
        setGameError(error);
      }
    } catch (err) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [ERROR] [Game] Failed to initialize game: ` +
        `${err.message}`
      );
      if (err.stack) {
        console.error(
          `[${errorTimestamp}] [ERROR] [Game] Stack trace:`,
          err.stack
        );
      }
      setGameError(err);
    }
  };

  usePhaserErrorHandling({
    onError: (error) => {
      const timestamp = new Date().toISOString();
      console.warn(
        `[${timestamp}] [WARN] [Game] Phaser error: ${error.message}`
      );
      if (error.stack) {
        console.warn(`[${timestamp}] [WARN] [Game] Stack trace:`, error.stack);
      }
    },
    onUnrecoverableError: (error) => {
      const timestamp = new Date().toISOString();
      console.error(
        `[${timestamp}] [ERROR] [Game] Fatal game error: ${error.message}`
      );
      if (error.stack) {
        console.error(
          `[${timestamp}] [ERROR] [Game] Stack trace:`,
          error.stack
        );
      }
      setGameError(error);
    },
  });

  /**
   * Initializes the Phaser game instance.
   * If the game instance exists, destroys it first.
   * Waits briefly before creating the new instance to ensure DOM updates.
   * Handles potential errors during container lookup or game creation.
   *
   * @type {Function}
   * @param {object} [_config={}] - Optional configuration object (currently
   *   unused).
   */
  const initializeGame = useCallback(
    (_config = {}) => {
      if (!mountedRef.current || gameInitializedRef.current) {
        return;
      }

      if (gameInstance) {
        gameInstance.destroy(true, true);
        setGameInstance(null);
      }

      const timestamp = new Date().toISOString();

      setTimeout(() => {
        if (directContainerRef.current) {
          directContainerRef.current.id = 'gameContainer';
          const containerElement = document.getElementById('gameContainer');

          if (containerElement) {
            _createPhaserInstance(containerElement, timestamp);
          } else {
            const error = new Error('Container element not found');
            console.error(`[${timestamp}] [ERROR] [Game] ${error.message}`);
            setGameError(error);
          }
        } else {
          const error = new Error('Container reference is null');
          console.error(`[${timestamp}] [ERROR] [Game] ${error.message}`);
          setGameError(error);
        }
      }, 100);
    },
    [
      gameInstance,
      instantStart,
      refContainer,
      directContainerRef,
      mountedRef,
      gameInitializedRef,
      setGameInstance,
      setGameStarted,
    ]
  );

  /**
   * Destroys the current Phaser game instance if it exists and cleans up
   * associated resources, including WebGL context if possible. Sets the game
   * state to not started. Prevents execution if the component is not mounted.
   *
   * @type {Function}
   */
  const stopGame = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (gameInstance) {
      gameInstance.destroy(true, true);
      setGameInstance(null);
      gameInitializedRef.current = false;

      const canvas = document.querySelector('#gameContainer canvas');
      if (canvas) {
        const gl =
          canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const loseContextExt = gl.getExtension('WEBGL_lose_context');
          if (loseContextExt) {
            loseContextExt.loseContext();
          }
        }
      }
    }

    setGameStarted(false);
  }, [
    gameInstance,
    mountedRef,
    gameInitializedRef,
    setGameInstance,
    setGameStarted,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    const loadingTimer = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(loadingTimer);
      stopGame();
    };
  }, [stopGame]);

  useEffect(() => {
    if (!mountedRef.current || isLoading) {
      return;
    }

    if (!gameInstance && !gameInitializedRef.current) {
      initializeGame();
    }

    const handleGameStart = (config) => {
      stopGame();
      setTimeout(() => initializeGame(config), 100);
    };

    const handleGameStop = () => {
      stopGame();
    };

    const startUnsubscribe = EventBus.on('game:start', handleGameStart);
    const stopUnsubscribe = EventBus.on('game:stop', handleGameStop);

    return () => {
      startUnsubscribe();
      stopUnsubscribe();
    };
  }, [
    isLoading,
    initializeGame,
    stopGame,
    mountedRef,
    gameInstance,
    gameInitializedRef,
  ]);

  useEffect(() => {
    if (gameStarted && mountedRef.current && gameInstance) {
      EventBus.emit('game:resize', dimensions);
    }
  }, [dimensions, gameStarted, gameInstance, mountedRef]);

  useEffect(() => {
    if (
      !isLoading &&
      instantStart &&
      !gameStarted &&
      !gameInstance &&
      mountedRef.current &&
      !gameInitializedRef.current
    ) {
      initializeGame();
    }
  }, [
    isLoading,
    instantStart,
    gameStarted,
    gameInstance,
    initializeGame,
    mountedRef,
    gameInitializedRef,
  ]);

  if (gameError) {
    return <GameErrorFallback error={gameError} />;
  }

  return (
    <div id="app">
      {isLoading && <CustomLoader />}

      <div
        ref={directContainerRef}
        id="gameContainer"
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          position: 'static',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

Game.propTypes = {
  /**
   * An object specifying the desired width and height of the game canvas.
   * This influences the Phaser game configuration.
   */
  dimensions: PropTypes.shape({
    /** The desired width in pixels. */
    width: PropTypes.number.isRequired,
    /** The desired height in pixels. */
    height: PropTypes.number.isRequired,
  }).isRequired,
  /**
   * A React ref object that will be populated with references to the Phaser
   * game instance and its main scene once the game is initialized.
   */
  refContainer: PropTypes.object.isRequired,
  /**
   * A React ref object, currently unused but maintained for potential future
   * use or API consistency.
   */
  refController: PropTypes.object.isRequired, // Keeping refController required
  /**
   * If true, the game will attempt to initialize automatically shortly
   * after the component mounts, without waiting for a 'game:start' event.
   */
  instantStart: PropTypes.bool,
};

Game.defaultProps = {
  instantStart: false,
};

/**
 * @component CustomLoader
 * @description A React component that displays a loading indicator styled
 *              similarly to the Phaser Preloader scene.
 * @returns {React.ReactElement} The custom loader UI.
 */
const CustomLoader = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '50%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(to bottom, #000033, #000088)',
        zIndex: 1000, // Ensure it's on top
      }}
    >
      <p
        style={{
          color: '#ffffff',
          fontSize: '48px',
          fontFamily: 'Arial, Helvetica, sans-serif',
          marginBottom: '30px',
        }}
      >
        Initializing...
      </p>
      <div
        style={{
          width: '240px',
          height: '50px',
          backgroundColor: 'rgba(34, 34, 34, 0.8)', // #222222 with 0.8 alpha
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        <div
          className="custom-loader-bar"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '3px',
          }}
        />
      </div>
    </div>
  );
};

export default withErrorBoundary(Game, {
  fallback: GameErrorFallback,
  name: 'Game',
});
