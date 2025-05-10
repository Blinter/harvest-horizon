import fs from 'fs';

/**
 * Schema helper module for loading and validating JSON schemas. Provides
 * functions to load schemas from files and validate data against them.
 * Caches loaded schemas for efficiency.
 *
 * @module schemaHelpers
 * @property {function} loadSchema - Loads a JSON schema from a specified file
 *   path, utilizing a cache to avoid redundant reads.
 * @property {function} validateData - Validates provided data against a given
 *   JSON schema object.
 * @property {Object} characterItemsBuySchema - Schema for validating requests
 *   to buy character items.
 * @property {Object} characterItemsSellSchema - Schema for validating requests
 *   to sell character items.
 * @property {Object} characterMapChangeNameSchema - Schema for validating
 *   requests to change a character's map name.
 * @property {Object} characterMapFavoriteSchema - Schema for validating
 *   requests to favorite a character's map.
 * @property {Object} userCharacterChangeNameSchema - Schema for validating
 *   requests to change a user's character name.
 * @property {Object} userDeleteCharacterSchema - Schema for validating
 *   requests to delete a user's character.
 * @property {Object} userFavoriteCharacterSchema - Schema for validating
 *   requests to favorite a user's character.
 * @property {Object} userLoginSchema - Schema for validating user login
 *   requests.
 * @property {Object} userPasswordForgotSchema - Schema for validating password
 *   recovery initiation requests.
 * @property {Object} userPasswordUpdateSchema - Schema for validating password
 *   update requests.
 * @property {Object} userRegisterSchema - Schema for validating user
 *   registration requests.
 * @property {Object} userUpdateSchema - Schema for validating user profile
 *   update requests.
 * @property {Object} userVerifySchema - Schema for validating user email
 *   verification requests.
 * @property {Object} statusLogGetSchema - Schema for validating requests to
 *   retrieve status logs.
 */

/**
 * Cache for loaded schemas to avoid redundant file system access and parsing.
 * Keys are file paths, values are the parsed schema objects.
 *
 * @type {Object.<string, Object>}
 * @private
 */
const schemaCache = {};

/**
 * Loads a JSON schema from a specified file path. Caches the schema after
 * the first successful load. Logs errors if the file doesn't exist, is
 * empty, or contains invalid JSON, returning an empty object in such cases
 * to prevent application failure.
 *
 * @param {string} path - The relative or absolute file path from which to
 *   load the JSON schema.
 * @returns {Object} The parsed JSON schema object, or an empty object if
 *   loading or parsing fails.
 * @throws {Error} If there's an error parsing valid JSON data (re-throws
 *   the JSON.parse error).
 */
const loadSchema = (path) => {
  // Check if schema is already in cache
  if (schemaCache[path]) {
    return schemaCache[path];
  }

  try {
    if (!fs.existsSync(path)) {
      console.error(`Schema file not found: ${path}`);
      return {};
    }

    const rawData = fs.readFileSync(path, 'utf8');
    if (!rawData || rawData.trim() === '') {
      console.warn(`File ${path} is empty`);
      return {};
    }

    try {
      const schema = JSON.parse(rawData.trim());
      // Cache the schema for future use
      schemaCache[path] = schema;
      return schema;
    } catch (parseError) {
      console.error(`Error parsing schema JSON in ${path}:`, parseError);
      throw new Error(
        `Invalid JSON in schema file ${path}: ${parseError.message}`
      );
    }
  } catch (error) {
    console.error(`Error loading schema from ${path}:`, error);
    // Return empty object instead of throwing to prevent app failure
    return {};
  }
};

const normalPath = 'server/schemas/';

export const characterItemsBuySchema = loadSchema(
  `${normalPath}characterItemsBuy.json`
);

export const characterItemsSellSchema = loadSchema(
  `${normalPath}characterItemsSell.json`
);

export const characterMapChangeNameSchema = loadSchema(
  `${normalPath}characterMapChangeName.json`
);

export const characterMapFavoriteSchema = loadSchema(
  `${normalPath}characterMapFavorite.json`
);

export const userCharacterChangeNameSchema = loadSchema(
  `${normalPath}userCharacterChangeName.json`
);

export const userDeleteCharacterSchema = loadSchema(
  `${normalPath}userDeleteCharacter.json`
);

export const userFavoriteCharacterSchema = loadSchema(
  `${normalPath}userFavoriteCharacter.json`
);

export const userLoginSchema = loadSchema(`${normalPath}userLogin.json`);

export const userPasswordForgotSchema = loadSchema(
  `${normalPath}userPasswordForgot.json`
);

export const userPasswordUpdateSchema = loadSchema(
  `${normalPath}userPasswordUpdate.json`
);

export const userRegisterSchema = loadSchema(`${normalPath}userRegister.json`);

export const userUpdateSchema = loadSchema(`${normalPath}userUpdate.json`);

export const userVerifySchema = loadSchema(`${normalPath}userVerify.json`);

export const statusLogGetSchema = loadSchema(`${normalPath}statusLogGet.json`);

/**
 * Validates provided data against a given JSON schema using Ajv.
 *
 * @function validateData
 * @param {any} data - The data object (e.g., request body) to validate.
 * @param {Object} schema - The JSON schema object to validate against. It's
 *   expected that this schema has been loaded previously, potentially using
 *   the `loadSchema` function.
 * @returns {Object} An object indicating the validation result.
 *   Structure:
 *   {
 *     valid: boolean,
 *     errors?: Array<{field: Array<string|number>, message: string}>
 *   }
 */
