/**
 * @fileoverview Vite configuration file for the project. Defines build
 * options, plugins, and server proxy settings.
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration object.
 *
 * @see https://vitejs.dev/config/
 */
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  const isProduction = env.NODE_ENV === 'production';

  return {
    /**
     * Build specific options.
     *
     * @see https://vitejs.dev/config/build-options.html
     */
    build: {
      /**
       * Development flag. Set to true if NODE_ENV is not 'production'.
       * Can be used for conditional logic in application code.
       */
      __DEV__: !isProduction,
      /**
       * Disable minification in development for faster builds and debugging.
       * Enable 'terser' for production builds.
       */
      minify: isProduction ? 'terser' : false,
      terserOptions: {
        // Only applied if minify is 'terser'
        format: {
          comments: false, // Remove comments in production
        },
      },
      /**
       * Enable sourcemaps for debugging in development.
       * Consider disabling or using a different type for production.
       */
      sourcemap: !isProduction,
      /**
       * Increase chunk size warning limit to 1MB.
       */
      chunkSizeWarningLimit: 1000, // Increase to 1MB
      /**
       * Rollup specific options.
       *
       * @see https://rollupjs.org/configuration-options/
       */
      rollupOptions: {
        /**
         * Disable tree shaking in development as it might interfere with Phaser
         * and slow down builds. Enable for production.
         */
        treeshake: isProduction,
        /**
         * Output specific options.
         */
        output: {
          /**
           * Manually define chunks for vendor libraries and Phaser.
           */
          manualChunks: {
            vendor: ['react', 'react-dom'],
            phaser: ['phaser'],
          },
        },
      },
    },
    /**
     * List of Vite plugins to use.
     *
     * @see https://vitejs.dev/plugins/
     */
    plugins: [
      /**
       * React plugin for Vite. Enables React Fast Refresh and JSX transform.
       */
      react(),
    ],
    /**
     * Server specific options.
     *
     * @see https://vitejs.dev/config/server-options.html
     */
    server: {
      /**
       * Proxy settings for the development server.
       */
      proxy: {
        /**
         * Proxy API requests to the backend server.
         */
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        /**
         * Proxy WebSocket connections for Socket.IO.
         */
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        // Uncomment if needed to proxy all other requests
        // '^/.*': {
        //   target: 'http://localhost:3000',
        //   changeOrigin: true,
        //   secure: false,
        // },
      },
    },
  };
});
