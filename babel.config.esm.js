/**
 * @file Babel configuration specifically for ES Modules.
 * @module babel.config.esm
 *
 * This file configures Babel to preserve ES Modules syntax (`import`/`export`)
 * instead of transforming to CommonJS (`require`/`module.exports`).
 * 
 * It's used when targeting environments that natively support ES Modules,
 * such as modern browsers and Node.js v14+.
 *
 * @requires @babel/preset-env
 * @requires @babel/preset-react
 * @requires @babel/plugin-transform-runtime
 * @requires @babel/plugin-transform-json-modules
 * @requires @babel/plugin-syntax-import-meta
 * @requires @babel/plugin-syntax-jsx
 */
export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        modules: false, // Preserve ES modules syntax
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
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
            modules: 'auto', // Use CommonJS for test environment
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
