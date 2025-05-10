/**
 * @file Library of functions and components for game control interfaces.
 * @module components/library/libControls
 * @description Provides reusable UI elements and logic handlers for game
 *   controls, including authentication forms, movement pads, and action
 *   buttons.
 */

import PropTypes from 'prop-types';
import FarmingControls from '../controls/FarmingControls';
import Login from '../auth/Login';
import SignUp from '../auth/SignUp';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Col,
  CardText,
  Row,
} from 'reactstrap';
import { handleMove } from './libControlHandler';
// Import crop utility functions from the shared library
import {
  canHarvestTile,
  canSpeedGrowTile,
  calculateCropStageInfo
} from '../../library/cropUtils.js';
import {
  canPayRent,
  isPlantable,
  canLeaseTile,
  canClearRubbleTile,
  getCropStagesCount,
} from '../../library/gameData.js';

import { formatTime, formatTimeDefault } from '../../library/formatTime.js';
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';

// --- Helper functions for determining available actions --- START

/**
 * Determines the set of available actions based on an array of selected tiles.
 * Iterates through the tiles once, calling specific check helpers for each
 * potential action to optimize performance.
 * 
 * @private
 * @param {Array<object | null>} tiles - Array of selected tile data objects,
 *   potentially containing null/invalid entries.
 * @returns {{
 *   canPayRent: boolean,
 *   canLease: boolean,
 *   canClearRubble: boolean,
 *   canPlant: boolean,
 *   canHarvest: boolean,
 *   canSpeedGrow: boolean,
 *   hasOtherActions: boolean
 * }} An object containing boolean flags for each possible action, plus a
 *   combined `hasOtherActions` flag (true if any action other than deselect is
 *   possible).
 */
function determineAvailableActions(tiles) {
  // Debugging: Determine Available Actions
  // Keep for performance testing
  // console.debug('[determineAvailableActions] Starting', tiles);
  // Initialize action flags
  const actions = {
    canPayRent: false,
    canLease: false,
    canClearRubble: false,
    canPlant: false,
    canHarvest: false,
    canSpeedGrow: false,
  };

  // Handle empty selection
  if (!tiles || tiles.length === 0) {
    return { ...actions, hasOtherActions: false };
  }

  // Iterate and update flags using helper functions and OR assignment
  for (const tile of tiles) {
    actions.canPayRent = actions.canPayRent || canPayRent(tile?.properties);
    actions.canLease = actions.canLease || canLeaseTile(tile);
    actions.canClearRubble = actions.canClearRubble || canClearRubbleTile(tile);
    actions.canPlant = actions.canPlant || isPlantable(tile);
    actions.canHarvest = actions.canHarvest || canHarvestTile(tile);
    actions.canSpeedGrow = actions.canSpeedGrow || canSpeedGrowTile(tile);

    // Simplified early exit: Check if all flags are now true
    if (Object.values(actions).every(Boolean)) {
      break;
    }
  }

  // Calculate the combined flag using .some()
  const hasOtherActions = Object.values(actions).some(Boolean);

  return { ...actions, hasOtherActions };
}

// --- Helper functions for determining available actions --- END

/**
 * Returns a simple welcome message as a React Fragment.
 *
 * @returns {React.ReactElement} A React Fragment containing the welcome text.
 */
const getTitleWelcome = () => <>Welcome to Harvest Horizon</>;

/**
 * Creates a divider component with centered content.
 * Renders a horizontal line with text or a component centered within it.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.component - The React node to render within
 *   the divider's text span. Typically a string or another component.
 * @returns {React.ReactElement} A div element representing the divider.
 */
const addDividerComponent = ({ component }) => (
  <div className="divider-container">
    <div className="divider-line" />
    <span className="divider-text">{component}</span>
    <div className="divider-line" />
  </div>
);

/**
 * Creates a simple divider container with optional centered text.
 * Similar to `addDividerComponent` but takes text directly.
 *
 * @param {string} [text=''] - Optional text to display within the divider.
 *   Defaults to an empty string.
 * @returns {React.ReactElement} A div element representing the divider.
 */
const addDividerContainer = (text = '') => (
  <div className="divider-container">
    <div className="divider-line" />
    <span className="divider-text">{text || ''}</span>
    <div className="divider-line" />
  </div>
);

/**
 * Creates a divider styled specifically for submenus, with optional text.
 *
 * @param {string} [text=''] - Optional text to display within the divider.
 *   Defaults to an empty string.
 * @returns {React.ReactElement} A div element representing the submenu
 *   divider.
 */
