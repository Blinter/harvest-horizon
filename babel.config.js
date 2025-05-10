/**
 * @file Babel configuration for the project.
 * Defines presets and plugins for JavaScript transpilation, potentially used
 * alongside Vite or for specific environments like testing.
 *
 * @module babel.config
 * @requires @babel/preset-env
 * @requires @babel/preset-react
 * @requires @babel/plugin-transform-runtime
 * @requires @babel/plugin-transform-json-modules
 * @requires @babel/plugin-syntax-import-meta
 */
export default {
  presets: [
    // Transpile modern JavaScript for the current Node.js version.
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        modules: 'auto',
      },
    ],
    // Enable JSX transformation with the automatic runtime
    // (no need for `import React`).
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    // Avoids helper code duplication and uses runtime polyfills.
    '@babel/plugin-transform-runtime',
    // Allows importing JSON files as ES modules.
    '@babel/plugin-transform-json-modules',
    // Allows Babel to parse `import.meta` syntax (used by Vite).
    '@babel/plugin-syntax-import-meta',
  ],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
            modules: 'auto',
          },
        ],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
      plugins: [
        '@babel/plugin-transform-runtime',
        '@babel/plugin-transform-json-modules',
        '@babel/plugin-syntax-import-meta',
        '@babel/plugin-syntax-jsx',
      ],
    },
  },
};
