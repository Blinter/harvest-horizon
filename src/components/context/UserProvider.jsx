/**
 * @file UserProvider.jsx
 * @module components/context/UserProvider
 * @description Provides a React context and provider for managing user
 *   authentication state across the application. It handles loading tokens,
 *   validating sessions, fetching user profiles, managing login/logout/register
 *   flows, and reacting to token refresh events.
 * @requires react
 * @requires prop-types
 * @requires jwt-decode
 * @requires ../../library/auth.service
 */

import React, {
  createContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import {
  loadAccessToken,
  decodeToken,
  getUser,
  loginUser,
  registerUser,
  logoutUser,
  authEvents,
  ACCESS_TOKEN_STORAGE_KEY,
  configureAxiosHeaders,
  saveTokens,
  REFRESH_TOKEN_STORAGE_KEY,
} from '../../library/auth.service';

/**
 * User context value object shape.
 * @typedef {Object} UserContextValue
 * @property {object|null} currentUser
 * @property {function(object): Promise<void>} login
 * @property {function(): Promise<void>} logout
 * @property {function(object): Promise<void>} register
 * @property {function((string|number)): Promise<object>} getUserInfo
 * @property {boolean} isAuthenticated
 * @property {boolean} isLoading
 * @property {string|null} accessToken
 */

/**
 * React context for distributing user authentication state and actions.
 * 
 * @type {object}
 */
const UserContext = createContext();

/**
 * Error message constant for when `useUser` is called outside a `UserProvider`.
 * 
 * @type {string}
 * @constant
 * @private
 */
const CONTEXT_ERROR = 'useUser must be used within a UserProvider';

/**
 * Provides user authentication state and related functions to children via
 * context. Handles token loading, validation, user profile retrieval, and
 * logout. Listens for authentication events like session expiration and
 * token refresh.
 *
 * @component UserProvider
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that will consume
 *   the context.
 * @returns {React.ReactElement} The context provider component wrapping the
 *   children.
 * @throws {Error} Can potentially throw errors during initialization if token
 *   decoding or initial user fetch fails, though attempts are made to handle
 *   these gracefully by logging out. Login/register functions re-throw API
 *   errors.
 * @example
 * <UserProvider>
 *   <App />
 * </UserProvider>
 */
function UserProvider({ children }) {
  /**
   * Stores the current JWT access token. Null if not authenticated.
   * @state
   * Holds state for the current JWT access token.
   * // [state, setState] tuple
@type {Array}
   */
  const [accessToken, setAccessToken] = useState(null);

  /**
   * Stores the current authenticated user's data, typically decoded from the
   * JWT payload, potentially merged with data fetched from the server. Null
   * if not authenticated.
   * @state
   * Holds state for the current authenticated user's data.
   * // [state, setState] tuple
@type {Array}
   */
  const [currentUserState, setCurrentUserState] = useState(null);

  /**
   * Tracks the loading state during initial authentication checks or login/
   * register processes. True while loading, false otherwise.
   * @state
   * Holds state for the loading status.
   * // [state, setState] tuple
@type {Array}
   */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Logs out the current user. Calls the backend logout endpoint (if possible)
   * via `logoutUser`, removes tokens from local storage, and clears the
   * authentication state in the context.
   *
   * @function logout
   * @async
   * @type {Function}
   * @returns {Promise<void>} Resolves when logout process is complete.
   */
  const logout = useCallback(async () => {
    setIsLoading(true); // Indicate loading during logout
    try {
      // Call auth service logout (handles backend + local storage)
      await logoutUser();
    } catch (error) {
      // logoutUser logs errors, log context here
      console.error(
        `[${new Date().toISOString()}] [UserProvider] ` +
        `Error during logoutUser call: `,
        error
      );
      // Proceed with clearing local state regardless
    }

    // Clear local React state
    setAccessToken(null);
    setCurrentUserState(null);
    configureAxiosHeaders(null); // Clear Axios headers
    setIsLoading(false); // Ensure loading is stopped
  }, []);

  /**
   * Handles direct session setting using provided user data and tokens.
   * Used for Quick Start flow or potentially token refresh responses that
   * include user data. Saves tokens, decodes the access token, configures
   * Axios headers, and updates the context state.
   *
   * @function _handleDirectSessionLogin
   * @private
   * @async
   * @type {Function}
   * @param {object} authData - Session data containing user object, access
   *   token, and optionally a refresh token.
   * @param {string} timestamp - ISO timestamp string for consistent logging.
   * @returns {Promise<void>} Resolves when session is set and state updated.
   * @throws {Error} If saving tokens or decoding the access token fails.
   */
  const _handleDirectSessionLogin = useCallback(async (authData, timestamp) => {
    // Debug when direct session is set
    // console.debug(
    //   `[${timestamp}] [UserProvider] Setting session directly ` +
    //   `for user: ${authData.user.username}`
    // );
    const { user, token: accessToken, refreshToken } = authData;

    if (refreshToken) {
      // Debug when refresh token is present
      // console.debug(
      //   `[${timestamp}] [UserProvider] Saving received access and refresh ` +
      //   `tokens (direct set).`
      // );
      saveTokens(accessToken, refreshToken); // Save both tokens
    } else {
      console.warn(
        `[${timestamp}] [UserProvider] Refresh token missing in direct set ` +
        `data. Only saving access token.`
      );
      try {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
        // Explicitly remove any old refresh token to avoid inconsistency
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      } catch (storageError) {
        console.error(
          `[${timestamp}] [UserProvider] Error saving ONLY access token ` +
          `to localStorage during direct login:`, storageError
        );
        throw new Error('Failed to save session token.');
      }
    }

    let decodedUser = null;
    try {
      decodedUser = decodeToken(accessToken);
    } catch (decodeError) {
      console.error(
        `[${timestamp}] [UserProvider] Failed to decode provided token ` +
        `during direct login: ${decodeError.message}`
      );
      await logout(); // Use logout from outer scope
      throw new Error('Invalid session token provided.');
    }

    setAccessToken(accessToken);
    // Prefer fresh decoded data, fallback to provided user object
    setCurrentUserState(decodedUser || user);
    // Pass token directly for synchronous header update
    configureAxiosHeaders(accessToken);
    // Debug when direct session is set
    // console.info(
    //   `[${timestamp}] [UserProvider] Direct session set complete ` +
    //   `for user: ${(decodedUser || user).username}`
    // );
  }, [logout]);

  /**
   * Handles user login via username and password credentials. Calls the
   * `loginUser` service function, which handles the API call and token saving.
   * Updates the context state upon successful login.
   *
   * @function _handleCredentialLogin
   * @private
   * @async
   * @type {Function}
   * @param {object} authData - Credentials object { username, password }.
   * @param {string} timestamp - ISO timestamp string for consistent logging.
   * @returns {Promise<void>} Resolves when login is successful and state
   *   updated.
   * @throws {Error} If `loginUser` API call fails or returns no access token.
   */
  const _handleCredentialLogin = useCallback(async (authData, timestamp) => {
    // Debug when credential login is attempted
    // console.debug(
    //   `[${timestamp}] [UserProvider] Attempting credential login ` +
    //   `for user: ${authData.username}`
    // );
    const credentials = authData;
    // loginUser handles API call AND saving both tokens internally
    // It also calls configureAxiosHeaders on success
    const newAccessToken = await loginUser(credentials);
    if (newAccessToken) {
      const decodedUser = decodeToken(newAccessToken);
      setAccessToken(newAccessToken); // Update state with the new token
      setCurrentUserState(decodedUser);
      // Debug when credential login is successful
      // console.info(
      //   `[${timestamp}] [UserProvider] Credential login successful ` +
      //   `for user: ${decodedUser.username}`
      // );
    } else {
      // Should not happen if loginUser throws on failure, but good practice
      console.error(
        `[${timestamp}] [UserProvider] Login Error: ` +
        `loginUser resolved without access token.`
      );
      throw new Error('Login failed: No token received.');
    }
  }, []);

  /**
   * Logs in a user. Can handle both credential-based login and direct session
   * setting (e.g., from Quick Start) by delegating to helper functions.
   * Manages loading state and error handling.
   *
   * @function login
   * @async
   * @type {Function}
   * @param {object} authData - Authentication data. Can be either
   *   `{username, password}` for credential login, or
   *   `{user, token, refreshToken}` for direct session setting.
   * @returns {Promise<void>} Resolves upon successful login and state update.
   * @throws {Error} If invalid arguments are provided or if the login process
   *   fails (re-throws error from helper functions).
   */
  const login = useCallback(async (authData) => {
    const timestamp = new Date().toISOString();
    setIsLoading(true); // Start loading
    try {
      // Check if called with user object and token (Quick Start / Refresh)
      if (authData?.user && authData?.token) {
        await _handleDirectSessionLogin(authData, timestamp);
      }
      // Check if called with credentials (Standard Login)
      else if (authData?.username && authData.password) {
        await _handleCredentialLogin(authData, timestamp);
      }
      // Invalid arguments passed
      else {
        console.error(
          `[${timestamp}] [UserProvider] Login function called with ` +
          `invalid arguments.`, authData
        );
        throw new Error(
          'Login requires {username, password} or {user, token, refreshToken}.'
        );
      }
    } catch (error) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [UserProvider] Login/Session Set failed: ` +
        `${error.message || 'Unknown error'}`,
        error
      );
      // Clear potentially inconsistent state on failure
      setAccessToken(null);
      setCurrentUserState(null);
      configureAxiosHeaders(null); // Clear Axios headers too
      // No need to clear tokens from storage here, as logout() should handle
      // it if called by the error source (e.g., decoding failure in helper)
      throw error; // Re-throw the error for calling components
    } finally {
      setIsLoading(false); // Stop loading regardless of outcome
    }
  }, [_handleDirectSessionLogin, _handleCredentialLogin]);

  /**
   * Registers a new user. Calls the `registerUser` service function, which
   */
  const register = useCallback(async (userData) => {
    setIsLoading(true);
    try {
      // registerUser handles API call, token saving, and Axios header config
      const newAccessToken = await registerUser(userData);
      if (newAccessToken) {
        const decodedUser = decodeToken(newAccessToken);
        setAccessToken(newAccessToken);
        setCurrentUserState(decodedUser);
        // Debug when user is registered
        // console.info(
        //   `[${new Date().toISOString()}] [UserProvider] User registered ` +
        //   `and session started successfully for ${decodedUser.username}`
        // );
      } else {
        // Should not happen if registerUser throws on failure
        console.error(
          `[${new Date().toISOString()}] [UserProvider] Register Error: ` +
          `registerUser resolved without access token.`
        );
        throw new Error('Registration failed: No token received.');
      }
    } catch (error) {
      const errorTimestamp = new Date().toISOString();
      console.error(
        `[${errorTimestamp}] [UserProvider] Registration failed: ` +
        `${error.message || 'Unknown error'}`,
        error
      );
      // Clear state on failure
      setAccessToken(null);
      setCurrentUserState(null);
      configureAxiosHeaders(null);
      throw error; // Re-throw for UI feedback
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetches detailed user information from the server by user ID.
   * Primarily intended for internal use during initialization for non-
   * temporary users, but exposed for potential specific needs.
   *
   * @function getUserInfo
   * @async
   * @type {Function}
   * @param {string|number} userId - The PostgreSQL ID of the user to retrieve.
   * @returns {Promise<object>} The full user data object from the API.
   * @throws {Error} If `userId` is not provided or if the API call fails.
   */
  const getUserInfo = useCallback(async (userId) => {
    // This function might be less necessary if initializeUser covers the
    // primary use case. Kept for potential direct use.
    console.warn(
      `[${new Date().toISOString()}] [UserProvider] ` +
      `getUserInfo called directly - check if needed.`
    );
    if (!userId) {
      console.error(
        `[${new Date().toISOString()}] [UserProvider] ` +
        `getUserInfo failed: No userId provided.`
      );
      throw new Error('User ID is required to get user info.');
    }
    try {
      // getUser service function handles API call and internal logging
      const userData = await getUser(userId);
      return userData;
    } catch (error) {
      // Log context here, specific error logged by getUser
      console.error(
        `[${new Date().toISOString()}] [UserProvider] ` +
        `Error fetching user info via getUserInfo: ${error.message}`,
        error
      );
      throw error; // Re-throw
    }
  }, []);

  /**
   * Handles the 'sessionExpired' event emitted by the auth service.
   * Triggers a logout to clear the invalid session state.
   *
   * @function handleSessionExpired
   * @private
   * @type {Function}
   */
  const handleSessionExpired = useCallback(() => {
    console.warn(
      `[${new Date().toISOString()}] [UserProvider] 'sessionExpired' event ` +
      `received. Initiating logout.`
    );
    logout(); // Call the internal logout function
  }, [logout]);

  /**
   * Handles the 'tokenRefreshed' event emitted by the auth service.
   * Updates the context state (access token, current user) with the newly
   * refreshed token data. Assumes the auth service has already saved the new
   * token and configured Axios headers.
   *
   * @function handleTokenRefreshed
   * @private
   * @type {Function}
   * @param {object} eventData - Event data containing the new token.
   * @param {string} eventData.newToken - The newly acquired access token.
   */
  const handleTokenRefreshed = useCallback((eventData) => {
    const { newToken } = eventData;
    const timestamp = new Date().toISOString();

    // Debug when token refresh event is handled
    // console.debug(
    //   `[${timestamp}] [UserProvider] Handling 'tokenRefreshed' event...`
    // );

    if (!newToken) {
      console.error(
        `[${timestamp}] [UserProvider] ` +
        `'tokenRefreshed' event received without a new token. Ignoring.`
      );
      return;
    }

    // Debug when new token is received
    // console.debug(
    //   `[${timestamp}] [UserProvider] Received new token via event.`
    //   // Avoid logging the token itself here for security
    // );

    try {
      const decodedUser = decodeToken(newToken);
      if (!decodedUser) {
        // This case might indicate an issue with the new token itself
        console.error(
          `[${timestamp}] [UserProvider] ` +
          `Failed to decode the refreshed token received via event. ` +
          `Logging out.`
        );
        logout(); // Log out to clear potentially invalid state
        return;
      }
      // Update state with the refreshed token and decoded user
      // console.debug(
      //   `[${timestamp}] [UserProvider] Decoding successful from refreshed ` +
      //   `token event. Updating state...`,
      //   decodedUser
      // );
      setAccessToken(newToken);
      setCurrentUserState(decodedUser);
      // Axios headers should have been configured by auth.service before
      // emitting this event.
      // console.info(
      //   `[${timestamp}] [UserProvider] ` +
      //   `Context state updated successfully from tokenRefreshed event.`
      // );
    } catch (error) {
      console.error(
        `[${timestamp}] [UserProvider] ` +
        `Error processing tokenRefreshed event: ${error.message}. ` +
        `Logging out.`,
        error
      );
      logout(); // Log out if processing fails
    }
  }, [logout]);

  /**
   * Initializes the user state upon component mount. Attempts to load tokens
   * from storage, validate the access token, decode it, configure Axios,
   * and potentially fetch the full user profile for non-temporary users.
   * Handles invalid/expired tokens by logging out.
   *
   * @function initializeUser
   * @async
   * @private
   * @type {Function}
   */
  const initializeUser = useCallback(async () => {
    const timestamp = new Date().toISOString();
    setIsLoading(true);

    const token = await loadAccessToken();

    if (!token) {
      // Debug when no token is found
      // console.info(
      //   `[${timestamp}] [UserProvider] No access token found in storage. ` +
      //   `User is not logged in.`
      // );
      setAccessToken(null);
      setCurrentUserState(null);
      configureAxiosHeaders(null); // Ensure headers are cleared
      setIsLoading(false);
      return;
    }

    // Debug when token is found
    // console.debug(
    //   `[${timestamp}] [UserProvider] Access token found. Decoding...`
    // );
    let decodedUser = null;
    try {
      decodedUser = decodeToken(token);
      if (!decodedUser) {
        // decodeToken returns null for various invalid token issues
        throw new Error('Token decoded to null/undefined.');
      }
    } catch (decodeError) {
      console.error(
        `[${timestamp}] [UserProvider] ` +
        `Token decoding failed during initialization: ${decodeError.message}.` +
        ` Clearing state.`
      );
      await logout(); // Use internal logout to clear everything
      setIsLoading(false); // Ensure loading stops after async logout
      return;
    }

    // Debug when token is decoded
    // console.debug(
    //   `[${timestamp}] [UserProvider] Token decoded successfully.`,
    //   decodedUser
    // );
    // Set initial state and configure headers immediately
    setAccessToken(token);
    setCurrentUserState(decodedUser);
    configureAxiosHeaders(token);

    // Check if it's a temporary user
    if (decodedUser.isTemporary) {
      // Debug when temporary user is initialized
      // console.info(
      //   `[${timestamp}] [UserProvider] Initialized temporary user ` +
      //   `'${decodedUser.username}' from token. Skipping full profile fetch.`
      // );
      setIsLoading(false);
      return; // Initialization complete for temp user
    }

    // --- Non-Temporary User Logic ---

    // Check if essential userId is present for non-temporary user
    if (!decodedUser.userId) {
      console.error(
        `[${timestamp}] [UserProvider] ` +
        `Decoded non-temporary token missing 'userId'. Cannot fetch full ` +
        `user profile. Session might be invalid.`
      );
      // Consider logging out here as state might be inconsistent
      await logout();
      setIsLoading(false);
      return;
    }

    // Proceed with fetching full profile for regular users
    // console.debug(
    //   `[${timestamp}] [UserProvider] Initialized regular user ` +
    //   `'${decodedUser.username}' from token. ` +
    //   `Attempting full profile fetch...`
    // );
    try {
      const userData = await getUser(decodedUser.userId);
      // Debug when user data is fetched
      // console.debug(
      //   `[${timestamp}] [UserProvider] Full ` +
      //   `user profile fetched successfully.`
      // );
      // Merge fetched data, preferring fresh server data over potentially
      // stale token data, but keep essential token fields if missing from API
      setCurrentUserState((prevState) => ({
        // Keep essential fields from token payload if not in userData
        ...prevState,
        // Overwrite/add with fetched data
        ...userData,
      }));
    } catch (fetchError) {
      // getUser logs specific errors
      console.error(
        `[${timestamp}] [UserProvider] Failed to fetch full ` +
        `user data after decoding token (${fetchError.message}). ` +
        `Session may be invalid. Logging out.`,
        fetchError
      );
      // If fetching fails, logout to clear potentially inconsistent state
      await logout();
    } finally {
      // This finally block now correctly executes after try/catch concludes
      setIsLoading(false);
      // Debug when initialization is complete
      // console.debug(
      //   `[${new Date().toISOString()}] [UserProvider] User initialization ` +
      //   `process complete.`
      // );
    }
  }, [logout]); // Add logout dependency

  // --- Effects ---

  // Initialize user state on component mount.
  useEffect(() => {
    initializeUser();
  }, [initializeUser]); // Dependency array ensures it runs once on mount

  // Set up listener for session expiration events from auth service.
  useEffect(() => {
    authEvents.on('sessionExpired', handleSessionExpired);
    // Cleanup function to remove listener on unmount
    return () => {
      authEvents.off('sessionExpired', handleSessionExpired);
    };
  }, [handleSessionExpired]);

  // Set up listener for successful token refresh events from auth service.
  useEffect(() => {
    authEvents.on('tokenRefreshed', handleTokenRefreshed);
    // Cleanup function to remove listener on unmount
    return () => {
      authEvents.off('tokenRefreshed', handleTokenRefreshed);
    };
  }, [handleTokenRefreshed]);

  // --- Memoized Context Value ---

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // when the provider re-renders but the context value itself hasn't changed.
  const contextValue = useMemo(
    () => ({
      currentUser: currentUserState,
      login: login,
      logout: logout,
      register: register,
      getUserInfo: getUserInfo,
      isAuthenticated: !!currentUserState, // Derived boolean state
      isLoading,
      accessToken, // Expose token if needed by consumers (use with caution)
    }),
    [
      currentUserState,
      isLoading,
      login,
      logout,
      register,
      getUserInfo,
      accessToken,
    ] // List all dependencies that affect the context value
  );

  // --- Render ---

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

/**
 * PropTypes definition for the UserProvider component.
 */
UserProvider.propTypes = {
  /**
   * The child components that will have access to the user context.
   * Typically the root application component.
   */
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to easily consume the UserContext. Provides access to user
 * state (currentUser, isAuthenticated, isLoading, accessToken) and auth
 * actions (login, logout, register, getUserInfo).
 *
 * @function useUser
 * @returns {{
 *   currentUser: object | null,
 *   login: { type: Function },
 *   logout: { type: Function },
 *   register: { type: Function },
 *   getUserInfo: { type: Function },
 *   isAuthenticated: boolean,
 *   isLoading: boolean,
 *   accessToken: string | null
 * }} The user context value.
 * @throws {Error} If the hook is used outside of a `UserProvider` component.
 * @example
 * import { useUser } from './UserProvider';
 *
 * function UserProfile() {
 *   const { currentUser, logout, isAuthenticated } = useUser();
 *
 *   if (!isAuthenticated) return <p>Please log in.</p>;
 *
 *   return (
 *     <div>
 *       <p>Welcome, {currentUser.username}!</p>
 *       <button onClick={logout}>Log Out</button>
 *     </div>
 *   );
 * }
 */
export const useUser = () => {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    // Log critical error for easier debugging
    console.error(
      `[${new Date().toISOString()}] [UserProvider] CRITICAL: ` +
      `useUser() hook called outside of a UserProvider component tree.`
    );
    throw new Error(CONTEXT_ERROR);
  }
  return context;
};

// Export UserContext primarily for advanced use cases or testing.
// Components should generally use the useUser hook.
export { UserContext };

export default UserProvider;
