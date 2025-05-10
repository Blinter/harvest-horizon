import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
// Direct console calls are used instead of logger;

/**
 * @file auth.service.js
 * @module authService
 * @description Authentication service for handling JWT tokens and user
 *   authentication. Provides functions for authentication, token management,
 *   and API requests. Interacts with the backend and manages secure token
 *   storage.
 */

/**
 * @constant {string} BASE_URL - The base URL for API requests.
 * @default ''
 */
const BASE_URL = '';

/**
 * @constant {string} localStorageKey - Key for the access token in local
 *   storage.
 * @default 'harvestHorizonToken'
 * @private
 */
const localStorageKey = 'harvestHorizonToken';

/**
 * Publicly exported constant holding the key used for storing the access
 * token in local storage. Use this constant when accessing the token
 * storage outside this service.
 *
 * @constant {string} ACCESS_TOKEN_STORAGE_KEY
 */
export const ACCESS_TOKEN_STORAGE_KEY = localStorageKey;

/**
 * @constant {string} REFRESH_TOKEN_KEY - Key for the refresh token in local
 *   storage.
 * @default 'harvestHorizonRefreshToken'
 * @private
 */
const REFRESH_TOKEN_KEY = 'harvestHorizonRefreshToken'; // Key for refresh token

/**
 * Publicly exported constant holding the key used for storing the refresh
 * token in local storage.
 *
 * @constant {string} REFRESH_TOKEN_STORAGE_KEY
 */
export const REFRESH_TOKEN_STORAGE_KEY = REFRESH_TOKEN_KEY;

/**
 * Keys for temporary session data stored in sessionStorage.
 *
 * @constant {string} TEMP_CHAR_ID_KEY - Key for the temporary character ID.
 * @private
 */
const TEMP_CHAR_ID_KEY = 'tempCharacterId';
/**
 * Keys for temporary session data stored in sessionStorage.
 *
 * @constant {string} TEMP_MAP_ID_KEY - Key for the temporary map ID.
 * @private
 */
const TEMP_MAP_ID_KEY = 'tempMapId';

/**
 * Global flag to indicate a permanent logout state, typically set after a
 * failed token refresh attempt. Prevents further automatic refresh attempts.
 *
 * @type {boolean}
 * @private
 */
let _isPermanentlyLoggedOut = false;

/**
 * Loads the authentication access token from local storage.
 *
 * @async
 * @function loadAccessToken
 * @returns {Promise<string|null>} A promise that resolves with the stored JWT
 *   access token or null if it's not found or an error occurs during access.
 */
export const loadAccessToken = async () => {
  try {
    const token = localStorage.getItem(localStorageKey);
    return token;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Error loading Access ` +
      `Token from localStorage:`,
      error
    );
    return null;
  }
};

/**
 * Loads the refresh token from local storage.
 *
 * @async
 * @function loadRefreshToken
 * @returns {Promise<string|null>} A promise that resolves with the stored
 *   refresh token or null if it's not found or an error occurs during access.
 */
export const loadRefreshToken = async () => {
  try {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    return token;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Error loading Refresh Token from localStorage:`,
      error
    );
    return null;
  }
};

/**
 * Saves the access and refresh tokens to local storage. Also resets the
 * permanent logout flag upon successful saving.
 *
 * @function saveTokens
 * @param {string} accessToken - The JWT access token to save.
 * @param {string} refreshToken - The JWT refresh token to save.
 * @returns {void}
 */
export const saveTokens = (accessToken, refreshToken) => {
  try {
    if (!accessToken || !refreshToken) {
      console.error(
        `[${new Date().toISOString()}] [AuthService] Attempted to save ` +
        `undefined/null tokens. Aborting save.`
      );
      return;
    }
    localStorage.setItem(localStorageKey, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    _isPermanentlyLoggedOut = false; // Reset flag on successful token save
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Error saving tokens to localStorage:`,
      error
    );
  }
};

/**
 * Removes both the access and refresh tokens from local storage and sets the
 * permanent logout flag.
 *
 * @function removeTokens
 * @returns {void}
 */
export const removeTokens = () => {
  try {
    localStorage.removeItem(localStorageKey);
    localStorage.removeItem(REFRESH_TOKEN_KEY);

    _isPermanentlyLoggedOut = true; // Set flag on any token removal
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Error removing tokens from localStorage:`,
      error
    );
  }
};

