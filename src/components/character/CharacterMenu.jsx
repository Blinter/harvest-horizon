/**
 * @file src/components/character/CharacterMenu.jsx
 * @description React component for managing user characters. Allows viewing
 *   details, renaming, favoriting, deleting, and accessing inventory, status
 *   logs, and map views.
 * @module components/character/CharacterMenu
 */
import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, Input, ListGroup, ListGroupItem, Row, Col } from 'reactstrap';
import { addDividerContainerSubMenu } from '../library/libControls';
import InventoryMenu from './InventoryMenu';
import StatusLogMenu from './StatusLogMenu';
import MapMenu from './MapMenu';
import { useUser } from '../context/UserProvider';

/**
 * Displays a list of characters with various interaction options.
 *
 * Enables users to:
 * - View character details (name, coins).
 * - Rename characters inline.
 * - Mark characters as favorites.
 * - Delete characters with confirmation.
 * - Open and view character-specific Inventory, Status Logs, and Maps.
 * - Close the character menu.
 * - Refresh the character list.
 * - Optionally create new characters if the handler is provided.
 *
 * @component CharacterMenu
 * @param {object} props - The component props object.
 * @param {Array<object>} [props.characters=[]] - An array of character
 *   objects. Each object should include `pg_id`, `character_id`,
 *   `inventory_id`, `status_log_id`, `wallet_id`, `name`,
 *   `favorite_character`, and `coins`.
 * @param {Function} props.onClose - Callback executed when the 'Close
 *   Characters' button is clicked.
 * @param {Function} [props.onSaveNickname] - Callback executed on submitting
 *   a character rename. It receives the character's MongoDB ID
 *   (`characterMongoId`) and the `newName`. Expected to return a Promise
 *   resolving to `true` on success, `false` otherwise (e.g., for 409).
 * @param {Function} [props.onCreateCharacter] - Callback executed when the
 *   'Create Character' button is clicked.
 * @param {Function} [props.onDeleteCharacter] - Callback executed upon
 *   confirming character deletion. Receives the `characterMongoId`.
 * @param {Function} [props.onRefreshCharacters] - Callback executed when the
 *   'Refresh' button is clicked. Used to fetch the latest character list.
 * @param {Function} [props.onSetFavorite] - Callback executed when the
 *   favorite status button is toggled. Receives `characterMongoId` and the
 *   desired boolean `favoriteState`.
 * @param {string} [props._error] - Optional error message related to fetching
 *   or creating characters, typically passed from the parent component.
 * @param {string} [props.renameError] - Specific error message related to
 *   the renaming process (e.g., name already taken).
 * @param {Function} [props.clearRenameError] - Callback function to clear the
 *   `renameError` message.
 * @param {Function} [props.onPlayMap] - Callback function invoked when a user
 *   chooses to play a specific map associated with a character. Receives the
 *   map ID.
 * @param {Function} [props.onCharacterMapFavoriteStatusChanged] - Callback
 *   executed when the favorite status of a map associated with the character
 *   is changed within the `MapMenu`.
 * @param {Function} [props.onMapDeleted] - Callback executed when a map
 *   associated with the character is deleted from within the `MapMenu`.
 * @returns {React.ReactElement} The CharacterMenu component UI.
 */