const addDividerContainerSubMenu = (text = '') => (
  <div className="divider-container-submenu">
    <div className="divider-line-submenu" />
    <span className="divider-text-submenu">{text || ''}</span>
    <div className="divider-line-submenu" />
  </div>
);

/**
 * Returns a styled H2 element displaying the game's welcome title.
 *
 * @returns {React.ReactElement} A styled H2 element.
 */
const getTitleWelcomeStyled = () => (
  <h2 className="game-controls-title">{getTitleWelcome()}</h2>
);

/**
 * Returns the primary FarmingControls component instance.
 * This acts as a simple wrapper or entry point for the main game controls UI.
 *
 * @returns {React.ReactElement} An instance of the `FarmingControls` component.
 */
const getGameControls = () => <FarmingControls />;

/**
 * Renders the Login component within a standard controls container div.
 * Passes required event handlers down to the `Login` component.
 *
 * @param {object} props - Component props.
 * @param {Function} props.handleButtonClick - Callback function invoked for
 *   actions within the Login form (e.g., cancel, signup link, completion). The
 *   specific action is passed as an argument to the handler.
 * @returns {React.ReactElement} The Login component wrapped in a div.
 */
const getLoginComponent = ({ handleButtonClick }) => (
  <div className="game-controls">
    <Login
      cancelHandler={() => handleButtonClick('signupCancel')}
      signUpHandler={() => handleButtonClick('signup')}
      completedHandler={() => handleButtonClick('loginCompleted')}
    />
  </div>
);

/**
 * Renders the SignUp component within a standard controls container div.
 * Passes required event handlers down to the `SignUp` component.
 *
 * @param {object} props - Component props.
 * @param {Function} props.handleButtonClick - Callback function invoked for
 *   actions within the SignUp form (e.g., cancel, login link, completion). The
 *   specific action is passed as an argument to the handler.
 * @returns {React.ReactElement} The SignUp component wrapped in a div.
 */
const getSignupComponent = ({ handleButtonClick }) => (
  <div className="game-controls">
    <SignUp
      cancelHandler={() => handleButtonClick('signupCancel')}
      loginHandler={() => handleButtonClick('login')}
      completedHandler={() => handleButtonClick('signupCompleted')}
    />
  </div>
);

/**
 * Renders the directional movement buttons interface.
 * Uses `handleMove` from `libControlHandler` for button clicks.
 *
 * @returns {React.ReactElement} A div containing the movement button grid.
 */
const movementInterface = () => (
  <div className="movement-interface-container">
    <b className="movement-interface-title">Movement</b>
    <div className="movement-grid">
      {/* Up Button */}
      <div></div>
      <Button
        color="primary"
        className="movement-button"
        onClick={() => handleMove('up')}
        aria-label="Move Up"
      >
        ↑
      </Button>
      <div></div>
      {/* Left Button */}
      <Button
        color="primary"
        className="movement-button"
        onClick={() => handleMove('left')}
        aria-label="Move Left"
      >
        ←
      </Button>
      {/* Center Placeholder */}
      <Button
        disabled
        className="movement-button movement-button-center disabled"
        aria-hidden="true"
      ></Button>
      {/* Right Button */}
      <Button
        color="primary"
        className="movement-button"
        onClick={() => handleMove('right')}
        aria-label="Move Right"
      >
        →
      </Button>
      <div></div>
      {/* Down Button */}
      <Button
        color="primary"
        className="movement-button"
        onClick={() => handleMove('down')}
        aria-label="Move Down"
      >
        ↓
      </Button>
      <div></div>
    </div>
  </div>
);

/**
 * Renders a dynamic set of action buttons based on selected tile data.
 * Determines available actions using `determineAvailableActions` and displays
 * corresponding buttons (e.g., Plant, Harvest, Clear Rubble, Lease, Pay Rent,
 * Speed Grow, Deselect).
 *
 * @param {object} props - Component props.
 * @param {Function} props.handleActionButtonClick - Callback invoked when any
 *   action button is clicked. The specific action type (e.g., 'plantWheat',
 *   'deselect') is passed as an argument.
 * @param {Array<object | null> | null} props.selectedTiles - An array of the
 *   currently selected tile data objects, or null/empty if none selected.
 * @returns {React.ReactElement} A div containing the grid of action buttons.
 */