/**
 * @deprecated Use `removeTokens` instead. This function only removes the
 *   access token.
 * @function removeToken_deprecated
 * @returns {void}
 */
export const removeToken_deprecated = () => {
  localStorage.removeItem(localStorageKey);
};

/**
 * Saves temporary session IDs (e.g., guest character or map IDs) to
 * sessionStorage. These IDs are typically used during guest play before full
 * registration or login.
 *
 * @function saveTemporarySessionIds
 * @param {string|null} characterId - The temporary character ID to save, or
 *   null to remove the existing one.
 * @param {string|null} mapId - The temporary map ID to save, or null to remove
 *   the existing one.
 * @returns {void}
 */
export const saveTemporarySessionIds = (characterId, mapId) => {
  try {
    if (characterId) {
      sessionStorage.setItem(TEMP_CHAR_ID_KEY, characterId);
    } else {
      sessionStorage.removeItem(TEMP_CHAR_ID_KEY);
    }
    if (mapId) {
      sessionStorage.setItem(TEMP_MAP_ID_KEY, mapId);
    } else {
      sessionStorage.removeItem(TEMP_MAP_ID_KEY);
    }
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Error saving temporary ` +
      `session IDs to sessionStorage:`,
      error
    );
  }
};

/**
 * Retrieves temporary session IDs (character ID and map ID) from
 * sessionStorage.
 *
 * @function getTemporarySessionIds
 * @returns {{characterId: string|null, mapId: string|null}} An object
 *   containing the `characterId` and `mapId`, which will be null if not found
 *   or if an error occurred during retrieval.
 */
export const getTemporarySessionIds = () => {
  let charId = null;
  let mapId = null;
  try {
    charId = sessionStorage.getItem(TEMP_CHAR_ID_KEY);
    mapId = sessionStorage.getItem(TEMP_MAP_ID_KEY);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Error retrieving ` +
      `temporary session IDs from sessionStorage:`,
      error
    );
  }
  return { characterId: charId, mapId };
};

/**
 * Clears any temporary session IDs (character ID and map ID) stored in
 * sessionStorage.
 *
 * @function clearTemporarySessionIds
 * @returns {void}
 */
export const clearTemporarySessionIds = () => {
  try {
    sessionStorage.removeItem(TEMP_CHAR_ID_KEY);
    sessionStorage.removeItem(TEMP_MAP_ID_KEY);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] ` +
      `Error clearing temporary session IDs from sessionStorage:`,
      error
    );
  }
};

/**
 * Decodes a JWT token to extract its payload without verifying its signature.
 * Useful for inspecting token contents (like expiration time or user ID) on the
 * client-side.
 *
 * **Warning:** This function DOES NOT validate the token's authenticity.
 * Signature verification must happen on the server.
 *
 * @function decodeToken
 * @param {string} token - The JWT token string to decode.
 * @returns {Object|null} The decoded payload object, or null if the token is
 *   invalid, malformed, or decoding fails.
 */
export const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      console.warn(
        `[${new Date().toISOString()}] [AuthService] ` +
        `decodeToken called with invalid token:`,
        token
      ); // Use warn for invalid input
      return null;
    }
    const decoded = jwtDecode(token);
    return decoded;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] ` + `Error decoding token:`,
      error
    );
    return null;
  }
};

/**
 * Registers a new user with the backend service. If temporary session IDs
 * (guest character/map) exist, they are included in the registration payload
 * to potentially link the guest progress to the new account. On successful
 * registration, saves the returned tokens and clears temporary IDs.
 *
 * @async
 * @function registerUser
 * @param {object} userData - User registration details.
 * @param {string} userData.username - The desired username.
 * @param {string} userData.password - The user's chosen password.
 * @param {string} userData.email - The user's email address.
 * @param {object} [userData.additionalData] - Optional additional registration
 *   data.
 * @returns {Promise<string>} A promise that resolves with the new access token
 *   upon successful registration.
 * @throws {Error} Throws an error if registration fails (e.g., username
 *   taken, invalid data, server error), containing a user-friendly message.
 */
