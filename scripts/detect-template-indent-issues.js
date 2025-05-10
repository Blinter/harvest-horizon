#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Regular expression to find template literals with concatenation and possible
// extra indentation. This is defined but not used directly in the line-by-line
// processing, which is more accurate for line numbers.
// const TEMPLATE_CONCAT_REGEX = /(`[^`]*`)\\s*\\+\\s*\\n\\s+(`[^`]*`)/g;

/**
 * Checks if a file should be processed based on its extension. Only common
 * JavaScript/TypeScript related files are included.
 *
 * @param {string} filePath - Path to the file being checked.
 * @returns {boolean} True if the file should be processed, false otherwise.
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  // Only process common JS/TS related files
  return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
}

/**
 * Represents a detected indentation issue in a template literal spanning
 * multiple lines using string concatenation.
 *
 * @typedef {object} IndentationIssue
 * @property {number} line - The 1-based line number where the first part of
 *   the concatenated template literal appears.
 * @property {number} nextLine - The 1-based line number of the continuation
 *   line with the second backtick.
 * @property {string} filePath - The path to the file containing the issue.
 * @property {object} details - Specific details about the indentation issue.
 * @property {number} details.firstLineIndent - The number of leading
 *   whitespace characters on the `line`.
 * @property {number} details.firstLineTick - The 0-based column index of the
 *   first backtick (`) on the `line`.
 * @property {number} details.nextLineTick - The 0-based column index of the
 *   second backtick (`) on the `nextLine`.
 * @property {string} details.problem - A description of the detected problem
 *   (e.g., "Extra indentation on continuation line").
 * @property {string} details.suggestion - A suggestion for fixing the issue
 *   (e.g., "Align continuation template literal with the first").
 * @property {string} details.lineContent - The full content of the `line`.
 * @property {string} details.nextLineContent - The full content of the
 *   `nextLine`.
 */

/**
 * Checks a pair of adjacent lines for a template literal concatenation
 * indentation issue.
 *
 * @param {string} line - The current line content.
 * @param {string} nextLine - The next line content.
 * @param {number} lineNumber - The 1-based line number of the current line.
 * @param {string} filePath - The path of the file being checked.
 * @returns {IndentationIssue | null} An issue object if found, otherwise null.
 */
function checkLinePairForIndentationIssue(line, nextLine, lineNumber, filePath) {
  // Check if the current line ends with a template literal followed by ` + `
  const lineEndRegex = /`[^`]*`\s*\+\s*$/;
  if (lineEndRegex.exec(line) === null) {
    return null;
  }

  const firstTick = line.indexOf('`');
  if (firstTick === -1) {
    return null; // Should not happen based on regex, but safe check
  }

  // Check if the next line starts with a backtick after trimming
  const nextLineTrimmed = nextLine.trim();
  if (!nextLineTrimmed.startsWith('`')) {
    return null;
  }

  const nextLineTick = nextLine.indexOf('`');

  // Check if the next line's backtick is indented further than the first
  if (nextLineTick > firstTick) {
    const indentRegex = /^(\s*)/;
    const lineIndentMatch = indentRegex.exec(line);
    const lineIndent = lineIndentMatch ? lineIndentMatch[1].length : 0;

    return {
      line: lineNumber,
      nextLine: lineNumber + 1,
      filePath,
      details: {
        firstLineIndent: lineIndent,
        firstLineTick: firstTick,
        nextLineTick: nextLineTick,
        problem: 'Extra indentation on continuation line',
        suggestion: 'Align continuation template literal with the first',
        lineContent: line,
        nextLineContent: nextLine,
      },
    };
  }

  return null;
}

/**
 * Processes a single file to find template literal indentation issues where
 * concatenation is used across lines. It reads the file content, splits it
 * into lines, and iterates through them to identify potential issues based
 * on the presence of a template literal ending with ` + ` and the alignment
 * of the subsequent template literal's starting backtick.
 *
 * @param {string} filePath - The absolute or relative path to the file to be
 *   processed.
 * @returns {Promise<IndentationIssue[]>} A promise that resolves to an array
 *   of `IndentationIssue` objects found in the file. Returns an empty array
 *   if the file cannot be read or if no issues are found. Errors during file
 *   processing are logged to the console.
 */
async function processFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\\n');
    /** @type {IndentationIssue[]} */
    const issues = [];

    // We need to process the file line by line to get accurate line numbers
    // and handle indentation relative to the *start* of the template literal.
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      const lineNumber = i + 1; // 1-based for the helper

      const issue = checkLinePairForIndentationIssue(
        line,
        nextLine,
        lineNumber,
        filePath
      );

      if (issue) {
        issues.push(issue);
      }

      // Simple check: line ends with `...` + (potential whitespace)
      // if (line.match(/`[^`]*`\s*\+\s*$/)) {
      //   // This line has a template literal possibly ending in concatenation.
      //   const firstTick = line.indexOf('`');
      //   if (firstTick === -1) continue; // Should not happen with the regex match
      //
      //   // Find the start of the template literal on the *next* line.
      //   const nextLineTrimmed = nextLine.trim();
      //   if (!nextLineTrimmed.startsWith('`')) continue; // Next line doesn't start with `
      //
      //   const nextLineTick = nextLine.indexOf('`');
      //
      //   // Check if the next line's backtick is indented further than the first.
      //   if (nextLineTick > firstTick) {
      //     const lineIndentMatch = line.match(/^(\s*)/);
      //     const lineIndent = lineIndentMatch ? lineIndentMatch[1].length : 0;
      //
      //     issues.push({
      //       line: i + 1, // 1-based indexing for reporting
      //       nextLine: i + 2,
      //       filePath,
      //       details: {
      //         firstLineIndent: lineIndent,
      //         firstLineTick: firstTick,
      //         nextLineTick: nextLineTick,
      //         problem: 'Extra indentation on continuation line',
      //         suggestion: 'Align continuation template literal with the first',
      //         lineContent: line,
      //         nextLineContent: nextLine
      //       }
      //     });
      //   }
      // }
    }

    return issues;
  } catch (error) {
    // Log error with more context
    console.error(`Error processing file ${filePath}: ${error.message}`);
    // Optionally log the stack trace for debugging
    // console.error(error.stack);
    return []; // Return empty array on error to allow script continuation
  }
}

