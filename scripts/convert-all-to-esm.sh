#!/bin/bash

# Script to convert CommonJS files to ES Modules
# Finds all .js files, excluding node_modules and other build directories

echo "Finding files to convert..."

# Find potential CommonJS files
FOUND_FILES=$(find . -type f -name "*.js" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*" -not -path "*/.git/*")

# Count for statistics
TOTAL_FILES=0
CONVERTED_FILES=0

for FILE in $FOUND_FILES; do
  TOTAL_FILES=$((TOTAL_FILES + 1))
  
  # Skip files that are already in ESM format
  if grep -q "export default" "$FILE" || grep -q "export {" "$FILE" || grep -q "export const" "$FILE" || grep -q "export function" "$FILE" || grep -q "export class" "$FILE"; then
    echo "$FILE already appears to be in ES Module format. Skipping."
    continue
  fi
  
  # Check for CommonJS patterns
  if grep -q "require(" "$FILE" || grep -q "module.exports" "$FILE" || grep -q "exports\\." "$FILE"; then
    echo "Converting $FILE from CommonJS to ES Modules..."
    
    # Create a backup
    cp "$FILE" "${FILE}.bak"
    
    # Replace require() with import
    sed -i 's/const \(.*\) = require(\(.*\))/import \1 from \2/g' "$FILE"
    sed -i 's/let \(.*\) = require(\(.*\))/import \1 from \2/g' "$FILE"
    sed -i 's/var \(.*\) = require(\(.*\))/import \1 from \2/g' "$FILE"
    
    # Replace destructuring require with named imports
    sed -i 's/const { \(.*\) } = require(\(.*\))/import { \1 } from \2/g' "$FILE"
    sed -i 's/let { \(.*\) } = require(\(.*\))/import { \1 } from \2/g' "$FILE"
    sed -i 's/var { \(.*\) } = require(\(.*\))/import { \1 } from \2/g' "$FILE"
    
    # Replace module.exports = with export default
    sed -i 's/module\.exports = /export default /g' "$FILE"
    
    # Replace exports.x = with export const x =
    sed -i 's/exports\.\([a-zA-Z0-9_]*\) = /export const \1 = /g' "$FILE"
    
    CONVERTED_FILES=$((CONVERTED_FILES + 1))
    echo "Converted: $FILE"
  else
    echo "$FILE doesn't appear to be using CommonJS. Skipping."
  fi
done

echo "====================================="
echo "Conversion complete!"
echo "Processed $TOTAL_FILES files."
echo "Converted $CONVERTED_FILES files to ES Modules."
echo "=====================================" 