export const registerUser = async (userData) => {
  const endpoint = `${BASE_URL}/api/auth/register`;
  try {
    const { tempCharacterId, tempMapId } = getTemporarySessionIds();
    const payload = {
      ...userData,
      ...(tempCharacterId && { tempCharacterId }),
      ...(tempMapId && { tempMapId }),
    };

    const response = await axios.post(endpoint, payload);

    if (!response.data?.accessToken || !response.data?.refreshToken) {
      console.error(
        `[${new Date().toISOString()}] [AuthService] Registration response ` +
        `missing expected tokens.`,
        response.data
      );
      throw new Error('Invalid response received after registration.');
    }

    saveTokens(response.data.accessToken, response.data.refreshToken);
    clearTemporarySessionIds();
    await configureAxiosHeaders();

    return response.data.accessToken;
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Registration Error: ` +
      `${err.response?.data || err.message}`
    );
    throw _handleAuthApiResponseError(
      err,
      'An unknown error occurred during registration'
    );
  }
};

/**
 * Authenticates an existing user with the backend service using their
 * credentials. If temporary session IDs (guest character/map) exist, they are
 * included in the login payload. On successful login, saves the returned
 * tokens and clears temporary IDs.
 *
 * @async
 * @function loginUser
 * @param {object} credentials - User login credentials.
 * @param {string} credentials.username - The user's username or email.
 * @param {string} credentials.password - The user's password.
 * @returns {Promise<string>} A promise that resolves with the access token
 *   upon successful login.
 * @throws {Error} Throws an error if authentication fails (e.g., invalid
 *   credentials, server error), containing a user-friendly message.
 */
export const loginUser = async (credentials) => {
  const endpoint = `${BASE_URL}/api/auth/login`;
  try {
    const { tempCharacterId, tempMapId } = getTemporarySessionIds();
    const payload = {
      ...credentials,
      ...(tempCharacterId && { tempCharacterId }),
      ...(tempMapId && { tempMapId }),
    };

    const response = await axios.post(endpoint, payload);

    if (!response.data?.accessToken || !response.data?.refreshToken) {
      console.error(
        `[${new Date().toISOString()}] [AuthService] Login response missing expected tokens.`,
        response.data
      );
      throw new Error('Invalid response received after login.');
    }

    saveTokens(response.data.accessToken, response.data.refreshToken);
    clearTemporarySessionIds();
    await configureAxiosHeaders();

    return response.data.accessToken;
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Login Error: ` +
      `${err.response?.data || err.message}`
    );
    throw _handleAuthApiResponseError(
      err,
      'Invalid credentials or an unknown error occurred during login'
    );
  }
};

/**
 * Makes an authenticated API request using Axios. Automatically includes the
 * Authorization header with the Bearer token if available. Handles basic error
 * logging for the request.
 *
 * Note: Token refresh logic is handled by the Axios interceptor.
 *
 * @async
 * @function request
 * @param {string} endpoint - The API endpoint path (e.g., '/api/users/me').
 *   Should not include the base URL.
 * @param {object} [data={}] - The request payload for POST, PUT, PATCH
 *   requests. Ignored for GET, DELETE.
 * @param {string} [method='GET'] - The HTTP method (e.g., 'GET', 'POST',
 *   'PUT', 'DELETE'). Case-insensitive.
 * @returns {Promise<object>} A promise that resolves with the response data
 *   from the API.
 * @throws {Error} Throws the original Axios error if the request fails after
 *   potential interceptor handling (like token refresh attempts).
 */
