/**
 * @file src/components/character/MapDetails.jsx
 * @description Component responsible for displaying details and actions for a
 *   selected map.
 *
 * @module components/character/MapDetails
 */
import { useState, useEffect, useCallback } from 'react'; // Keep only used hooks
import PropTypes from 'prop-types';
import {
  Button,
  CardSubtitle,
  ListGroup,
  ListGroupItem,
  Spinner,
  Alert,
  Input,
} from 'reactstrap';
import { updateMapNickname, deleteMap, payMapRent } from '../../api/mapApi.js';

// --- Helper Components --- //

/**
 * Renders the UI for renaming a map.
 *
 * @param {object} props - Component props.
 * @param {string} props.tempMapName - The temporary name being entered.
 * @param {Function} props.handleTempMapNameChange - Handler for name input
 *   changes.
 * @param {boolean} props.isSavingName - Flag indicating if the name save is
 *   in progress.
 * @param {Function} props.handleRenameSave - Handler for the save action.
 * @param {Function} props.handleRenameCancel - Handler for the cancel action.
 * @returns {JSX.Element} The rename map UI.
 */
const RenameUI = ({
  tempMapName,
  handleTempMapNameChange,
  isSavingName,
  handleRenameSave,
  handleRenameCancel,
}) => (
  <div className="d-flex align-items-center gap-2">
    <Input
      type="text"
      bsSize="sm"
      placeholder="Enter new map name"
      value={tempMapName}
      onChange={handleTempMapNameChange}
      disabled={isSavingName}
    />
    <Button
      color="primary"
      size="sm"
      onClick={handleRenameSave}
      disabled={isSavingName || !tempMapName.trim()}
      style={{ minWidth: '50px' }}
    >
      {isSavingName ? <Spinner size="sm" /> : 'Save'}
    </Button>
    <Button
      color="danger"
      size="sm"
      onClick={handleRenameCancel}
      disabled={isSavingName}
      style={{ minWidth: '60px' }}
    >
      Cancel
    </Button>
  </div>
);

RenameUI.propTypes = {
  /** The temporary name being entered. */
  tempMapName: PropTypes.string.isRequired,
  /** Handler for name input changes. */
  handleTempMapNameChange: PropTypes.func.isRequired,
  /** Flag indicating if the name save is in progress. */
  isSavingName: PropTypes.bool.isRequired,
  /** Handler for the save action. */
  handleRenameSave: PropTypes.func.isRequired,
  /** Handler for the cancel action. */
  handleRenameCancel: PropTypes.func.isRequired,
};

/**
 * Renders the standard action buttons for a selected map.
 *
 * @param {object} props - Component props.
 * @param {Function} props.handleRenameStart - Handler to initiate renaming.
 * @param {Function} props.handleDeleteStart - Handler to initiate deletion.
 * @param {Function} props.handleFavoriteToggle - Handler to toggle favorite
 *   status.
 * @param {Function} props.handlePayRent - Handler to pay rent.
 * @param {string} props.selectedMapId - The ID of the selected map.
 * @param {boolean} props.isFavorite - Flag indicating if the map is a
 *   favorite.
 * @param {boolean} props.isActionDisabled - Flag indicating if actions should
 *   be disabled.
 * @returns {JSX.Element} The map actions UI.
 */
const ActionsUI = ({
  handleRenameStart,
  handleDeleteStart,
  handleFavoriteToggle,
  handlePayRent,
  selectedMapId,
  isFavorite,
  isActionDisabled,
}) => (
  <>
    <Button
      color="primary"
      size="sm"
      onClick={handleRenameStart}
      title="Rename this map"
      disabled={isActionDisabled}
    >
      Rename
    </Button>
    <Button
      color={isFavorite ? 'danger' : 'secondary'}
      size="sm"
      onClick={handleFavoriteToggle}
      title={isFavorite ? 'Unset as favorite' : 'Set as favorite'}
      disabled={isActionDisabled}
    >
      {isFavorite ? '★ Unfavorite' : '☆ Favorite'}
    </Button>
    <Button
      color="danger"
      size="sm"
      onClick={handleDeleteStart}
      title="Delete this map"
      disabled={isActionDisabled}
    >
      Delete
    </Button>
    <Button
      color="warning"
      size="sm"
      onClick={() => handlePayRent(selectedMapId)}
      title="Pay current rent for this map"
      disabled={true}
    >
      Pay Rent
    </Button>
  </>
);

