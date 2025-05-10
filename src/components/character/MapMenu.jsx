/**
 * @file src/components/character/MapMenu.jsx
 * @description Container component for managing and displaying character maps.
 * @module components/character/MapMenu
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Card,
  CardBody,
  Row,
  Col,
  Spinner,
  Alert,
  Input,
} from 'reactstrap';
import {
  getMapsByCharacterId,
  createMapForCharacter,
  setFavoriteMap,
} from '../../api/mapApi.js';
import MapList from './MapList.jsx';
import MapDetails from './MapDetails.jsx';
import '../../styles/MapMenu.css'; // Import the CSS file

// --- Helper Components --- //

/**
 * Renders the action buttons for the MapMenu.
 *
 * @param {object} props - Component props.
 * @param {object | null} props.selectedMap - The currently selected map.
 * @param {boolean} props.isLoading - Whether the map list is loading.
 * @param {boolean} props.isCreating - Whether a map is being created.
 * @param {Function} props.handleCreateMap - Handler for creating a map.
 * @param {Function} props.toggleFilter - Handler for toggling the filter
 *   input.
 * @param {boolean} props.showFilter - Whether the filter input is shown.
 * @param {Function} props.fetchMaps - Handler for refreshing maps.
 * @param {Function} props.onClose - Handler for closing the map menu.
 * @param {Function} props.onPlayMap - Handler for starting the game with this
 *   map.
 * @param {string} props.characterId - The MongoDB ID of the character.
 * @returns {React.ReactElement} The action buttons element.
 */
function ActionButtons({
  selectedMap,
  isLoading,
  isCreating,
  handleCreateMap,
  toggleFilter,
  showFilter,
  fetchMaps,
  onClose,
  onPlayMap,
  characterId,
}) {
  return (
    <>
      <Button
        color="primary"
        size="sm"
        onClick={handleCreateMap}
        title="Create a new map for this character"
        style={{ minWidth: '90px' }}
        disabled={isCreating || isLoading}
      >
        {isCreating ? <Spinner size="sm" /> : 'Create Map'}
      </Button>
      <Button
        color="secondary"
        size="sm"
        onClick={toggleFilter}
        title={showFilter ? 'Hide map filter' : 'Filter maps by name'}
        style={{ minWidth: '90px' }}
        disabled={isLoading || isCreating}
        aria-expanded={showFilter}
      >
        {showFilter ? 'Hide Filter' : 'Filter Maps'}
      </Button>
      <Button
        color="info"
        size="sm"
        onClick={fetchMaps}
        title="Refresh map data"
        style={{ minWidth: '90px' }}
        disabled={isLoading || isCreating}
      >
        Refresh
      </Button>

      <hr className="w-50 d-none d-md-block" />

      <Button
        color="danger"
        size="sm"
        onClick={onClose}
        title="Close this map view"
        className="close-map-button"
        style={{ minWidth: '90px' }}
      >
        Close Maps
      </Button>

      <hr className="w-75 d-none d-md-block" />

      {selectedMap && (
        <Button
          color="success"
          size="lg"
          className={`d-block w-50 mt-2 map-button-cycling play-map-button`}
          onClick={() => {
            if (onPlayMap) {
              onPlayMap(selectedMap._id, characterId);
            } else {
              console.warn(
                `[${new Date().toISOString()}] [WARN] [ActionButtons]: ` +
                `onPlayMap handler not provided.`
              );
            }
          }}
          title={`Play ${selectedMap.mapNickname || 'selected map'}`}
          style={{
            fontFamily: `'Press Start 2P', cursive`,
            minWidth: '120px',
            boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.3)',
            color: 'yellow',
          }}
          disabled={isLoading || isCreating}
        >
          Play
        </Button>
      )}
    </>
  );
}

ActionButtons.propTypes = {
  selectedMap: PropTypes.object,
  isLoading: PropTypes.bool.isRequired,
  isCreating: PropTypes.bool.isRequired,
  handleCreateMap: PropTypes.func.isRequired,
  toggleFilter: PropTypes.func.isRequired,
  showFilter: PropTypes.bool.isRequired,
  fetchMaps: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onPlayMap: PropTypes.func,
  characterId: PropTypes.string.isRequired,
};

// --- Helper Functions (Keep fetch, create, error helpers) --- //

/**
 * Checks if an error object indicates a map limit error based on status code
 * and response data content.
 *
 * @param {Error} err - The error object, likely an AxiosError.
 * @returns {boolean} True if the error indicates a map limit condition, false
 *   otherwise.
 */
