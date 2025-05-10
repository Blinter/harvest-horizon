/**
 * @file Mongoose model retrieval helper.
 * @module server/database/helpers/mongoose
 * @description Provides a function to safely get a Mongoose model,
 *   preventing recompilation if it already exists. This avoids the
 *   `OverwriteModelError` often encountered during development, especially
 *   with features like hot-reloading.
 */

'use strict';

import mongoose from 'mongoose';

/**
 * Retrieves a Mongoose model by name.
 *
 * If the model already exists in Mongoose's cache, it returns the existing
 * model. Otherwise, it compiles and returns a new model based on the
 * provided schema. This mechanism is crucial for preventing the
 * `OverwriteModelError` during development phases that utilize
 * hot-reloading or similar dynamic code update processes.
 *
 * @function getMongooseModel
 * @param {string} name - The designated name for the Mongoose model.
 * @param {mongoose.Schema} schema - The Mongoose schema definition used
 *   to structure the model.
 * @returns {mongoose.Model<any>} The requested Mongoose model, either
 *   retrieved from the cache or newly compiled.
 */
export function getMongooseModel(name, schema) {
  if (mongoose.models[name]) {
    return mongoose.models[name];
  }
  return mongoose.model(name, schema);
}

export default getMongooseModel;