export const request = async (endpoint, data = {}, method = 'GET') => {
  // Assuming BASE_URL might be set elsewhere
  const url = `${BASE_URL}${endpoint}`;
  const token = await loadAccessToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await axios({ url, method, data, headers });
    return response.data;
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] API Request Error (${method} ${endpoint}): Status ${err.response?.status}`,
      err.response?.data || err.message
    );
    throw err;
  }
};

/**
 * Retrieves detailed user information for a specific user ID from the backend.
 *
 * @async
 * @function getUser
 * @param {string|number} userId - The unique identifier of the user whose
 *   data is to be fetched.
 * @returns {Promise<object>} A promise that resolves with the user data object.
 * @throws {Error} Throws an error if the user cannot be found, the request
 *   fails, or the server returns an error response. The error message is
 *   formatted for user display.
 */
export const getUser = async (userId) => {
  const endpoint = `/api/user/${userId}`;
  try {
    // Use the generic request function which includes logging
    const userData = await request(endpoint);
    return userData;
  } catch (err) {
    // Error already logged in request function, just log context here
    console.error(
      `[${new Date().toISOString()}] [AuthService] Get User Error: ` +
      `Failed to fetch data for user ID ${userId}.`
    );
    throw new Error(
      Array.isArray(err.response?.data?.error?.message)
        ? err.response.data.error.message.join(', ')
        : err.response?.data?.error?.message ||
        'An unknown error occurred while fetching user data'
    );
  }
};

/**
 * Configures the default Authorization header for all subsequent Axios
 * requests. If a token is explicitly provided, it uses that. Otherwise, it
 * attempts to load the access token from local storage. If no token is found,
 * it removes the Authorization header from Axios defaults.
 *
 * @async
 * @function configureAxiosHeaders
 * @param {string} [token=null] - An optional access token string to set
 *   directly. If null or omitted, the token is loaded from storage.
 * @returns {Promise<void>} A promise that resolves once the header is
 *   configured.
 */
export const configureAxiosHeaders = async (token = null) => {
  let tokenToUse = token;
  if (!tokenToUse) {
    tokenToUse = await loadAccessToken();
  }

  if (tokenToUse) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenToUse}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

// Call it once on load to set initial headers if token exists
configureAxiosHeaders();

/**
 * Attempts to refresh the access token using the currently stored refresh
 * token. Sends a request to the `/api/auth/refresh` endpoint. If successful,
 * saves the new access token (keeping the existing refresh token), updates
 * Axios headers, resets the permanent logout flag, and emits a
 * 'tokenRefreshed' event. If unsuccessful (e.g., invalid refresh token,
 * server error), it removes both tokens, sets the permanent logout flag, emits
 * a 'sessionExpired' event, and returns null.
 *
 * This function is primarily called by the Axios interceptor when a 401 error
 * occurs. It includes checks to prevent attempts if no refresh token exists or
 * if the service is in a permanent logout state.
 *
 * @async
 * @function refreshAccessToken
 * @returns {Promise<string|null>} A promise that resolves with the new access
 *   token if successful, or null if the refresh fails or is not possible.
 */
export const refreshAccessToken = async () => {
  const endpoint = `${BASE_URL}/api/auth/refresh`;
  const refreshToken = await loadRefreshToken();
  const timestamp = new Date().toISOString(); // Add timestamp for logging

  if (!refreshToken) {
    console.warn(
      `[${timestamp}] [AuthService] ` +
      `Refresh attempt aborted: No refresh token found in storage.`
    );
    _isPermanentlyLoggedOut = true; // Ensure flag is set
    return null;
  }

  if (_isPermanentlyLoggedOut) {
    console.warn(
      `[${timestamp}] [AuthService] ` +
      `Refresh attempt aborted: In permanent logout state.`
    );
    return null;
  }

  console.debug(`[${timestamp}] [AuthService] Attempting to refresh token...`);

  try {
    // Use a separate Axios instance or configure this specific request not to
    // use the interceptor
    const response = await axios.post(
      endpoint,
      { refreshToken },
      { _skipInterceptor: true }
    );

    
    // Keep for debugging
    // console.debug(
    //   `[${timestamp}] [AuthService] Refresh API call successful. Response:`,
    //   response.data
    // );

    // Only expect accessToken from the refresh endpoint
    const { accessToken: newAccessToken } = response.data;
    if (!newAccessToken) {
      console.error(
        `[${timestamp}] [AuthService] Refresh error: No new ` +
        `access token received from refresh endpoint.`
      );
      throw new Error('No new access token received from refresh endpoint.');
    }

    // Keep for debugging
    // console.debug(
    //   `[${timestamp}] [AuthService] Received new access token:`,
    //   newAccessToken
    // );

    // Load the existing refresh token to save it alongside the new access token
    const existingRefreshToken = await loadRefreshToken();
    if (!existingRefreshToken) {
      // This case should ideally not happen if we got here, but handle defensively
      console.error(
        `[${timestamp}] [AuthService] Refresh error: ` +
        `Could not load existing refresh token after successful refresh.`
      );
      removeTokens(); // Clear potentially inconsistent state
      _isPermanentlyLoggedOut = true;
      authEvents.emit('sessionExpired');
      return null;
    }

    // Keep for debugging
    // console.debug(
    //   `[${timestamp}] [AuthService] Saving new ` +
    //   `access token and existing refresh token...`
    // );

    // Save the new access token and the *existing* refresh token
    saveTokens(newAccessToken, existingRefreshToken); // Use utility to save both
    await configureAxiosHeaders(); // Update Axios defaults

    // --- EMIT EVENT WITH NEW TOKEN --- 
    // Keep for debugging
    // console.debug(
    //   `[${timestamp}] [AuthService] Emitting tokenRefreshed event.`
    // );
    authEvents.emit('tokenRefreshed', { newToken: newAccessToken });
    // ---------------------------------

    return newAccessToken;
  } catch (err) {
    console.error(
      `[${timestamp}] [AuthService] Refresh token failed: ` +
      `Status ${err.response?.status}, ` +
      `Response: ${JSON.stringify(err.response?.data)}, ` +
      `Message: ${err.message}`
    );
    console.warn(
      `[${timestamp}] [AuthService] Clearing tokens due ` +
      `to refresh failure.`
    );
    removeTokens();
    _isPermanentlyLoggedOut = true; // Ensure flag is set
    authEvents.emit('sessionExpired'); // Emit event for global logout
    return null;
  }
};

// Store the original axios instance if needed elsewhere
// const originalAxios = axios.create();

// Global flag to prevent concurrent refresh attempts
let isRefreshing = false;
// Queue for requests that failed with 401 and are waiting for refresh
let failedQueue = [];

/**
 * Processes the queue of requests that failed due to an expired token (401).
 * If the token refresh was successful, it resolves each promise in the queue
 * with the new token, allowing the original requests to be retried. If the
 * refresh failed, it rejects each promise with the refresh error. Clears the
 * queue after processing.
 *
 * @function processQueue
 * @param {Error|null} error - The error object if the token refresh failed,
 *   otherwise null.
 * @param {string|null} [token=null] - The new access token if the refresh was
 *   successful, otherwise null.
 * @returns {void}
 * @private
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error); // Reject with the error passed in
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Handles adding a failed request (due to 401) to a queue while a token
 * refresh is already in progress. Returns a promise that will resolve with the
 * new token (allowing retry) or reject if the refresh ultimately fails.
 *
 * @function _handleQueuedRequest
 * @param {object} originalRequest - The original Axios request config that
 *   failed.
 * @param {string} requestUrl - The URL of the original request (for logging).
 * @returns {Promise<object>} A promise that resolves with the result of the
 *   retried Axios request or rejects with an error if the refresh fails or the
 *   retry itself fails.
 * @private
 */
const _handleQueuedRequest = (originalRequest, requestUrl) => {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  })
    .then((token) => {
      originalRequest.headers['Authorization'] = `Bearer ${token}`;
      return axios(originalRequest); // Retry the request
    })
    .catch((err) => {
      console.error(
        `[${new Date().toISOString()}] [AuthService] Interceptor Helper: ` +
        `Queued request ${requestUrl} failed after refresh attempt.`,
        err
      );
      // Ensure we reject with an Error instance
      const rejectionError =
        err instanceof Error
          ? err
          : new Error(`Queued request failed: ${String(err)}`);
      return Promise.reject(rejectionError);
    });
};

/**
 * Orchestrates the token refresh attempt and the subsequent retry of the
 * original request that failed with a 401. Sets the `isRefreshing` flag to
 * prevent concurrent refreshes. Calls `refreshAccessToken`. If successful,
 * updates the original request's header, processes the waiting queue, and
 * retries the original request. If refresh fails, logs the error, processes
 * the queue with the failure, emits 'sessionExpired', sets the permanent
 * logout flag, and rejects the promise. Resets the `isRefreshing` flag in a
 * finally block.
 *
 * @async
 * @function _attemptRefreshAndRetry
 * @param {object} originalRequest - The original Axios request config that
 *   failed with 401.
 * @param {string} requestUrl - The URL of the original request (for logging).
 * @returns {Promise<object>} A promise that resolves with the result of the
 *   retried Axios request if successful, or rejects with an error if the
 *   refresh or retry fails.
 * @private
 */
const _attemptRefreshAndRetry = async (originalRequest, requestUrl) => {
  originalRequest._retry = true;
  isRefreshing = true;

  try {
    const newAccessToken = await refreshAccessToken();

    if (newAccessToken) {
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken); // Process queue on success
      return axios(originalRequest); // Return the promise for the retried
      // request
    } else {
      // Refresh failed
      console.error(
        `[${new Date().toISOString()}] [AuthService] Interceptor Helper: ` +
        `Token refresh failed. Rejecting original request ${requestUrl}.`
      );
      _isPermanentlyLoggedOut = true;
      const refreshFailError = new Error('Session expired or refresh failed.');
      processQueue(refreshFailError, null); // Reject queue
      authEvents.emit('sessionExpired');
      // Reject with a user-friendly error, already logged specific cause
      const rejectionError = new Error('Session expired. Please log in again.');
      return Promise.reject(rejectionError);
    }
  } catch (refreshError) {
    console.error(
      `[${new Date().toISOString()}] [AuthService] Interceptor Helper: ` +
      `Error during token refresh attempt for ${requestUrl}.`,
      refreshError
    );
    // Ensure we pass an Error to the queue and reject with one
    const processedRefreshError =
      refreshError instanceof Error
        ? refreshError
        : new Error(`Token refresh failed: ${String(refreshError)}`);
    processQueue(processedRefreshError, null); // Reject queue with the error
    return Promise.reject(processedRefreshError);
  } finally {
    isRefreshing = false;
  }
};

/**
 * Core logic for the Axios response interceptor's error handling. Determines if
 * a token refresh should be attempted based on the error status code (401),
 * whether it's a retry, not an auth URL, not explicitly skipped, and not
 * permanently logged out. It also checks if a refresh token exists. If refresh
 * is viable, it handles queuing if another refresh is in progress, otherwise
 * initiates the refresh and retry process via `_attemptRefreshAndRetry`. If
 * refresh is not viable or fails, it rejects the promise, potentially emitting
 * 'sessionExpired'.
 *
 * @async
 * @function _handleInterceptorError
 * @param {Error} error - The error object from Axios.
 * @param {object} originalRequest - The original Axios request configuration.
 * @param {number|undefined} statusCode - The HTTP status code from the error
 *   response (e.g., 401).
 * @param {string} requestUrl - The URL of the failed request.
 * @returns {Promise<any>} A promise that either resolves with the result of a
 *   successfully retried request or rejects with the original/new error.
 * @private
 */
const _handleInterceptorError = async (
  error,
  originalRequest,
  statusCode,
  requestUrl
) => {
  const timestamp = new Date().toISOString();

  // Keep for debugging
  // console.debug(
  //   `[${timestamp}] [AuthService] Interceptor Error: Handling error for ` +
  //   `${requestUrl}. Status: ${statusCode}.`,
  //   error.config?._isRetry // Check if it's already a retry
  // );

  const isAuthUrl = _isAuthenticationUrl(requestUrl);

  // 1. Check if refresh is permissible for this error/request type
  if (!_canAttemptRefresh(statusCode, originalRequest, isAuthUrl)) {
    console.warn(
      `[${timestamp}] [AuthService] Interceptor: Refresh not ` +
      `applicable/allowed for ${requestUrl} (status: ${statusCode}, ` +
      `isAuth: ${isAuthUrl}, isRetry: ${originalRequest._isRetry}). ` +
      `Rejecting original request.`
    );
    // Emit session expired only if it was a 401 on a non-auth URL
    if (statusCode === 401 && !isAuthUrl) {
      authEvents.emit('sessionExpired', {
        reason: 'Refresh not applicable or disallowed',
      });
    }
    return Promise.reject(error);
  }

  // 2. Check if a refresh token actually exists before attempting refresh
  let refreshToken = null;
  try {
    refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (storageError) {
    console.error(
      `[${timestamp}] [AuthService] Interceptor: Failed to read refresh ` +
      `token from storage. Cannot attempt refresh for ${requestUrl}.`, storageError
    );
    authEvents.emit('sessionExpired', { reason: 'Storage read error' });
    return Promise.reject(error); // Reject if we can't even check for the token
  }

  if (!refreshToken) {
    console.warn(
      `[${timestamp}] [AuthService] Interceptor: No refresh token found ` +
      `in storage. Refresh cannot be attempted for ${requestUrl}. ` +
      `Treating as session expired.`
    );
    authEvents.emit('sessionExpired', { reason: 'No refresh token available' });
    // Return a specific error indicating why the retry failed
    // Use a new error to avoid potential infinite loops if the original
    // error is re-thrown and somehow re-intercepted.
    return Promise.reject(
      new Error('Authentication failed: No refresh token available.')
    );
  }

  // 3. Refresh is applicable, allowed, and a token exists - attempt it
  // Check if another request is already refreshing the token
  if (isRefreshing) {
    // Keep for debugging
    // console.debug(
    //   `[${timestamp}] [AuthService] Interceptor: Refresh already in ` +
    //   `progress. Queuing request for ${requestUrl}.`
    // );
    // Queue the request and return the promise from the queue handler
    return _handleQueuedRequest(originalRequest, requestUrl);
  }

  // No refresh in progress, attempt it
  // Keep for debugging
  // console.debug(
  //   `[${timestamp}] [AuthService] Interceptor: Attempting token ` +
  //   `refresh for ${requestUrl}...`
  // );
  try {
    const response = await _attemptRefreshAndRetry(originalRequest, requestUrl);
    return response; // Return the successful response from the retried request
  } catch (refreshError) {
    console.error(
      `[${timestamp}] [AuthService] Interceptor: Token refresh and ` +
      `retry process failed for ${requestUrl}.`, refreshError
    );
    // The _attemptRefreshAndRetry function should have emitted
    // 'sessionExpired' if the refresh itself failed.
    // Ensure we reject with an actual Error object.
    const finalError = refreshError instanceof Error
      ? refreshError
      : new Error(`Token refresh/retry failed: ${String(refreshError)}`);
    return Promise.reject(finalError);
  }
};

/**
 * Logs the user out. This involves:
 * 1. Attempting to inform the backend by sending the refresh token to the
 *    `/api/auth/logout` endpoint for revocation. Errors during this step are
 *    logged but do not prevent local logout.
 * 2. Removing the access and refresh tokens from local storage using
 *    `removeTokens()`, which also sets the permanent logout flag.
 *
 * @async
 * @function logoutUser
 * @returns {Promise<void>} A promise that resolves when the local token
 *   removal is complete. It does not guarantee the backend call succeeded.
 */
export const logoutUser = async () => {
  const timestamp = new Date().toISOString();
  const refreshToken = await loadRefreshToken(); // Get the token before removing

  if (refreshToken) {
    const endpoint = `${BASE_URL}/api/auth/logout`;
    try {
      // Send the refresh token to the backend for revocation
      await axios.post(
        endpoint,
        { refreshToken }
        // Use configured Axios instance which should have auth header if needed
        // but logout might not require the *access* token, just the refresh token
      );
    } catch (error) {
      // Log the error but proceed with local token removal regardless
      const status = error.response?.status || 'N/A';
      const message = error.response?.data?.message || error.message;
      console.error(
        `[${timestamp}] [AuthService] Backend logout request failed ` +
        `(Status: ${status}): ${message}. Proceeding with local token removal.`,
        error
      );
      // Handle specific errors if needed, e.g., 401 might mean the refresh
      // token was already invalid/revoked
    }
  } else {
    console.warn(
      `[${timestamp}] [AuthService] No refresh token found in local storage ` +
      `during logout. Skipping backend revocation call.`
    );
  }

  // Always remove tokens locally after attempting backend logout
  removeTokens();
};

// Simple custom event emitter (can replace with standard Node 'events' if in
// Node env)
// Keeping custom for browser compatibility if needed, but enhancing logs
class CustomEventEmitter {
  constructor() {
    this.events = {};
  }

  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }

  off(eventName, listenerToRemove) {
    if (!this.events[eventName]) {
      return;
    }
    this.events[eventName] = this.events[eventName].filter(
      (listener) => listener !== listenerToRemove
    );
  }

  emit(eventName, data) {
    if (!this.events[eventName]) {
      console.debug(
        `[${new Date().toISOString()}] [CustomEventEmitter] No listeners ` +
        `for event: ${eventName}`
      );
      return;
    }
    console.debug(
      `[${new Date().toISOString()}] [CustomEventEmitter] Emitting event: ` +
      `${eventName} with data:`,
      data || '(no data)'
    );
    this.events[eventName].forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] [CustomEventEmitter] Error in ` +
          `listener for event ${eventName}:`,
          error
        );
      }
    });
  }
}

