/**
 * @file AudioControlPanel.jsx
 * @description Reusable component for audio controls in the Harvest Horizon
 *   game. Provides UI for controlling volume, mute state, and playback for
 *   different audio types (sound effects, music, ambience).
 * @module components/controls/AudioControlPanel
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Label, Input } from 'reactstrap';
import { EventBus } from '../../game/EventBus';
import '../../styles/App.css';
import { addDividerContainer } from '../library/libControls';

/**
 * Renders controls for a specific audio type (sounds, music, or ambience).
 *
 * Provides UI for:
 * - Volume adjustment with a slider
 * - Mute toggle button
 * - Play/Stop buttons
 * - Expandable menu with additional controls
 *
 * @param {object} props - Component props.
 * @param {string} props.type - Audio type ('sounds', 'music', or 'ambience').
 * @param {number} props.initialVolume - Initial volume setting (0-100).
 * @param {boolean} props.initiallyPlaying - Whether audio should start playing
 *   automatically.
 * @param {boolean} props.initiallyMuted - Whether audio should start muted.
 * @param {Function} [props.onPlayStop] - Optional callback triggered when the
 *   play/stop state changes. Receives the new playing state (boolean) as an
 *   argument.
 * @param {Function} [props.onMuteChange] - Optional callback triggered when
 *   the mute state changes. Receives the new muted state (boolean) as an
 *   argument.
 * @param {Function} [props.onVolumeChange] - Optional callback triggered when
 *   the volume changes (debounced). Receives the new volume (0-100) as an
 *   argument.
 * @param {boolean} props.isOpen - Whether the control panel menu is currently
 *   open. This state is managed by the parent component to ensure persistence
 *   across re-renders (lifting state up).
 * @param {Function} props.onToggle - Function provided by the parent component
 *   to toggle the `isOpen` state, controlling the visibility of detailed
 *   settings.
 * @returns {React.ReactElement} The rendered audio control panel component.
 */
