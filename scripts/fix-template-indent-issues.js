#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Checks if a file should be processed based on its extension. Only JS, JSX,
 * TS, and TSX files are considered.
 *
 * @param {string} filePath - The full path to the file being checked.
 * @returns {boolean} True if the file should be processed, false otherwise.
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
}

/**
 * Reads a file, identifies lines with improperly indented template literals
 * following a concatenation (`+`), and fixes the indentation on the subsequent
 * line. Logs details about the fixes applied.
 *
 * @param {string} filePath - The full path to the file to process.
 * @param {boolean} [dryRun=false] - If true, logs potential changes without
 *   writing them to the disk. Defaults to false.
 * @returns {Promise<object>} A promise that resolves to an object containing
 *   the file path, the number of fixes made, a boolean indicating if the file
 *   was modified, and an optional error message.
 */
async function processAndFixFile(filePath, dryRun = false) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let fixCount = 0;

    // Process the file line by line to identify and fix issues
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];

      // Check if this line ends with a concatenated template literal
      if (line.match(/`[^`]*`\s*\+\s*$/)) {
        // This line has a template literal with concatenation
        const firstTick = line.indexOf('`');

        // Find the template literal on the next line
        const nextLineTick = nextLine.indexOf('`');

        if (nextLineTick > firstTick && nextLine.trim().startsWith('`')) {
          // The next line has additional indentation that needs fixing
          const expectedIndent = ' '.repeat(firstTick);
          const fixedNextLine = expectedIndent + nextLine.trim();

          // Log the fix
          console.log(`File: ${filePath}`);
          console.log(`  Line ${i + 2}: Fixing indentation`);
          console.log(`    Before: ${nextLine}`);
          console.log(`    After:  ${fixedNextLine}`);

          // Apply the fix
          lines[i + 1] = fixedNextLine;
          modified = true;
          fixCount++;
        }
      }
    }

    // Write the fixed content back to the file if changes were made
    if (modified && !dryRun) {
      await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');
      console.log(`Fixed ${fixCount} issues in ${filePath}`);
    } else if (modified) {
      console.log(`[DRY RUN] Would fix ${fixCount} issues in ${filePath}`);
    }

    return { filePath, fixCount, modified };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return { filePath, fixCount: 0, modified: false, error: error.message };
  }
}

/**
 * Recursively scans a directory and its subdirectories to find all files that
 * match the criteria defined by `shouldProcessFile`. Skips `node_modules`,
 * hidden directories (starting with '.'), and the script files themselves.
 *
 * @param {string} dir - The path to the directory to start scanning from.
 * @returns {Promise<string[]>} A promise resolving to an array of full file
 *   paths that should be processed. Returns an empty array if an error occurs
 *   during scanning.
 */
async function scanDirectory(dir) {
  try {
    let files = [];
    const entries = await fs.promises.readdir(dir);

    for (const entry of entries) {
      const entryPath = path.join(dir, entry);

      // Skip node_modules, hidden directories and our scripts
      if (entry === 'node_modules' || entry.startsWith('.') ||
        entry === 'detect-template-indent-issues.js' ||
        entry === 'fix-template-indent-issues.js') {
        continue;
      }

      const stats = await fs.promises.stat(entryPath);

      if (stats.isDirectory()) {
        const subDirFiles = await scanDirectory(entryPath);
        files = [...files, ...subDirFiles];
      } else if (stats.isFile() && shouldProcessFile(entryPath)) {
        files.push(entryPath);
      }
    }

    return files;
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
    return [];
  }
}

/**
 * Main execution function for the script. Parses command-line arguments to
 * determine the target directory and whether to run in dry-run mode. Scans the
 * directory, processes eligible files, and prints a summary of the operations.
 * Exits with code 1 if an error occurs during execution.
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    const startDir = args.find(arg => !arg.startsWith('-')) || process.cwd();

    console.log(`Scanning directory: ${startDir}${dryRun ? ' (DRY RUN)' : ''}`);

    // Find all JavaScript/JSX/TS/TSX files
    const files = await scanDirectory(startDir);
    console.log(`Found ${files.length} files to check`);

    // Process each file
    let totalFixed = 0;
    let totalModifiedFiles = 0;

    for (const file of files) {
      const result = await processAndFixFile(file, dryRun);

      if (result.modified) {
        totalModifiedFiles++;
        totalFixed += result.fixCount;
      }
    }

    // Summary
    console.log('\n--- Summary ---');
    console.log(`Total files processed: ${files.length}`);
    console.log(`Files with fixes: ${totalModifiedFiles}`);
    console.log(`Total issues fixed: ${totalFixed}`);

    if (dryRun && totalFixed > 0) {
      console.log('\nThis was a dry run. No files were modified.');
      console.log('Run without the --dry-run flag to apply the fixes.');
    } else if (totalFixed > 0) {
      console.log('"When breaking a strings using concatenation (`+`) across multiple lines due to length limits,');
      console.log('align the `+` operator and the subsequent template literal directly under the beginning of');
      console.log('the first line\'s template literal. Do not add extra indentation."');
    } else {
      console.log('\nNo indentation issues found in template literals. Great job!');
    }
  } catch (error) {
    console.error('Error running script:', error);
    process.exit(1);
  }
}

// Run the script
main(); 