ActionsUI.propTypes = {
  /** Handler to initiate renaming. */
  handleRenameStart: PropTypes.func.isRequired,
  /** Handler to initiate deletion. */
  handleDeleteStart: PropTypes.func.isRequired,
  /** Handler to toggle favorite status. */
  handleFavoriteToggle: PropTypes.func.isRequired,
  /** Handler to pay rent. */
  handlePayRent: PropTypes.func.isRequired,
  /** The ID of the selected map. */
  selectedMapId: PropTypes.string.isRequired,
  /** Flag indicating if the map is a favorite. */
  isFavorite: PropTypes.bool.isRequired,
  /** Flag indicating if actions should be disabled. */
  isActionDisabled: PropTypes.bool.isRequired,
};

/**
 * Renders the UI for confirming map deletion.
 *
 * @param {object} props - Component props.
 * @param {Function} props.handleDeleteConfirm - Handler for the confirm
 *   delete action.
 * @param {boolean} props.isDeletingMap - Flag indicating if deletion is in
 *   progress.
 * @param {Function} props.handleDeleteCancel - Handler for the cancel
 *   action.
 * @returns {JSX.Element} The delete confirmation UI.
 */
const DeleteConfirmUI = ({
  handleDeleteConfirm,
  isDeletingMap,
  handleDeleteCancel,
}) => (
  <>
    <Button
      color="danger"
      size="sm"
      onClick={handleDeleteConfirm}
      disabled={isDeletingMap}
      style={{ minWidth: '110px' }}
    >
      {isDeletingMap ? <Spinner size="sm" /> : 'Confirm Delete'}
    </Button>
    <Button
      color="secondary"
      size="sm"
      onClick={handleDeleteCancel}
      disabled={isDeletingMap}
    >
      Cancel
    </Button>
  </>
);

DeleteConfirmUI.propTypes = {
  /** Handler for the confirm delete action. */
  handleDeleteConfirm: PropTypes.func.isRequired,
  /** Flag indicating if deletion is in progress. */
  isDeletingMap: PropTypes.bool.isRequired,
  /** Handler for the cancel action. */
  handleDeleteCancel: PropTypes.func.isRequired,
};

/**
 * Renders map statistics.
 *
 * @param {object} props - Component props.
 * @param {object|null} props.mapStats - Object containing calculated map
 *   statistics, or null if unavailable.
 * @returns {JSX.Element} The map statistics display.
 */
const MapStats = ({ mapStats }) => {
  if (!mapStats) {
    return (
      <Alert color="warning" className="mt-2">
        Could not calculate map statistics.
      </Alert>
    );
  }

  return (
    <ListGroup flush>
      <ListGroupItem>
        <strong>Area (Max):</strong> {mapStats.area} <i>({Math.sqrt(mapStats.area)} x {Math.sqrt(mapStats.area)})</i>
      </ListGroupItem>
      <ListGroupItem>
        <strong>Tiles Leased:</strong> {mapStats.leasedCount}
      </ListGroupItem>
      {mapStats.leasableCount > 0 && (
        <ListGroupItem>
          <strong>Tiles Leasable:</strong> {mapStats.leasableCount}
        </ListGroupItem>
      )}
    </ListGroup>
  );
};

MapStats.propTypes = {
  /**
   * Object containing calculated map statistics, or null if unavailable.
   */
  mapStats: PropTypes.object,
};

/**
 * Renders error and success alerts.
 *
 * @param {object} props - Component props.
 * @param {string|null} props.detailsError - Error message related to general
 *   details operations (rename, delete).
 * @param {string|null} props.payRentError - Error message related to paying
 *   rent.
 * @param {string|null} props.payRentSuccess - Success message related to
 *   paying rent.
 * @returns {JSX.Element} The alert messages UI.
 */
