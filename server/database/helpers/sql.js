/**
 * @file SQL generation helper for partial updates.
 * @module server/database/helpers/sql
 * @description Provides a function to generate SQL SET clauses and values
 *   for partial updates based on provided data. This is crucial for
 *   building dynamic UPDATE queries safely and efficiently.
 */

'use strict';

import { BadRequestError } from '../../expressError.js';

/**
 * Generates SQL components for a partial update operation (SET clause).
 *
 * Takes an object containing data to update and an optional mapping
 * from JavaScript object keys to SQL column names. It constructs the
 * `SET` clause portion of an SQL UPDATE statement and an array of
 * corresponding values, suitable for parameterized queries. Handles
 * nested objects if specified in the `jsToSql` mapping (currently one
 * level deep).
 *
 * @function sqlForPartialUpdate
 * @param {Object} dataToUpdate - An object where keys are the fields
 *   to update and values are the new values. For example,
 *   `{ firstName: 'Aliya', age: 32 }`.
 * @param {Object} [jsToSql={}] - Optional mapping from JavaScript
 *   object keys (camelCase) to SQL column names (snake_case).
 *   Use dot notation for basic nested objects:
 *   `{ 'address.street': 'street_address', 'firstName': 'first_name' }`.
 *   If a key isn't mapped, the original key is used as the column name.
 *   If a value is an object and a corresponding nested mapping exists
 *   (e.g., `address.street` for `dataToUpdate.address`), its properties
 *   will be processed.
 * @returns {{setCols: string, values: Array<any>}} An object containing:
 *   - `setCols`: A string representing the SQL SET clause, like
 *     `"first_name"=$1, "age"=$2`.
 *   - `values`: An array of values corresponding to the placeholders in
 *     `setCols`, like `['Aliya', 32]`.
 * @throws {BadRequestError} If `dataToUpdate` is empty, ensuring that
 *   update attempts without data are explicitly handled.
 */
function sqlForPartialUpdate(dataToUpdate, jsToSql = {}) {
  const keys = Object.keys(dataToUpdate);
  if (!keys.length) {
    throw new BadRequestError('No data provided for update');
  }

  const cols = [];
  const values = [];

  // Iterate over keys in the data object
  keys.forEach((key) => {
    const value = dataToUpdate[key];
    // Only process keys with defined (non-undefined) values
    if (value !== undefined) {
      // Determine the SQL column name using mapping or the key itself
      const sqlKey = jsToSql[key] || key;

      // Basic handling for nested objects (only one level deep)
      // Assumes if a nested mapping exists (e.g., "address.street"),
      // we should iterate through the nested object's properties.
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) && // Exclude arrays
        Object.keys(jsToSql).some((k) => k.startsWith(`${key}.`))
      ) {
        // Process nested object properties
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          if (nestedValue !== undefined) {
            // Construct nested SQL key using mapping or default
            // dot notation
            const nestedSqlKey =
              jsToSql[`${key}.${nestedKey}`] || `${key}_${nestedKey}`; // Adjusted default key
            // Add to SET clause parts and values array
            cols.push(`"${nestedSqlKey}"=$${values.length + 1}`);
            values.push(nestedValue);
          }
        });
      } else {
        // Process non-nested or non-mapped object values
        cols.push(`"${sqlKey}"=$${values.length + 1}`);
        values.push(value);
      }
    }
  });

  // Return the generated SET clause string and the values array
  return {
    setCols: cols.join(', '),
    values,
  };
}

export default sqlForPartialUpdate;
