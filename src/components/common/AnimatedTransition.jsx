/**
 * @file AnimatedTransition.jsx
 * @description A component for adding animated transitions between UI
 *   elements. Provides various transition types and configurable
 *   animation behavior.
 * @module components/common/AnimatedTransition
 *
 * @requires react
 * @requires prop-types
 * @requires ../../styles/transitions.css
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../../styles/transitions.css';

/**
 * Wraps children components to apply CSS transitions when they change or
 * when triggered.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The content to be animated.
 * @param {'fade' | 'slide' | 'scale' | 'flip'} [props.type='fade'] - The
 *   type of animation (e.g., fade, slide).
 * @param {number} [props.duration=300] - The duration of the transition in
 *   milliseconds.
 * @param {*} [props.triggerKey] - A key that, when changed, forces a
 *   transition even if children remain the same.
 * @param {'forward' | 'backward' | 'up' | 'down' | 'left' | 'right'}
 *   [props.direction='forward'] - The direction for directional animations
 *   (like slide or flip).
 * @returns {React.ReactElement} The animated wrapper component.
 */
const AnimatedTransition = ({
  children,
  type = 'fade',
  duration = 300,
  triggerKey,
  direction = 'forward',
}) => {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionClass, setTransitionClass] = useState('');

  useEffect(() => {
    if (children !== displayChildren && !transitioning) {
      setTransitioning(true);
      setTransitionClass(`exit-${type} exit-${type}-${direction}`);

      setTimeout(() => {
        setDisplayChildren(children);
        setTransitionClass(`enter-${type} enter-${type}-${direction}`);

        setTimeout(() => {
          setTransitioning(false);
          setTransitionClass('');
        }, duration);
      }, duration);
    }
  }, [children, displayChildren, transitioning, type, duration, direction]);

  useEffect(() => {
    if (!transitioning && triggerKey) {
      setDisplayChildren(children);
    }
  }, [triggerKey, children, transitioning]);

  return (
    <div
      className={`animated-transition ${transitionClass}`}
      style={{ '--transition-duration': `${duration}ms` }}
    >
      {displayChildren}
    </div>
  );
};

AnimatedTransition.propTypes = {
  /** The content to be animated */
  children: PropTypes.node.isRequired,

  /** The type of animation to apply */
  type: PropTypes.oneOf(['fade', 'slide', 'scale', 'flip']),

  /** The duration of the transition in milliseconds */
  duration: PropTypes.number,

  /**
   * A key that, when changed, forces a transition even if children
   * remain the same.
   */
  triggerKey: PropTypes.any,

  /** The direction for directional animations (like slide or flip) */
  direction: PropTypes.oneOf([
    'forward',
    'backward',
    'up',
    'down',
    'left',
    'right',
  ]),
};

export default AnimatedTransition;