/**
 * Recursively scans a directory for files to process. It skips common
 * directories like `node_modules`, hidden files/directories (starting with
 * '.'), and the script files themselves (`detect-template-indent-issues.js`,
 * `fix-template-indent-issues.js`). It only includes files matching the
 * extensions specified in `shouldProcessFile`.
 *
 * @param {string} dir - The path to the directory to start scanning from.
 * @returns {Promise<string[]>} A promise that resolves to an array of file
 *   paths that should be processed. Returns an empty array if the directory
 *   cannot be scanned. Errors during scanning are logged to the console.
 */
async function scanDirectory(dir) {
  try {
    let files = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      // Skip node_modules, hidden directories/files and our own scripts
      if (entry.name === 'node_modules' || entry.name.startsWith('.') ||
        entry.name === 'detect-template-indent-issues.js' ||
        entry.name === 'fix-template-indent-issues.js') {
        continue;
      }

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subDirFiles = await scanDirectory(entryPath);
        files = [...files, ...subDirFiles];
      } else if (entry.isFile() && shouldProcessFile(entryPath)) {
        files.push(entryPath);
      }
    }

    return files;
  } catch (error) {
    console.error(`Error scanning directory ${dir}: ${error.message}`);
    // Optionally log the stack trace for debugging
    // console.error(error.stack);
    return [];
  }
}

/**
 * Formats and logs a detected indentation issue to the console using
 * `console.warn`. It displays the file path, line numbers, the problematic
 * lines, and a suggested fix showing the expected alignment for the
 * continuation line.
 *
 * @param {IndentationIssue} issue - The indentation issue object to log.
 */
function logIssue(issue) {
  // Use console.warn for issues found
  console.warn(`\nFile: ${issue.filePath}`);
  console.warn(
    `  Line ${issue.line}-${issue.nextLine}: ` +
    `Extra indentation in template literal continuation.`
  );
  console.warn(`    Problem: ${issue.details.lineContent.trim()}`);
  console.warn(`             ${issue.details.nextLineContent.trim()}`);

  // Calculate and show suggested fix indentation
  const expectedIndent = ' '.repeat(issue.details.firstLineTick);
  // Ensure we only slice the backtick if it exists
  const nextContent = issue.details.nextLineContent.trim();
  const fixedNextLine = nextContent.startsWith('`')
    ? `${expectedIndent}\`${nextContent.slice(1)}`
    : `${expectedIndent}${nextContent}`; // Fallback if no backtick found

  console.warn(`    Suggested:`);
  console.warn(`    ${issue.details.lineContent.trim()}`); // Keep first line as is
  console.warn(`    ${fixedNextLine}`);
}

/**
 * Main function to execute the template literal indentation detection
 * script. It determines the target directory (defaults to CWD or uses the
 * first command-line argument), scans for relevant files, processes each
 * file to find issues, and reports the findings. If issues are found, it
 * logs each one, provides a summary, explains the rule, and suggests using
 * the fixing script. If no issues are found, it prints a success message.
 * Exits with code 1 on script error.
 */
async function main() {
  try {
    // Start from the current directory by default, or use provided arg
    const startDir = process.argv[2] || process.cwd();

    // Use console.info for general script progress messages
    console.info(`Scanning directory: ${startDir}`);

    // Find all relevant files using the recursive scanner
    const files = await scanDirectory(startDir);
    console.info(`Found ${files.length} files to check.`);

    // Process each file and collect all issues
    let allIssues = [];
    for (const file of files) {
      const issues = await processFile(file);
      allIssues = allIssues.concat(issues);
    }

    // Report issues found
    if (allIssues.length > 0) {
      console.info(`\n--- Issues Found (${allIssues.length}) ---`);
      allIssues.forEach(logIssue); // Log each issue using the helper

      // Provide summary and remediation advice
      console.info('\n--- Summary ---');
      console.info(
        `Found ${allIssues.length} template literal indentation issues.`
      );
      console.info(
        `\nTo fix these issues, align the continuation template literals` +
        `\nwith the first template literal.`
      );
      // Rule 15 explanation formatted
      console.info(
        `"When breaking strings using concatenation (\`+\`) across ` +
        `multiple lines\ndue to length limits, align the \`+\` operator ` +
        `and the subsequent\ntemplate literal directly under the beginning ` +
        `of the first line's\ntemplate literal. Do not add extra ` +
        `indentation."`
      );
      console.info(
        `\nYou can use \`scripts/fix-template-indent-issues.js\` to ` +
        `attempt automatic fixing.`
      );

    } else {
      console.info('\n--- Summary ---');
      console.info('No template literal indentation issues found. Great job!');
    }

  } catch (error) {
    console.error('Error running script:', error);
    process.exit(1); // Exit with error code if the main function fails
  }
}

// Run the script
main(); 