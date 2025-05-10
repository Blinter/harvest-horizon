/**
 * @file FarmingControls.jsx
 * @description Component providing UI controls for farming actions like
 *   planting, harvesting, leasing, and clearing rubble. Displays information
 *   about selected tiles and their current state (crops, rent).
 * @module components/controls/FarmingControls
 *
 * @requires react
 * @requires reactstrap
 * @requires ../../game/PhaserGame
 * @requires ../../game/EventBus
 * @requires ../../components/library/libControls
 * @requires ../../library/cropUtils
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardBody, CardTitle, CardText, Row, Col } from 'reactstrap';
// Removing unused import
// import PropTypes from 'prop-types'; // Removed PropTypes import

import '../../styles/App.css';

// Used for JSDocs
// eslint-disable-next-line no-unused-vars
const PhaserGame = React.lazy(() => import('../../game/PhaserGame'));

import { EventBus } from '../../game/EventBus';
import {
  actionsInterface,
  addDividerContainer,
  RentTimersInterfaceComponent,
  CropStageInterfaceComponent,
  ErrorNotificationInterface,
} from '../../components/library/libControls';

import {
  calculateCropStageInfo,
  hasCropTile,
} from '../../library/cropUtils.js';
/**
 * FarmingControls component provides the user interface for initiating farming
 * actions. It displays information about currently selected tiles, including
 * crop growth stages and rent timers. It interacts with the game state and
 * other components through the global EventBus.
 *
 * @component
 * @returns {React.ReactElement} The farming controls UI elements.
 */
