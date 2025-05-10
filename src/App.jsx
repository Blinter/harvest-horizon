/**
 * @file App.jsx
 * @module App
 * @description Root React component for the Harvest Horizon application.
 *   Sets up routing, lazy loads main components (Game, Controls), manages
 *   layout refs, and includes top-level error boundaries.
 */
import React, { useRef, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PropTypes from 'prop-types';
import './styles/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import ErrorBoundary from './components/errorBoundary/ErrorBoundary.jsx';
import { handleError } from './utils/errorHandler.js';
import { EventBus } from './game/EventBus.js';

/**
 * Lazy-loaded Game component.
 * @see {@link module:Game}
 */
const Game = React.lazy(() => import('./components/main/Game.jsx'));

/**
 * Lazy-loaded MainMenuControls component.
 * @see {@link module:MainMenuControls}
 */
const MainMenuControls = React.lazy(
  () => import('./components/controls/MainMenuControls.jsx')
);

/**
 * @component CustomLoader
 * @description A React component that displays a loading indicator styled
 *              similarly to the Phaser Preloader scene.
 *              It is intended for use during suspense fallbacks.
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
        height: '100%', // Fallback loader should cover full screen
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(to bottom, #000033, #000088)',
        zIndex: 2000, // Ensure it's on top of other content during load
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
        Loading...
      </p>
      <div
        style={{
          width: '240px',
          height: '50px',
          backgroundColor: 'rgba(34, 34, 34, 0.8)',
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        <div
          className="custom-loader-bar" // Uses animation from App.css
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

/**
 * Simple loading indicator component displayed during lazy loading.
 *
 * @component
 * @returns {React.ReactElement} A div containing a spinner and text.
 */
const LoadingFallback = () => <CustomLoader />;

/**
 * Fallback component displayed by ErrorBoundary when a route fails to load
 * or renders with an error.
 *
 * @component
 * @param {object} props - Component props.
 * @param {Error} [props.error] - The error object caught by the ErrorBoundary.
 *   Useful for displaying debug information in non-production environments.
 * @returns {React.ReactElement} A div containing an error message and a reload
 *   button.
 */
const RouteFallback = ({ error }) => (
  <div className="error-container">
    <h2>Oops! Something went wrong.</h2>
    <p>We encountered an error while loading this page.</p>
    {process.env.NODE_ENV !== 'production' && error && (
      <details>
        <summary>Error details</summary>
        <pre>{error.message}</pre>
      </details>
    )}
    <button onClick={() => window.location.reload()} className="reload-button">
      Reload page
    </button>
  </div>
);

RouteFallback.propTypes = {
  error: PropTypes.instanceOf(Error),
};

/**
 * Defines the expected properties for the App component.
 *
 * @typedef {object} AppProps
 * @property {object} dimensions - Container dimensions for the game.
 * @property {number} dimensions.width - Width of the game container in
 *   pixels.
 * @property {number} dimensions.height - Height of the game container in
 *   pixels.
 */

/**
 * The main application component.
 *
 * Manages refs for game container and controls, sets up routing using React
 * Router, lazy loads components with Suspense, and wraps routes with
 * ErrorBoundaries. Handles initial user interaction for audio context setup
 * and listens for map changes via the EventBus.
 *
 * @component
 * @param {AppProps} props - Component props containing dimensions.
 * @returns {React.ReactElement} The root application structure with routes.
 */
function App({ dimensions }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const audioInitRequested = useRef(false);
  const [currentMapId, setCurrentMapId] = React.useState(null);

  React.useEffect(() => {
    // Add global listeners for the first interaction
    const performFirstInteraction = (event) => {
      // Check if it's a relevant keyboard event or any click
      if (
        event.type === 'click' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        handleFirstInteraction();
      }
    };

    document.addEventListener('click', performFirstInteraction);
    document.addEventListener('keydown', performFirstInteraction);

    // --- EventBus Listener for Map ID --- //
    const handleMapLoaded = (mapId) => {
      setCurrentMapId(mapId);
    };

    EventBus.on('game-map-loaded', handleMapLoaded);
    // --- End Listener --- //

    return () => {
      // Clean up global listeners
      document.removeEventListener('click', performFirstInteraction);
      document.removeEventListener('keydown', performFirstInteraction);

      // --- EventBus Cleanup --- //
      EventBus.off('game-map-loaded', handleMapLoaded);
      // --- End Cleanup --- //
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount

  const handleRouteError = (error) => {
    handleError(error, {
      context: 'App.Route',
      onError: (err) => {
        const timestamp = new Date().toISOString();
        console.error(
          `[${timestamp}] [ERROR] [App] Route error: ${err.message}`
        );
      },
    });
  };

  /**
   * Handles the first user interaction (click or relevant keydown) within
   * the app. Emits a 'requestAudioInit' event via the EventBus exactly once
   * to allow audio context initialization, typically required by browsers
   * before audio playback can begin.
   */
  const handleFirstInteraction = () => {
    if (!audioInitRequested.current) {
      EventBus.emit('requestAudioInit');
      audioInitRequested.current = true;
    }
  };

  return (
    <div
      ref={containerRef}
      className="app-container"
      style={{ backgroundColor: '#000000' }}
    >
      <ErrorBoundary
        fallback={RouteFallback}
        onError={handleRouteError}
        name="AppRoutes"
      >
        <Routes>
          <Route
            path="/"
            element={
              <ErrorBoundary name="HomePage">
                <Suspense fallback={<LoadingFallback />}>
                  <Game
                    dimensions={dimensions}
                    refContainer={containerRef}
                    refController={controllerRef}
                    instantStart={false}
                  />
                  <MainMenuControls
                    dimensions={dimensions}
                    refContainer={containerRef}
                    refController={controllerRef}
                    instantStart={false}
                    mapId={currentMapId}
                  />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="/play"
            element={
              <ErrorBoundary name="PlayPage">
                <Suspense fallback={<LoadingFallback />}>
                  <Game
                    dimensions={dimensions}
                    refContainer={containerRef}
                    refController={controllerRef}
                    instantStart={true}
                  />
                  <MainMenuControls
                    dimensions={dimensions}
                    refContainer={containerRef}
                    refController={controllerRef}
                    instantStart={true}
                    mapId={currentMapId}
                  />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<p>Not Found!</p>} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

/**
 * PropTypes definition for the App component. Validates the structure of
 * the `dimensions` prop.
 */
App.propTypes = {
  /**
   * Container dimensions required for sizing the game and potentially
   * controls.
   */
  dimensions: PropTypes.shape({
    /**
     * The required width of the game container in pixels.
     */
    width: PropTypes.number.isRequired,
    /**
     * The required height of the game container in pixels.
     */
    height: PropTypes.number.isRequired,
  }).isRequired,
};

/**
 * Named export of the App component. Useful for testing or scenarios
 * requiring specific imports rather than the default export.
 * @type {React.FunctionComponent<AppProps>}
 */
export { App as AppComponent };

export default App;