const AudioControlPanel = ({
  type,
  initialVolume = 1,
  initiallyPlaying = true,
  initiallyMuted = false,
  onPlayStop,
  onMuteChange,
  onVolumeChange,
  isOpen,
  onToggle,

}) => {
  // State for the audio controls
  const [volume, setVolume] = useState(initialVolume);
  const [isPlaying, setIsPlaying] = useState(initiallyPlaying);
  const [isMuted, setIsMuted] = useState(initiallyMuted);

  // Ref for debouncing volume changes
  const debouncedRef = useRef(null);

  // Capitalized type for display and event names
  const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
  const typeLower = type.toLowerCase();

  // Event names for EventBus
  const playEvent = `play${typeCapitalized}`;
  const stopEvent = `stop${typeCapitalized}`;
  const muteEvent = `mute${typeCapitalized}`;
  const unmuteEvent = `unmute${typeCapitalized}`;
  const volumeEvent = `set${typeCapitalized}Volume`;

  /**
   * Toggles the mute state and emits the appropriate `mute<Type>` or
   * `unmute<Type>` event via EventBus. Calls `onMuteChange` if provided.
   * When unmuting, the current volume level is sent with the event.
   *
   * @type {Function}
   */
  const handleMuteChange = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Emit the appropriate event with the current volume when unmuting
    if (newMutedState) {
      EventBus.emit(muteEvent);
    } else {
      // When unmuting, send the current volume to restore it
      const decimalVolume = volume / 100;
      EventBus.emit(unmuteEvent, decimalVolume);
    }

    if (onMuteChange) {
      onMuteChange(newMutedState);
    }
  }, [isMuted, volume, muteEvent, unmuteEvent, onMuteChange]);

  /**
   * Handles volume changes from the slider input. Updates the local volume
   * state immediately and emits the `set<Type>Volume` event via EventBus
   * after a debounce period (200ms) to prevent excessive event firing. Calls
   * `onVolumeChange` if provided, also after the debounce. The volume is
   * converted to a decimal (0-1) for the EventBus event.
   *
   * @type {Function}
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change
   *   event from the range slider.
   */
  const handleVolumeChange = useCallback(event => {
    const newVolume = parseInt(event.target.value, 10);
    setVolume(newVolume);

    // Clear any pending timeout
    if (debouncedRef.current) {
      clearTimeout(debouncedRef.current);
    }

    // Set a new timeout for emitting the volume change event
    debouncedRef.current = setTimeout(() => {
      // Convert volume from percentage (0-100) to decimal (0-1)
      const decimalVolume = newVolume / 100;
      EventBus.emit(volumeEvent, decimalVolume);

      if (onVolumeChange) {
        onVolumeChange(newVolume);
      }
    }, 200);
  },
    [volumeEvent, typeCapitalized, onVolumeChange]
  );

  /**
   * Toggles the play/stop state, updates the local state, and emits the
   * appropriate event (`play<Type>`/`stop<Type>` or
   * `resumeSounds`/`stopSounds`) via EventBus. Calls `onPlayStop` if
   * provided.
   *
   * @type {Function}
   */
  const handlePlayStop = useCallback(() => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    if (type === 'sounds') {
      EventBus.emit(newPlayingState ? 'resumeSounds' : 'stopSounds');
    } else {
      EventBus.emit(newPlayingState ? playEvent : stopEvent);
    }

    if (onPlayStop) {
      onPlayStop(newPlayingState);
    }
  }, [isPlaying, playEvent, stopEvent, onPlayStop, type]);

  // Cleanup the debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debouncedRef.current) {
        clearTimeout(debouncedRef.current);
      }
    };
  }, []);

  /**
   * Gets the appropriate label for the mute/unmute button based on the
   * current `isMuted` state.
   *
   * @returns {string} The button label ('Unmute' or 'Mute').
   */
  const getMuteButtonLabel = () => {
    return isMuted ? `Unmute` : `Mute`;
  };

  /**
   * Gets the appropriate label for the play/stop button based on the current
   * `isPlaying` state and the audio `type`.
   *
   * @returns {string} The button label (e.g., 'Stop music' or 'Play music').
   */
  const getPlayStopButtonLabel = () => {
    return isPlaying ? `Stop ${typeLower}` : `Play ${typeLower}`;
  };

  /**
   * Gets a string representation of the current volume level as a percentage.
   *
   * @returns {string} The volume formatted as a percentage string (e.g.,
   *   '75%').
   */
  const getVolumeDisplay = () => {
    return `${volume}%`;
  };

  return (
    <div className={`audio-control audio-control-${typeLower}`}>
      <div className="audio-control-main">
        <Button
          color="primary"
          size="sm"
          className="audio-settings-btn"
          onClick={onToggle}
        >
          {isOpen ? `Close ${typeCapitalized} Settings` : `${typeCapitalized}`}
        </Button>
      </div>

      {isOpen && (
        <div
          style={{
            border: '0.25px orange dotted',
          }}
        >
          {addDividerContainer(
            <Label for={`${typeLower}Control`}>{typeCapitalized}</Label>
          )}
          <div>
            <Button
              color={isPlaying ? 'danger' : 'primary'}
              size="sm"
              className="audio-toggle-btn"
              onClick={handlePlayStop}
            >
              {getPlayStopButtonLabel()}
            </Button>
            <Button
              color={isMuted ? 'primary' : 'warning'}
              size="sm"
              className="audio-mute-btn"
              onClick={handleMuteChange}
            >
              {getMuteButtonLabel()}
            </Button>
            <FormGroup className="mb-2">
              <div className="d-flex justify-content-center align-items-center">
                <Label for={`${typeLower}-volume`}>
                  {typeCapitalized} Volume: {getVolumeDisplay()}
                </Label>
              </div>
              <Input
                type="range"
                id={`${typeLower}-volume`}
                name={`${typeLower}-volume`}
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
              />
            </FormGroup>

            {type === 'sounds' && (
              <Button
                color="warning"
                size="sm"
                className="test-sound-btn"
                style={{
                  display: 'block',
                  margin: '0 auto',
                  marginBottom: '0.5rem',
                }}
                onClick={() => {
                  EventBus.emit('playTestSound');
                }}
              >
                Play Test Sound
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

AudioControlPanel.propTypes = {
  type: PropTypes.oneOf(['sounds', 'music', 'ambience']).isRequired,
  initialVolume: PropTypes.number,
  initiallyPlaying: PropTypes.bool,
  initiallyMuted: PropTypes.bool,
  onPlayStop: PropTypes.func,
  onMuteChange: PropTypes.func,
  onVolumeChange: PropTypes.func,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default AudioControlPanel;
