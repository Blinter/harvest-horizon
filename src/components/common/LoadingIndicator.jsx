/**
 * @file LoadingIndicator.jsx
 * @description A reusable loading spinner component with customizable size and
 *   message. Suitable for indicating background processes or data fetching.
 * @module components/common/LoadingIndicator
 *
 * @requires react
 * @requires prop-types
 * @requires ../../styles/loading.css
 */
import PropTypes from 'prop-types';
import '../../styles/loading.css';

/**
 * Displays a loading spinner and an optional message. Provides different size
 * options for flexibility in various UI contexts.
 *
 * @param {object} props - The component props object.
 * @param {string} [props.message='Loading...'] - The text message displayed
 *   beneath the spinner animation. Defaults to 'Loading...'.
 * @param {'small' | 'medium' | 'large'} [props.size='medium'] - Specifies the
 *   visual size of the loading indicator ('small', 'medium', or 'large').
 *   Defaults to 'medium'.
 * @returns {React.ReactElement} The rendered loading indicator component,
 *   including the spinner and message, wrapped in an <output> element with
 *   appropriate ARIA attributes.
 */
const LoadingIndicator = ({ message = 'Loading...', size = 'medium' }) => {
  return (
    <output className={`loading-container loading-${size}`} aria-live="polite">
      <div className="loading-spinner">
        <div className="loading-spinner-inner"></div>
      </div>
      <p className="loading-message">{message}</p>
    </output>
  );
};

LoadingIndicator.propTypes = {
  /**
   * The text message displayed beneath the spinner animation.
   */
  message: PropTypes.string,

  /**
   * Specifies the visual size of the loading indicator.
   */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
};

export default LoadingIndicator;