const AlertMessages = ({ detailsError, payRentError, payRentSuccess }) => (
  <>
    {detailsError && (
      <Alert color="danger" className="mb-2">
        {detailsError}
      </Alert>
    )}
    {payRentError && (
      <Alert color="danger" className="mb-2">
        {payRentError}
      </Alert>
    )}
    {payRentSuccess && (
      <Alert color="success" className="mb-2">
        {payRentSuccess}
      </Alert>
    )}
  </>
);

AlertMessages.propTypes = {
  /** Error message related to general details operations. */
  detailsError: PropTypes.string,
  /** Error message related to paying rent. */
  payRentError: PropTypes.string,
  /** Success message related to paying rent. */
  payRentSuccess: PropTypes.string,
};

// --- Custom Hooks --- //

/**
 * Custom hook to manage the state and logic for paying map rent.
 *
 * Provides state variables for tracking payment status, success/error
 * messages, and a function to initiate the rent payment process. Also
 * includes a function to clear messages.
 *
 * @param {string|undefined} mapId - The ID of the map for which rent is to
 *   be paid.
 * @returns {{
 *   handlePayRent: Function,
 *   isPayingRent: boolean,
 *   payRentSuccess: string,
 *   payRentError: string|null,
 *   clearPayRentMessages: Function
 * }} Object containing state and handlers for rent payment.
 */
const usePayRent = (mapId) => {
  const [isPayingRent, setIsPayingRent] = useState(false);
  const [payRentSuccess, setPayRentSuccess] = useState('');
  const [payRentError, setPayRentError] = useState(null);

  const clearPayRentMessages = useCallback(() => {
    setPayRentSuccess('');
    setPayRentError(null);
  }, []);

  const handlePayRent = useCallback(async () => {
    if (!mapId) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] ` +
        `[usePayRent handlePayRent]: Cannot pay rent, mapId is missing.`
      );
      setPayRentError('Cannot pay rent: Map ID is missing.');
      return;
    }

    setIsPayingRent(true);
    setPayRentError(null);
    setPayRentSuccess('');

    try {
      const result = await payMapRent(mapId);
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [usePayRent handlePayRent]: ` +
        `Rent payment API call successful for map ${mapId}:`, result
      );
      setPayRentSuccess(result.message || 'Rent paid successfully!');
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to pay rent.';
      console.error(
        `[${new Date().toISOString()}] [ERROR] ` +
        `[usePayRent handlePayRent]: Failed to pay rent for map ${mapId}:`,
        message,
        err
      );
      setPayRentError(`Rent payment failed: ${message}`);
    } finally {
      setIsPayingRent(false);
    }
  }, [mapId]);

  return {
    handlePayRent,
    isPayingRent,
    payRentSuccess,
    payRentError,
    clearPayRentMessages
  };
};

/**
 * Custom hook to manage the renaming functionality.
 *
 * Provides state variables for tracking renaming status, temporary name,
 * saving status, and errors. Also includes handlers for starting, changing,
 * canceling, and saving the rename operation.
 *
 * @param {object|null} selectedMap - The currently selected map object.
 * @param {Function} onMapUpdate - Callback function to update the map list
 *   after a successful rename.
 * @returns {{
 *   isRenaming: boolean,
 *   tempMapName: string,
 *   isSavingName: boolean,
 *   renameError: string|null,
 *   handleRenameStart: Function,
 *   handleTempMapNameChange: Function,
 *   handleRenameCancel: Function,
 *   handleRenameSave: Function
 * }} Object containing state and handlers for renaming.
 */