const CharacterMenu = ({
  characters = [],
  onClose,
  onSaveNickname,
  onCreateCharacter,
  onDeleteCharacter,
  onRefreshCharacters,
  onSetFavorite,
  _error,
  renameError,
  clearRenameError,
  onPlayMap,
  onCharacterMapFavoriteStatusChanged,
  onMapDeleted,
}) => {
  /**
   * @state {string|number|null} editingCharacterId - Stores the PostgreSQL
   *   `pg_id` of the character currently being renamed. `null` if no
   *   character is being edited.
   */
  const [editingCharacterId, setEditingCharacterId] = useState(null);
  /**
   * @state {string} tempName - Holds the temporary value of the character's
   *   name while it is being edited in the input field.
   */
  const [tempName, setTempName] = useState('');
  /**
   * @state {string|null} openInventoryForCharId - Stores the MongoDB
   *   `character_id` of the character whose inventory panel is currently
   *   open. `null` if no inventory panel is open.
   */
  const [openInventoryForCharId, setOpenInventoryForCharId] = useState(null);
  /**
   * @state {string|null} openStatusLogForCharId - Stores the MongoDB
   *   `character_id` of the character whose status log panel is currently
   *   open. `null` if no status log panel is open.
   */
  const [openStatusLogForCharId, setOpenStatusLogForCharId] = useState(null);
  /**
   * @state {string|null} confirmingDeleteCharId - Stores the MongoDB
   *   `character_id` of the character for whom delete confirmation buttons
   *   are currently shown. `null` otherwise.
   */
  const [confirmingDeleteCharId, setConfirmingDeleteCharId] = useState(null);
  /**
   * @state {string|null} openMapForCharId - Stores the MongoDB
   *   `character_id` of the character whose map view panel is currently open.
   *   `null` if no map view is open.
   */
  const [openMapForCharId, setOpenMapForCharId] = useState(null);
  /**
   * @state {string|null} deleteError - Stores an error message specifically
   *   for disallowed delete operations (e.g., temporary user).
   */
  const [deleteError, setDeleteError] = useState(null);
  /**
   * @state {string|null} favoriteError - Stores an error message specifically
   *   for disallowed favorite operations (e.g., temporary user).
   */
  const [favoriteError, setFavoriteError] = useState(null);

  // --- Auto-clear Error Messages --- //
  useEffect(() => {
    if (deleteError) {
      const timer = setTimeout(() => {
        setDeleteError(null);
      }, 5000); // Clear after 5 seconds
      // Cleanup function to clear the timeout if the component unmounts
      // or if deleteError changes before the timeout finishes
      return () => clearTimeout(timer);
    }
  }, [deleteError]); // Dependency array: run effect when deleteError changes

  useEffect(() => {
    if (favoriteError) {
      const timer = setTimeout(() => {
        setFavoriteError(null);
      }, 5000); // Clear after 5 seconds
      // Cleanup function
      return () => clearTimeout(timer);
    }
  }, [favoriteError]); // Dependency array: run effect when favoriteError changes

  // --- State and Ref for scroll-to-focus ---
  /**
   * @state {string|null} newlyAddedCharacterId - Stores the MongoDB
   *   `character_id` of a character just added to the list, used to trigger
   *   scrolling to that character's item. Reset to `null` after scroll attempt.
   */
  const [newlyAddedCharacterId, setNewlyAddedCharacterId] = useState(null);
  /**
   * @ref {object} itemRefs - A ref object holding references to the DOM
   *   elements of each character list item, keyed by `character_id`. Used for
   *   scrolling.
   */
  const itemRefs = useRef({});
  /**
   * @ref {Array<object>|null} prevCharactersRef - Ref storing the previous
   *   `characters` prop array to compare against the current prop for detecting
   *   newly added characters.
   */
  // Ref to store previous characters
  const prevCharactersRef = useRef(characters);
  // --- End state/ref for scroll-to-focus ---

  const componentName = 'CharacterMenu';

  // --- Context Hooks ---
  const { currentUser } = useUser();

  // Log mount and unmount
  useEffect(() => {
    // No debug log needed here on mount/unmount
    return () => {
      // No debug log needed here on mount/unmount
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // --- Effect to Detect New Character (Refactored) ---
  useEffect(() => {
    // Get current and previous characters
    const currentCharacters = characters;
    const previousCharacters = prevCharactersRef.current || [];

    // Simple check: Only proceed if the length has increased
    if (currentCharacters.length > previousCharacters.length) {
      const previousIds = new Set(previousCharacters.map(c => c.character_id));
      let addedId = null;

      // Find the ID that exists now but didn't before
      for (const char of currentCharacters) {
        if (!previousIds.has(char.character_id)) {
          addedId = char.character_id;
          break; // Assuming only one character is added at a time
        }
      }

      if (addedId) {
        // Debug when new character is detected
        // console.debug(
        //   `[${new Date().toISOString()}] [DEBUG] ` +
        //   `[${componentName}]: New character ` +
        //   `detected: ${addedId}`
        // );
        setNewlyAddedCharacterId(addedId);
      }
    }

    // Update the ref to store the current characters for the next render
    prevCharactersRef.current = currentCharacters;

    // Dependency is only on the characters array reference now
  }, [characters]);
  // --- End Effect to Detect New Character ---

  // --- Effect to Scroll to New Character ---
  useEffect(() => {
    if (newlyAddedCharacterId) {
      const element = itemRefs.current[newlyAddedCharacterId];
      if (element) {
        // Debug when scrolling to new character
        // console.debug(
        //   `[${new Date().toISOString()}] [DEBUG] ` +
        //   `[${componentName}]: Scrolling to new character:` +
        //   ` ${newlyAddedCharacterId}`
        // );
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest' // Tries to keep the element fully in view
        });
      }
      // Reset after scrolling attempt
      setNewlyAddedCharacterId(null);
    }
  }, [newlyAddedCharacterId]); // Run only when a new character ID is set
  // --- End Effect to Scroll to New Character ---

  /**
   * Toggles the visibility of the inline inventory panel for a character.
   * If the inventory for the clicked character is already open, it closes it.
   * Otherwise, it opens the inventory for that character and closes any other
   * open panels (Status Log, Map View).
   *
   * @function handleOpenInventoryClick
   * @param {string} characterMongoId - The MongoDB `character_id` of the
   *   target character.
   */
  const handleOpenInventoryClick = (characterMongoId) => {
    setOpenInventoryForCharId((prevOpenId) =>
      prevOpenId === characterMongoId ? null : characterMongoId
    );
    setOpenStatusLogForCharId(null);
    setOpenMapForCharId(null);
  };

  /**
   * Closes any currently open inline inventory panel by setting the
   * controlling state to `null`.
   *
   * @function handleCloseInventoryClick
   */
  const handleCloseInventoryClick = () => {
    setOpenInventoryForCharId(null);
  };

  /**
   * Toggles the visibility of the inline status log panel for a character.
   * If the status log for the clicked character is already open, it closes it.
   * Otherwise, it opens the status log for that character and closes any other
   * open panels (Inventory, Map View).
   *
   * @function handleOpenStatusLogClick
   * @param {string} characterMongoId - The MongoDB `character_id` of the
   *   target character.
   */
  const handleOpenStatusLogClick = (characterMongoId) => {
    setOpenStatusLogForCharId((prevOpenId) =>
      prevOpenId === characterMongoId ? null : characterMongoId
    );
    setOpenInventoryForCharId(null);
    setOpenMapForCharId(null);
  };

  /**
   * Closes any currently open inline status log panel by setting the
   * controlling state to `null`.
   *
   * @function handleCloseStatusLog
   */
  const handleCloseStatusLog = () => {
    setOpenStatusLogForCharId(null);
  };

  /**
   * Toggles the visibility of the inline map view panel for a character.
   * If the map view for the clicked character is already open, it closes it.
   * Otherwise, it opens the map view for that character and closes any other
   * open panels (Inventory, Status Log).
   *
   * @function handleOpenMapClick
   * @param {string} characterMongoId - The MongoDB `character_id` of the
   *   target character.
   */
  const handleOpenMapClick = (characterMongoId) => {
    setOpenMapForCharId((prevOpenId) =>
      prevOpenId === characterMongoId ? null : characterMongoId
    );
    // Close other sections when opening map view
    setOpenInventoryForCharId(null);
    setOpenStatusLogForCharId(null);
  };

  /**
   * Closes any currently open inline map view panel by setting the
   * controlling state to `null`.
   *
   * @function handleCloseMapClick
   */
  const handleCloseMapClick = () => {
    setOpenMapForCharId(null);
  };

  /**
   * Activates the renaming UI for a specific character. Sets the
   * `editingCharacterId` state to the character's PostgreSQL `pg_id` and
   * pre-fills the `tempName` state with the character's current name
   * (or a default if the name is missing).
   *
   * @function handleEditClick
   * @param {string|number} characterPgId - The PostgreSQL `pg_id` of the
   *   character to rename.
   */
  const handleEditClick = (characterPgId) => {
    setEditingCharacterId(characterPgId);
    const character = characters.find((c) => c.pg_id === characterPgId);
    const defaultName = character?.name || 'Adventurer';
    setTempName(defaultName);
  };

  /**
   * Updates the `tempName` state as the user types in the rename input field.
   * Also clears any existing rename error message via `clearRenameError`.
   *
   * @function handleTempNameChange
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change
   *   event object.
   */
  const handleTempNameChange = (event) => {
    clearRenameError(); // Clear error on typing
    setTempName(event.target.value);
  };

  /**
   * Cancels the renaming process. Clears any rename error, resets the
   * `editingCharacterId` state to `null`, and clears the `tempName`.
   *
   * @function handleCancelClick
   */
  const handleCancelClick = () => {
    clearRenameError(); // Clear error on cancel
    setEditingCharacterId(null);
    setTempName('');
  };

  /**
   * Handles the submission of a new character name.
   * Finds the character's MongoDB ID using the provided PostgreSQL ID.
   * Calls the `onSaveNickname` prop function with the MongoDB ID and the
   * `tempName`.
   * If `onSaveNickname` is provided and resolves successfully (returns true),
   * it exits the edit mode by resetting state.
   * If `onSaveNickname` indicates failure (returns false, e.g., 409 error),
   * it keeps the edit mode open.
   * Logs warnings if the handler is missing or the character ID cannot be
   * found. Exits edit mode in these warning cases.
   * Catches and logs other potential errors during the save process.
   *
   * @function handleSubmitClick
   * @param {string|number} characterPgId - The PostgreSQL `pg_id` of the
   *   character whose name is being saved.
   * @async
   */
  const handleSubmitClick = async (characterPgId) => {
    const newName = tempName;

    // Find the character MongoDB ID using the PG ID
    const characterMongoId = characters.find(
      (c) => c.pg_id === characterPgId
    )?.character_id;

    if (onSaveNickname && characterMongoId) {
      try {
        // Call parent handler and wait for success/failure indication
        const success = await onSaveNickname(characterMongoId, newName);

        if (success) {
          // Exit edit mode only on success
          setEditingCharacterId(null);
          setTempName('');
        } else {
          // Keep edit mode open if parent returned false (e.g., 409 error)
          console.debug(
            `[${new Date().toISOString()}] [DEBUG] [${componentName}]: ` +
            `Save nickname indicated failure (e.g., 409), keeping edit mode ` +
            `open.`
          );
        }
      } catch (error) {
        // Handle errors re-thrown by onSaveNickname (other than 409)
        console.error(
          `[${new Date().toISOString()}] [ERROR] [${componentName}]: ` +
          `Error during onSaveNickname call: ${error.message}`,
          error
        );
        // Decide how to handle unexpected errors - maybe show a generic 
        // message?
        // For now, we keep the edit mode open.
      }
    } else {
      const warnTimestamp = new Date().toISOString();
      console.warn(
        `[${warnTimestamp}] [WARN] [${componentName}]: ` +
        `onSaveNickname handler not provided or ` +
        `characterMongoId not found for PG ID ${characterPgId}.`
      );
      console.warn(
        `[${warnTimestamp}] [WARN] [${componentName}]: ` +
        `Cannot save name "${newName}" for PG char ${characterPgId}. ` +
        `Handler missing or ID not found.`
      ); // Exit edit mode if no handler or ID
      setEditingCharacterId(null);
      setTempName('');
    }

    // Note: Rename error is cleared in handleTempNameChange/handleCancelClick
    // or before the next attempt in the parent's handleSaveNickname.
  };

  /**
   * Handles the click event for the favorite button.
   * Determines the desired new favorite state (opposite of the current state).
   * Calls the `onSetFavorite` prop function with the character's MongoDB ID
   * and the `desiredFavoriteState`.
   * Logs a warning if the `onSetFavorite` handler is not provided.
   *
   * @function handleSetFavorite
   * @param {string} characterMongoId - The MongoDB `character_id` of the
   *   character to toggle favorite status for.
   * @param {boolean} currentFavoriteStatus - The current favorite status
   *   of the character.
   */
  const handleSetFavorite = (characterMongoId, currentFavoriteStatus) => {
    setFavoriteError(null); // Clear previous error
    setDeleteError(null); // Clear other errors too

    if (currentUser && currentUser.isTemporary) {
      // Keep for debugging
      // console.warn(
      //   `[${new Date().toISOString()}] [WARN] ` +
      //   `[${componentName}]: Temporary user attempted to set favorite ` +
      //   `for character ${characterMongoId}. Operation blocked.`
      // );
      setFavoriteError('This action requires a registered account.');
      return; // Prevent action
    }

    if (onSetFavorite) {
      // Determine desired state: toggle current status.
      const desiredFavoriteState = !currentFavoriteStatus;
      // Pass the desired state to the handler in MainMenuControls
      onSetFavorite(characterMongoId, desiredFavoriteState);
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [${componentName}]: ` +
        `onSetFavorite handler is not provided.`
      );
    }
  };

  /**
   * Initiates the character deletion confirmation step.
   * Sets the `confirmingDeleteCharId` state to the MongoDB `character_id`
   * of the character whose delete button was clicked. This causes the
   * confirmation buttons to appear for that character.
   *
   * @function handleDeleteClick
   * @param {string} characterMongoId - The MongoDB `character_id` of the
   *   character to potentially delete.
   */
  const handleDeleteClick = (characterMongoId) => {
    setConfirmingDeleteCharId(characterMongoId);
  };

  /**
   * Cancels the character deletion confirmation process.
   * Resets the `confirmingDeleteCharId` state to `null`, hiding the
   * confirmation buttons.
   *
   * @function handleCancelDeleteClick
   */
  const handleCancelDeleteClick = () => {
    setConfirmingDeleteCharId(null);
    setDeleteError(null); // Clear delete error on cancel
    setFavoriteError(null); // Also clear favorite error
  };

  /**
   * Handles the final confirmation of deleting a character. Calls the
   * `onDeleteCharacter` prop with the character's MongoDB ID if the user is
   * not temporary. Logs a warning if a temporary user attempts deletion.
   *
   * @function handleConfirmDeleteClick
   * @param {string} characterMongoId - The MongoDB `character_id` of the
   *   character to delete.
   */
  const handleConfirmDeleteClick = (characterMongoId) => {
    if (currentUser && currentUser.isTemporary) {
      console.warn(
        `[${new Date().toISOString()}] [WARN] ` +
        `[${componentName}]: Temporary user attempted to delete ` +
        `character ${characterMongoId}. Operation blocked.`
      );
      // Set error message
      setDeleteError('This action requires a registered account.');
      setConfirmingDeleteCharId(null); // Hide confirmation buttons
      return; // Prevent deletion
    }

    if (onDeleteCharacter) {
      // Debug log before calling parent delete handler
      // console.debug(
      //   `[${new Date().toISOString()}] [DEBUG] ` +
      //   `[${componentName}]: Confirming delete for ` +
      //   `character: ${characterMongoId}. Calling onDeleteCharacter.`
      // );
      onDeleteCharacter(characterMongoId);
    }
    setConfirmingDeleteCharId(null); // Reset confirmation state after attempting delete
  };

  /**
   * Callback function passed to the `InventoryMenu` component.
   * Triggered when an action within the inventory (e.g., selling an item)
   * requires the main character list to be refreshed to reflect changes
   * (like updated coin count).
   * Calls the `onRefreshCharacters` prop if available. Logs a warning if not.
   *
   * @function handleInventoryUpdate
   */
  const handleInventoryUpdate = () => {
    if (onRefreshCharacters) {
      onRefreshCharacters();
    } else {
      console.warn(
        `[${new Date().toISOString()}] [WARN] [${componentName}]: ` +
        `onRefreshCharacters handler not provided.`
      );
    }
  };

  return (
    <>
      {/* --- CSS Animation Style --- */}
      <style>
        {`
          @keyframes colorCycle {
            0%   { background-color: #28a745; border-color: #28a745; } /* Green */
            20%  { background-color: #007bff; border-color: #007bff; } /* Blue */
            40%  { background-color: #6f42c1; border-color: #6f42c1; } /* Purple */
            60%  { background-color: #fd7e14; border-color: #fd7e14; } /* Orange */
            80%  { background-color: #dc3545; border-color: #dc3545; } /* Red */
            100% { background-color: #28a745; border-color: #28a745; } /* Back to Green */
          }

          @keyframes colorCycleReverse {
            0%   { background-color: #28a745; border-color: #28a745; } /* Green */
            20%  { background-color: #dc3545; border-color: #dc3545; } /* Red */
            40%  { background-color: #fd7e14; border-color: #fd7e14; } /* Orange */
            60%  { background-color: #6f42c1; border-color: #6f42c1; } /* Purple */
            80%  { background-color: #007bff; border-color: #007bff; } /* Blue */
            100% { background-color: #28a745; border-color: #28a745; } /* Back to Green */
          }

          /* Normal speed, forward cycle */
          .map-button-cycling {
            animation: colorCycle 5s linear infinite;
          }

          /* Slow speed, reverse cycle (for when map is open) */
          .map-button-cycling-reverse-slow {
            animation: colorCycleReverse 50s linear infinite; /* 10x slower */
          }
        `}
      </style>
      {/* --- End CSS Animation Style --- */}

      {characters.length > 0 ? (
        <ListGroup>
          {characters.map((char) => (
            <ListGroupItem
              key={char.pg_id}
              className="mb-3 p-3 character-list-item"
              tag="div"
              ref={(el) => { itemRefs.current[char.character_id] = el; }}
            >
              {/* Main Row for Character Info and Actions */}
              <Row className="align-items-start">
                {/* Column 1: Character Details & IDs */}
                <Col xs={12} md={7} className="mb-2 mb-md-0">
                  {editingCharacterId === char.pg_id ? (
                    // Edit Mode for Name
                    <div>
                      <h5 className="mb-2">Character Rename</h5>
                      <div
                        className="d-flex align-items-center mb-2"
                        style={{ gap: '10px' }}
                      >
                        <Input
                          type="text"
                          bsSize="sm"
                          placeholder="Enter name"
                          value={tempName}
                          onChange={handleTempNameChange}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault(); // Prevent default form submission/reload
                              handleSubmitClick(char.pg_id); // Trigger save on Enter
                            }
                          }}
                          style={{ maxWidth: '200px' }}
                          invalid={!!renameError}
                        />
                        <Button
                          color="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmitClick(char.pg_id);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          color="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelClick();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      {renameError && (
                        <div
                          style={{
                            color: 'red',
                            fontSize: '0.8em',
                            marginTop: '5px',
                          }}
                        >
                          {renameError}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Display Mode for Name
                    <h5 className="mb-1">
                      <strong>{char.name || `Unnamed Character`}</strong>
                    </h5>
                  )}

                  {/* IDs and Coins Section */}
                  <div
                    className="character-ids"
                    style={{
                      fontSize: '0.8em',
                      color: '#6c757d',
                    }}
                  >
                    <span>Coins: {char.coins ?? 'N/A'}</span>
                  </div>

                  {/* Map Button - Moved and styled with CSS Animation */}
                  <Button
                    color="success" // Base color (less relevant now)
                    size="lg"
                    // Apply animation class: slow reverse if open, normal forward otherwise
                    className={`d-block w-50 mt-2 ${openMapForCharId === char.character_id
                      ? 'map-button-cycling-reverse-slow' // Apply slow reverse class
                      : 'map-button-cycling' // Apply normal forward class
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMapClick(char.character_id);
                    }}
                    title="Toggle Map View"
                    style={{
                      fontFamily: `'Press Start 2P', cursive`,
                      minWidth: '110px',
                      boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.3)',
                      // Conditionally set text color to yellow when map is open
                      color:
                        openMapForCharId === char.character_id
                          ? 'yellow'
                          : undefined,
                    }}
                  >
                    Maps
                  </Button>
                </Col>

                {/* Column 2: Action Buttons */}
                <Col
                  xs={12}
                  md={5}
                  className={
                    'd-flex flex-column ' +
                    'align-items-md-end align-items-start'
                  }
                  style={{ gap: '5px' }}
                >
                  {/* Container for Delete / Confirm Delete Buttons */}
                  {confirmingDeleteCharId === char.character_id ? (
                    // Show Confirm/Cancel Delete
                    <div className="d-flex" style={{ gap: '5px' }}>
                      <Button
                        color="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmDeleteClick(char.character_id);
                        }}
                        title="Confirm character deletion"
                        style={{ minWidth: '90px' }}
                      >
                        Confirm Delete
                      </Button>
                      <Button
                        color="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelDeleteClick();
                        }}
                        title="Cancel deletion"
                        style={{ minWidth: '90px' }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    // Show standard action buttons including Delete
                    <>
                      {/* Favorite Button */}
                      <Button
                        color={char.favorite_character ? 'danger' : 'warning'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetFavorite(
                            char.character_id,
                            char.favorite_character
                          );
                        }}
                        disabled={!onSetFavorite}
                        title={
                          char.favorite_character
                            ? '★ Unfavorite'
                            : '☆ Favorite'
                        }
                        style={{ minWidth: '90px' }}
                      >
                        {char.favorite_character
                          ? '★ Unfavorite'
                          : '☆ Favorite'}
                      </Button>

                      {/* Inventory Button */}
                      <Button
                        color="info"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInventoryClick(char.character_id);
                        }}
                        title="Toggle Inventory"
                        style={{ minWidth: '90px' }}
                      >
                        Inventory
                      </Button>

                      {/* Status Logs Button */}
                      <Button
                        color="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStatusLogClick(char.character_id);
                        }}
                        title="Toggle Status Logs"
                        style={{ minWidth: '90px' }}
                      >
                        Status Logs
                      </Button>

                      {/* Rename Button (only in display mode) */}
                      {editingCharacterId !== char.pg_id && (
                        <Button
                          color="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(char.pg_id);
                          }}
                          title="Change Character Name"
                          style={{ minWidth: '90px' }}
                        >
                          Rename
                        </Button>
                      )}

                      {/* Delete Button */}
                      <Button
                        color="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Initiate confirm
                          handleDeleteClick(char.character_id);
                        }}
                        // Disable if handler not provided
                        disabled={!onDeleteCharacter}
                        title="Delete this character"
                        style={{ minWidth: '90px' }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </Col>
              </Row>

              {/* Conditional Rendering: Status Logs */}
              {openStatusLogForCharId === char.character_id && (
                <Row className="mt-2">
                  <Col>
                    <StatusLogMenu
                      characterId={char.character_id}
                      onClose={handleCloseStatusLog}
                    />
                  </Col>
                </Row>
              )}

              {/* Conditional Rendering: Inventory */}
              {openInventoryForCharId === char.character_id && (
                <Row className="mt-2">
                  <Col>
                    <InventoryMenu
                      characterId={openInventoryForCharId}
                      onClose={handleCloseInventoryClick}
                      onInventoryUpdate={handleInventoryUpdate}
                    />
                  </Col>
                </Row>
              )}

              {/* Conditional Rendering: Map View */}
              {openMapForCharId === char.character_id && (
                <Row className="mt-2">
                  <Col>
                    <MapMenu
                      characterId={char.character_id}
                      onClose={handleCloseMapClick}
                      onPlayMap={onPlayMap}
                      onMapFavoriteStatusChanged={
                        onCharacterMapFavoriteStatusChanged
                      }
                      onMapDeleted={onMapDeleted}
                    />
                  </Col>
                </Row>
              )}
            </ListGroupItem>
          ))}
        </ListGroup>
      ) : (
        <p
          style={{
            fontSize: '1.5em',
            textAlign: 'center',
          }}
        >
          No characters found. Start playing to create one!
        </p>
      )}

      {addDividerContainerSubMenu('Character Controls')}
      <div
        style={{
          marginTop: '5px',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <Button color="danger" onClick={onClose}>
          Close Characters
        </Button>
        <Button
          color="info"
          onClick={onRefreshCharacters}
          disabled={!onRefreshCharacters}
        >
          Refresh
        </Button>
        <Button
          color="primary"
          onClick={onCreateCharacter}
          // Disable if no handler OR if the user is temporary
          disabled={!onCreateCharacter || currentUser?.isTemporary}
        >
          Create Character
        </Button>
      </div>

      {/* Display general fetch error below controls */}
      {_error && (
        <div style={{
          color: 'red',
          textAlign: 'center',
          marginTop: '10px'
        }}>
          Error fetching characters: {_error}
        </div>
      )}

      {/* Display specific deletion error */}
      {deleteError && (
        <div style={{
          color: 'orange',
          textAlign: 'center',
          marginTop: '10px'
        }}>
          {deleteError}
        </div>
      )}

      {/* Display specific favorite error */}
      {favoriteError && (
        <div style={{
          color: 'orange',
          textAlign: 'center',
          marginTop: '10px'
        }}>
          {favoriteError}
        </div>
      )}
    </>
  );
};