const actionsInterface = ({ handleActionButtonClick, selectedTiles }) => {
  // Ensure tiles is always an array
  const tiles = selectedTiles || [];

  // Get the available actions status
  const {
    canPayRent,
    canLease,
    canClearRubble,
    canPlant,
    canHarvest,
    canSpeedGrow,
    hasOtherActions,
  } = determineAvailableActions(tiles);

  // Determine if the deselect action should be available
  const canDeselect = tiles.length > 0;

  return (
    <div className="actions-interface-container">
      <div className="actions-grid">
        {/* --- Main Action Buttons --- */}
        {canSpeedGrow && (
          <Button
            color="warning"
            className="action-button"
            onClick={() => handleActionButtonClick('speedGrow')}
          >
            Speed Grow
          </Button>
        )}
        {canPlant && (
          <Button
            color="primary"
            className="action-button"
            onClick={() => handleActionButtonClick('plantWheat')}
          >
            Plant Wheat
          </Button>
        )}
        {canHarvest && (
          <Button
            color="primary"
            className="action-button"
            onClick={() => handleActionButtonClick('harvestWheat')}
          >
            Harvest Wheat
          </Button>
        )}
        {canClearRubble && (
          <Button
            color="primary"
            className="action-button"
            onClick={() => handleActionButtonClick('clearRubble')}
          >
            Clear Rubble
          </Button>
        )}
        {canPayRent && (
          <Button
            color="warning"
            className="action-button"
            onClick={() => handleActionButtonClick('payRent')}
          >
            Pay Rent
          </Button>
        )}
        {canLease && (
          <Button
            color="warning"
            className="action-button"
            onClick={() => handleActionButtonClick('leaseTile')}
          >
            Lease Tile
          </Button>
        )}

        {/* --- Deselect Buttons (Contextual) --- */}
        {/* Gray 'De-Select' if other actions are also available */}
        {canDeselect && hasOtherActions && (
          <Button
            color="secondary"
            className="action-button"
            onClick={() => handleActionButtonClick('deselect')}
          >
            De-Select
          </Button>
        )}
        {/* Gray 'Deselect' if it's the only available action */}
        {canDeselect && !hasOtherActions && (
          <Button
            color="danger"
            className="action-button"
            onClick={() => handleActionButtonClick('deselect')}
          >
            De-Select
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Helper function to group rent states for summary view.
 * Groups by nextRentDue time windows.
 *
 * @private
 * @param {Map<string, object>} relevantStates - The map of rent states.
 * @param {number} now - The current timestamp.
 * @param {number} [thresholdMs=10000] - Time window in ms for grouping.
 *   Defaults to 10 seconds.
 * @returns {Map<string, {count: number, earliestRentDue: number, keys:
 *   Array<string>}>} A map where keys represent time groups and values contain
 *   { count, earliestRentDue, keys }.
 */
const groupSimilarRentTimers = (
  relevantStates,
  now,
  // Default grouping window to 10 seconds
  thresholdMs = 10000
) => {
  const groups = new Map();

  relevantStates.forEach((data, key) => {
    const { nextRentDue } = data;

    if (!nextRentDue || typeof nextRentDue !== 'number' || isNaN(nextRentDue)) {
      return; // Skip invalid entries
    }

    // Create a grouping key based on time window
    const timeGroup = Math.floor(nextRentDue / thresholdMs);
    const groupKey = `rent-${timeGroup}`;

    // Initialize group if it doesn't exist
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        count: 0,
        earliestRentDue: nextRentDue, // Track the earliest due date
        keys: [],
      });
    }

    const group = groups.get(groupKey);
    group.keys.push(key);
    group.count++;
    group.earliestRentDue = Math.min(group.earliestRentDue, nextRentDue);
  });

  return groups;
};

/**
 * Renders a grid of countdown timer cards for tiles with rent due.
 * Cards are arranged in rows and wrap, contained within a scrollable area.
 * If more than SUMMARY_THRESHOLD tiles are selected, shows a summary view.
 * For 26-50 tiles, uses a condensed layout.
 *
 * @param {object} props - Component props.
 * @param {Map<string, {nextRentDue: number | null}>} props.relevantStates - Map
 *   of rent states for selected, leased tiles with future due dates. Key:
 *   "x,y", Value: { nextRentDue: timestamp | null }.
 * @param {number} props.currentTime - Current timestamp from `Date.now()`.
 * @param {Function} props.onSelectRequest - Callback function when a card is
 *   clicked, passing an array of tile keys (`['x,y', ...]`).
 * @returns {React.ReactElement} A Col containing a scrollable grid of timers.
 */
const RentTimersInterfaceComponent = ({
  relevantStates,
  currentTime,
  onSelectRequest,
}) => {
  // Internal state for current time, updated via effect when prop changes
  const [now, setNow] = useState(() => currentTime);
  const SUMMARY_THRESHOLD = 50; // Threshold to switch to summary view
  const DENSE_LAYOUT_THRESHOLD = 26; // Threshold for condensed layout

  // Effect to synchronize internal 'now' state with the prop 'currentTime'
  useEffect(() => {
    setNow(currentTime);
  }, [currentTime]);

  if (relevantStates === null ||
    typeof relevantStates.forEach !== 'function' ||
    relevantStates.size === 0) {
    return <></>
  }

  // Determine layout type based on the number of tiles
  const useSummaryView = relevantStates.size > SUMMARY_THRESHOLD;
  const useDenseLayout = !useSummaryView && relevantStates.size > DENSE_LAYOUT_THRESHOLD;
  const containerMaxHeight = useDenseLayout ? '200px' : '150px';

  // Define column sizes based on layout type
  const colProps = useDenseLayout
    ? { xs: "4", sm: "3", md: "2" } // More cards per row for dense layout
    : { xs: "6", sm: "4", md: "3" }; // Default layout

  // Define time thresholds for border colors (in milliseconds)
  const RED_THRESHOLD = 20 * 60 * 1000; // 20 minutes
  const YELLOW_THRESHOLD = 60 * 60 * 1000; // 1 hour

  // Define border colors
  const BORDER_COLOR_RED = '#DC3545'; // Danger Red
  const BORDER_COLOR_YELLOW = '#FFC107'; // Amber Yellow
  const BORDER_COLOR_DEFAULT = 'rgba(108, 117, 125, 0.5)'; // Default subtle border

  // --- Render Summary View (for > 50 tiles) ---
  if (useSummaryView) {
    const groupedRentTimers = groupSimilarRentTimers(relevantStates, now);

    const summaryCards = Array.from(groupedRentTimers.entries()).map(([groupKey, groupData]) => {
      const { count, earliestRentDue, keys } = groupData;
      const reactKey = `grouped-rent-timer-${groupKey}`;

      // Calculate remaining time to earliest due date
      const remainingTime = earliestRentDue - now;
      const timeText = formatTime(Math.max(0, remainingTime));

      // Determine border color based on remaining time
      let borderColor = BORDER_COLOR_DEFAULT;
      if (remainingTime <= RED_THRESHOLD) {
        borderColor = BORDER_COLOR_RED;
      } else if (remainingTime <= YELLOW_THRESHOLD) {
        borderColor = BORDER_COLOR_YELLOW;
      }

      return (
        <Col key={reactKey} {...colProps} className="mb-1">
          <Card
            className="rent-timer-item game-card h-100 clickable"
            style={{
              padding: '0.25rem',
              border: `2px solid ${borderColor}`, // Apply dynamic border
              transition: 'border-color 0.1s ease', // Smooth transition for color change
            }}
            onClick={() => onSelectRequest ? onSelectRequest(keys) : null}
          >
            <CardBody
              className="d-flex flex-column justify-content-center"
              style={{
                padding: '0.2rem',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Watermark */}
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '2.5rem',
                  fontFamily: 'cursive, Brush Script MT, sans-serif',
                  color: 'rgb(255, 174, 0)',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  zIndex: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                RENT
              </span>
              {/* Content */}
              <CardTitle
                tag="h6"
                className="text-center mb-1 small"
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  margin: 0,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {count} Tiles
              </CardTitle>
              <CardText
                className="text-center small"
                style={{
                  fontSize: '0.8rem',
                  margin: 0,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                Due in: {timeText}
              </CardText>
            </CardBody>
          </Card>
        </Col>
      );
    });

    return (
      <Col
        xs="12"
        className="mb-0 mt-0"
        style={{ maxHeight: containerMaxHeight, overflowY: 'auto', padding: '0 5px' }}
      >
        <Row className="g-1 justify-content-center">
          {summaryCards}
        </Row>
      </Col>
    );
  }

  // --- Render Individual Cards (for <= 50 tiles) ---
  const timerCards = Array.from(relevantStates.entries()).map(([key, state]) => {
    if (state.nextRentDue) {
      // Calculate remaining time based on internal 'now' state
      const remainingTime = state.nextRentDue - now;

      // Only render timers that haven't expired (allow brief visibility after 0)
      if (remainingTime > -1000) {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        // Consistent key generation
        const elementKey = (!isNaN(x) && !isNaN(y))
          ? `rent-timer-${x}-${y}` : `rent-timer-${key}`;

        // Determine border color based on remaining time
        let borderColor = BORDER_COLOR_DEFAULT;
        if (remainingTime <= RED_THRESHOLD) {
          borderColor = BORDER_COLOR_RED;
        } else if (remainingTime <= YELLOW_THRESHOLD) {
          borderColor = BORDER_COLOR_YELLOW;
        }

        return (
          <Col
            key={elementKey}
            {...colProps} // Use dynamic column size based on layout
            className="mb-1" // Spacing between cards
          >
            <Card
              className="rent-timer-item game-card h-100 clickable"
              style={{
                padding: '0.25rem',
                border: `2px solid ${borderColor}`, // Apply dynamic border
                transition: 'border-color 0.3s ease', // Smooth transition for color change
              }}
              onClick={() => onSelectRequest ? onSelectRequest([key]) : null}
            >
              <CardBody
                className="d-flex flex-column justify-content-center"
                style={{
                  padding: '0.2rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Watermark */}
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '2.5rem',
                    fontFamily: 'cursive, Brush Script MT, sans-serif',
                    color: 'rgb(255, 174, 0)',
                    textTransform: 'uppercase',
                    pointerEvents: 'none',
                    zIndex: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  RENT
                </span>
                {/* Content */}
                <CardTitle
                  tag="h6"
                  className="text-center mb-1 small"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    margin: 0,
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  ({key.replace(',', ', ')}) {/* Coords */}
                </CardTitle>
                <CardText
                  className="text-center small"
                  style={{
                    fontSize: '0.8rem',
                    margin: 0,
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  {/* Format time, ensuring non-negative display */}
                  {formatTime(Math.max(0, remainingTime))} {/* Time */}
                </CardText>
              </CardBody>
            </Card>
          </Col>
        );
      }
    }
    // Return null if the condition isn't met to avoid rendering empty fragments
    return null;
  });

  // Map over the relevant states
  return (
    <Col
      xs="12"
      className="mb-0 mt-0"
      style={{ maxHeight: containerMaxHeight, overflowY: 'auto', padding: '0 5px' }}
    >
      <Row className="g-1 justify-content-center">
        {timerCards}
      </Row>
    </Col>
  );
};

// Define PropTypes for the new component structure
RentTimersInterfaceComponent.propTypes = {
  /** Map of rent states. Key: "x,y", Value: { nextRentDue: timestamp }. */
  relevantStates: PropTypes.instanceOf(Map).isRequired,
  /** Current timestamp from Date.now(), passed from parent. */
  currentTime: PropTypes.number.isRequired,
  /**
   * Callback function when a card is clicked, passing an array of tile keys.
   */
  onSelectRequest: PropTypes.func,
};

/**
 * Helper function to group crop states for the summary view.
 * Groups by crop type, level, and planting time window.
 *
 * @private
 * @param {Map<string, object>} relevantStates - The map of crop states.
 * @param {number} now - The current timestamp.
 * @param {number} [thresholdMs=6000] - Time window in ms for grouping. Defaults
 *   to 6 seconds.
 * @returns {Map<string, {
 *   count: number,
 *   cropType: string,
 *   cropLevel: number,
 *   earliestPlantedAt: number,
 *   representativeStage: number | null,
 *   representativeNextStage: number | null,
 *   keys: Array<string>
 * }>} A map where keys represent groups and values contain group data.
 */
const groupSimilarCrops = (
  relevantStates,
  now,
  // Default grouping window to 6 seconds
  thresholdMs = 6000
) => {
  const groups = new Map();

  relevantStates.forEach((data, key) => {
    const {
      cropType,
      cropLevel,
      cropPlantedAt,
    } = data;

    if (
      // Needs to be a non-empty string
      !cropType ||
      // Level must be a valid number
      typeof cropLevel !== 'number' ||
      isNaN(cropLevel) ||
      !cropPlantedAt ||
      // Planted time must be a non-empty string
      typeof cropPlantedAt !== 'string'
    ) {
      console.warn(
        `[groupSimilarCrops] Skipping invalid data (type/level/plantedAt) for key ${key}: `,
        { cropType, cropLevel, cropPlantedAt },
        { data }
      );
      return; // Skip this entry entirely
    }

    // --- Convert plantedAt and Validate Timestamp --- //
    const plantedAtTimestamp = new Date(cropPlantedAt).getTime();
    if (isNaN(plantedAtTimestamp) || plantedAtTimestamp <= 0) {
      console.warn(
        `[groupSimilarCrops] Skipping invalid date format or non-positive timestamp for key ${key}: `,
        { cropPlantedAt, plantedAtTimestamp },
        { data }
      );
      return; // Skip if date string is invalid or timestamp is not positive
    }
    // --- End Timestamp Validation --- //

    // Create a grouping key based on type, level, and time window
    const timeGroup = Math.floor(plantedAtTimestamp / thresholdMs);
    const groupKey = `${cropType}-${cropLevel}-${timeGroup}`;

    // Initialize group if it doesn't exist
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        count: 0,
        cropType: cropType,
        cropLevel: cropLevel,
        earliestPlantedAt: plantedAtTimestamp, // Store the earliest timestamp
        representativeStage: null,
        representativeNextStage: null,
        keys: [],
      });
    }

    const group = groups.get(groupKey);
    group.keys.push(key);
    group.count++;
    group.earliestPlantedAt = Math.min(group.earliestPlantedAt, plantedAtTimestamp);
  });

  // After grouping, calculate representative stage info for each group
  groups.forEach((group) => {
    const stageInfo = calculateCropStageInfo(
      group.cropType,
      group.earliestPlantedAt, // Use earliest time
      group.cropLevel
    );
    group.representativeStage = stageInfo.cropStage;
    group.representativeNextStage = stageInfo.cropNextStage;
  });
  return groups;
};

/**
 * Renders a grid of cards displaying crop stage information for selected tiles.
 * Cards show coordinates, crop type, current stage/total stages, and time
 * until the next stage or "Ready".
 * Performance optimized by grouping crops with similar plantedAt timestamps.
 * If more than `SUMMARY_THRESHOLD` crops are selected, a summary view is shown.
 *
 * @param {object} props - Component props.
 * @param {Map<string, object>} props.relevantStates - Map of crop states for 
 *  selected tiles.
 *   Each value should contain: { cropType: string, cropLevel: number,
 *   cropPlantedAt: string, cropStage?: number, cropNextStage?: (number|null) }
 * @param {number} props.currentTime - Current timestamp from `Date.now()`.
 * @param {Function} props.onSelectRequest - Callback function when a card is
 *   clicked, passing an array of tile keys (`['x,y', ...]`).
 * @returns {React.ReactElement} A Col containing a scrollable grid of crop
 *   info.
 */
const CropStageInterfaceComponent = ({
  relevantStates,
  currentTime,
  onSelectRequest,
}) => {
  const [now, setNow] = useState(() => currentTime);
  const SUMMARY_THRESHOLD = 50; // Threshold to switch to summary view

  useEffect(() => {
    setNow(currentTime);
  }, [currentTime]);

  if (relevantStates === null ||
    typeof relevantStates.forEach !== 'function' ||
    relevantStates.size === 0) {
    // Return empty fragment or a placeholder if no relevant states
    return <></>;
  }

  // --- Decide between Summary View and Individual Cards ---
  if (relevantStates.size > SUMMARY_THRESHOLD) {
    // --- Render Grouped Cards (Summary View) --- //
    const groupedSimilarCrops = groupSimilarCrops(relevantStates, now);
    const DENSE_LAYOUT_THRESHOLD = 26; // Threshold for denser layout (based on group count)
    const useDenseLayout = groupedSimilarCrops.size > DENSE_LAYOUT_THRESHOLD;
    const containerMaxHeight = useDenseLayout ? '200px' : '150px';
    const colProps = useDenseLayout
      ? { xs: "4", sm: "3", md: "2" } // More cards per row
      : { xs: "6", sm: "4", md: "3" }; // Default layout

    const groupCardsList = [...groupedSimilarCrops.entries()].map(([groupKey, groupData]) => {
      const {
        cropType,
        cropLevel,
        count,
        representativeStage,
        representativeNextStage,
        keys,
      } = groupData;
      const reactKey = `grouped-crop-info-${groupKey}`;

      // Calculate stage and time text based on representative data
      const totalStages = getCropStagesCount(cropType, cropLevel);
      let stageText = 'Invalid Data';
      let timeText = '-';

      if (
        totalStages !== undefined &&
        representativeStage !== undefined &&
        representativeStage !== null
      ) {
        stageText = `Stage: ${representativeStage + 1}/${totalStages}`;
        if (representativeNextStage === null || representativeNextStage <= now) {
          timeText = 'Ready!';
        } else {
          const remainingTime = representativeNextStage - now;
          if (isNaN(remainingTime)) {
            console.error(
              `[CropStageInterface] NaN remainingTime for group ${groupKey}`,
              groupData
            );
            timeText = 'Error';
          } else {
            timeText = `Next: ${formatTimeDefault(remainingTime)}`;
          }
        }
      } else {
        console.warn(`[CropStageInterface] Invalid stage data for group ${groupKey}`,
          groupData);
      }

      // Render the card for the group
      return (
        <Col key={reactKey} {...colProps} className="mb-1">
          <Card
            className="crop-info-item game-card h-100 clickable"
            style={{ padding: '0.25rem' }}
            onClick={() => onSelectRequest ? onSelectRequest(keys) : null}
          >
            <CardBody
              className="d-flex flex-column justify-content-center"
              style={{
                padding: '0.2rem',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Watermark (Copied from individual card style) */}
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '2.0rem',
                  fontFamily: 'Georgia, serif',
                  color: 'rgba(0, 128, 0, 0.1)',
                  textTransform: 'uppercase',
                  fontWeight: 'bold',
                  pointerEvents: 'none',
                  zIndex: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                GROW
              </span>
              <CardTitle
                tag="h6"
                className="text-center mb-1 small"
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  margin: 0,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {cropType} (Lvl {cropLevel}) x {count}
              </CardTitle>
              <CardText
                className="text-center small"
                style={{ fontSize: '0.7rem', margin: '0 0 2px 0', position: 'relative', zIndex: 1 }}
              >
                {stageText}
              </CardText>
              <CardText
                className="text-center small"
                style={{ fontSize: '0.8rem', margin: 0, position: 'relative', zIndex: 1 }}
              >
                {timeText}
              </CardText>
            </CardBody>
          </Card>
        </Col>
      );
    });

    // Return the grid of grouped cards
    return (
      <Col
        xs="12"
        className="mb-0 mt-0"
        style={{ maxHeight: containerMaxHeight, overflowY: 'auto', padding: '0 5px' }}
      >
        <Row className="g-1 justify-content-center">
          {groupCardsList}
        </Row>
      </Col>
    );

  } else {
    // --- Render Individual Cards (Existing Logic) ---
    const DENSE_LAYOUT_THRESHOLD = 26; // Threshold for using denser layout
    const useDenseLayout = relevantStates.size > DENSE_LAYOUT_THRESHOLD;
    const containerMaxHeight = useDenseLayout ? '200px' : '150px';
    const colProps = useDenseLayout
      ? { xs: "4", sm: "3", md: "2" } // More cards per row
      : { xs: "6", sm: "4", md: "3" }; // Default layout

    const cropCardsList = [...relevantStates.entries()].map(([key, data]) => {
      // Use individual tile data for rendering
      const { cropType, cropLevel, cropPlantedAt } = data;
      const reactKey = `crop-info-${key}`;

      // Calculate stage info based on individual tile data
      const {
        cropStage: calculatedStage,
        cropNextStage: calculatedNextStage,
      } = calculateCropStageInfo(cropType, cropPlantedAt, cropLevel);

      const totalStages = getCropStagesCount(cropType, cropLevel);
      let stageText = 'Invalid Data';
      let timeText = '-';

      if (totalStages !== undefined &&
        calculatedStage !== undefined &&
        calculatedStage !== null) {
        // Display 1-based index
        stageText = `Stage: ${calculatedStage + 1}/${totalStages}`;

        if (calculatedNextStage === null || calculatedNextStage <= now) {
          timeText = 'Ready!'; // Crop is mature or at final stage
        } else {
          const remainingTime = calculatedNextStage - now;
          // Defensive check for NaN before formatting
          if (isNaN(remainingTime)) {
            console.error(
              `[CropStageInterface] Calculated NaN remainingTime for group. `,
              { key, calculatedNextStage, now, data } // Log individual data
            );
            timeText = 'Error'; // Indicate calculation error in UI
          } else {
            timeText = `Next: ${formatTimeDefault(remainingTime)}`;
          }
        }
      } else {
        // Handle cases where stage calculation failed (e.g., bad data)
        console.warn(`[CropStageInterface] Invalid stage data for:`, {
          key,
          data,
        });
      }

      return (
        <Col
          key={reactKey} // Use the generated React key
          // Apply conditional column sizes
          {...colProps}
          className="mb-1" // Spacing between cards
        >
          <Card
            className="crop-info-item game-card h-100 clickable" // Add clickable class
            style={{ padding: '0.25rem' }}
            onClick={() => onSelectRequest ? onSelectRequest([key]) : null} // Add onClick
          >
            <CardBody
              className="d-flex flex-column justify-content-center"
              style={{
                padding: '0.2rem',
                position: 'relative', // Needed for absolute positioning of watermark
                overflow: 'hidden' // Prevents watermark overflow
              }}
            >
              {/* Watermark (Optional: adjust or remove) */}
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '2.0rem', // Slightly smaller than rent
                  fontFamily: 'Georgia, serif', // Different font style
                  color: 'rgba(0, 128, 0, 0.1)', // Light green, transparent
                  textTransform: 'uppercase',
                  fontWeight: 'bold',
                  pointerEvents: 'none',
                  zIndex: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                GROW
              </span>
              {/* Actual Content */}
              <CardTitle
                tag="h6"
                className="text-center mb-1 small"
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  margin: 0,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                ({key}) {/* Coords */}
              </CardTitle>
              <CardText
                className="text-center small"
                style={{
                  fontSize: '0.7rem', // Smaller text for crop details
                  margin: '0 0 2px 0', // Small bottom margin
                  position: 'relative',
                  zIndex: 1,
                  textTransform: 'capitalize', // Capitalize crop type
                }}
              >
                {cropType} {/* Crop Type */}
              </CardText>
              <CardText
                className="text-center small"
                style={{
                  fontSize: '0.7rem',
                  margin: '0 0 2px 0',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {stageText} {/* Stage Info */}
              </CardText>
              <CardText
                className="text-center small"
                style={{
                  fontSize: '0.8rem',
                  margin: 0,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {timeText} {/* Time until next stage or Ready */}
              </CardText>
            </CardBody>
          </Card>
        </Col>
      );
    });

    // Return the grid of individual cards
    return (
      <Col
        xs="12"
        className="mb-0 mt-0"
        style={{ maxHeight: containerMaxHeight, overflowY: 'auto', padding: '0 5px' }}
      >
        <Row className="g-1 justify-content-center">
          {cropCardsList}
        </Row>
      </Col>
    );
  }
};

// PropTypes for the new component structure
CropStageInterfaceComponent.propTypes = {
  /** Map of crop states. Key: "x,y", Value: Crop state object. */
  relevantStates: PropTypes.instanceOf(Map).isRequired,
  /** Current timestamp from Date.now(). */
  currentTime: PropTypes.number.isRequired,
  /**
   * Callback function when a card is clicked, passing an array of tile keys.
   */
  onSelectRequest: PropTypes.func,
};

/**
 * Renders an error notification card with a flashing effect.
 *
 * @param {object} props - Component props.
 * @param {string | null} props.errorMessage - The error message to display.
 *   If null or empty, the component renders nothing.
 * @returns {React.ReactElement | null} A Col containing the styled error Card,
 *   or null if no error message is provided.
 */
const ErrorNotificationInterface = ({ errorMessage }) => {
  if (!errorMessage) {
    return null; // Don't render anything if there's no error
  }

  return (
    <Col
      xs="12"
      sm="12"
      className="mb-0 mt-0"
    >
      <Card
        className="h-100 mb-0 mt-0 game-card error-notification-card"
        style={{
          margin: 'auto',
          textAlign: 'center',
          backgroundColor: '#f8d7da',
          borderColor: '#f5c6cb',
          color: '#721c24',
          fontWeight: 'bold',
          animation: 'flash-error 1s infinite',
        }}
      >
        {errorMessage}
      </Card>
    </Col>
  );
};

// --- PropTypes --- //

addDividerComponent.propTypes = {
  /** The React node to render within the divider text span. */
  component: PropTypes.node.isRequired,
};

// Note: addDividerContainer uses default param, no props validation needed here
// Note: addDividerContainerSubMenu uses default param, no props needed here

getLoginComponent.propTypes = {
  /** Callback function for actions within the Login form. */
  handleButtonClick: PropTypes.func.isRequired,
};

getSignupComponent.propTypes = {
  /** Callback function for actions within the SignUp form. */
  handleButtonClick: PropTypes.func.isRequired,
};

actionsInterface.propTypes = {
  /** Callback function invoked when an action button is clicked. */
  handleActionButtonClick: PropTypes.func.isRequired,
  /** Array of selected tile data objects or null. */
  selectedTiles: PropTypes.array,
};

ErrorNotificationInterface.propTypes = {
  /** The error message to display. Renders null if empty. */
  errorMessage: PropTypes.string,
};

// --- Exports --- //

export {
  addDividerComponent,
  addDividerContainer,
  addDividerContainerSubMenu,
  getTitleWelcome,
  getTitleWelcomeStyled,
  getGameControls,
  getLoginComponent,
  getSignupComponent,
  movementInterface,
  actionsInterface,
  RentTimersInterfaceComponent,
  CropStageInterfaceComponent,
  ErrorNotificationInterface,
};