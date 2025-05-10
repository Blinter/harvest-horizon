/**
 * @file Legacy ESLint configuration (.eslintrc format) specifically for the
 * server-side code.
 * Defines environments and rules suitable for Node.js.
 * @module .eslintrc.server
 */

export default {
  // Extend basic recommended ESLint rules.
  extends: [
    'eslint:recommended',
    // Remove any React-specific extensions
  ],
  // Configure parser for modern JavaScript module syntax.
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  // Define the execution environment as Node.js and ES6+.
  env: {
    node: true,
    es6: true,
  },
  rules: {
    // Add any server-specific rules here
    'no-console': 'warn',
    'no-unused-vars': [
      'warning',
      { vars: 'all', args: 'after-used', ignoreRestSiblings: true },
    ],
    'indent': ['error', 2], // Enforce 2-space indentation
    'max-len': [
      'error',
      {
        code: 80,
        // Ignore lines starting with optional whitespace, followed by /, then
        // anything, then / and optional regex flags + optional semicolon
        ignorePatterns: ['^\\s*\\/.*\\/[gimyus]*;?$'],
        ignoreUrls: true,
        ignoreStrings: false,
        ignoreTemplateLiterals: false,
        ignoreRegExpLiterals: false,
      },
    ],
  },
};