const useRenameMap = (selectedMap, onMapUpdate) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempMapName, setTempMapName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [renameError, setRenameError] = useState(null);

  useEffect(() => {
    setIsRenaming(false);
    setTempMapName(selectedMap?.mapNickname || '');
    setIsSavingName(false);
    setRenameError(null);
  }, [selectedMap]);

  const handleRenameStart = useCallback(() => {
    if (!selectedMap) return;
    setIsRenaming(true);
    setTempMapName(selectedMap.mapNickname || '');
    setRenameError(null);
  }, [selectedMap]);

  const handleTempMapNameChange = useCallback((event) => {
    setTempMapName(event.target.value);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setIsRenaming(false);
    setTempMapName('');
    setRenameError(null);
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (!selectedMap || !tempMapName.trim()) {
      setRenameError('New map name cannot be empty.');
      return;
    }
    const mapId = selectedMap._id;
    const newName = tempMapName.trim();
    setIsSavingName(true);
    setRenameError(null);

    try {
      const updatedMapData = await updateMapNickname(mapId, newName);
      setIsRenaming(false);
      setTempMapName('');
      onMapUpdate(updatedMapData);
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [useRenameMap] Failed to rename map ${mapId}:`,
        err
      );
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update map name.';
      setRenameError(`Rename failed: ${message}`);
    } finally {
      setIsSavingName(false);
    }
  }, [selectedMap, tempMapName, onMapUpdate]);

  return {
    isRenaming,
    tempMapName,
    isSavingName,
    renameError,
    handleRenameStart,
    handleTempMapNameChange,
    handleRenameCancel,
    handleRenameSave
  };
};

/**
 * Custom hook to manage the delete functionality.
 *
 * Provides state variables for tracking delete confirmation status, deletion
 * progress, and errors. Includes handlers for starting, canceling, and
 * confirming the delete operation.
 *
 * @param {object|null} selectedMap - The currently selected map object.
 * @param {Function} onDeselectMap - Callback function to clear the map
 *   selection after deletion.
 * @param {Function|undefined} onMapDeleted - Optional callback function
 *   invoked after successful deletion, passing the deleted map ID.
 * @param {Function} fetchMaps - Function to refresh the map list after
 *   deletion.
 * @returns {{
 *   confirmingDelete: boolean,
 *   isDeleting: boolean,
 *   deleteError: string|null,
 *   handleDeleteStart: Function,
 *   handleDeleteCancel: Function,
 *   handleDeleteConfirm: Function
 * }} Object containing state and handlers for map deletion.
 */
const useDeleteMap = (selectedMap, onDeselectMap, onMapDeleted, fetchMaps) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    setConfirmingDelete(false);
    setIsDeleting(false);
    setDeleteError(null);
  }, [selectedMap]);

  const handleDeleteStart = useCallback(() => {
    if (!selectedMap) return;
    setConfirmingDelete(true);
    setDeleteError(null);
  }, [selectedMap]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const mapIdToDelete = selectedMap?._id;
    if (!mapIdToDelete) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [useDeleteMap]: Cannot delete, selectedMap or its ID is missing.`
      );
      setDeleteError('Cannot delete: Map ID is missing.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteMap(mapIdToDelete);

      if (onMapDeleted) {
        console.debug(
          `[${new Date().toISOString()}] [DEBUG] [useDeleteMap] ` +
          `handleDeleteConfirm: Calling onMapDeleted for map ID:` +
          ` ${mapIdToDelete}`
        );
        onMapDeleted(mapIdToDelete);
      } else {
        console.warn(
          `[${new Date().toISOString()}] [WARN] [useDeleteMap] ` +
          `handleDeleteConfirm: onMapDeleted handler not provided.`
        );
      }

      setConfirmingDelete(false);
      onDeselectMap();
      await fetchMaps();
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to delete map.';
      console.error(
        `[${new Date().toISOString()}] [ERROR] [useDeleteMap] ` +
        `handleDeleteConfirm: Failed to delete map ${mapIdToDelete}:`,
        message,
        err
      );
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedMap, onDeselectMap, onMapDeleted, fetchMaps]);

  return {
    confirmingDelete,
    isDeleting,
    deleteError,
    handleDeleteStart,
    handleDeleteCancel,
    handleDeleteConfirm
  };
};

// --- Helper Functions --- //

/**
 * Processes a single tile's data to determine count increments for map
 * statistics.
 *
 * Checks if a tile contributes to the 'leased' count or the 'leasable'
 * count based on its properties. Handles invalid tile data gracefully.
 *
 * @param {object|null} tile - The tile object from the map data.
 * @returns {{leasableIncrement: number, leasedIncrement: number}} Increments
 *   for the statistics calculation.
 * @private
 */
