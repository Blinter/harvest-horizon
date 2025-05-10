/**
 * @file usePhaserErrorHandling.js
 * @description Custom React hook for managing Phaser game errors in React.
 *   Provides error tracking, reporting, and management for fatal and
 *   non-fatal errors occurring within the Phaser game instance. Integrates
 *   with the application's event bus to capture game errors and provide
 *   React components with the ability to respond and display these errors.
 * @module hooks/usePhaserErrorHandling
 */
import { useState, useEffect, useRef } from 'react';
import { handleError } from '../utils/errorHandler';
import { EventBus } from '../game/EventBus';

/**
 * Custom React Hook for centralized handling of Phaser game errors.
 *
 * Listens for 'game:error' and 'game:fatal-error' events emitted by the
 * EventBus, logs them using a central `handleError` utility, and manages
 * error state within the React component.
 *
 * @param {object} [options={}] - Configuration options for the hook.
 * @param {React.RefObject<Phaser.Game>} [options._phaserRef] - Optional ref
 *   to the Phaser game instance (currently unused within the hook logic).
 * @param {function(Error): void} [options.onError] - Callback function for
 *   non-fatal errors. Called with the specific error instance.
 * @param {function(Error): void} [options.onUnrecoverableError] - Callback
 *   function for fatal errors. Called with the specific error instance.
 * @returns {{
 *   error: Error | null,
 *   hasError: boolean,
 *   resetError: function(): void,
 *   errorCount: number,
 *   fatalErrorCount: number
 * }} An object containing the latest error encountered (or null), a boolean
 *   flag indicating if an error is currently set, a function to clear the
 *   current error state, a count of all errors handled by the hook, and a
 *   count of only the fatal errors handled.
 */
const usePhaserErrorHandling = ({
  _phaserRef,
  onError,
  onUnrecoverableError,
} = {}) => {
  const [error, setError] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [fatalErrorCount, setFatalErrorCount] = useState(0);
  const errorsRef = useRef({
    count: 0,
    fatalCount: 0,
  });

  useEffect(() => {
    const handlePhaserError = (err, isFatal = false) => {
      const phaserError = err instanceof Error ? err : new Error(String(err));

      errorsRef.current.count += 1;
      setErrorCount(errorsRef.current.count);

      if (isFatal) {
        errorsRef.current.fatalCount += 1;
        setFatalErrorCount(errorsRef.current.fatalCount);
      }

      handleError(phaserError, {
        context: 'Phaser Game',
        captureStack: true,
        onError: isFatal ? onUnrecoverableError : onError,
        rethrow: false,
      });

      setError(phaserError);
    };

    const errorUnsubscribe = EventBus.on('game:error', (err) =>
      handlePhaserError(err, false)
    );
    const fatalErrorUnsubscribe = EventBus.on('game:fatal-error', (err) =>
      handlePhaserError(err, true)
    );

    return () => {
      errorUnsubscribe();
      fatalErrorUnsubscribe();
    };
  }, [onError, onUnrecoverableError]);

  const resetError = () => {
    setError(null);
  };

  return {
    error,
    hasError: error !== null,
    resetError,
    errorCount,
    fatalErrorCount,
  };
};

export default usePhaserErrorHandling;
