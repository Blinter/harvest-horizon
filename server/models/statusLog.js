/**
 * @file Mongoose schema definition for Character Status Logs.
 * @module server/database/mongo/statusLogSchema
 * @description Defines the structure for status log documents in MongoDB,
 *   linked to a Character document, storing a history of events.
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for status log entries.
 *
 * @typedef {object} StatusLogEntry
 * @property {mongoose.Types.ObjectId} characterId - Reference to the Character
 *   document (required, indexed).
 * @property {string} message - The log message detailing the status change or
 *   event (required, trimmed, maxlength: 500).
 * @property {string} level - Log level (e.g., 'info', 'warn', 'error')
 *   (default: 'info', enum validation).
 * @property {object} [context] - Optional additional structured data
 *   relevant to the log entry.
 * @property {Date} timestamp - Timestamp of the log entry creation
 *   (default: Date.now, required).
 */

/**
 * Mongoose schema definition for storing status log history for characters.
 * Each document belongs to one character and contains an array of log entries.
 * Timestamps for document creation and updates are automatically managed.
 *
 * @typedef {object} StatusLogSchemaDef
 * @property {mongoose.Schema.Types.ObjectId} characterId - Immutable reference
 *   to the associated Character document. Essential for linking logs to a
 *   specific character. Required and indexed for efficient querying.
 * @property {StatusLogEntrySubdocument[]} entries - An array holding individual
 *   status log entries. Each entry records a specific event or status change.
 * @property {Date} createdAt - Timestamp automatically added by Mongoose when
 *   the document is first created. Represents the creation time of the log
 *   record itself (not the first entry). Managed by Mongoose `timestamps`
 *   option.
 * @property {Date} updatedAt - Timestamp automatically updated by Mongoose
 *   whenever the document (including the `entries` array) is modified.
 *   Reflects the time of the last update to the log record. Managed by
 *   Mongoose `timestamps` option.
 */
