/**
 * @file main.jsx
 * @module main
 * @description Main entry point for the React application. Sets up the root
 *   component, handles window resizing to calculate dimensions for the game
 *   canvas, wraps the App in StrictMode and BrowserRouter, and renders the
 *   application to the DOM.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/App.css';
import App from './App.jsx';
import UserProvider from './components/context/UserProvider';
import { ResizeControlProvider } from './context/ResizeControlContext';

/**
 * Root React component that manages window dimensions and renders the main App.
 *
 * Wraps the main App component with necessary context providers.
 *
 * @component
 * @returns {React.ReactElement} The rendered RootComponent structure.
 */
function RootComponent() {
  return (
    <StrictMode>
      <BrowserRouter>
        <UserProvider>
          {/* App consumes dimensions, context is handled above */}
          <App />
        </UserProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

/**
 * The component that sets up the context provider before rendering RootComponent.
 */
function AppWithProviders() {
  return (
    <ResizeControlProvider>
      <RootComponent />
    </ResizeControlProvider>
  );
}

/**
 * Gets the root DOM element and renders the application.
 *
 * Selects the DOM element with the ID 'root', creates a React root using
 * `createRoot`, and renders the `AppWithProviders` into it.
 *
 * @throws {Error} If the root element with ID 'root' is not found in the DOM.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(rootElement);
root.render(<AppWithProviders />);

export { RootComponent };
