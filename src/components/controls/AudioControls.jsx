/**
 * @file AudioControls.jsx
 * @description Audio controls component that provides UI for adjusting sound,
 *   music, and ambience settings. Handles volume changes and mute toggles
 *   with debouncing.
 * @module components/controls/AudioControls
 *
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires ../../game/EventBus
 */
import { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Label, Input } from 'reactstrap';
import eventBus from '../../game/EventBus';

/**
 * Component for controlling audio settings in the game. Provides sliders and
 * mute buttons for sounds, music, and ambience. Implements debouncing to
 * prevent event spamming.
 *
 * @component
 * @param {object} props - Component props
 * @param {number} props.soundsVolume - Current sound effects volume (0-100)
 * @param {number} props.musicVolume - Current music volume (0-100)
 * @param {number} props.ambienceVolume - Current ambience volume (0-100)
 * @param {boolean} props.soundsMuted - Whether sound effects are muted
 * @param {boolean} props.musicMuted - Whether music is muted
 * @param {boolean} props.ambienceMuted - Whether ambience is muted
 * @param {Function} props.onSoundsVolumeChange - Handler for sound volume
 *   changes
 * @param {Function} props.onMusicVolumeChange - Handler for music volume
 *   changes
 * @param {Function} props.onAmbienceVolumeChange - Handler for ambience
 *   volume changes
 * @param {Function} props.onSoundsMuteChange - Handler for sound mute toggle
 * @param {Function} props.onMusicMuteChange - Handler for music mute toggle
 * @param {Function} props.onAmbienceMuteChange - Handler for ambience mute
 *   toggle
 * @returns {React.ReactElement} The audio controls component
 */
