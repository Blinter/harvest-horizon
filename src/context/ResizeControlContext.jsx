/**
 * @file ResizeControlContext.jsx
 * @description Provides a context for globally enabling or disabling resize 
 *   events throughout the application.
 * @module context/ResizeControlContext
 */
import { createContext, useState, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

const ResizeControlContext = createContext();

export function ResizeControlProvider({ children }) {
  const [isResizeGloballyEnabled, setIsResizeGloballyEnabled] = useState(true);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isResizeGloballyEnabled,
    setIsResizeGloballyEnabled,
  }), [isResizeGloballyEnabled]);

  return (
    <ResizeControlContext.Provider value={value}>
      {children}
    </ResizeControlContext.Provider>
  );
}

ResizeControlProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useResizeControl = () => {
  const context = useContext(ResizeControlContext);
  if (context === undefined) {
    throw new Error(
      'useResizeControl must be used within a ResizeControlProvider'
    );
  }
  return context;
}; 