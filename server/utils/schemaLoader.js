/**
 * @file schemaLoader.js
 * @description Loads and exports JSON schemas from the `../schemas`
 *   directory relative to this file's location. Each JSON file in the
 *   schemas directory is loaded, parsed, and made available for import.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemasDir = path.join(__dirname, '../schemas');

const loadedSchemas = {};

console.log(`[SchemaLoader] Loading schemas from: ${schemasDir}`);

try {
  const files = fs.readdirSync(schemasDir);

  files.forEach((file) => {
    if (path.extname(file) === '.json') {
      const schemaPath = path.join(schemasDir, file);
      const schemaName = path.basename(file, '.json'); // e.g., characterCreate
      try {
        const fileContent = fs.readFileSync(schemaPath, 'utf8');
        loadedSchemas[schemaName] = JSON.parse(fileContent);
        console.log(`[SchemaLoader] Successfully loaded schema: ${schemaName}`);
      } catch (err) {
        console.error(
          `[SchemaLoader] Error loading or parsing schema ${file}:`,
          err
        );
        // Decide how to handle errors: throw, log, exit?
        // For now, we just log the error and potentially skip the schema.
      }
    }
  });
} catch (err) {
  console.error(
    `[SchemaLoader] Error reading schemas directory ${schemasDir}:`,
    err
  );
  // Handle directory reading error - maybe throw?
  throw new Error(`Failed to read schemas directory: ${err.message}`);
}

console.log(
  `[SchemaLoader] Finished loading ${Object.keys(loadedSchemas).length} schemas.`
);

// Export the loaded schemas dynamically
export default loadedSchemas;

// Optional: Export individual schemas if preferred
// export const characterCreateSchema = loadedSchemas.characterCreate;
// export const userLoginSchema = loadedSchemas.userLogin;
// etc.