const AudioControls = ({
  soundsVolume,
  musicVolume,
  ambienceVolume,
  soundsMuted,
  musicMuted,
  ambienceMuted,
  onSoundsVolumeChange,
  onMusicVolumeChange,
  onAmbienceVolumeChange,
  onSoundsMuteChange,
  onMusicMuteChange,
  onAmbienceMuteChange,
}) => {
  const debouncedRefMusic = useRef(null);
  const debouncedRefAmbience = useRef(null);
  const debouncedRefSounds = useRef(null);

  /**
   * Handles toggling the mute state for sound effects with debouncing.
   *
   * @function
   * @returns {void}
   */
  const handleSoundsMuteChange = useCallback(() => {
    const newSoundsMuted = !soundsMuted;
    onSoundsMuteChange(newSoundsMuted);
    if (debouncedRefSounds.current) clearTimeout(debouncedRefSounds.current);

    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [AudioControls] ` +
      `Handle sounds mute change. New state: ${newSoundsMuted}.`
    );

    debouncedRefSounds.current = setTimeout(() => {
      if (newSoundsMuted) {
        eventBus.emit('muteSounds');
      } else {
        eventBus.emit('unmuteSounds', soundsVolume / 100);
      }

      const logEventDetail = newSoundsMuted
        ? 'muteSounds'
        : `unmuteSounds with volume ${soundsVolume / 100}`;
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [AudioControls] ` +
        `Debounced: Emitting ${logEventDetail}.`
      );
    }, 250);
  }, [soundsMuted, soundsVolume, onSoundsMuteChange]);

  /**
   * Handles toggling the mute state for music with debouncing.
   *
   * @function
   * @returns {void}
   */
  const handleMusicMuteChange = useCallback(() => {
    const newMusicMuted = !musicMuted;
    onMusicMuteChange(newMusicMuted);
    if (debouncedRefMusic.current) clearTimeout(debouncedRefMusic.current);

    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [AudioControls] ` +
      `Handle music mute change. New state: ${newMusicMuted}.`
    );

    debouncedRefMusic.current = setTimeout(() => {
      if (newMusicMuted) eventBus.emit('muteMusic');
      else {
        eventBus.emit('unmuteMusic', musicVolume / 100);
      }

      const logEventDetail = newMusicMuted
        ? 'muteMusic'
        : `unmuteMusic with volume ${musicVolume / 100}`;
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [AudioControls] ` +
        `Debounced: Emitting ${logEventDetail}.`
      );
    }, 250);
  }, [musicMuted, musicVolume, onMusicMuteChange]);

  /**
   * Handles toggling the mute state for ambience with debouncing.
   *
   * @function
   * @returns {void}
   */
  const handleAmbienceMuteChange = useCallback(() => {
    const newAmbienceMuted = !ambienceMuted;
    onAmbienceMuteChange(newAmbienceMuted);
    if (debouncedRefAmbience.current)
      clearTimeout(debouncedRefAmbience.current);

    console.debug(
      `[${new Date().toISOString()}] [DEBUG] [AudioControls] ` +
      `Handle ambience mute change. New state: ${newAmbienceMuted}.`
    );

    debouncedRefAmbience.current = setTimeout(() => {
      if (newAmbienceMuted) eventBus.emit('muteAmbience');
      else eventBus.emit('unmuteAmbience', ambienceVolume / 100);

      const logEventDetail = newAmbienceMuted
        ? 'muteAmbience'
        : `unmuteAmbience with volume ${ambienceVolume / 100}`;
      console.debug(
        `[${new Date().toISOString()}] [DEBUG] [AudioControls] ` +
        `Debounced: Emitting ${logEventDetail}.`
      );
    }, 250);
  }, [ambienceMuted, ambienceVolume, onAmbienceMuteChange]);

  return (
    <div className="audio-controls" data-testid="audio-controls">
      <FormGroup>
        <Label for="soundsVolume">Sound Effects</Label>
        <div className="d-flex align-items-center">
          <Input
            type="range"
            id="soundsVolume"
            min="0"
            max="100"
            value={soundsVolume}
            onChange={(e) => {
              const value = Math.max(0, Math.min(100, Number(e.target.value)));
              onSoundsVolumeChange(value);
            }}
            disabled={soundsMuted}
          />
          <Button
            color={soundsMuted ? 'secondary' : 'primary'}
            onClick={handleSoundsMuteChange}
            className="ml-2"
            aria-label={soundsMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {soundsMuted ? '🔇' : '🔊'}
          </Button>
        </div>
      </FormGroup>

      <FormGroup>
        <Label for="musicVolume">Music</Label>
        <div className="d-flex align-items-center">
          <Input
            type="range"
            id="musicVolume"
            min="0"
            max="100"
            value={musicVolume}
            onChange={(e) => {
              const value = Math.max(0, Math.min(100, Number(e.target.value)));
              onMusicVolumeChange(value);
            }}
            disabled={musicMuted}
          />
          <Button
            color={musicMuted ? 'secondary' : 'primary'}
            onClick={handleMusicMuteChange}
            className="ml-2"
            aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
          >
            {musicMuted ? '🔇' : '🎵'}
          </Button>
        </div>
      </FormGroup>

      <FormGroup>
        <Label for="ambienceVolume">Ambience</Label>
        <div className="d-flex align-items-center">
          <Input
            type="range"
            id="ambienceVolume"
            min="0"
            max="100"
            value={ambienceVolume}
            onChange={(e) => {
              const value = Math.max(0, Math.min(100, Number(e.target.value)));
              onAmbienceVolumeChange(value);
            }}
            disabled={ambienceMuted}
          />
          <Button
            color={ambienceMuted ? 'secondary' : 'primary'}
            onClick={handleAmbienceMuteChange}
            className="ml-2"
            aria-label={ambienceMuted ? 'Unmute ambience' : 'Mute ambience'}
          >
            {ambienceMuted ? '🔇' : '🌳'}
          </Button>
        </div>
      </FormGroup>
    </div>
  );
};

AudioControls.propTypes = {
  /** Current sound effects volume (0-100) */
  soundsVolume: PropTypes.number.isRequired,

  /** Current music volume (0-100) */
  musicVolume: PropTypes.number.isRequired,

  /** Current ambience volume (0-100) */
  ambienceVolume: PropTypes.number.isRequired,

  /** Whether sound effects are muted */
  soundsMuted: PropTypes.bool.isRequired,

  /** Whether music is muted */
  musicMuted: PropTypes.bool.isRequired,

  /** Whether ambience is muted */
  ambienceMuted: PropTypes.bool.isRequired,

  /** Handler for sound volume changes */
  onSoundsVolumeChange: PropTypes.func.isRequired,

  /** Handler for music volume changes */
  onMusicVolumeChange: PropTypes.func.isRequired,

  /** Handler for ambience volume changes */
  onAmbienceVolumeChange: PropTypes.func.isRequired,

  /** Handler for sound mute toggle */
  onSoundsMuteChange: PropTypes.func.isRequired,

  /** Handler for music mute toggle */
  onMusicMuteChange: PropTypes.func.isRequired,

  /** Handler for ambience mute toggle */
  onAmbienceMuteChange: PropTypes.func.isRequired,
};

export default AudioControls;
