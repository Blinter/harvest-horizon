/**
 * @file src/components/character/MapList.jsx
 * @description Component responsible for rendering the list of character maps.
 * @module components/character/MapList
 */
import { memo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ListGroup, ListGroupItem, Spinner, Alert } from 'reactstrap';
import '../../styles/MapMenu.css'; // Reuse styles

/**
 * Renders the list of maps for a character. Handles loading states, errors,
 * and scrolling the selected map into view.
 *
 * @component
 * @param {object} props - Component props.
 * @param {Array<object>} props.maps - Array of map objects associated with the
 *   character. Each object should have at least an `_id`, and optionally
 *   `mapNickname` and `isFavorite`.
 * @param {string|null} props.selectedMapId - The ID of the currently selected
 *   map, or null if no map is selected. Used for highlighting and scrolling.
 * @param {Function} props.onMapSelect - Callback function invoked when a map
 *   item in the list is clicked. It receives the selected map object (e.g.,
 *   `{ _id: '...', mapNickname: '...', isFavorite: false }`) as an argument.
 * @param {boolean} props.isLoading - Indicates if the map list data is
 *   currently being fetched or processed. Displays a spinner if true.
 * @param {string|null} props.error - An error message string to display if
 *   loading failed, otherwise null. Displays an alert if present.
 * @returns {React.ReactElement} The MapList component, rendering either a
 *   loading indicator, an error message, or the interactive list of maps.
 */
const MapList = memo(
  ({ maps, selectedMapId, onMapSelect, isLoading, error }) => {
    const listGroupRef = useRef(null); // Ref for the scrollable container

    // Effect to scroll the selected item into view
    useEffect(() => {
      if (selectedMapId && listGroupRef.current) {
        const itemElement = listGroupRef.current.querySelector(
          `[data-map-id="${selectedMapId}"]`
        );
        if (itemElement) {
          itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      // Dependency array: run when selectedMapId changes or when maps list updates
      // (to ensure the element exists before trying to scroll)
    }, [selectedMapId, maps]);

    if (isLoading) {
      return (
        <div className="text-center">
          <Spinner size="sm" /> Loading maps...
        </div>
      );
    }

    if (error) {
      return <Alert color="danger">Error: {error}</Alert>;
    }

    return (
      <>
        <h6 className="card-title">Map List</h6>
        <ListGroup
          flush
          ref={listGroupRef} // Attach the ref here
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            marginBottom: '1rem',
          }}
        >
          {maps.length === 0 ? (
            <ListGroupItem className="map-list-item">
              No maps found for this character.
            </ListGroupItem>
          ) : (
            maps.map((mapItem) => (
              <ListGroupItem
                key={mapItem._id}
                tag="button"
                action
                className={`map-list-item ${selectedMapId === mapItem._id ? 'active' : ''
                  }`}
                onClick={() => onMapSelect(mapItem)}
                disabled={isLoading}
                aria-pressed={selectedMapId === mapItem._id}
                title={`Select map: ${mapItem.mapNickname || 'Unnamed Map'}${mapItem.isFavorite ? ' (Favorite)' : ''}`}
                data-map-id={mapItem._id} // Add data attribute for targeting
              >
                <span
                  className="map-name-text"
                  style={{
                    cursor: 'pointer',
                    flexGrow: 1,
                    fontWeight: mapItem.isFavorite ? 'bold' : 'normal',
                  }}
                >
                  {mapItem.mapNickname || 'Unnamed Map'}
                  {mapItem.isFavorite ? ' ⭐' : ''}
                </span>
              </ListGroupItem>
            ))
          )}
        </ListGroup>
      </>
    );
  }
);

MapList.displayName = 'MapList';

MapList.propTypes = {
  /**
   * Array of map objects to be displayed. Each object represents a map
   * associated with the character.
   */
  maps: PropTypes.arrayOf(
    PropTypes.shape({
      /** Unique identifier for the map (e.g., MongoDB ObjectId). */
      _id: PropTypes.string.isRequired,
      /** Optional user-defined nickname for the map. Defaults if not set. */
      mapNickname: PropTypes.string,
      /** Optional flag indicating if the map is marked as a favorite. */
      isFavorite: PropTypes.bool,
    })
  ).isRequired,
  /** The ID of the map currently selected in the list, or null/undefined. */
  selectedMapId: PropTypes.string,
  /** Function called when a user clicks on a map item in the list. */
  onMapSelect: PropTypes.func.isRequired,
  /** Boolean indicating if the maps data is currently being loaded. */
  isLoading: PropTypes.bool.isRequired,
  /**
   * Potential error message string if loading fails (e.g., network error).
   * Null or undefined if there is no error.
   */
  error: PropTypes.string,
};

export default MapList;
