/**
 * @file ErrorBoundary.jsx
 * @description Provides error boundary components for capturing and handling
 *   errors in React component trees. Includes both a standard ErrorBoundary
 *   component and a higher-order component (withErrorBoundary) for wrapping
 *   components with error handling functionality.
 *
 * @module components/errorBoundary/ErrorBoundary
 */
import React from 'react';
import PropTypes from 'prop-types';
import { handleError } from '../../utils/errorHandler';
/**
 * A React component that catches JavaScript errors anywhere in its child
 * component tree, logs those errors, and displays a fallback UI instead of
 * the crashed component tree.
 *
 * @extends React.Component
 */
class ErrorBoundary extends React.Component {
  /**
   * Initializes the component state.
   *
   * @param {object} props - Component props.
   */
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Updates state so the next render will show the fallback UI.
   *
   * @param {Error} error - The error that was thrown.
   * @returns {{hasError: boolean, error: Error}} The state update.
   */
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  /**
   * Catches errors after they have been thrown, logs them, and optionally
   * calls a callback.
   *
   * @param {Error} error - The error that was caught.
   * @param {object} errorInfo - An object with a componentStack key containing
   *   information about which component threw the error.
   */
  componentDidCatch(error, errorInfo) {
    const { name, onError } = this.props;

    handleError(error, {
      context: `ErrorBoundary(${name || 'unnamed'})`,
      onError: onError || undefined,
      captureStack: true,
      rethrow: false,
    });

    if (errorInfo?.componentStack) {
      const timestamp = new Date().toISOString();
      console.error(
        `[${timestamp}] [ERROR]: Component stack for error in ${name || 'unnamed'}:`,
        {
          componentStack: errorInfo.componentStack,
        }
      );
    }
  }

  /**
   * Renders the component tree or the fallback UI if an error occurred.
   *
   * @returns {React.ReactNode} The rendered component or fallback UI.
   */
  render() {
    const { children, fallback } = this.props;

    if (this.state.hasError) {
      // Determine the fallback UI based on the type of the 'fallback' prop
      if (React.isValidElement(fallback)) {
        // If fallback is a React element, clone it and pass the error
        return React.cloneElement(fallback, { error: this.state.error });
      } else if (typeof fallback === 'function') {
        // If fallback is a function, call it with the error
        return fallback({ error: this.state.error });
      } else {
        // Otherwise, render the default fallback UI
        return (
          <div className="error-boundary-fallback">
            <h2>Something went wrong.</h2>
            <p>The application encountered an error and could not continue.</p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details>
                <summary>Error details</summary>
                <p>{this.state.error.toString()}</p>
              </details>
            )}
          </div>
        );
      }
    }

    // If no error, render children normally
    return children;
  }
}

ErrorBoundary.propTypes = {
  /** The child components to wrap with the error boundary. */
  children: PropTypes.node.isRequired,
  /**
   * The fallback UI to render when an error is caught. Can be a React node or a
   * function returning a node.
   */
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  /** An optional callback function that is called when an error is caught. */
  onError: PropTypes.func,
  /** An optional name for the boundary, used in logging. */
  name: PropTypes.string,
};

/**
 * A Higher-Order Component (HOC) that wraps a given component with an
 * ErrorBoundary.
 *
 * @param {React.ComponentType} Component - The component to wrap.
 * @param {object} [boundaryProps={}] - Props to pass to the underlying
 *   ErrorBoundary component.
 * @returns {React.ComponentType} The wrapped component.
 */
export const withErrorBoundary = (Component, boundaryProps = {}) => {
  /**
   * The wrapped component that includes the ErrorBoundary.
   *
   * @param {object} props - Props passed to the original component.
   * @returns {React.ReactElement} The rendered wrapped component.
   */
  const WrappedComponent = (props) => (
    <ErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  // Set display name for better debugging
  WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'
    })`;

  return WrappedComponent;
};

export default ErrorBoundary;