const FarmingControls = () => {
  const [selectedTiles, setSelectedTiles] = useState(null);
  // State to hold rent due data keyed by "x,y"
  const [rentStates, setRentStates] = useState(new Map());

  // State to hold crop states keyed by "x,y"
  const [cropStates, setCropStates] = useState(new Map());

  // State to trigger re-render for countdown updates
  const [currentTime, setCurrentTime] = useState(Date.now());
  // State for displaying action failure messages
  const [errorMessage, setErrorMessage] = useState(null);
  const errorTimeoutRef = useRef(null); // Ref to store timeout ID

  // eslint-disable-next-line no-unused-vars
  const [forceRenderKey, setForceRenderKey] = useState(0);

  // Effect to clear error message after a delay
  useEffect(() => {
    if (errorMessage) {
      // Clear previous timeout if a new error comes in quickly
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      // Set new timeout
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMessage(null);
        errorTimeoutRef.current = null; // Clear the ref
      }, 5000); // Display error for 5 seconds
    }

    // Clean up the timeout when the component unmounts or error changes
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [errorMessage]);

  /**
   * Handles clicks on action buttons (e.g., Plant, Harvest, Lease). Emits
   * corresponding events via the EventBus with the selected tile data.
   *
   * @function
   * @param {string} actionType - Identifier for the action triggered
   *   (e.g., 'clearRubble', 'plantWheat', 'leaseTile').
   * @returns {void}
   */
  const handleActionButtonClick = useCallback(actionType => {
    // Allow deselect even if selectedTiles is null/empty initially
    if (!selectedTiles &&
      actionType !== 'deselect') return;

    switch (actionType) {
      case 'clearRubble':
        // Debugging: Clear Rubble
        console.debug(
          `[FarmingControls handleActionButtonClick] Clearing rubble at ` +
          `selectedTiles:`, selectedTiles
        );
        EventBus.emit('clear-rubble', selectedTiles);
        break;
      case 'plantWheat':
        // Debugging: Plant Crop
        console.debug(
          `[FarmingControls handleActionButtonClick] Planting wheat at ` +
          `selectedTiles:`, selectedTiles
        );
        EventBus.emit('plant-crop', selectedTiles, 'wheat');
        break;
      case 'deselect':
        // Emit tiles-selected with empty array
        EventBus.emit('tiles-selected', []);
        break;
      case 'harvestWheat':
        // Debugging: Harvest Crop
        console.debug(
          `[FarmingControls handleActionButtonClick] Harvesting wheat at ` +
          `selectedTiles:`, selectedTiles
        );
        EventBus.emit('harvest-crop', selectedTiles, 'wheat');
        break;
      case 'speedGrow':
        // Debugging: Speed Grow
        console.debug(
          `[FarmingControls handleActionButtonClick] ` +
          `Speeding up growth at ` +
          `selectedTiles:`, selectedTiles
        );
        EventBus.emit('speed-grow', selectedTiles);
        break;
      case 'leaseTile':
        // Debugging: Lease Tile
        console.debug(
          `[FarmingControls handleActionButtonClick] Leasing tile at ` +
          `selectedTiles:`, selectedTiles
        );
        EventBus.emit('lease-tile', selectedTiles);
        break;
      case 'payRent':
        // Debugging: Pay Rent
        console.debug(
          `[FarmingControls handleActionButtonClick] Paying rent at ` +
          `selectedTiles:`, selectedTiles
        );
        EventBus.emit('pay-rent', selectedTiles);
        break;
      default:
        console.error(
          `[${new Date().toISOString()}] [ERROR]: Unknown Action`, {
          actionType,
        });
        break;
    }
  }, [selectedTiles]);

  /**
   * Callback function triggered when the main Phaser game scene emits the
   * 'scene-ready' event. Currently logs a debug message.
   *
   * @function
   * @param {Phaser.Scene} _scene - The Phaser scene instance that is ready.
   *   Currently unused.
   * @returns {void}
   */
  const handleSceneReady = useCallback((_scene) => {
    // Placeholder for future logic when scene is ready.
    console.debug(
      `[FarmingControls] EventBus scene-ready received.`
    );
  }, []);

  /**
   * Handles 'tileUpdated' events from the EventBus. If the updated tile is
   * currently selected, its data within the `selectedTiles` state is updated
   * with the new properties. This keeps the displayed information consistent
   * with the server state.
   *
   * @function
   * @param {object} payload - The event payload containing tile coordinates
   *   and the updates. Expected format: `{ x: number, y: number, updates:
   *   object }`.
   * @returns {void}
   */
  const handleTileUpdate = useCallback(payload => {
    // Keep for Debugging:
    // console.debug(
    //   `[FarmingControls handleTileUpdate] Received payload:`,
    //   payload
    // );
    const { x, y, updates } = payload || {};

    if (x === undefined ||
      y === undefined ||
      !updates) {
      console.warn(
        `[FarmingControls handleTileUpdate] Received invalid payload:`,
        payload
      );
      return;
    }


    setSelectedTiles(prevSelectedTiles => {
      // Keep for Debugging:
      // console.debug(
      //   `[FarmingControls handleTileUpdate] Prev state:`,
      //   prevSelectedTiles
      // );
      if (!prevSelectedTiles) return null;

      const index = prevSelectedTiles.findIndex(tile =>
        tile.x === x &&
        tile.y === y);

      // Keep for Debugging:
      // console.debug(
      //   `[FarmingControls handleTileUpdate] Found index: ${index}`
      // );

      if (index !== -1) {
        const existingTile = prevSelectedTiles[index];
        // Keep for Debugging:
        // console.debug(
        //   `[FarmingControls handleTileUpdate] Existing tile:`,
        //   existingTile
        // );
        // console.debug(
        //   `[FarmingControls handleTileUpdate] Updates received:`,
        //   updates
        // );


        const newProperties = updates.properties
          ? { ...existingTile.properties, ...updates.properties }
          : existingTile.properties;
        // Keep for Debugging:
        // console.debug(
        //   `[FarmingControls handleTileUpdate] Merged properties:`,
        //   newProperties
        // );

        const newSelectedTiles = [...prevSelectedTiles];
        newSelectedTiles[index] = {
          ...existingTile,
          ...updates,
          properties: newProperties,
        };

        const updateKeys = Object.keys(updates);
        if (updateKeys.length === 1 &&
          updateKeys[0] === 'properties' &&
          updates.properties &&
          typeof updates.properties === 'object' &&
          Object.keys(updates.properties).length === 1 &&
          Object.keys(updates.properties)[0] === 'nextRentDue') {
          setForceRenderKey(prevKey => prevKey + 1);
        }

        return newSelectedTiles;
      }
      console.debug(
        `[FarmingControls handleTileUpdate] Tile ` +
        `(${x},${y}) not found in selection.`
      );
      return prevSelectedTiles;
    });
  }, []);

  /**
   * Handler for 'crop-stage-updated' events emitted by CropManager via the
   * EventBus. If the crop that updated its stage belongs to a currently
   * selected tile and has reached its final stage (ready for harvest),
   * it triggers a re-render of this component to update the UI state
   * (e.g., enable the harvest button).
   *
   * @function
   * @param {object} data - Event data containing tile coordinates and stage
   *   information. Expected format: `{ x: number, y: number, stage: number,
   *   nextStage: number | null, cropState: object }`.
   * @returns {void}
   */
  const handleCropStageEvent = useCallback(data => {
    const { x, y, nextStage } = data || {};

    // Ignore if the tile isn't selected
    if (!selectedTiles) {
      return;
    }

    const isSelected = selectedTiles.some(tile =>
      tile.x === x &&
      tile.y === y);

    // Check if the updated tile is selected and reached the final stage
    if (isSelected && nextStage === null) {
      // Debugging:
      // console.debug(
      //   `[FarmingControls] Triggering re-render because selected crop at ` +
      //   `(${x},${y}) is ready.`
      // );
      // Increment key to force re-render
      setForceRenderKey(prevKey => prevKey + 1);
    }
  }, [selectedTiles]); // Dependency: selectedTiles

  /**
   * Handler for 'request-farming-controls-rerender' events, typically
   * emitted when an external timer (like a rent timer managed by RentManager)
   * expires. If the event data corresponds to a currently selected tile, it
   * forces this component to re-render to reflect potential state changes
   * (e.g., rent is now due).
   *
   * @function
   * @param {object} data - Event data containing the coordinates of the tile
   *   that requires a potential UI update. Expected format: `{ x: number, y:
   *   number }`.
   * @returns {void}
   */
  const handleRequestReRenderCheck = useCallback(data => {

    // Debugging:
    // console.debug(
    //   `[FarmingControls handleRequestReRenderCheck] ` +
    //   `Received data:`,
    //   data
    // );
    const { x, y } = data || {};

    // Ignore if no tiles are selected or if data is invalid
    if (!selectedTiles || x === undefined || y === undefined) {
      return;
    }

    const isSelected = selectedTiles.some(tile =>
      tile.x === x &&
      tile.y === y);

    if (isSelected) {
      // Debugging:
      // console.debug(
      //   `[FarmingControls] Re-rendering requested for ` +
      //   `selected tile (${x},${y}).`
      // );
      // Increment key to force re-render
      setForceRenderKey(prevKey => prevKey + 1);
    }
  }, [selectedTiles]); // Dependency: selectedTiles

  /**
   * Callback function to handle updates to the rent states map received from
   * RentManager via the 'rent-states-updated' EventBus event. Updates the
   * local `rentStates` state.
   *
   * @function
   * @param {Map<string, {nextRentDue: number | null}>} newStates - Map where
   *   keys are "x,y" and values contain rent timer info.
   * @returns {void}
   */
  const handleRentStatesUpdate = useCallback(newStates => {
    // Debugging:
    // console.debug('[FarmingControls] useCallback handleRentStatesUpdate', 
    // newStates);
    setRentStates(newStates);
  }, []); // Empty dependency array means this function reference is stable

  /**
   * Callback function to handle updates to the crop states map received from
   * CropManager via the 'crop-states-updated' EventBus event. Updates the
   * local `cropStates` state.
   *
   * @function
   * @param {Map<string, object>} newStates - Map where keys are "x,y" and
   *   values contain detailed crop state information.
   * @returns {void}
   */
  const handleCropStatesUpdate = useCallback(newStates => {
    // Debugging:
    // console.debug('[FarmingControls] useCallback handleCropStatesUpdate', newStates);
    setCropStates(newStates);
  }, []); // Empty dependency array means this function reference is stable

  /**
   * Handles requests originating from child components (like timer displays)
   * to select specific tiles. Emits a 'request-select-tiles' event via the
   * EventBus, which is typically handled by the component managing the map
   * selection (e.g., NewGame).
   *
   * @function
   * @param {string[]} keys - Array of tile coordinate strings ("x,y") to be
   *   selected.
   * @returns {void}
   */
  const handleSelectRequest = useCallback((keys) => {
    if (!keys || keys.length === 0) {
      console.warn('[FarmingControls handleSelectRequest] Received empty keys.');
      return;
    }
    // Debugging: Log request
    // console.debug(`[FarmingControls handleSelectRequest] Requesting selection for keys:`, keys);
    EventBus.emit('request-select-tiles', keys);
  }, []); // No dependencies needed

  /**
   * Effect hook to manage EventBus subscriptions and the interval timer for
   * updating countdown displays. Sets up listeners for various game events
   * ('scene-ready', 'tiles-selected', 'tileUpdated', state updates, etc.)
   * and action failures. Cleans up listeners and the timer on component
   * unmount.
   *
   * @effect
   * @returns {Function} Cleanup function that removes all event listeners and
   *   clears the interval timer.
   */

  useEffect(() => {
    // --- Listener for Rent State Updates ---
    // REMOVED: const handleRentStatesUpdate = (newStates) => { ... };
    // Use the useCallback version from the outer scope
    EventBus.on('rent-states-updated', handleRentStatesUpdate);

    // --- Listener for Crop States Updates ---
    // REMOVED: const handleCropStatesUpdate = (newStates) => { ... };
    // Use the useCallback version from the outer scope
    EventBus.on('crop-states-updated', handleCropStatesUpdate);
    // ---------------------------------------

    // --- Interval Timer for Countdown Refresh ---
    const intervalId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 2500); // Update every 2500ms
    // -----------------------------------------

    // Set up other event listeners using the extracted handlers
    EventBus.on('scene-ready', handleSceneReady);
    EventBus.on('tiles-selected', setSelectedTiles);
    EventBus.on('tileUpdated', handleTileUpdate);
    // Add listener for crop stage updates to trigger re-render for harvest
    // readiness
    EventBus.on('crop-stage-updated', handleCropStageEvent);
    // Add listener for rent-due related re-render requests
    EventBus.on(
      'request-farming-controls-rerender',
      handleRequestReRenderCheck
    );

    // Listener for the new action failed event
    // Keep error messages explicitly for fine-tuning to UI
    const handleActionFailed = (data) => {
      const { action, reason, context } = data || {};
      switch (action) {
        case 'PlantCrop':
          setErrorMessage(
            `Can't plant crop: ${reason}. ` +
            `You need to have ` +
            `${context.required} seed${context.required > 1 ? 's' : ''}.`
          );
          break;
        case 'SpeedGrow':
          setErrorMessage(
            `Can't speed up growth: ${reason}. ` +
            `You need to have ` +
            `${context.required} coin${context.required > 1 ? 's' : ''}.`
          );
          break;
        case 'Lease':
          setErrorMessage(
            `Can't lease tile: ${reason}. ` +
            `You need to have ` +
            `${context.required} coin${context.required > 1 ? 's' : ''}.`
          );
          break;
        case 'PayRent':
          setErrorMessage(
            `Can't pay rent: ${reason}. ` +
            `You need to have ` +
            `${context.required} coin${context.required > 1 ? 's' : ''}.`
          );
          break;
        default:
          // Log the error to the console
          console.error(
            `[FarmingControls] failed:`,
            action, reason, JSON.stringify(context)
          );
          setErrorMessage(
            `[FarmingControls] (Unhandled Default) ` +
            `'${action}' failed: ${reason}`
          );
          break;
      }
    };
    EventBus.on('ACTION_FAILED_EVENT', handleActionFailed);

    // Clean up other event listeners on unmount
    return () => {
      EventBus.off('scene-ready', handleSceneReady);
      EventBus.off('tiles-selected', setSelectedTiles);
      EventBus.off('tileUpdated', handleTileUpdate);
      // Remove listener for crop stage updates
      EventBus.off('crop-stage-updated', handleCropStageEvent);
      // Remove listener for rent-due related re-render requests
      EventBus.off(
        'request-farming-controls-rerender',
        handleRequestReRenderCheck
      );
      EventBus.off('ACTION_FAILED_EVENT', handleActionFailed);
      // Use the useCallback version from the outer scope for cleanup
      EventBus.off('rent-states-updated', handleRentStatesUpdate);
      EventBus.off('crop-states-updated', handleCropStatesUpdate);
      clearInterval(intervalId);
    };
  }, [
    handleSceneReady,
    handleTileUpdate,
    handleCropStageEvent,
    handleRequestReRenderCheck,
    handleRentStatesUpdate, // Dependency is the useCallback version
    handleCropStatesUpdate, // Dependency is the useCallback version
    errorMessage,
    handleSelectRequest,
    // setSelectedTiles is stable, not strictly needed in deps
  ]);

  /**
   * Renders the main card displaying information about the selected tile(s).
   * Includes coordinates, action buttons, and conditionally rendered sections
   * for crop progress and rent timers based on the relevant states derived
   * from `cropStates` and `rentStates`.
   *
   * @function
   * @returns {React.ReactElement | React.Fragment} A React element containing
   *   the selected tile information card, or an empty fragment if no tiles
   *   are selected.
   */
  const gameCardTemplate = () => {
    if (!selectedTiles || selectedTiles.length <= 0) {
      return <></>;
    }
    // Use currentTime state for consistency in comparisons
    const now = currentTime;

    const relevantRentStates = new Map();
    const relevantCropStates = new Map();

    // Process selected tiles in a single loop
    selectedTiles.forEach(tile => {
      if (!tile?.properties) return; // Skip invalid tiles

      const key = `${tile.x},${tile.y}`;

      // Populate rent states
      if (rentStates.has(key)) {
        const rentData = rentStates.get(key);
        // Ensure rentData and nextRentDue exist
        if (rentData?.nextRentDue) {
          const rentDueDate = rentData.nextRentDue; // Already a timestamp
          // Only include if the due date is in the future
          if (rentDueDate > now) {
            relevantRentStates.set(key, {
              nextRentDue: rentDueDate, // Use the timestamp from rentStates
            });
          }
        }
      }

      // Check if this tile's state exists in the cropStates map
      if (cropStates.has(key)) {
        const cropData = cropStates.get(key);
        // Add it to relevantCropStates if it's valid
        // CropStageInterfaceComponent expects:
        // { cropType, cropLevel, cropPlantedAt, cropStage, cropNextStage }
        if (cropData?.cropType) { // Basic validation
          relevantCropStates.set(key, {
            cropType: cropData.cropType,
            cropLevel: cropData.cropLevel,
            cropPlantedAt: cropData.cropPlantedAt,
            // Get stage from CropManager state
            cropStage: cropData.cropStage,
            // Get next stage from CropManager
            cropNextStage: cropData.cropNextStage,
          });
        }
      } else if (hasCropTile(tile)) {
        // We will need to create a crop state for this tile, no cached data 
        // available
        const { cropStage, cropNextStage } = calculateCropStageInfo(
          tile.cropType,
          tile.cropLevel,
          tile.cropPlantedAt
        );
        relevantCropStates.set(key, {
          cropType: tile.cropType,
          cropLevel: tile.cropLevel,
          cropPlantedAt: tile.cropPlantedAt,
          cropStage,
          cropNextStage,
        });
      }
    });

    return (
      <>
        <Col
          xs="12"
          sm="12"
          className="mb-0 mt-0 mb-sm-0"
          style={{
            display: 'flex',
            alignContent: 'center',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0',
            width: '90%',
            margin: 'auto',
          }}
        >
          <Card
            className="h-100 mb-0 mt-0 green-selection-pulse"
            style={{
              padding: '0.5rem',
            }}
          >
            <CardBody
              style={{
                padding: '0',
              }}
            >
              <CardTitle
                className="text-center green-selection-pulse-text"
                style={{
                  margin: '0',
                  padding: '0',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                }}
              >
                Selected Tile{selectedTiles.length > 1 ? 's' : ''}
              </CardTitle>
              <CardText

                style={{
                  paddingBottom: '10px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                  maxHeight: '2.6rem',
                  textAlign: 'center',
                }}
              >
                <span
                  className="mb-0 mt-0 small"
                >
                  {selectedTiles.map((tile) => (
                    <span
                      key={`${tile.x}-${tile.y}`}
                      className="text-center small"
                      style={{
                        fontStyle: 'italic',
                        fontSize: '0.8rem',
                      }}
                    >{`(${tile.x},${tile.y}) `}
                    </span>
                  ))}
                </span>
              </CardText>
            </CardBody>
          </Card>
        </Col>

        {addDividerContainer('Tile Actions')}
        {actionsInterface({ handleActionButtonClick, selectedTiles })}

        {/* Conditionally render Crop Info section */}
        {relevantCropStates &&
          relevantCropStates.size > 0 && (
            <>
              {addDividerContainer('Crop Info')}
              <CropStageInterfaceComponent
                relevantStates={relevantCropStates}
                currentTime={currentTime}
                onSelectRequest={handleSelectRequest}
              />
            </>
          )}

        {/* Conditionally render Rent Info section */}
        {relevantRentStates &&
          relevantRentStates.size > 0 && (
            <>
              {addDividerContainer('Tile Info')}
              <RentTimersInterfaceComponent
                relevantStates={relevantRentStates}
                currentTime={currentTime}
                onSelectRequest={handleSelectRequest}
              />
            </>
          )}
      </>
    )
  };

  /**
   * Renders the overall structure of the FarmingControls component. Includes
   * a section for displaying error notifications and incorporates the main
   * content generated by `gameCardTemplate`.
   *
   * @function
   * @returns {React.ReactElement | React.Fragment} The complete farming
   *   controls UI, or an empty fragment if there's nothing to render (though
   *   typically the Row/Col structure is always present).
   */
  const returnFarmControls = () => {

    return (
      <Row>
        <Col
          xs="12"
          sm="12"
          className="mb-2"
        >
          {/* Render error message if it exists */}
          {errorMessage &&
            <ErrorNotificationInterface errorMessage={errorMessage} />}
        </Col>
        {/* Call gameCardTemplate to render the main card content */}
        {gameCardTemplate()}
      </Row>
    );
  };

  return <>{returnFarmControls()}</>;
};

// Removed unused propTypes definition
// FarmingControls.propTypes = {};

export default FarmingControls;