const _isMapLimitError = (err) => {
  const status = err?.response?.status;
  const dataString = JSON.stringify(err?.response?.data || '');
  return (
    status === 400 && dataString.includes('Character cannot have more than')
  );
};

/**
 * Determines the appropriate error message string for map creation failures,
 * prioritizing backend messages over generic ones and specifically handling
 * map limit errors.
 *
 * @param {Error} err - The error object caught (likely AxiosError).
 * @returns {string} The processed error message suitable for display.
 */
const getMapCreationErrorMessage = (err) => {
  const backendMessage =
    err?.response?.data?.message || err?.response?.data?.error?.message;

  const genericMessage = err?.message || 'Failed to create map.';

  // Check for map limit error using the helper
  if (_isMapLimitError(err)) {
    // Return the full desired error message
    return 'Map limit reached. Cannot create more.';
  }

  // Return the most specific message available
  return backendMessage || genericMessage;
};

/**
 * Determines the appropriate error message string for errors encountered
 * when attempting to set a favorite map. Prioritizes backend messages.
 *
 * @param {Error} err - The error object, likely an AxiosError.
 * @returns {string} The processed error message.
 */
const _getFavoriteMapErrorMessage = (err) => {
  const backendMessage =
    err?.response?.data?.message || err?.response?.data?.error?.message;
  const genericMessage = err?.message || 'Failed to update favorite status.';
  // Add specific checks if needed, e.g., for specific error codes
  return backendMessage || genericMessage;
};

/**
 * Asynchronously fetches maps for a specific character ID and updates the
 * component's state including maps list, loading status, and any internal
 * errors encountered during the fetch.
 *
 * @param {string} characterId - The MongoDB ID of the character whose maps
 *   are to be fetched.
 * @param {Function} setMaps - State setter function for the maps array.
 * @param {Function} setIsLoading - State setter function for the loading
 *   boolean.
 * @param {Function} setInternalError - State setter function for storing
 *   error messages.
 * @returns {Promise<void>} A promise that resolves when the fetch and state
 *   updates are complete.
 */