const _getTileIncrements = (tile) => {
  const increments = { leasableIncrement: 0, leasedIncrement: 0 };

  if (typeof tile !== 'object' || tile === null) {
    console.warn(
      `[${new Date().toISOString()}] [WARN] [_getTileIncrements]` +
      ` Received invalid tile data:`,
      tile
    );
    return increments;
  }

  if (!Object.hasOwn(tile, 'properties') ||
    !Object.hasOwn(tile.properties, 'leasable')) {
    return increments;
  }

  if (tile.properties.base === false &&
    tile.properties.leasable === false) {
    increments.leasedIncrement = 1;
  } else {
    increments.leasableIncrement = tile.properties.base ? 0 : 1;
  }

  return increments;
};

/**
 * Helper to calculate map statistics from the `tiles` object within a map.
 *
 * Iterates through the tiles, summing up leasable and leased counts using
 * `_getTileIncrements`. Returns an object with calculated counts and total
 * area. Handles invalid `tiles` input.
 *
 * @param {object} [tiles={}] - The `tiles` object from the map data, where
 *   keys are coordinates and values are tile objects.
 * @returns {{
 *   totalTiles: number,
 *   leasableCount: number,
 *   leasedCount: number,
 *   area: number
 * }|null} Calculated map statistics, or null if input is invalid.
 */
const calculateMapStats = (tiles = {}) => {
  if (typeof tiles !== 'object' || tiles === null) {
    console.warn(
      `[${new Date().toISOString()}] [WARN] ` +
      `[MapDetails:calculateMapStats] Received invalid tiles:`,
      tiles
    );
    return null;
  }

  let tileCounts = {
    leasableCount: 0,
    leasedCount: 0,
  };
  let totalTiles = 0;

  for (const coord in tiles) {
    if (Object.hasOwn(tiles, coord)) {
      totalTiles++;
      const increments = _getTileIncrements(tiles[coord]);
      tileCounts.leasableCount += increments.leasableIncrement;
      tileCounts.leasedCount += increments.leasedIncrement;
    }
  }

  return {
    totalTiles,
    leasableCount: tileCounts.leasableCount,
    leasedCount: tileCounts.leasedCount,
    area: totalTiles
  };
};

/**
 * Displays details and actions for the selected map.
 *
 * This component orchestrates the display of map information (name, stats)
 * and provides actions like renaming, deleting, favoriting, and paying rent.
 * It utilizes several custom hooks (`useRenameMap`, `useDeleteMap`,
 * `usePayRent`) to manage the state and logic for these actions.
 *
 * @param {object} props - Component props.
 * @param {object|null} props.selectedMap - The full map object currently
 *   selected. Can be null if no map is selected.
 * @param {Function} props.fetchMaps - Function to refresh the list of maps
 *   in the parent component.
 * @param {Function} props.onDeselectMap - Function to call in the parent
 *   to clear the current map selection.
 * @param {Function} props.onFavoriteMap - Function passed from the parent
 *   to handle toggling the favorite status of a map.
 * @param {Function} props.onMapUpdate - Function to notify the parent of
 *   local map updates (e.g., after a rename).
 * @param {Function} [props.onMapDeleted] - Optional function to notify the
 *   parent after a map is successfully deleted. Receives the deleted map ID.
 * @returns {JSX.Element|null} The MapDetails component UI, or null if no
 *   map is selected.
 */
