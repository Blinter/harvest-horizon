/**
 * @file GameControls.jsx
 * @description In-game control panel component displaying map info, game
 *   actions, movement controls, and audio settings.
 * @module components/controls/GameControls
 *
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires ../library/libControls
 * @requires ./AudioControlPanel
 * @requires ../../styles/App.css
 */
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import {
  addDividerContainer,
  movementInterface,
  getGameControls,
} from '../library/libControls';
import AudioControlPanel from './AudioControlPanel';
import '../../styles/App.css';

/**
 * Renders the in-game control panel. Displays the currently loaded map ID,
 * provides a button to stop the game, shows movement controls, and includes
 * audio settings panels.
 *
 * @param {object} props - Component props.
 * @param {string|null} props.mapId - The ID of the currently loaded map.
 * @param {string|null} [props.mapNickname] - The nickname of the currently
 *   loaded map.
 * @param {Function} props.onStopGame - Callback function to stop the game.
 * @param {Function} props.onReloadMap - Callback function to reload map data.
 * @param {boolean} props.isReloadDisabled - Whether the reload button should
 *   be disabled.
 * @param {boolean} props.soundsSettingsOpen - Whether the sounds panel is
 *   open.
 * @param {Function} props.toggleSoundsSettings - Toggles the sounds panel.
 * @param {boolean} props.musicSettingsOpen - Whether the music panel is open.
 * @param {Function} props.toggleMusicSettings - Toggles the music panel.
 * @param {boolean} props.ambienceSettingsOpen - Whether the ambience panel is
 *   open.
 * @param {Function} props.toggleAmbienceSettings - Toggles the ambience
 *   panel.
 * @param {boolean} props.isMapTitleVisible - Whether the map title should be
 *   shown.
 * @param {Function} props.onToggleMapTitleVisibility - Callback to toggle map
 *   title visibility.
 * @param {number} props.soundsVolume - Current volume level for sounds.
 * @param {number} props.musicVolume - Current volume level for music.
 * @param {number} props.ambienceVolume - Current volume level for ambience.
 * @param {Function} props.onSoundsVolumeChange - Callback for sounds volume
 *   change.
 * @param {Function} props.onMusicVolumeChange - Callback for music volume
 *   change.
 * @param {Function} props.onAmbienceVolumeChange - Callback for ambience
 *   volume change.
 * @returns {React.ReactElement} The rendered game controls component.
 */
const GameControls = ({
  mapId,
  //Add mapNickName for other controls later
  // eslint-disable-next-line no-unused-vars
  mapNickname,
  onStopGame,
  onReloadMap,
  isReloadDisabled,
  soundsSettingsOpen,
  toggleSoundsSettings,
  musicSettingsOpen,
  toggleMusicSettings,
  ambienceSettingsOpen,
  toggleAmbienceSettings,
  isMapTitleVisible,
  onToggleMapTitleVisibility,
  soundsVolume,
  musicVolume,
  ambienceVolume,
  onSoundsVolumeChange,
  onMusicVolumeChange,
  onAmbienceVolumeChange,
}) => {

  return (
    <div
      className="game-controls"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        alignItems: 'center',
        width: '100%',
        maxWidth: '100%',
        margin: '0',
        padding: '20px',
        paddingTop: '0',
        marginTop: '0',
      }}
    >
      {getGameControls()}
      {/*  Keep for debugging 
      {mapId && (
        <p className="text-info text-center small mt-2 mb-3">
          Loaded Map ID: {mapId}
        </p>
      )} */}

      {mapId && (
        <div
          style={{
            marginBottom: '15px',
          }}
        >
        </div>
      )}

      {addDividerContainer('Map Controls')}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0',
          width: '100%',
        }}
      >
        {movementInterface()}
      </div>

      {addDividerContainer('Game Controls')}
      <div
        style={{
          marginTop: '0',
          padding: '0',
          display: 'flex',
          justifyContent: 'space-around',
          width: '100%',
        }}
      >
        <Button color="danger" onClick={onStopGame}>
          Stop Game
        </Button>
        <Button
          color="warning"
          size="sm"
          onClick={onReloadMap}
          disabled={isReloadDisabled}
        >
          Reload Map Data
        </Button>
      </div>

      {addDividerContainer('Client Settings')}
      <div className="form-check form-switch my-3 d-flex justify-content-center">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="showMapTitleSwitch"
          checked={isMapTitleVisible}
          onChange={onToggleMapTitleVisibility}
        />
        <label
          className="form-check-label small ms-2"
          htmlFor="showMapTitleSwitch"
        >
          Show Map Title
        </label>
      </div>
      <div
        style={{
          marginTop: '0',
          padding: '10px 0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '10px',
          width: '100%',
        }}
      >
        <AudioControlPanel
          type="sounds"
          initialVolume={soundsVolume}
          initiallyPlaying={true}
          initiallyMuted={false}
          isOpen={soundsSettingsOpen}
          onToggle={toggleSoundsSettings}
          onVolumeChange={onSoundsVolumeChange}
        />
        <AudioControlPanel
          type="music"
          initialVolume={musicVolume}
          initiallyPlaying={true}
          initiallyMuted={false}
          isOpen={musicSettingsOpen}
          onToggle={toggleMusicSettings}
          onVolumeChange={onMusicVolumeChange}
        />
        <AudioControlPanel
          type="ambience"
          initialVolume={ambienceVolume}
          initiallyPlaying={true}
          initiallyMuted={false}
          isOpen={ambienceSettingsOpen}
          onToggle={toggleAmbienceSettings}
          onVolumeChange={onAmbienceVolumeChange}
        />
      </div>
    </div>
  );
};

GameControls.propTypes = {
  mapId: PropTypes.string,
  mapNickname: PropTypes.string,
  onStopGame: PropTypes.func.isRequired,
  onReloadMap: PropTypes.func.isRequired,
  isReloadDisabled: PropTypes.bool.isRequired,
  soundsSettingsOpen: PropTypes.bool.isRequired,
  toggleSoundsSettings: PropTypes.func.isRequired,
  musicSettingsOpen: PropTypes.bool.isRequired,
  toggleMusicSettings: PropTypes.func.isRequired,
  ambienceSettingsOpen: PropTypes.bool.isRequired,
  toggleAmbienceSettings: PropTypes.func.isRequired,
  isMapTitleVisible: PropTypes.bool.isRequired,
  onToggleMapTitleVisibility: PropTypes.func.isRequired,
  soundsVolume: PropTypes.number.isRequired,
  musicVolume: PropTypes.number.isRequired,
  ambienceVolume: PropTypes.number.isRequired,
  onSoundsVolumeChange: PropTypes.func.isRequired,
  onMusicVolumeChange: PropTypes.func.isRequired,
  onAmbienceVolumeChange: PropTypes.func.isRequired,
};

export default GameControls;