export const statusLogSchema = new mongoose.Schema(
  {
    /**
     * Reference to the owning Character document. Links this log document
     * to a specific character. This field is indexed to allow for quick
     * lookups of logs based on the character ID. It is mandatory, ensuring
     * every log document is associated with a character.
     * 
     * Mongoose ObjectId
     * 
     * @type {object}
     * @ref Character
     * @required
     * @index
     */
    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Character',
      required: true,
      index: true,
    },
    /**
     * Array storing the individual status log entries for the character.
     * Each object within this array represents a single logged event.
     * 
     * Array of StatusLogEntrySubdocument
     * 
     * @type {Array}
     */
    entries: [
      {
        /**
         * The exact time when the logged event occurred or was recorded.
         * Defaults to the time the entry is added if not explicitly set.
         * 
         * @type {Date}
         * @default Date.now
         */
        timestamp: {
          type: Date,
          default: Date.now,
        },
        /**
         * Categorizes the type of event being logged. Helps in filtering
         * and understanding the nature of the log entry. Must be one of
         * the predefined valid status types.
         * 
         * @type {string}
         * @enum {string} [
         *   'connected', 'disconnected', 'announcement', 'achievement',
         *   'milestone', 'event', 'purchase', 'sale'
         * ]
         * @required
         */
        statusType: {
          type: String,
          enum: [
            'connected',
            'disconnected',
            'announcement',
            'achievement',
            'milestone',
            'event',
            'purchase',
            'sale',
          ],
          required: true,
        },
        /**
         * Optional field to provide more specific information or context
         * about the logged event beyond the `statusType`. Can store custom
         * messages or data related to the event.
         * 
         * @type {string}
         * @optional
         */
        details: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

/**
 * Mongoose middleware (pre-hook) triggered before a `save` operation
 * on a StatusLog document. Checks if the document is new (`this.isNew`)
 * and if it currently has no entries (`this.entries.length === 0`).
 * If both conditions are true, it automatically adds an initial
 * 'connected' log entry to signify the creation or initial state.
 * Includes debug logging before and after adding the entry, and error
 * logging if the addition fails. If an error occurs, it prevents the
 * save operation by passing the error to `next()`.
 *
 * @function preSaveHook
 * @param {Function} next - Mongoose middleware callback function. Call this
 *   to proceed with the save operation, or pass an error to halt it.
 * @listens StatusLog.save
 * @this mongoose.Document - The StatusLog document being saved.
 */
statusLogSchema.pre('save', function (next) {
  if (this.isNew && this.entries.length === 0) {
    try {
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'statusLogSchema.pre.save',
        message: 'Adding initial "connected" log entry...',
        context: { characterId: this.characterId },
      });
      this.entries.push({
        statusType: 'connected',
        timestamp: new Date(),
        details: 'Initial connection',
      });
      console.debug({
        timestamp: new Date().toISOString(),
        service: 'statusLogSchema.pre.save',
        message: 'Initial "connected" log entry added successfully.',
        context: { characterId: this.characterId },
      });
    } catch (error) {
      console.error({
        timestamp: new Date().toISOString(),
        service: 'statusLogSchema.pre.save',
        message: 'Error adding initial "connected" log entry.',
        context: {
          characterId: this.characterId,
          error: error.message,
          stack: error.stack,
        },
      });
      // Pass error to Mongoose to prevent saving
      return next(error);
    }
  }
  next();
});

// --- Static Methods ---

/**
 * Fetches a paginated list of status log entries for a specific character,
 * sorted by timestamp in descending order (most recent first). Uses MongoDB
 * aggregation pipeline for efficiency.
 *
 * Handles potential errors during the database query and logs them using a
 * structured format. If no log document is found for the character, it
 * returns a default empty structure instead of throwing an error for not found.
 *
 * @static
 * @async
 * @function getPaginatedLogsByCharacterId
 * @memberof StatusLog
 * @param {string | mongoose.Types.ObjectId} characterId - The unique
 *   identifier of the character whose logs are to be fetched. Can be a
 *   string or a Mongoose ObjectId.
 * @param {number} skip - The number of log entries to skip from the
 *   beginning of the sorted list (used for pagination).
 * @param {number} limit - The maximum number of log entries to return in
 *   this page.
 * @returns {Promise<{
 *   totalEntries: number,
 *   paginatedEntries: StatusLogEntrySubdocument[]
 * }>}
 *   A promise that resolves to an object containing:
 *   - `totalEntries`: The total count of all log entries for the character.
 *   - `paginatedEntries`: An array containing the requested subset of log
 *     entries, sorted by timestamp descending.
 *
 *   Returns `{ totalEntries: 0, paginatedEntries: [] }` if no log
 *   document exists for the character.
 * @throws {Error} If the database aggregation query fails for reasons other
 *   than the document not being found.
 */
statusLogSchema.statics.getPaginatedLogsByCharacterId = async function (
  characterId,
  skip,
  limit
) {
  try {
    // Ensure characterId is an ObjectId for matching
    const matchId =
      typeof characterId === 'string'
        ? new mongoose.Types.ObjectId(characterId)
        : characterId;

    const aggregationResult = await this.aggregate([
      {
        $match: { characterId: matchId },
      },
      {
        $project: {
          _id: 0, // Exclude the main document ID
          totalEntries: { $size: '$entries' },
          paginatedEntries: {
            $slice: [
              {
                $sortArray: {
                  input: '$entries',
                  // Sort by timestamp descending within the subdocuments
                  sortBy: { timestamp: -1 },
                },
              },
              skip,
              limit,
            ],
          },
        },
      },
    ]).exec();

    if (!aggregationResult || aggregationResult.length === 0) {
      console.debug(
        `[DEBUG][StatusLogModel] Log document not found or empty ` +
        `for char ${characterId}`
      );
      // Consistent return structure even if no logs found
      return { totalEntries: 0, paginatedEntries: [] };
    }

    // Aggregation returns an array, we expect only one result
    return aggregationResult[0];
  } catch (error) {
    // Log using structured format from debugging.mdc
    console.error({
      timestamp: new Date().toISOString(),
      service: 'StatusLogModel.getPaginatedLogsByCharacterId',
      message: `Aggregation failed for char ${characterId}: ${error.message}`,
      context: {
        characterId: characterId, // Include characterId in context
        error: error.message, // Keep error message here too
        stack: error.stack,
      },
    });
    // Re-throw the error to be handled by the caller (e.g., API route)
    throw error;
  }
};

/**
 * Mongoose Model representing the StatusLog collection. Provides an
 * interface for interacting with the `statuslogs` collection in MongoDB,
 * including CRUD operations and the custom static methods defined
 * on the schema (like `getPaginatedLogsByCharacterId`).
 * 
 * Mongoose Model
 *
 * @type {object}
 */
export default mongoose.model('StatusLog', statusLogSchema);