function MapDetails({
  selectedMap,
  fetchMaps,
  onDeselectMap,
  onFavoriteMap,
  onMapUpdate,
  onMapDeleted,
}) {
  // Use custom hooks for state management
  const {
    isRenaming,
    tempMapName,
    isSavingName,
    renameError,
    handleRenameStart,
    handleTempMapNameChange,
    handleRenameCancel,
    handleRenameSave
  } = useRenameMap(selectedMap, onMapUpdate);

  const {
    confirmingDelete,
    isDeleting,
    deleteError,
    handleDeleteStart,
    handleDeleteCancel,
    handleDeleteConfirm
  } = useDeleteMap(selectedMap, onDeselectMap, onMapDeleted, fetchMaps);

  const {
    handlePayRent,
    isPayingRent,
    payRentSuccess,
    payRentError,
    clearPayRentMessages
  } = usePayRent(selectedMap?._id);

  // Calculate error state from all sources
  const detailsError = renameError || deleteError || null;

  // Calculate statistics
  const mapStats = selectedMap ? calculateMapStats(selectedMap.tiles) : null;

  // Clean up all messages when selectedMap changes
  useEffect(() => {
    clearPayRentMessages();
  }, [selectedMap, clearPayRentMessages]);

  /**
   * Handles toggling the favorite status of the selected map.
   *
   * Calls the `onFavoriteMap` prop function passed from the parent component.
   * Includes basic error handling for the call itself. Assumes the parent
   * handles the actual API call and state update logic.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleFavoriteToggle = useCallback(async () => {
    if (!selectedMap?._id || !onFavoriteMap) return;
    try {
      await onFavoriteMap(selectedMap._id);
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] [ERROR] [MapDetails] Error occurred during favorite toggle (handled by parent):`,
        err
      );
    }
  }, [selectedMap, onFavoriteMap]);

  // Don't render anything if no map is selected
  if (!selectedMap) {
    return null;
  }

  // Determine if any action is in progress
  const isActionInProgress = isRenaming || confirmingDelete || isPayingRent || isSavingName || isDeleting;

  return (
    <div
      className="mt-3 p-3 map-details-container"
      style={{
        backgroundColor: '#f8f9fa',
        borderRadius: '5px',
      }}
    >
      <AlertMessages
        detailsError={detailsError}
        payRentError={payRentError}
        payRentSuccess={payRentSuccess}
      />

      <CardSubtitle
        style={{
          fontSize: '1.2rem',
          fontWeight: 'bold',
          color: 'lightskyblue',
        }}
        tag="h6"
        className="mb-2 text-muted"
      >
        {isRenaming ? 'Rename Map' : `Map Details`}
      </CardSubtitle>

      {isRenaming ? (
        <RenameUI
          tempMapName={tempMapName}
          handleTempMapNameChange={handleTempMapNameChange}
          isSavingName={isSavingName}
          handleRenameSave={handleRenameSave}
          handleRenameCancel={handleRenameCancel}
        />
      ) : (
        <>
          <MapStats mapStats={mapStats} />
          <div className="d-flex flex-column align-items-start gap-2 mt-3">
            {confirmingDelete ? (
              <DeleteConfirmUI
                handleDeleteConfirm={handleDeleteConfirm}
                isDeletingMap={isDeleting}
                handleDeleteCancel={handleDeleteCancel}
              />
            ) : (
              <ActionsUI
                handleFavoriteToggle={handleFavoriteToggle}
                isFavorite={selectedMap.isFavorite || false}
                handleRenameStart={handleRenameStart}
                handleDeleteStart={handleDeleteStart}
                selectedMapId={selectedMap._id}
                handlePayRent={handlePayRent}
                isActionDisabled={isActionInProgress}
              />
            )}
          </div>
          {isPayingRent && (
            <div className="mt-2">
              <Spinner size="sm" color="warning" /> Paying rent...
            </div>
          )}
        </>
      )}
    </div>
  );
}

MapDetails.propTypes = {
  /** The full map object that is selected. Can be null if nothing selected. */
  selectedMap: PropTypes.object,
  /** Function to refresh the map list. */
  fetchMaps: PropTypes.func.isRequired,
  /** Function to call to clear the map selection in the parent. */
  onDeselectMap: PropTypes.func.isRequired,
  /** Function to handle toggling favorite status. */
  onFavoriteMap: PropTypes.func.isRequired,
  /** Function to notify parent of local map updates (e.g., after rename). */
  onMapUpdate: PropTypes.func.isRequired,
  /** Optional function to notify parent after a map is successfully deleted. */
  onMapDeleted: PropTypes.func,
};

export default MapDetails;