/**
 * An instance of the CustomEventEmitter used for broadcasting authentication
 * events like 'tokenRefreshed' and 'sessionExpired'. Other parts of the
 * application can listen to these events using `authEvents.on(...)`.
 *
 * @constant {CustomEventEmitter} authEvents
 */
export const authEvents = new CustomEventEmitter();

/**
 * Centralized internal error handler specifically for logging authentication-
 * related errors encountered within the auth service itself (not necessarily
 * API response errors).
 *
 * @function _handleAuthError
 * @param {Error} err - The error object.
 * @param {string} [context='Auth'] - A string providing context for where the
 *   error occurred (e.g., 'Token Load', 'Token Save').
 * @returns {void}
 * @private
 */
const _handleAuthError = (err, context) => {
  // Log the error with context
  console.error(
    `[${new Date().toISOString()}] [AuthService Error - ` +
    `${context || 'Auth'}]: ${err.message}`,
    err // Log the full error object for stack trace etc.
  );
  // Optionally, emit an event or call a specific handler if provided
  // (Example: authEmitter.emit('authError', { error: err, context });)
};

/**
 * Formats error messages received from Axios API responses, specifically
 * targeting authentication (`/api/auth/...`) endpoints, into a user-friendly
 * array of strings. Handles cases where the response contains an array of
 * messages or a single message string. Provides a default message if no
 * specific error message is found in the response. Handles network errors
 * separately.
 *
 * @function _handleAuthApiResponseError
 * @param {Error} err - The error object, expected to be from an Axios request.
 * @param {string} defaultMessage - A fallback message to use if a specific
 *   error message cannot be extracted from the response.
 * @returns {Array<string>} An array containing one or more error message
 *   strings suitable for display to the user.
 * @private
 */
