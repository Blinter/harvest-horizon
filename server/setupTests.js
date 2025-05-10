/**
 * @file
 * @fileoverview
 * @module server/setupTests
 */
// Configures the test environment for server-side unit and integration tests.
// It makes the `fetch` API globally available using `node-fetch` and
// explicitly sets the `NODE_ENV` environment variable to `test`.
// This ensures that application components behave correctly under test
// conditions, such as using test-specific database configurations or disabling
// production optimizations.


import fetch from 'node-fetch';

global.fetch = fetch;

process.env.NODE_ENV = 'test';