CharacterMenu.propTypes = {
  /**
   * An array containing character objects. Each object represents a playable
   * character and includes their identifiers, status, and display information.
   * Expected to be empty if no characters exist for the user.
   */
  characters: PropTypes.arrayOf(
    PropTypes.shape({
      /**
       * The unique identifier for the character record in the PostgreSQL
       * database. Used primarily for linking within the application logic where
       * PG IDs are relevant.
       */
      pg_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      /**
       * The unique identifier for the character document in the MongoDB
       * database. Used as the primary key for most character-related
       * operations and associations (inventory, logs, etc.).
       */
      character_id: PropTypes.string.isRequired,
      /**
       * The MongoDB unique identifier for the inventory document associated
       * with this character. Links to the character's item storage.
       */
      inventory_id: PropTypes.string.isRequired,
      /**
       * The MongoDB unique identifier for the status log document associated
       * with this character. Links to the record of character events or status
       * changes.
       */
      status_log_id: PropTypes.string.isRequired,
      /**
       * The MongoDB unique identifier for the wallet document associated with
       * this character, tracking their currency.
       */
      wallet_id: PropTypes.string.isRequired,
      /**
       * The user-defined display name of the character. Can be edited by the
       * user. May be null or empty if not set.
       */
      name: PropTypes.string,
      /**
       * Represents the character's current level. Primarily informational
       * display data. Type allows string or number for flexibility.
       */
      level: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      /**
       * A boolean flag indicating whether the user has marked this character
       * as a favorite. Affects display (e.g., favorite icon) and potentially
       * sorting.
       */
      favorite_character: PropTypes.bool,
      /**
       * The amount of in-game currency (coins) the character currently
       * possesses. Displayed in the character details.
       */
      coins: PropTypes.number,
    })
  ),
  /**
   * A mandatory callback function that should be invoked when the user clicks
   * the 'Close Characters' button. Typically used to hide or unmount the
   * `CharacterMenu`.
   */
  onClose: PropTypes.func.isRequired,
  /**
   * An optional callback function invoked when the user saves a new nickname
   * for a character.
   * @param {string} characterMongoId - The MongoDB ID of the character being
   *   renamed.
   * @param {string} newName - The new name entered by the user.
   * Should return a Promise resolving to `true` on success, `false` on failure
   * (like a 409 conflict).
   */
  onSaveNickname: PropTypes.func,
  /**
   * An optional callback function invoked when the user clicks the 'Create
   * Character' button. Should handle the logic for initiating the character
   * creation process. If omitted, the button might be disabled.
   */
  onCreateCharacter: PropTypes.func,
  /**
   * An optional callback function invoked after the user confirms deletion of a
   * character.
   * @param {string} characterMongoId - The MongoDB ID of the character to be
   *   deleted.
   * Should handle the API call to delete the character. If omitted, the delete
   * button might be disabled.
   */
  onDeleteCharacter: PropTypes.func,
  /**
   * An optional callback function invoked when the user clicks the 'Refresh'
   * button. Should handle fetching the latest list of characters from the
   * server and updating the `characters` prop. If omitted, the refresh button
   * might be disabled.
   */
  onRefreshCharacters: PropTypes.func,
  /**
   * An optional callback function invoked when the user clicks the favorite
   * button for a character.
   * @param {string} characterMongoId - The MongoDB ID of the character whose
   *   favorite status is being changed.
   * @param {boolean} favoriteState - The *desired* new favorite state (true to
   *   favorite, false to unfavorite).
   * Should handle the API call to update the character's favorite status. If
   * omitted, the favorite button might be disabled.
   */
  onSetFavorite: PropTypes.func,
  /**
   * An optional string containing an error message related to fetching or
   * creating characters (e.g., network error, server error). Displayed below
   * the main controls if present.
   */
  _error: PropTypes.string,
  /**
   * An optional callback function invoked when the user clicks a 'Play' button
   * within the `MapMenu` for a specific map.
   * @param {string} mapId - The ID of the map selected to play.
   * Should handle the transition to the game scene/view for that map.
   */
  onPlayMap: PropTypes.func,
  /**
   * An optional string containing an error message specifically related to the
   * character renaming process (e.g., "Name already taken", "Invalid name").
   * Displayed near the rename input field if present.
   */
  renameError: PropTypes.string,
  /**
   * A mandatory callback function used to clear the `renameError` message.
   * Typically called when the user starts typing in the rename input or cancels
   * the rename action.
   */
  clearRenameError: PropTypes.func.isRequired,
  /**
   * An optional callback function invoked when the favorite status of a map
   * (associated with the current character) changes within the nested
   * `MapMenu` component. Allows the parent to potentially react or refresh data.
   * Should receive relevant identifiers if needed (e.g., map ID, new status).
   */
  onCharacterMapFavoriteStatusChanged: PropTypes.func,
  /**
   * An optional callback function invoked when a map (associated with the
   * current character) is deleted from within the nested `MapMenu` component.
   * Allows the parent to react, potentially refreshing character or map data.
   * Should receive the ID of the deleted map if needed.
   */
  onMapDeleted: PropTypes.func,
};

CharacterMenu.defaultProps = {
  characters: [],
  onSaveNickname: () => { },
  onCreateCharacter: () => { },
  onDeleteCharacter: () => { },
  onRefreshCharacters: () => { },
  onSetFavorite: () => { },
  _error: '',
  renameError: '',
  onPlayMap: () => { },
  onCharacterMapFavoriteStatusChanged: () => { },
  onMapDeleted: () => { },
};

export default CharacterMenu;
