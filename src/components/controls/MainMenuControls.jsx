/**
 * @file MainMenuControls.jsx
 * @description Main menu interface for Harvest Horizon. Manages game state,
 *   audio, authentication, scene switching, and character interactions.
 * @module components/controls/MainMenuControls
 */
import PropTypes from 'prop-types';
import { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react';
import { Button, Input, Form, FormGroup, Label, Row, Col } from 'reactstrap';
import Login from '../auth/Login';
import SignUp from '../auth/SignUp';
import AudioControlPanel from './AudioControlPanel';
import { useUser } from '../context/UserProvider';
import CharacterMenu from '../character/CharacterMenu';
import {
  getCharacters,
  updateCharacterNickname,
  createCharacter,
  setFavoriteCharacter,
  deleteCharacter,
} from '../../api/characterApi';

import { addDividerContainer } from '../library/libControls';

import { startGame, stopGame } from '../library/libControlHandler.jsx';
import GameControls from './GameControls';
import { EventBus } from '../../game/EventBus.js';
import { quickStartGame } from '../../api/quickStartApi';
import { useResizeControl } from '../../context/ResizeControlContext'; // Import context

import CustomLoader from '../main/Game';

/**
 * Renders the character selection and management section.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.isAuthenticated - User authentication status.
 * @param {boolean} props.showCharacterMenu - Visibility of the character
 *   menu.
 * @param {Function} props.toggleCharFilters - Toggles filter visibility.
 * @param {boolean} props.showCharFilters - Visibility of character filters.
 * @param {string} props.charSearchTerm - Current search term for names.
 * @param {Function} props.setCharSearchTerm - Updates the search term state.
 * @param {string} props.charFilterFavorite - Current favorite filter ('all',
 *   'true', 'false').
 * @param {Function} props.setCharFilterFavorite - Updates the favorite
 *   filter state.
 * @param {Function} props.toggleCharSortOrder - Toggles the sort direction.
 * @param {string} props.charSortKey - Key used for sorting ('name', etc.).
 * @param {string} props.charSortOrder - Sort direction ('asc', 'desc').
 * @param {Function} props.resetCharFilters - Resets filters and sorting.
 * @param {boolean} props.charactersLoading - Indicates if characters are
 *   loading.
 * @param {string|null} props.charactersError - Error message for character
 *   loading.
 * @param {Array<object>|null} props.filteredSortedCharacters - Characters
 *   to display.
 * @param {Function} props.handleButtonClick - Handles generic button clicks.
 * @param {Function} props.handleSaveNickname - Handles saving a new nickname.
 * @param {Function} props.handleCreateCharacter - Handles character creation.
 * @param {Function} props.handleDeleteCharacter - Handles character deletion.
 * @param {Function} props.fetchCharacters - Function to fetch characters.
 * @param {Function} props.handleSetFavorite - Handles setting a character
 *   as favorite.
 * @param {string|null} props.renameError - Error message for nickname rename
 *   conflicts.
 * @param {Function} props.clearRenameError - Clears the rename error state.
 * @param {Function} props.handlePlayMap - Starts the game with a specific
 *   character/map.
 * @param {Function} props.onCharacterMapFavoriteStatusChanged - Callback when
 *   a character's map favorite status changes.
 * @param {Function} props.onMapDeleted - Callback when a map is deleted.
 * @returns {React.ReactElement|null} The character section UI or null.
 */
const CharacterSectionDisplay = memo(
  ({
    isAuthenticated,
    showCharacterMenu,
    toggleCharFilters,
    showCharFilters,
    charSearchTerm,
    setCharSearchTerm,
    charFilterFavorite,
    setCharFilterFavorite,
    toggleCharSortOrder,
    charSortKey,
    charSortOrder,
    resetCharFilters,
    charactersLoading,
    charactersError,
    filteredSortedCharacters,
    handleButtonClick,
    handleSaveNickname,
    handleCreateCharacter,
    handleDeleteCharacter,
    fetchCharacters,
    handleSetFavorite,
    renameError,
    clearRenameError,
    handlePlayMap,
    onCharacterMapFavoriteStatusChanged,
    onMapDeleted,
  }) => {
    if (!isAuthenticated || !showCharacterMenu) {
      return null;
    }

    return (
      <>
        {addDividerContainer('Characters')}

        {/* Toggle Button for Filters */}
        <div style={{ marginBottom: '10px', textAlign: 'center' }}>
          <Button
            color={charSearchTerm.length > 0 || charFilterFavorite !== 'all' ? 'warning' : 'secondary'}
            size="sm"
            onClick={toggleCharFilters}
            title={showCharFilters ? 'Hide Filters' : 'Show Filters'}
          >
            {showCharFilters ? 'Hide' : 'Show'} Filters {charSearchTerm.length > 0 || charFilterFavorite !== 'all' ? '(Active)' : ''}
          </Button>
        </div>

        {/* Filter Controls (Conditionally Rendered) */}
        {showCharFilters && (
          <Form
            className="mb-3 p-2 border rounded bg-white"
            onSubmit={(e) => e.preventDefault()}
          >
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label for="charSearch" hidden>
                    Search Name
                  </Label>
                  <Input
                    type="search"
                    id="charSearch"
                    placeholder="Search by Name..."
                    bsSize="sm"
                    value={charSearchTerm}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCharSearchTerm(newValue);
                    }}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label for="charFavoriteFilter" hidden>
                    Filter by Favorite
                  </Label>
                  <Input
                    type="select"
                    id="charFavoriteFilter"
                    bsSize="sm"
                    value={charFilterFavorite}
                    onChange={(e) => setCharFilterFavorite(e.target.value)}
                    title="Filter by Favorite Status"
                  >
                    <option value="all">All Characters</option>
                    <option value="true">Favorites Only</option>
                    <option value="false">Non-Favorites Only</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col
                className="d-flex justify-content-end"
                style={{ gap: '5px' }}
              >
                {/* Add Sort Key Selection if needed later */}
                <Button
                  color="info"
                  size="sm"
                  onClick={toggleCharSortOrder}
                  title={`Sort by ${charSortKey} (${charSortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
                >
                  Sort {charSortOrder === 'asc' ? '▲' : '▼'}
                </Button>
                <Button
                  color="danger"
                  size="sm"
                  onClick={resetCharFilters}
                  title="Reset Filters & Sort"
                >
                  Reset
                </Button>
              </Col>
            </Row>
          </Form>
        )}

        {/* Loading Indicator */}
        {charactersLoading && (
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            Loading characters...
          </div>
        )}

        {/* Character List - Wrapped in a div for width control */}
        <div style={{ width: '80%' }}>
          <CharacterMenu
            // Always pass characters, even if potentially stale during loading
            // Ensure array if null/undefined
            characters={filteredSortedCharacters || []}
            onClose={() => handleButtonClick('hideCharacters')}
            onSaveNickname={handleSaveNickname}
            onCreateCharacter={handleCreateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            // Pass fetchCharacters with force=true
            onRefreshCharacters={() => fetchCharacters(true)}
            onSetFavorite={handleSetFavorite}
            // Pass the error state down to CharacterMenu (though it might not
            // display it directly)
            error={charactersError}
            renameError={renameError}
            clearRenameError={clearRenameError}
            onPlayMap={handlePlayMap}
            onCharacterMapFavoriteStatusChanged={
              onCharacterMapFavoriteStatusChanged
            }
            onMapDeleted={onMapDeleted}
          />
        </div>

        {/* Error message displayed AFTER the character list */}
        {charactersError && (
          <div style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>
            Error: {charactersError}
          </div>
        )}
      </>
    );
  }
);

// Add displayName for better debugging
CharacterSectionDisplay.displayName = 'CharacterSectionDisplay';

// Prop types for the new component
CharacterSectionDisplay.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  showCharacterMenu: PropTypes.bool.isRequired,
  toggleCharFilters: PropTypes.func.isRequired,
  showCharFilters: PropTypes.bool.isRequired,
  charSearchTerm: PropTypes.string.isRequired,
  setCharSearchTerm: PropTypes.func.isRequired,
  charFilterFavorite: PropTypes.string.isRequired,
  setCharFilterFavorite: PropTypes.func.isRequired,
  toggleCharSortOrder: PropTypes.func.isRequired,
  charSortKey: PropTypes.string.isRequired,
  charSortOrder: PropTypes.string.isRequired,
  resetCharFilters: PropTypes.func.isRequired,
  charactersLoading: PropTypes.bool.isRequired,
  charactersError: PropTypes.string,
  filteredSortedCharacters: PropTypes.array,
  handleButtonClick: PropTypes.func.isRequired,
  handleSaveNickname: PropTypes.func.isRequired,
  handleCreateCharacter: PropTypes.func.isRequired,
  handleDeleteCharacter: PropTypes.func.isRequired,
  fetchCharacters: PropTypes.func.isRequired,
  handleSetFavorite: PropTypes.func.isRequired,
  renameError: PropTypes.string,
  clearRenameError: PropTypes.func.isRequired,
  handlePlayMap: PropTypes.func.isRequired,
  onCharacterMapFavoriteStatusChanged: PropTypes.func.isRequired,
  onMapDeleted: PropTypes.func.isRequired,
};

/**
 * Renders main menu UI controls. Manages game state, auth, audio,
 * scene switching, and character display.
 *
 * @param {object} props - Component props.
 * @param {object} [props._dimensions] - Dimensions (future use).
 * @param {number} [props._dimensions.width] - Width.
 * @param {number} [props._dimensions.height] - Height.
 * @param {React.RefObject<HTMLElement>} [props._refContainer] - Ref to main
 *   container. (Marked as unused in function signature)
 * @param {object} [props._refController] - Controller ref (future use).
 * @param {React.RefObject<HTMLElement>} [props._refController.current] -
 *   Current ref.
 * @param {boolean} [props.instantStart=false] - Start game immediately on
 *   mount.
 * @param {string | null} [props.mapId] - Currently loaded map ID.
 * @returns {React.ReactElement} Main menu controls component.
 */
const MainMenuControls = ({
  _dimensions,
  _refController,
  instantStart = false,
  mapId, // Add mapId to props destructuring
}) => {
  /** @state {boolean} Tracks if the SignUp form should be displayed. */
  const [userSigningUp, setUserSigningUp] = useState(false);
  /** @state {boolean} Tracks if the Login form should be displayed. */
  const [userLoggingIn, setUserLoggingIn] = useState(false);

  // Use the UserProvider context instead of managing auth state directly
  const { currentUser, isAuthenticated, logout, isLoading, login } = useUser();

  /** @state {boolean} Tracks if the game has been started. */
  const [started, setStarted] = useState(false);
  /** @state {boolean} Tracks if the Character Menu should be displayed. */
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  /** @state {Array<object>|null} Stores fetched character data. */
  const [characters, setCharacters] = useState(null);
  /** @state {boolean} Tracks loading state for characters. */
  const [charactersLoading, setCharactersLoading] = useState(false);
  /** @state {string|null} Stores error message if character fetch fails. */
  const [charactersError, setCharactersError] = useState(null);
  /** @state {string|null} Stores error message for nickname conflicts. */
  const [renameError, setRenameError] = useState(null);
  /** @state {string|null} Stores the map ID associated with the favorite
   * character. */
  const [mapToStart, setMapToStart] = useState(null); // New state for favorite map
  /** @state {string|null} Stores the character ID of the favorite character. */
  const [favoriteCharacterIdToStart, setFavoriteCharacterIdToStart] =
    useState(null);
  /** @state {string|null} Stores the nickname of the map to start. */
  const [mapNickname, setMapNickname] = useState(null);
  /** @state {boolean} Tracks if the sounds audio settings panel is open. */
  const [soundsSettingsOpen, setSoundsSettingsOpen] = useState(false);
  /** @state {boolean} Tracks if the music audio settings panel is open. */
  const [musicSettingsOpen, setMusicSettingsOpen] = useState(false);
  /** @state {boolean} Tracks if the ambience audio settings panel is open. */
  const [ambienceSettingsOpen, setAmbienceSettingsOpen] = useState(false);

  // State for Character Filtering/Sorting
  /** @state {string} Search term for filtering characters by name. */
  const [charSearchTerm, setCharSearchTerm] = useState('');
  /** @state {string} Filter characters by favorite status ('all', 'true',
   * 'false'). */
  const [charFilterFavorite, setCharFilterFavorite] = useState('all');
  /** @state {string} Sorting key for characters ('name', 'pg_id'). */
  const [charSortKey, setCharSortKey] = useState('name'); // Default sort by name
  /** @state {string} Sorting order ('asc', 'desc'). */
  const [charSortOrder, setCharSortOrder] = useState('asc'); // Default ascending
  /** @state {boolean} Controls visibility of character filter UI. */
  const [showCharFilters, setShowCharFilters] = useState(false);
  /** @state {string} Debounced search term for filtering characters. */
  const [debouncedCharSearchTerm, setDebouncedCharSearchTerm] = useState('');
  /** @state {boolean} Tracks if the reload map button should be disabled due
   * to debounce. */
  const [isReloading, setIsReloading] = useState(false);
  /** @ref {number|null} Stores the timer ID for the reload debounce. */
  const reloadTimerRef = useRef(null);

  // --- Add state for Map Title Visibility ---
  /** @state {boolean} Tracks if the map title should be visible. */
  const [isMapTitleVisible, setIsMapTitleVisible] = useState(true);

  // --- Add state for Audio Settings ---
  /** @state {number} Stores the volume for the sounds audio setting. */
  const [soundsVolume, setSoundsVolume] = useState(15);
  /** @state {number} Stores the volume for the music audio setting. */
  const [musicVolume, setMusicVolume] = useState(21);
  /** @state {number} Stores the volume for the ambience audio setting. */
  const [ambienceVolume, setAmbienceVolume] = useState(30);
  // ----------------------------------------

  // Consume and control the global resize state
  const { setIsResizeGloballyEnabled } = useResizeControl();

  // Effect to disable global resize when login/signup is active
  useEffect(() => {
    if (userLoggingIn || userSigningUp) {
      setIsResizeGloballyEnabled(false);
    } else {
      setIsResizeGloballyEnabled(true);
    }
    // Cleanup is implicitly handled: when component unmounts or states change,
    // this effect re-runs and sets the correct state.
  }, [userLoggingIn, userSigningUp, setIsResizeGloballyEnabled]);

  /**
   * Handles the volume change for the sounds audio setting.
   *
   * @function handleSoundsVolumeChange
   * @param {number} value - The new volume level (0-100).
   */
  const handleSoundsVolumeChange = useCallback((value) => {
    setSoundsVolume(value);
  }, []);

  /**
   * Handles the volume change for the music audio setting.
   *
   * @function handleMusicVolumeChange
   * @param {number} value - The new volume level (0-100).
   */
  const handleMusicVolumeChange = useCallback((value) => {
    setMusicVolume(value);
  }, []);

  /**
   * Handles the volume change for the ambience audio setting.
   *
   * @function handleAmbienceVolumeChange
   * @param {number} value - The new volume level (0-100).
   */
  const handleAmbienceVolumeChange = useCallback((value) => {
    setAmbienceVolume(value);
  }, []);

  /**
   * Handles authentication-related button clicks.
   *
   * @param {string} eventType - Type of authentication action ('login',
   *   'logout', etc.).
   */
  const handleAuthActions = useCallback(
    async (eventType) => {
      const timestamp = new Date().toISOString();
      switch (eventType) {
        case 'login':
          setUserLoggingIn(true);
          setUserSigningUp(false);
          break;
        case 'loginCancel':
          setUserLoggingIn(false);
          break;
        case 'loginCompleted':
          setUserLoggingIn(false);
          break;
        case 'signup':
          setUserSigningUp(true);
          setUserLoggingIn(false);
          break;
        case 'signupCancel':
          setUserSigningUp(false);
          break;
        case 'signupCompleted':
          setUserSigningUp(false);
          break;
        case 'logout':
          await logout(); // Use the logout function from UserProvider
          break;
        default:
          // This case should ideally not be reached if called correctly
          console.warn(
            `[${timestamp}] [WARN]: Unknown auth event: ${eventType}`
          );
      }
    },
    [logout, setUserLoggingIn, setUserSigningUp] // Include dependencies
  );

  /**
   * Handles character menu visibility button clicks.
   *
   * @param {string} eventType - The type of character menu action
   *   ('showCharacters', 'hideCharacters').
   */
  const handleCharacterMenuActions = useCallback(
    (eventType) => {
      switch (eventType) {
        case 'showCharacters':
          setShowCharacterMenu((prev) => !prev);
          break;
        case 'hideCharacters':
          setShowCharacterMenu(false);
          break;
        default:
          // This case should ideally not be reached
          console.warn(
            `[${new Date().toISOString()}] [WARN]: Unknown character menu event: ${eventType}`
          );
      }
    },
    [setShowCharacterMenu] // Include dependencies
  );


  /**
   * Listen on eventBus for map nickname and update the state
   */
  useEffect(() => {
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] ` + 
    //   `[MainMenuControls] ` +
    //   `Running fetchCharacters effect. ` +
    //   `isAuthenticated: ${isAuthenticated}, ` + 
    //   `charactersLoading: ${charactersLoading}, ` +
    //   `characters === null: ${characters === null}`
    // );
    EventBus.on('map-nickname-updated', (nickname) => {
      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] ` + 
      //   `[MainMenuControls] ` +
      //   `EventBus: map-nickname-updated ` + 
      //   `triggered with:`, nickname
      // );
      setMapNickname(nickname);
    });
    return () => {
      EventBus.off('map-nickname-updated', (nickname) => {
        setMapNickname(nickname);
      });
    };
  }, []);

  /**
   * Handles the API call and temporary login for the quick start flow.
   *
   * @private
   * @async
   * @function _prepareQuickStart
   * @param {Function} loginFn - The login function from UserProvider context.
   * @returns {Promise<{mapId: string, characterId: string}>} Object with IDs
   *   on success.
   * @throws {Error} If the quick start API call fails or returns invalid
   *   data.
   */
  const _prepareQuickStart = useCallback(async (loginFn) => {
    const timestamp = new Date().toISOString();
    // Debug when quick start is prepared
    // console.debug(
    //   `[${timestamp}] [DEBUG][MainMenuControls] ` +
    //   `Preparing Quick Start...`
    // );
    const result = await quickStartGame();
    if (result && result.accessToken && result.refreshToken && result.user && result.mapId && result.characterId) {
      // Debug when quick start is successful
      // console.debug(
      //   `[${timestamp}] [DEBUG][MainMenuControls] ` +
      //   `Quick Start API successful. ` + 
      //   `Logging in temporary user...`
      // );
      await loginFn({
        user: result.user,
        token: result.accessToken,
        refreshToken: result.refreshToken
      });
      // Debug when temporary user is logged in
      // console.info(
      //   `[${timestamp}] [INFO][MainMenuControls] ` +
      //   `Temporary user logged in.`
      // );
      return { mapId: result.mapId, characterId: result.characterId };
    } else {
      console.error(
        `[${timestamp}][ERROR][MainMenuControls] Quick Start ` +
        `API call returned unexpected data.`, { result }
      );
      throw new Error('Quick Start failed: Invalid data received.');
    }
  }, [login]); // loginFn might require adding login to dependencies


  /**
   * Handles the 'start' button click logic for both authenticated and
   * unauthenticated users. Initiates either a quick start or starts the game
   * with the user's favorite character and map.
   *
   * @private
   * @async
   * @function _handleStartClick
   * @param {{isStarted: boolean, isAuth: boolean, favMapId: string|null,
   *   favCharId: string|null}} startData - Object containing necessary state.
   * @param {{setStartedFn: Function, startGameFn: Function, loginFn:
   *   Function, prepareQuickStartFn: Function, closeLoginFn: Function,
   *   closeSignupFn: Function}} startActions - Object
   *   containing action functions.
   * @returns {Promise<void>}
   */
  const _handleStartClick = useCallback(async (
    startData,
    startActions
  ) => {
    const timestamp = new Date().toISOString();
    const {
      isStarted,
      isAuth,
      favMapId,
      favCharId
    } = startData;
    const {
      setStartedFn,
      startGameFn,
      loginFn,
      prepareQuickStartFn,
      closeLoginFn,  // Destructure new actions
      closeSignupFn // Destructure new actions
    } = startActions;

    // Close modals immediately
    closeLoginFn();
    closeSignupFn();

    if (isStarted) {
      console.warn(`[${timestamp}][WARN][_handleStartClick] Start clicked but game already started.`);
      return; // Do nothing if already started
    }

    let startArgs = null;

    if (!isAuth) {
      // Debug when quick start is prepared
      // console.debug(
      //   `[${timestamp}] [DEBUG][_handleStartClick] ` +
      //   `User not authenticated. Attempting quick start preparation...`
      // );
      try {
        const quickStartResult = await prepareQuickStartFn(loginFn);
        startArgs = { mapId: quickStartResult.mapId, characterId: quickStartResult.characterId };
        // Debug when quick start is prepared
        // console.info(
        //   `[${timestamp}] [INFO][_handleStartClick] ` +
        //   `Quick Start prepared. Args:`, startArgs
        // );
      } catch (error) {
        console.error(
          `[${timestamp}][ERROR][_handleStartClick] Quick Start preparation failed: ${error.message}`
        );
        return;
      }
    }
    // Combine else and if for authenticated users
    else if (favMapId && favCharId) {
      // Debug when authenticated user starts
      // console.debug(
      //   `[${timestamp}][DEBUG][_handleStartClick] ` +
      //   `Authenticated user start. Map: ${favMapId}, Char: ${favCharId}`
      // );
      startArgs = { mapId: favMapId, characterId: favCharId };
    }
    // Handle authenticated user with no selection
    else {
      console.warn(
        `[${timestamp}][WARN][_handleStartClick] ` +
        `Authenticated start clicked ` +
        `but no favorite map/character selected.`
      );
      return;
    }

    if (startArgs) {
      setStartedFn(true);
      startGameFn(startArgs);
    }
  }, []);


  /**
   * Handles the 'stop' button click logic.
   *
   * @private
   * @function _handleStopClick
   * @param {boolean} isStarted - Current started state.
   * @param {Function} setStartedFn - Function to update started state.
   * @param {Function} stopGameFn - Function to stop the game.
   */
  const _handleStopClick = useCallback((isStarted, setStartedFn, stopGameFn) => {
    if (isStarted) {
      setStartedFn(false);
      stopGameFn();
    }
  }, []);


  /**
   * Handles various button clicks within the main menu and game controls.
   * Dispatches actions based on the provided event type (e.g., 'start',
   * 'login').
   *
   * @function handleButtonClick
   * @param {string} eventType - The type of action to perform.
   * @returns {Promise<void>}
   */
  const handleButtonClick = useCallback(
    async (eventType) => {
      const timestamp = new Date().toISOString();

      switch (eventType) {
        case 'start':
          // Call the refactored start handler
          await _handleStartClick(
            // Group state/data into startData object
            {
              isStarted: started,
              isAuth: isAuthenticated,
              favMapId: mapToStart,
              favCharId: favoriteCharacterIdToStart,
            },
            // Group actions into startActions object
            {
              setStartedFn: setStarted,
              startGameFn: startGame,
              loginFn: login,
              prepareQuickStartFn: _prepareQuickStart,
              closeLoginFn: setUserLoggingIn,  // Pass setter
              closeSignupFn: setUserSigningUp // Pass setter
            }
          );
          break;

        case 'stop':
          // Use the stop handler
          _handleStopClick(started, setStarted, stopGame);
          break;

        case 'login':
        case 'loginCancel':
        case 'loginCompleted':
        case 'signup':
        case 'signupCancel':
        case 'signupCompleted':
        case 'logout':
          handleAuthActions(eventType);
          break;

        case 'showCharacters':
        case 'hideCharacters':
          handleCharacterMenuActions(eventType);
          break;

        default:
          console.warn(
            `[${timestamp}][WARN]: ` +
            `Unknown button click event: ${eventType}`
          );
          break;
      }
    },
    [ // Ensure all dependencies are listed for the main handler and the helpers it calls
      started,
      isAuthenticated,
      mapToStart,
      favoriteCharacterIdToStart,
      setStarted,
      startGame,
      login,
      _prepareQuickStart, // Add the new helper
      _handleStartClick,  // Add the refactored helper
      _handleStopClick,   // Add the stop helper
      handleAuthActions,
      handleCharacterMenuActions,
      stopGame,
      setUserLoggingIn, // Add setter dependency
      setUserSigningUp  // Add setter dependency
    ]
  );

  /**
   * Toggles the visibility of the sounds settings panel.
   *
   * @function toggleSoundsSettings
   */
  const toggleSoundsSettings = useCallback(() => {
    setSoundsSettingsOpen((prev) => !prev);
  }, []);

  /**
   * Toggles the visibility of the music settings panel.
   *
   * @function toggleMusicSettings
   */
  const toggleMusicSettings = useCallback(() => {
    setMusicSettingsOpen((prev) => !prev);
  }, []);

  /**
   * Toggles the visibility of the ambience settings panel.
   *
   * @function toggleAmbienceSettings
   */
  const toggleAmbienceSettings = useCallback(() => {
    setAmbienceSettingsOpen((prev) => !prev);
  }, []);

  // Character Filter/Sort Handlers
  /**
   * Toggles the visibility of the character filter controls.
   *
   * @function toggleCharFilters
   */
  const toggleCharFilters = useCallback(() => {
    setShowCharFilters((prev) => !prev);
  }, []);

  /**
   * Resets all character filters and sorting to defaults.
   *
   * @function resetCharFilters
   */
  const resetCharFilters = useCallback(() => {
    setCharSearchTerm('');
    setCharFilterFavorite('all');
    setCharSortKey('name');
    setCharSortOrder('asc');
    // Optional: Keep filters shown or hide them
    // setShowCharFilters(false);
  }, []);

  /**
   * Toggles the sort order between ascending and descending.
   *
   * @function toggleCharSortOrder
   */
  const toggleCharSortOrder = useCallback(() => {
    setCharSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Add handlers for changing search term, favorite filter, sort key if needed
  // (Directly using set functions in onChange is also fine for simple cases)

  /**
   * Fetches the list of characters for the authenticated user. Sets loading
   * state, updates character list, identifies the favorite character and their
   * associated map, and handles errors. Can be forced to refresh data.
   *
   * @function fetchCharacters
   * @param {boolean} [force=false] - If true, forces a refresh even if data
   *   exists.
   * @returns {Promise<void>} Resolves when fetch attempt is complete.
   */
  const fetchCharacters = useCallback(
    async (force = false) => {
      // --- Internal Helper: Fetches and processes characters ---
      const _fetchAndProcessCharacters = async () => {
        setCharactersLoading(true); // Start loading indicator early
        setCharactersError(null);
        try {
          const fetchedCharacters = await getCharacters();
          setCharacters(fetchedCharacters);

          const favoriteChar = fetchedCharacters.find(
            (char) => char.favorite_character === true
          );
          setMapToStart(favoriteChar?.favoriteMapId || null);
          // Also set the favorite character ID
          setFavoriteCharacterIdToStart(favoriteChar?.character_id || null);
        } catch (err) {
          console.error(
            `[${new Date().toISOString()}][ERROR]: Failed to fetch characters: `,
            err
          );
          const displayMessage =
            err.message || 'Could not load character data. Please try again.';
          setCharactersError(displayMessage);
          setCharacters([]); // Set to empty array on error
          // Re-throw the error if needed by the outer catch, or handle fully here
          throw err; // Propagate error to the outer catch if necessary
        } finally {
          setCharactersLoading(false); // Ensure loading stops
        }
      };
      // --- End Internal Helper ---

      // Check conditions before attempting fetch:
      // Fetch if authenticated, not already loading, AND
      // (EITHER force=true OR characters haven't been fetched yet (is null))
      if (isAuthenticated && !charactersLoading && (force || characters === null)) {
        try {
          await _fetchAndProcessCharacters();
        } catch (err) {
          // The error is already logged by the helper,
          // but we catch it here to prevent unhandled promise rejections
          // if the helper re-throws.
          console.error(
            `[${new Date().toISOString()}][ERROR]: ` +
            `Error during character fetch process: `,
            err.message
          );
          // Ensure loading is false if helper threw early
          if (charactersLoading) {
            setCharactersLoading(false);
          }
          // Clear start info on error
          setMapToStart(null);
          setFavoriteCharacterIdToStart(null);
        }
      }
    },
    // Remove 'characters' dependency. Fetch logic now depends on 'isAuthenticated'
    // and 'charactersLoading', plus the 'force' param and initial 'null' state.
    [isAuthenticated, charactersLoading]
  );

  /**
   * Handles the notification that a character's map favorite status might have
   * changed, typically after interacting with the map list within a
   * character card. Triggers a refetch of character data to ensure the main
   * menu reflects the latest favorite map selection.
   *
   * @function handleCharacterMapFavoriteStatusChanged
   */
  const handleCharacterMapFavoriteStatusChanged = useCallback(() => {
    // Force fetch characters to get updated favorite map info
    fetchCharacters(true);
  }, [fetchCharacters]); // Dependency: fetchCharacters

  // Effect to fetch characters initially and when auth status changes
  useEffect(() => {
    // Only fetch if authenticated
    if (isAuthenticated) {
      fetchCharacters();
    }

    // Clear characters on logout
    if (!isAuthenticated) {
      setCharacters(null);
      setCharactersError(null);
      setCharactersLoading(false);
      // Clear map/char ID on logout
      setMapToStart(null);
      setFavoriteCharacterIdToStart(null);
    }
    // Dependencies: isAuthenticated and currentUser identify login/logout changes.
    // fetchCharacters is stable due to useCallback.
    // Removed currentUser dependency as the guest check is gone.
  }, [isAuthenticated, fetchCharacters]); // fetchCharacters added

  // Effect to debounce character search term
  useEffect(() => {
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] ` + 
    //   `[MainMenuControls] ` +
    //   `Running debounce effect for ` + 
    //   `charSearchTerm: ${charSearchTerm}`
    // );
    // Set a timer to update the debounced search term after 2 seconds
    const timerId = setTimeout(() => {
      setDebouncedCharSearchTerm(charSearchTerm);
    }, 500); // 500ms = 1/2 second delay

    // Cleanup function to clear the timer if charSearchTerm changes again
    // before the timer finishes
    return () => {
      clearTimeout(timerId);
    };
  }, [charSearchTerm]); // Re-run effect only when charSearchTerm changes

  // Trigger game start if instantStart is true and not already started
  useEffect(() => {
    if (instantStart && !started) {
      handleButtonClick('start');
    }
  }, [instantStart, started, handleButtonClick]);

  // --- Effect to listen for initial map title visibility from Phaser ---
  useEffect(() => {
    const handleVisibilityState = (isVisible) => {
      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] ` + 
      //   `[DEBUG] [MainMenuControls] ` +
      //   `EventBus: map-title-visibility-state ` + 
      //   `triggered with: ${isVisible}`
      // );
      setIsMapTitleVisible(isVisible);
    };

    EventBus.on('map-title-visibility-state', handleVisibilityState);

    // Cleanup listener on unmount
    return () => {
      EventBus.off('map-title-visibility-state', handleVisibilityState);
    };
  }, []); // Run only once on mount
  // --------------------------------------------------------------------

  // Effect to clear the reload timer on unmount
  useEffect(() => {
    // Cleanup function for the reload timer
    return () => {
      // Clear the reload timeout when the component unmounts
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  /**
   * Clears the specific error state related to nickname update conflicts (409).
   *
   * @function clearRenameError
   */
  const clearRenameError = useCallback(() => {
    setRenameError(null);
  }, []);

  /**
   * Helper function to handle API errors during nickname updates. Logs the
   * error and sets appropriate error state based on whether it's a 409
   * conflict or another type of error.
   *
   * @function handleNicknameError
   * @param {Error} error - The error object from the API call, expected to
   *   have a `response` property for HTTP errors.
   * @param {string} characterId - The ID of the character being updated.
   * @returns {boolean} True if the error was a 409 conflict, false otherwise.
   */
  const handleNicknameError = useCallback(
    (error, characterId) => {
      const errorTimestamp = new Date().toISOString();
      // Adjusted error message extraction
      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message;

      console.error(
        `[${errorTimestamp}][ERROR][MainMenuControls]: ` +
        `Failed to update nickname for ${characterId}: ${errorMessage} `,
        error.response?.data
      );

      // Specifically check for 409 Conflict status
      if (error.response?.status === 409) {
        setRenameError(
          errorMessage || 'This name is already taken by another character.'
        );
        return true; // Indicate 409 error handled
      }

      // Set a generic error for other failures
      setCharactersError(`Failed to save nickname: ${errorMessage} `);
      return false; // Indicate other error type
    },
    [setRenameError, setCharactersError]
  );

  /**
   * Handles saving a character's nickname via an API call. Manages loading
   * state, calls the API, refreshes character data on success, and handles
   * potential errors (specifically 409 conflicts using
   * `handleNicknameError`).
   *
   * @function handleSaveNickname
   * @param {string} characterId - The ID of the character.
   * @param {string} newNickname - The desired new nickname.
   * @returns {Promise<boolean>} Resolves true on success, false on 409 error.
   * @throws {Error} If the nickname save fails for reasons other than a 409
   *   conflict.
   */
  const handleSaveNickname = useCallback(
    async (characterId, newNickname) => {
      clearRenameError();
      setCharactersLoading(true);
      try {
        await updateCharacterNickname(characterId, newNickname);
        await fetchCharacters(true); // Refresh the character list
        return true; // Indicate success
      } catch (error) {
        const isConflict = handleNicknameError(error, characterId);
        if (!isConflict) {
          // Re-throw errors other than 409 for higher-level handling if needed
          throw error;
        }
        return false; // Indicate failure (specifically 409)
      } finally {
        setCharactersLoading(false); // Always stop loading indicator
      }
    },
    [
      fetchCharacters,
      clearRenameError,
      handleNicknameError,
      setCharactersLoading,
    ]
  );

  /**
   * Handles creating a new character via an API call. Manages loading state,
   * updates the local character list on success, and sets error state on
   * failure, including specific handling for the character limit (403).
   *
   * @function handleCreateCharacter
   * @returns {Promise<void>} Resolves when the creation attempt is complete.
   */
  const handleCreateCharacter = useCallback(async () => {
    setCharactersLoading(true); // Use existing loading state for simplicity
    setCharactersError(null);
    try {
      // Pass initial data if needed
      const newCharacter = await createCharacter();
      // Add the new character to the local state
      setCharacters((prevChars) => [...(prevChars || []), newCharacter]);
      // Optionally: Add user feedback
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}][ERROR]: Failed to create character: `,
        error
      );
      // Check if the error has a response and a status code of 403
      if (error.response && error.response.status === 403) {
        // Specific message for character limit exceeded
        setCharactersError(
          error.response.data.message ||
          'Character limit reached. Cannot create more.'
        );
      } else {
        // General error message
        setCharactersError(error.message || 'Could not create character.');
      }
      // Optionally: Add user feedback about the error
    } finally {
      setCharactersLoading(false);
    }
  }, [setCharactersLoading, setCharactersError, setCharacters]); // Added dependencies

  /**
   * Handles toggling the favorite status for a given character via an API
   * call. Attempts the API update and then forces a character refresh to
   * ensure UI consistency, regardless of the specific success response
   * format. Logs errors.
   *
   * @function handleSetFavorite
   * @param {string} characterId - The ID of the character to toggle.
   * @param {boolean} desiredFavoriteState - The intended favorite state
   *   (true for favorite, false for unfavorite).
   * @returns {Promise<void>} Resolves when the attempt and refresh are
   *   complete.
   */
  const handleSetFavorite = useCallback(
    async (characterId, desiredFavoriteState) => {
      const timestamp = new Date().toISOString();

      // --- Internal Helper Function ---
      /**
       * Calls the API to set favorite status and checks for primary success.
       *
       * @returns {Promise<boolean>} True if API indicates success format,
       *   false otherwise.
       * @throws {Error} Propagates API call errors.
       */
      const _callApiAndCheckSuccess = async () => {
        const result = await setFavoriteCharacter(
          characterId,
          desiredFavoriteState
        );
        // Return true only if the expected success structure exists
        return result?.Favorited?.success === true;
      };
      // --- End Helper Function ---

      try {
        const success = await _callApiAndCheckSuccess();

        if (!success) {
          console.warn(
            `[${timestamp}][WARN][MainMenuControls handleSetFavorite]: ` +
            `API call to set favorite may have succeeded but returned ` +
            `unexpected format. Re-fetching for consistency.`
          );
        }

        // Always re-fetch characters after the attempt to ensure UI consistency
        // This will update mapToStart and favoriteCharacterIdToStart
        await fetchCharacters(true); // Fetch fresh data
      } catch (error) {
        const errorTimestamp = new Date().toISOString(); // Reuse timestamp or get new? New is fine.
        console.error(
          `[${errorTimestamp}][ERROR][MainMenuControls handleSetFavorite]: ` +
          `Failed to set favorite status for ${characterId}: `,
          error.response?.data || error.message // Log more specific error info
        );
        // Optionally: Set an error state for the CharacterMenu
      }
    },
    [fetchCharacters] // Dependencies
  );

  /**
   * Handles starting the game with a specific map and character ID, usually
   * triggered from the `CharacterMenu`. Sets the game to started and
   * initiates the game scene. Prevents starting if the game is already
   * running or if IDs are missing.
   *
   * @function handlePlayMap
   * @param {string} mapId - The MongoDB ID of the map to load.
   * @param {string} characterId - The MongoDB ID of the character to play as.
   * @returns {Promise<void>} Resolves when the start attempt is handled.
   */
  const handlePlayMap = useCallback(
    async (mapId, characterId) => {
      // Ensure mapId and characterId are provided
      if (!mapId || !characterId) {
        console.error(
          `[${new Date().toISOString()}][ERROR][MainMenuControls handlePlayMap]: ` +
          `Missing mapId (${mapId}) or characterId (${characterId}).`
        );
        // Maybe set an error state or provide user feedback
        return; // Prevent starting the game
      }

      if (!started) {
        setStarted(true); // Mark game as started
        // Pass both the specific mapId and characterId
        startGame({ mapId, characterId });
      } else {
        console.warn(
          `[${new Date().toISOString()}][WARN][MainMenuControls handlePlayMap]: ` +
          `handlePlayMap called but game already started.`
        );
        // Optionally, handle scene switching if game is already running
        // EventBus.emit('switch-scene', {
        //   sceneKey: 'NewGame',
        //   data: { mapId, characterId }
        // });
      }
    },
    [started] // Depend only on started state
  );

  /**
   * Handles the request to reload map data for the current game scene. Emits a
   * 'reload-current-scene' event via the EventBus and manages a debounce timer
   * to prevent rapid clicks, updating the `isReloading` state accordingly.
   *
   * @function handleReloadMap
   */
  const handleReloadMap = useCallback(() => {
    // Prevent triggering reload if already reloading
    if (isReloading) {
      return;
    }

    // 1. Disable button
    setIsReloading(true);

    // 2. Emit event to game scene
    EventBus.emit('reload-current-scene');

    // 3. Start timer to re-enable button
    const DEBOUNCE_MS = 5000; // Define delay here
    reloadTimerRef.current = setTimeout(() => {
      setIsReloading(false);
      reloadTimerRef.current = null; // Clear the ref
    }, DEBOUNCE_MS);
  }, [isReloading]); // Depend on isReloading to prevent overlapping timers

  // Filter and sort characters based on state
  const filteredSortedCharacters = useMemo(() => {
    let processedChars = characters ? [...characters] : [];

    // 1. Filter by Debounced Search Term (case-insensitive on name)
    if (debouncedCharSearchTerm) {
      const lowerSearchTerm = debouncedCharSearchTerm.toLowerCase();
      processedChars = processedChars.filter((char) =>
        (char.name || '').toLowerCase().includes(lowerSearchTerm)
      );
    }

    // 2. Filter by Favorite Status
    if (charFilterFavorite !== 'all') {
      const isFavorite = charFilterFavorite === 'true';
      processedChars = processedChars.filter(
        (char) => !!char.favorite_character === isFavorite // Coerce to boolean
      );
    }

    // 3. Sort
    processedChars.sort((a, b) => {
      let valA, valB;

      // Determine values based on sort key
      if (charSortKey === 'name') {
        valA = a.name || ''; // Handle null/undefined names
        valB = b.name || '';
      } else if (charSortKey === 'pg_id') {
        valA = a.pg_id;
        valB = b.pg_id;
      } else {
        return 0; // No sorting if key is unknown
      }

      // Comparison logic (case-insensitive for name)
      let comparison = 0;
      if (charSortKey === 'name') {
        comparison = valA.toLowerCase().localeCompare(valB.toLowerCase());
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        // Basic comparison for other types (like string IDs)
        if (valA < valB) comparison = -1;
        if (valA > valB) comparison = 1;
      }

      return charSortOrder === 'asc' ? comparison : comparison * -1;
    });

    return processedChars;
  }, [
    characters,
    debouncedCharSearchTerm, // Use debounced term for filtering
    charFilterFavorite,
    charSortKey,
    charSortOrder,
  ]);

  /**
   * Handles deleting a character via an API call. Updates the local character
   * list upon successful deletion. If the deleted character was the user's
   * favorite, it also clears the `mapToStart` and
   * `favoriteCharacterIdToStart` state to prevent starting the game with a
   * non-existent character/map combination. Logs errors.
   *
   * @function handleDeleteCharacter
   * @param {string} characterId - The ID of the character to delete.
   * @returns {Promise<void>} Resolves when the deletion attempt is complete.
   */
  const handleDeleteCharacter = useCallback(
    async (characterId) => {
      try {
        // Find the character to be deleted in the current state
        const characterToDelete = characters?.find(
          (char) => char.character_id === characterId
        );

        await deleteCharacter(characterId);
        // Remove the character from the local state
        setCharacters((prevChars) =>
          prevChars.filter((char) => char.character_id !== characterId)
        );

        // If the deleted character was the favorite, reset mapToStart
        if (characterToDelete?.favorite_character) {
          setMapToStart(null);
          setFavoriteCharacterIdToStart(null); // Clear favorite character ID too
        }
      } catch (error) {
        const errorTimestamp = new Date().toISOString();
        console.error(
          `[${errorTimestamp}][ERROR][MainMenuControls]: ` +
          `Failed to delete character ${characterId}: `,
          error
        );
        // Optionally: Add user feedback about the error
      }
    },
    [deleteCharacter, setCharacters, characters] // Depend on the imported API function, setCharacters, and characters
  );

  /**
   * Handles the notification that a map associated with a character has been
   * deleted (received from `CharacterMenu`). If the deleted map was the one
   * currently selected as the favorite to start with (`mapToStart`), this
   * function clears that selection (`mapToStart` and
   * `favoriteCharacterIdToStart`). It then forces a refresh of the character
   * list to ensure data consistency (e.g., reflecting removed favorite maps).
   *
   * @function handleMapDeleted
   * @param {string} deletedMapId - The ID of the map that was deleted.
   */
  const handleMapDeleted = useCallback(
    (deletedMapId) => {
      if (mapToStart === deletedMapId) {
        // Keep for debugging
        // console.debug(
        //   `[${new Date().toISOString()}][DEBUG]` + 
        //   `[MainMenuControlshandleMapDeleted]:` + 
        //   ` Deleted map ${deletedMapId} was the map ` +
        //   `set to start. Clearing mapToStart.`
        // );
        setMapToStart(null);
        setFavoriteCharacterIdToStart(null); // Clear favorite character ID too
      }
      // Refresh character list to reflect potential changes (e.g., favorite map removed)
      fetchCharacters(true); // Force refresh
    },
    [mapToStart, fetchCharacters, favoriteCharacterIdToStart]
  ); // Dependencies: mapToStart state, fetchCharacters function

  /**
   * Toggles the visibility of the map title overlay in the Phaser game scene.
   * Updates the local React state (`isMapTitleVisible`) and emits an event
   * (`set-map-title-visibility`) via the EventBus for the Phaser scene to act
   * upon.
   *
   * @function handleToggleMapTitleVisibility
   */
  const handleToggleMapTitleVisibility = useCallback(() => {
    const newVisibility = !isMapTitleVisible;
    // Update state in parent
    setIsMapTitleVisible(newVisibility);
    // Tell Phaser
    EventBus.emit('set-map-title-visibility', newVisibility);
  }, [isMapTitleVisible]);

  /**
   * Handles the `playerWalletUpdated` event from the EventBus.
   * Updates the coin count for the specific character in the local
   * `characters` state if the character is found.
   *
   * @param {object} data - The event data.
   * @param {string} data.characterId - The MongoDB ID of the character whose
   *   wallet was updated.
   * @param {number} data.coins - The new coin amount for the character.
   */
  useEffect(() => {
    const handlePlayerWalletUpdate = data => {
      // Keep for debugging
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] ` + 
      //   `[MainMenuControls] ` +
      //   `EventBus: playerWalletUpdated` + 
      //   ` triggered with:`, data
      // );
      // Debugging: Wallet Update
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] [MainMenuControls] ` +
      //   `Received playerWalletUpdated event:`, data
      // );
      const { characterId, coins } = data;
      if (characterId === undefined || coins === undefined) {
        console.warn(
          `[${new Date().toISOString()}] [WARN] [MainMenuControls] ` +
          `Received playerWalletUpdated event with missing data:`, data
        );
        return;
      }

      // Helper function to update coins for a single character
      const updateCharacterCoins = char => {
        return char.character_id === characterId ? { ...char, coins: coins } : char;
      };

      setCharacters(prevCharacters => {
        if (!prevCharacters) return null; // No characters loaded yet
        // Use the helper function in the map
        return prevCharacters.map(updateCharacterCoins);
      });
    };

    EventBus.on('playerWalletUpdated', handlePlayerWalletUpdate);

    // Cleanup listener on component unmount
    return () => {
      EventBus.off('playerWalletUpdated', handlePlayerWalletUpdate);
    };
  }, [setCharacters]); // Dependency on setCharacters

  /**
   * Renders the user authentication and game start buttons.
   * Includes Start Game, Log In/Out, Register, and Characters buttons.
   * Start Game is disabled if authenticated but no favorite map/character is
   * set.
   *
   * @returns {React.ReactElement} A div containing the control buttons.
   */
  const UserAuthControls = () => (
    <div
      className="user-controls"
      style={{
        display: 'flex', // Ensure horizontal layout
        flexWrap: 'wrap', // Allow wrapping on smaller screens
        justifyContent: 'center', // Center buttons
        gap: '10px', // Add space between buttons
        marginBottom: '1rem', // Add some space below buttons
      }}
    >
      <Button
        className="menu-button"
        color="primary"
        onClick={() => handleButtonClick('start')}
        // Disable start if authenticated but no favorite map OR character is selected
        disabled={isAuthenticated ? !mapToStart || !favoriteCharacterIdToStart : false}
      >
        Start Game
      </Button>

      {isAuthenticated ? (
        <Button
          className="menu-button"
          color="warning"
          onClick={() => handleButtonClick('logout')}
        >
          Log Out {currentUser?.username ? `(${currentUser.username})` : ''}
        </Button>
      ) : (
        <Button
          className="menu-button"
          color="success"
          onClick={() => handleButtonClick('login')}
        >
          Log In
        </Button>
      )}

      {!isAuthenticated && (
        <Button
          className="menu-button"
          color="info"
          onClick={() => handleButtonClick('signup')}
        >
          Register
        </Button>
      )}

      {/* Characters button moved here */}
      {isAuthenticated && (
        <Button
          className="menu-button"
          color="primary"
          onClick={() => handleButtonClick('showCharacters')}
        >
          Characters
        </Button>
      )}
    </div>
  );

  /**
   * Renders the Login and SignUp modal components conditionally based on
   * state.
   *
   * @returns {React.ReactElement} A fragment containing the modals, if active.
   */
  const AuthModals = () => (
    <>
      {userLoggingIn && (
        <Login
          cancelHandler={() => handleButtonClick('loginCancel')}
          completedHandler={() => handleButtonClick('loginCompleted')}
        />
      )}
      {userSigningUp && (
        <SignUp
          cancelHandler={() => handleButtonClick('signupCancel')}
          completedHandler={() => handleButtonClick('signupCompleted')}
        />
      )}
    </>
  );

  /**
   * Renders the audio control panels for sounds, music, and ambience.
   *
   * @returns {React.ReactElement} A fragment containing audio settings UI.
   */
  const AudioSettings = () => (
    <>
      {addDividerContainer('Client Settings')}
      <div
        style={{
          marginTop: '0',
          padding: '10px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '10px',
          width: '100%',
          height: '100%',
        }}
      >
        <AudioControlPanel
          type="sounds"
          initialVolume={soundsVolume}
          initiallyPlaying={true}
          initiallyMuted={false}
          isOpen={soundsSettingsOpen}
          onToggle={toggleSoundsSettings}
        />
        <AudioControlPanel
          type="music"
          initialVolume={musicVolume}
          initiallyPlaying={true}
          initiallyMuted={false}
          isOpen={musicSettingsOpen}
          onToggle={toggleMusicSettings}
        />
        <AudioControlPanel
          type="ambience"
          initialVolume={ambienceVolume}
          initiallyPlaying={true}
          initiallyMuted={false}
          isOpen={ambienceSettingsOpen}
          onToggle={toggleAmbienceSettings}
        />
      </div>
    </>
  );

  /**
   * Renders the main menu UI when the game has not been started. Includes
   * title, auth controls, character section (if applicable), status messages,
   * auth modals, and audio settings. Shows a loading indicator while user data
   * is being fetched.
   *
   * @returns {React.ReactElement} The main menu UI structure.
   */
  const renderMainPage = () => {
    // Add this log to check the state when the main page tries to render
    // DEBUGGING
    // console.debug(
    //   `[${new Date().toISOString()}] [DEBUG] ` +
    //   `[MainMenuControls renderMainPage] ` +
    //   `isLoading: ${isLoading}, userLoggingIn: ${userLoggingIn}, ` +
    //   `userSigningUp: ${userSigningUp}`
    // );
    // Add console.trace to log the call stack
    // console.trace(
    //   `[${new Date().toISOString()}] [TRACE] ` +
    //   `[MainMenuControls renderMainPage] Call stack:`
    // );

    if (isLoading) {
      return (
        <div
          className="game-controls"
          style={{ /* Style as needed, maybe ensure position relative for modals */ }}
        >
          <h2
            className="main-title"
            style={{
              fontSize: '1.6em',
              paddingTop: '3em',
              fontWeight: 'bold',
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Loading... Please wait.
          </h2>
        </div>
      );
    }

    return (
      <div
        className="game-controls"
        style={{ /* Style as needed, maybe ensure position relative for modals */ }}
      >
        <h2
          className="main-title"
          style={{
            fontSize: '1.6em',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          Main Menu
        </h2>
        {/* UserAuthControls now includes the Characters button */}
        <UserAuthControls />
        {/* CharacterSection now only renders the menu when active */}
        <CharacterSectionDisplay
          isAuthenticated={isAuthenticated}
          showCharacterMenu={showCharacterMenu}
          toggleCharFilters={toggleCharFilters}
          showCharFilters={showCharFilters}
          charSearchTerm={charSearchTerm}
          setCharSearchTerm={setCharSearchTerm}
          charFilterFavorite={charFilterFavorite}
          setCharFilterFavorite={setCharFilterFavorite}
          toggleCharSortOrder={toggleCharSortOrder}
          charSortKey={charSortKey}
          charSortOrder={charSortOrder}
          resetCharFilters={resetCharFilters}
          charactersLoading={charactersLoading}
          charactersError={charactersError}
          renameError={renameError}
          clearRenameError={clearRenameError}
          filteredSortedCharacters={filteredSortedCharacters}
          handleButtonClick={handleButtonClick}
          handleSaveNickname={handleSaveNickname}
          handleCreateCharacter={handleCreateCharacter}
          handleDeleteCharacter={handleDeleteCharacter}
          fetchCharacters={fetchCharacters}
          handleSetFavorite={handleSetFavorite}
          handlePlayMap={handlePlayMap}
          onCharacterMapFavoriteStatusChanged={
            handleCharacterMapFavoriteStatusChanged
          }
          onMapDeleted={handleMapDeleted}
        />

        {/* Auth Modals are now rendered here, visibility controlled internally */}
        <AuthModals />

        <p
          style={{
            marginTop: '1rem',
            marginBottom: '0',
            textAlign: 'center',
          }}
        >
          {isAuthenticated &&
            !currentUser?.isTemporary
            ? `You are logged in as ${currentUser?.username}.` +
            ` Your game progress will be saved.`
            : `Save the progress of your farms and continue playing ` +
            `on other devices by logging in.`}
        </p>

        <AudioSettings />
      </div>
    );
  };

  /**
   * Renders the in-game controls UI when the game *has* been started.
   * Delegates the actual rendering to the `GameControls` component, passing
   * down necessary props like map details, control handlers (stop, reload),
   * audio settings state and handlers, and map title visibility controls.
   *
   * @returns {React.ReactElement} The `GameControls` component instance.
   */
  const renderGameControls = () => {
    // Delegate rendering to GameControls, passing necessary props
    return (
      <GameControls
        mapId={mapId}
        mapNickname={mapNickname}
        onStopGame={() => handleButtonClick('stop')}
        onReloadMap={handleReloadMap} // Pass the updated handler
        isReloadDisabled={isReloading} // Pass the state here
        soundsSettingsOpen={soundsSettingsOpen}
        toggleSoundsSettings={toggleSoundsSettings}
        musicSettingsOpen={musicSettingsOpen}
        toggleMusicSettings={toggleMusicSettings}
        ambienceSettingsOpen={ambienceSettingsOpen}
        toggleAmbienceSettings={toggleAmbienceSettings}
        isMapTitleVisible={isMapTitleVisible}
        onToggleMapTitleVisibility={handleToggleMapTitleVisibility}
        soundsVolume={soundsVolume}
        musicVolume={musicVolume}
        ambienceVolume={ambienceVolume}
        onSoundsVolumeChange={handleSoundsVolumeChange}
        onMusicVolumeChange={handleMusicVolumeChange}
        onAmbienceVolumeChange={handleAmbienceVolumeChange}
      />
    );
  };

  return started ? renderGameControls() : renderMainPage();

};

MainMenuControls.propTypes = {
  _dimensions: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  _refController: PropTypes.object,
  instantStart: PropTypes.bool,
  mapId: PropTypes.string,
};

MainMenuControls.defaultProps = {
  instantStart: false,
};

// Wrap the export with React.memo
const MemoizedMainMenuControls = memo(MainMenuControls);

export default MemoizedMainMenuControls; // Export the memoized version