const _handleAuthApiResponseError = (err, defaultMessage) => {
  if (!err.response) {
    // Network or server connection error
    return ['Could not connect to the server. Please try again later.'];
  }
  // Check if the error response data has a message property
  const message = err.response?.data?.error?.message;
  if (Array.isArray(message)) {
    // If the server sent an array of messages, return it directly
    return message;
  }
  // Otherwise, return the single message or the default
  return [message || defaultMessage];
};

/**
 * Checks if a given URL corresponds to one of the primary authentication
 * endpoints (`/login`, `/register`, `/refresh`). Used by the interceptor to
 * avoid refresh loops on auth endpoints themselves.
 *
 * @function _isAuthenticationUrl
 * @param {string|undefined} url - The URL string to check.
 * @returns {boolean} Returns `true` if the URL matches one of the known
 *   authentication endpoints, `false` otherwise.
 * @private
 */
const _isAuthenticationUrl = (url) => {
  if (!url) return false;
  return (
    url === `${BASE_URL}/api/auth/login` ||
    url === `${BASE_URL}/api/auth/register` ||
    url === `${BASE_URL}/api/auth/refresh`
  );
};

/**
 * Determines whether a token refresh attempt is permissible based on the
 * context of an Axios request failure. A refresh should typically be attempted
 * only if:
 * - The status code is 401 (Unauthorized).
 * - The request is not already a retry (to prevent infinite loops).
 * - The request was not to an authentication endpoint itself.
 * - The request was not explicitly marked to skip the interceptor.
 * - The service is not in a 'permanently logged out' state.
 *
 * @function _canAttemptRefresh
 * @param {number|undefined} statusCode - The HTTP status code of the failed
 *   response.
 * @param {object} originalRequest - The original Axios request configuration
 *   object.
 * @param {boolean} isAuthUrl - Indicates if the request URL was an
 *   authentication endpoint.
 * @returns {boolean} Returns `true` if a token refresh attempt is appropriate
 *   under these conditions, `false` otherwise.
 * @private
 */
const _canAttemptRefresh = (statusCode, originalRequest, isAuthUrl) => {
  // Ensure originalRequest exists before accessing properties
  if (!originalRequest) return false;

  return (
    statusCode === 401 &&
    !originalRequest._retry &&
    !isAuthUrl &&
    !originalRequest._skipInterceptor &&
    !_isPermanentlyLoggedOut
  );
};

// Axios response interceptor
axios.interceptors.response.use(
  (response) => {
    // Successful response (2xx)
    return response;
  },
  async (error) => {
    
    // Keep for debugging
    // console.debug(
    //   `[${new Date().toISOString()}] [AuthService] ` + 
    //   `Axios Interceptor caught an error:`,
    //   { 
    //     status: error.response?.status, 
    //     url: error.config?.url, 
    //     isRetry: error.config?._isRetry 
    //   }
    // );

    const originalRequest = error.config;
    const statusCode = error.response?.status;
    const requestUrl = originalRequest?.url;

    // Delegate the core handling logic
    return _handleInterceptorError(
      error,
      originalRequest,
      statusCode,
      requestUrl
    );
    // We no longer need the promise variable here, just return the result
    // of the helper function directly.
  }
);