const _fetchCharacterMaps = async (
  characterId,
  setMaps,
  setIsLoading,
  setInternalError
) => {
  setIsLoading(true);
  setInternalError(null); // Clear internal error on fetch
  // Selection persistence is no longer handled here.
  try {
    const fetchedMaps = await getMapsByCharacterId(characterId);
    setMaps(fetchedMaps); // Update the main map list
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] [ERROR] [_fetchCharacterMaps]: ` +
      `Failed to fetch maps for ${characterId}:`,
      err?.message || err
    );
    setInternalError(
      err?.response?.data?.message || err?.message || 'Failed to load maps.'
    );
    // Keep stale list on error
  } finally {
    setIsLoading(false);
  }
};

// --- End Helper Functions ---

/**
 * Container component responsible for managing and displaying a character's
 * maps. It includes functionality for listing, selecting, creating,
 * filtering, favoriting, and initiating gameplay for maps.
 *
 * @component MapMenu
 * @param {object} props - Component props.
 * @param {string} props.characterId - The MongoDB ID of the character whose
 *   maps are being displayed.
 * @param {Function} props.onClose - Callback function invoked when the user
 *   requests to close the map view.
 * @param {string} [props._error] - Optional error message passed down from a
 *   parent component to be displayed initially.
 * @param {Function} [props.onPlayMap] - Optional callback handler invoked
 *   when the user chooses to start playing a selected map. Receives mapId and
 *   characterId.
 * @param {Function} [props.onMapFavoriteStatusChanged] - Optional callback
 *   handler invoked after a map's favorite status has been successfully
 *   updated on the server.
 * @param {Function} [props.onMapDeleted] - Optional callback handler invoked
 *   after a map has been successfully deleted from the server.
 * @returns {React.ReactElement} The rendered MapMenu component.
 */
function MapMenu({
  characterId,
  onClose,
  _error,
  onPlayMap,
  onMapFavoriteStatusChanged,
  onMapDeleted,
}) {
  const [maps, setMaps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [internalError, setInternalError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const creationErrorTimeoutRef = useRef(null); // Ref for the error timeout
  const creationErrorAlertRef = useRef(null); // Ref for the creation error Alert
  // Rename/Delete/Stats states and helpers are now moved to MapDetails

  /**
   * Fetches maps for the currently specified characterId from the backend API.
   * This function is memoized using useCallback to optimize performance by
   * preventing unnecessary re-creation on re-renders, dependent only on
   * `characterId` and stable state setters.
   *
   * @function fetchMaps
   * @returns {Promise<void>} A promise resolving after the fetch attempt.
   */
  const fetchMaps = useCallback(async () => {
    if (!characterId) return;
    // Selection ID is no longer needed here
    // const currentSelectedId = selectedMap?._id;
    // Delegate fetching, only pass setters for list, loading, and error
    await _fetchCharacterMaps(
      characterId,
      setMaps,
      setIsLoading,
      setInternalError
      // Removed: setSelectedMap,
      // Removed: currentSelectedId
    );
    // Dependencies only relate to fetching the list now
  }, [characterId, setMaps, setIsLoading, setInternalError]);

  // Fetch maps on initial mount and when characterId changes
  useEffect(() => {
    fetchMaps();
    // Cleanup timeout on unmount
    return () => {
      clearTimeout(creationErrorTimeoutRef.current);
    };
  }, [fetchMaps]);

  /**
   * Asynchronous helper function to handle the creation of a new map via API
   * call. Updates loading and error states, refreshes the map list on success,
   * automatically selects the new map, and handles potential creation errors,
   * including a timeout for error messages. Memoized with useCallback.
   *
   * @function _createCharacterMap
   * @returns {Promise<void>} A promise resolving after the creation attempt.
   */
  const _createCharacterMap = useCallback(async () => {
    if (!characterId) return;

    setIsCreating(true);
    setCreationError(null); // Clear previous creation errors

    // Clear any existing timeout before setting a new one
    clearTimeout(creationErrorTimeoutRef.current);

    try {
      // Call API directly and store the returned map
      const newMap = await createMapForCharacter(characterId, {}); // No nickname needed
      await fetchMaps(); // Refresh list on success
      // Automatically select the newly created map
      setSelectedMap(newMap);
    } catch (err) {
      const finalErrorMessage = getMapCreationErrorMessage(err);
      console.error(
        `[${new Date().toISOString()}] [ERROR] [_createCharacterMap]: ` +
        `Failed to create map for ${characterId}:`,
        finalErrorMessage,
        err
      );
      setCreationError(finalErrorMessage); // Set dedicated creation error state

      // Set a timeout to clear the error message after 5 seconds
      creationErrorTimeoutRef.current = setTimeout(() => {
        setCreationError(null);
      }, 5000);
    } finally {
      setIsCreating(false);
    }
  }, [
    characterId,
    fetchMaps,
    setCreationError,
    setIsCreating,
    setSelectedMap,
  ]);

  /**
   * Initiates the process of creating a new map for the current character by
   * calling the `_createCharacterMap` helper function. Memoized with
   * useCallback.
   *
   * @function handleCreateMap
   * @returns {Promise<void>} A promise resolving after the creation attempt.
   */
  const handleCreateMap = useCallback(async () => {
    await _createCharacterMap();
  }, [_createCharacterMap]); // Depend on the memoized helper

  /**
   * Handles the selection or deselection of a map from the list. If the
   * clicked map is already selected, it deselects it; otherwise, it selects
   * the clicked map. Ensures a valid map object with an `_id` is provided.
   * Memoized with useCallback.
   *
   * @function handleMapSelect
   * @param {object} map - The full map object that was clicked in the list.
   * @returns {void}
   */
  const handleMapSelect = useCallback((map) => {
    if (!map?._id) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [MapMenu] handleMapSelect ` +
        `called with invalid map object:`,
        map
      );
      return;
    }
    setSelectedMap((prevSelected) => {
      const newSelectedMap = prevSelected?._id === map._id ? null : map;
      return newSelectedMap;
    });
  }, []);

  /**
   * Handles toggling the favorite status of the currently selected map.
   * Performs an optimistic update on the local state for immediate UI
   * feedback, then calls the API. If the API call succeeds, it fetches the
   * updated map list and notifies the parent component. If it fails, it
   * reverts the optimistic update and sets an error message. Ensures the
   * selected map matches the `mapId` argument. Memoized with useCallback.
   *
   * @function handleFavoriteMap
   * @param {string} mapId - The ID of the map to toggle favorite status for.
   * @returns {Promise<void>} A promise resolving after the operation attempt.
   */
  const handleFavoriteMap = useCallback(
    async (mapId) => {
      if (!mapId || !characterId || !selectedMap || selectedMap._id !== mapId) {
        console.warn(
          `[${new Date().toISOString()}] [WARN] [MapMenu] ` +
          `handleFavoriteMap called with invalid mapId (${mapId}), ` +
          `characterId (${characterId}), or mismatch with ` +
          `selectedMap (${selectedMap?._id}).`
        );
        return;
      }

      // --- Optimistic Update ---
      const originalSelectedMap = selectedMap; // Store original state for potential rollback
      const newFavoriteStatus = !originalSelectedMap.isFavorite;

      // Update selectedMap immediately for instant UI feedback
      setSelectedMap((prevSelected) =>
        prevSelected && prevSelected._id === mapId
          ? { ...prevSelected, isFavorite: newFavoriteStatus }
          : prevSelected
      );
      setInternalError(null); // Clear previous errors
      // --- End Optimistic Update ---

      try {
        // Call the API function
        await setFavoriteMap(mapId);

        // --- Refresh map list AFTER successful API call --- //
        await fetchMaps(); // Fetch the updated list from the backend

        // --- Notify Parent on Successful Status Change --- //
        if (onMapFavoriteStatusChanged) {
          onMapFavoriteStatusChanged(); // Call the prop function
        }
        // --- End Notify Parent ---
      } catch (err) {
        // --- Rollback on Failure ---
        const errorMessage = _getFavoriteMapErrorMessage(err);
        console.error(
          `[${new Date().toISOString()}] [ERROR] [MapMenu] Failed to ` +
          `favorite map ${mapId}:`,
          errorMessage,
          err // Log the original error object as well
        );
        setInternalError(errorMessage);
        // Revert the optimistic updates
        setSelectedMap(originalSelectedMap);
        // --- End Rollback ---
      }
      // fetchMaps is now stable and only depends on characterId and list setters
      // Dependencies for this handler are the states/setters it uses directly
    },
    [
      characterId,
      fetchMaps,
      selectedMap,
      setSelectedMap,
      setInternalError,
      onMapFavoriteStatusChanged,
    ]
  );

  /**
   * Clears the currently selected map state, setting `selectedMap` to null.
   * Passed down to child components (like `MapDetails`) to allow them to
   * trigger deselection. Memoized with useCallback.
   *
   * @function handleDeselectMap
   * @returns {void}
   */
  const handleDeselectMap = useCallback(() => {
    setSelectedMap(null);
  }, []);

  /**
   * Updates the local state (`maps` array and `selectedMap` if applicable)
   * for a single map after it has been modified (e.g., renamed via
   * `MapDetails`). Ensures the `updatedMap` object is valid before
   * proceeding. Memoized with useCallback.
   *
   * @function handleMapUpdate
   * @param {object} updatedMap - The map object containing the updated data.
   * @returns {void}
   */
  const handleMapUpdate = useCallback(
    (updatedMap) => {
      if (!updatedMap?._id) {
        console.warn(
          `[${new Date().toISOString()}] [WARN] [MapMenu] ` +
          `handleMapUpdate called with invalid map object:`,
          updatedMap
        );
        return;
      }

      // Update the local maps state
      setMaps((prevMaps) =>
        prevMaps.map((mapItem) =>
          mapItem._id === updatedMap._id ? updatedMap : mapItem
        )
      );

      // Also update selectedMap if it was the one updated
      setSelectedMap((prevSelected) =>
        prevSelected?._id === updatedMap._id ? updatedMap : prevSelected
      );
    },
    [setMaps, setSelectedMap]
  ); // Dependencies: setMaps, setSelectedMap

  /**
   * Toggles the visibility of the map search/filter input field. When hiding
   * the filter, it also clears the current search term. Memoized with
   * useCallback.
   *
   * @function toggleFilter
   * @returns {void}
   */
  const toggleFilter = useCallback(() => {
    setShowFilter((prev) => !prev);
    // Clear search term when hiding the filter
    if (showFilter) {
      setSearchTerm('');
    }
  }, [showFilter]);

  /**
   * Prevents the default form submission behavior (which can cause a page
   * reload) when the Enter key is pressed within the map search input field.
   * Memoized with useCallback.
   *
   * @function handleSearchKeyDown
   * @param {React.KeyboardEvent<HTMLInputElement>} event - The keyboard event.
   * @returns {void}
   */
  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent default action (like form submission)
    }
  }, []); // No dependencies needed

  // Only pass loading/parent errors to MapList
  const mapListError = internalError || _error;

  // Filter maps based on searchTerm
  const filteredMaps = useMemo(() => {
    if (!searchTerm) {
      return maps; // Return all maps if search term is empty
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return maps.filter((mapItem) =>
      (mapItem.mapNickname || 'Unnamed Map')
        .toLowerCase()
        .includes(lowerCaseSearchTerm)
    );
  }, [maps, searchTerm]);

  /**
   * Placeholder function for handling the rent payment action for a map.
   * Currently logs an informational message and shows an alert indicating
   * the feature is not implemented. Ensures a `mapId` is provided. Memoized
   * with useCallback.
   *
   * @function handleRentMap
   * @param {string} mapId - The ID of the map for which rent payment was
   *   initiated.
   * @returns {void}
   */
  const handleRentMap = useCallback((mapId) => {
    if (!mapId) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [MapMenu] ` +
        `handleRentMap called without a mapId.`
      );
      return;
    }
    console.info(
      `[${new Date().toISOString()}] [INFO] [MapMenu] ` +
      `Placeholder: Pay Rent clicked for map: ${mapId}`
    );
    // Add actual API call and state updates here later
    // For now, maybe show an alert or log
    alert(
      `Rent payment for map "${selectedMap?.mapNickname || mapId}" is not ` +
      `yet implemented.`
    );
  }, [selectedMap]); // Keep selectedMap dependency for the alert message for now

  /**
   * Handles changes to the text value in the map filter/search input field.
   * Updates the `searchTerm` state with the new value and deselects any
   * currently selected map to avoid confusion when the list is filtered.
   * Memoized with useCallback.
   *
   * @function handleFilterChange
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change
   *   event object.
   * @returns {void}
   */
  const handleFilterChange = useCallback((event) => {
    setSearchTerm(event.target.value);
    // Deselect map whenever the filter text changes
    setSelectedMap(null);
  }, []); // Dependency removed as setSelectedMap is stable

  return (
    <Card className="mt-2 map-menu-card">
      {' '}
      {/* Added class for potential root styling */}
      <CardBody>
        <Row>
          {/* Column 1: Map List & Selected Map Details */}
          <Col md={7} className="mb-3 mb-md-0 map-list-details-col">
            {/* Conditionally render search input */}
            {showFilter && (
              <Input
                type="search"
                placeholder="Search by map name..."
                value={searchTerm}
                onChange={handleFilterChange}
                onKeyDown={handleSearchKeyDown} // Added keydown handler
                className="mb-2 map-search-input" // Class for styling
                bsSize="sm"
                aria-label="Search maps by name"
              />
            )}
            <MapList
              maps={filteredMaps} // Pass the filtered list
              selectedMapId={selectedMap?._id}
              onMapSelect={handleMapSelect}
              // Only show loading spinner initially
              isLoading={isLoading && maps.length === 0}
              error={mapListError} // Pass only relevant errors
              characterId={characterId}
            />

            {/* Selected Map Details/Actions Area - Use MapDetails component */}
            <MapDetails
              selectedMap={selectedMap}
              // Pass fetchMaps for refreshing after actions
              fetchMaps={fetchMaps}
              // Pass callback to clear selection
              onDeselectMap={handleDeselectMap}
              // Pass the handler here
              onFavoriteMap={handleFavoriteMap}
              // Pass the update handler
              onMapUpdate={handleMapUpdate}
              // Pass the new handler down
              onMapDeleted={onMapDeleted}
              // Pass the new handler down
              handlePayRent={handleRentMap}
            />
          </Col>

          {/* Column 2: Action Buttons (Create, Refresh, Close) */}
          <Col
            md={5}
            className="d-flex flex-column align-items-start align-items-md-end gap-1 map-actions-col"
          >

            {/* Render the ActionButtons component */}
            <ActionButtons
              selectedMap={selectedMap}
              isLoading={isLoading}
              isCreating={isCreating}
              handleCreateMap={handleCreateMap}
              toggleFilter={toggleFilter}
              showFilter={showFilter}
              fetchMaps={fetchMaps}
              onClose={onClose}
              onPlayMap={onPlayMap}
              characterId={characterId}
            />


            {creationError && (
              <Alert
                color="danger"
                className="mt-0 mb-2"
                style={{
                  width: '75%',
                }}
                ref={creationErrorAlertRef} // Attach the ref here
              >
                {creationError}
              </Alert>
            )}
          </Col>
        </Row>
      </CardBody>
    </Card>
  );
}

MapMenu.propTypes = {
  /** MongoDB ID of the character whose map is being viewed. */
  characterId: PropTypes.string.isRequired,
  /**
   * Function to call to start the game with a specific map. Receives mapId
   * and characterId.
   */
  onPlayMap: PropTypes.func,
  /** Function to call when the close button is clicked. */
  onClose: PropTypes.func.isRequired,
  /** Optional error message passed from parent component. */
  _error: PropTypes.string,
  /**
   * Optional handler called when a map's favorite status changes
   * successfully on the server.
   */
  onMapFavoriteStatusChanged: PropTypes.func,
  /**
   * Optional handler called after a map is successfully deleted from the
   * server.
   */
  onMapDeleted: PropTypes.func,
};

export default MapMenu;
