/**
 * @file ESLint configuration (Flat Config format) for the Harvest Horizon
 * project.
 * Defines linting rules for both frontend (React/JSX) and backend (Node.js)
 * code.
 * @module eslint.config
 * @requires @eslint/js
 * @requires globals
 * @requires eslint-plugin-react
 * @requires eslint-plugin-react-hooks
 * @requires eslint-plugin-react-refresh
 * @requires eslint-config-prettier
 */

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

// Base rules that will be shared across configurations
const baseRules = {
  // Disable some problematic rules
  // Allow console for now
  'no-console': 'off',
  'no-unused-vars': [
    'warn',
    {
      // Downgrade unused vars to warning
      vars: 'all',
      args: 'after-used',
      ignoreRestSiblings: true,
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  // Downgrade undefined variables to warning
  'no-undef': 'warn',

  'brace-style': ['error', '1tbs'],
  'comma-spacing': ['error', { before: false, after: true }],
  // Match Prettier's tabWidth, configure for SwitchCase
  indent: ['error', 2, { SwitchCase: 1 }],
  'max-len': [
    'error',
    {
      code: 80,
      // Enforce on comments/docs
      ignoreComments: false,
      ignoreUrls: false,
      ignoreStrings: false,
      ignoreTemplateLiterals: false,
      ignoreRegExpLiterals: false,
    },
  ],
  'object-curly-newline': ['error', { multiline: true, consistent: true }],
  'array-bracket-newline': ['error', 'consistent'],
  'array-element-newline': ['error', 'consistent'],
  'function-call-argument-newline': ['error', 'consistent'],
  // Consistent with multiline args
  'function-paren-newline': ['error', 'consistent'],
  'prefer-template': 'error',
  // Cyclomatic Complexity
  complexity: ['warn', 15],
};

// React-specific base rules (will be merged into frontend config)
const reactBaseRules = {
  // Include common base rules
  ...baseRules,
  'react/jsx-no-target-blank': 'off',
  // Disable component export checks
  'react-refresh/only-export-components': 'off',
  // Disable exhaustive deps warnings
  'react-hooks/exhaustive-deps': 'off',
  'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
  'react/jsx-wrap-multilines': [
    'error',
    {
      declaration: 'parens-new-line',
      assignment: 'parens-new-line',
      return: 'parens-new-line',
      arrow: 'parens-new-line',
      condition: 'parens-new-line',
      logical: 'parens-new-line',
      prop: 'parens-new-line',
    },
  ],
};

export default [
  // Global ignores
  { ignores: ['dist'] },

  // Frontend configuration (JS/JSX files outside /server)
  {
    files: ['**/*.{js,jsx}', '!server/**'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Make React available globally
        React: 'readonly',
        // Make Phaser available globally
        Phaser: 'readonly',
        // Make process available globally
        process: 'readonly',
        // Make PropTypes available globally
        PropTypes: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19.1' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // Apply combined React + base style rules
      ...reactBaseRules,
      // Keep specific override if needed
      'constructor-super': 'off',
    },
  },

  // Server configuration (using legacy config converted to flat config)
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        Inventory: 'readonly',
        Wallet: 'readonly',
        StatusLog: 'readonly',
        ExpressError: 'readonly',
        username: 'readonly',
        mapTileProgress: 'readonly',
        data: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Apply common base style rules (no React rules needed here)
      ...baseRules,
    },
  },
  // Add Prettier config last to override conflicting rules
  prettierConfig,
];
