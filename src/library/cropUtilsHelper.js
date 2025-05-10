/**
 * @file Client-Side Crop Management Utilities.
 * @module src/library/cropUtilsHelper
 * @description Provides helper functions for the cropUtils module. These
 *   functions handle validation, stage calculation, and timestamp
 *   determination for crop growth cycles.
 */

/**
 * Validates the inputs for calculating crop stage information. Checks if
 * stage data, planted time, type, and level are present and valid. Logs
 * warnings if validation fails.
 *
 * @private
 * @param {object} stagesData - The configuration data for the crop stages,
 *   expected to have `frames` (array) and `growthTime` (number).
 * @param {number} cropPlantedAt - The timestamp when the crop was planted.
 * @param {string} cropType - The type identifier of the crop.
 * @param {string} cropLevel - The level identifier of the crop.
 * @returns {boolean} True if all inputs are valid, false otherwise.
 */
export const _validateStageInfoInputs = (
  stagesData,
  cropPlantedAt,
  cropType,
  cropLevel
) => {
  if (!stagesData?.frames ||
    !Array.isArray(stagesData.frames) ||
    stagesData.frames.length === 0 ||
    !cropPlantedAt
  ) {
    if (!cropType) {
      console.warn(
        `[cropUtils _validateStageInfoInputs] Crop type is not defined: ` +
        `${cropType}.`
      );
    }
    if (!cropLevel) {
      console.warn(
        `[cropUtils _validateStageInfoInputs] Crop type is not defined: ` +
        `${cropType}.`
      );
    }
    if (!cropPlantedAt) {
      console.warn(
        `[cropUtils _validateStageInfoInputs] Invalid plantedAt timestamp: ` +
        `${cropPlantedAt}.`
      );
    } else {
      console.warn(
        `[cropUtils _validateStageInfoInputs] Stage data missing or invalid ` +
        `for ${cropType}${cropLevel}.`
      );
    }
    if (!stagesData?.growthTime ||
      stagesData.growthTime <= 0) {
      console.warn(
        `[cropUtils _validateStageInfoInputs] Growth time is not a positive number: ` +
        `${stagesData.growthTime}.`
      );
    }

    return false;
  }
  return true;
};

/**
 * Finds the current stage index based on elapsed time since planting and
 * the growth time per stage defined in stagesData. Ensures the stage is
 * within the valid range (0 to numFrames - 1).
 *
 * @private
 * @param {object} stagesData - Configuration data containing `frames` (array)
 *   and `growthTime` (number).
 * @param {number} elapsedTime - The time elapsed since the crop was planted,
 *   in milliseconds.
 * @returns {number} The calculated current stage index (0-based). Returns 0
 *   if inputs are invalid or growthTime is non-positive.
 */
export const _findCurrentStageIndex = (
  stagesData,
  elapsedTime
) => {
  let calculatedStage = 0;
  const numFrames = stagesData.frames?.length ?? 0;
  const growthTimePerStage = stagesData.growthTime;
  if (!growthTimePerStage ||
    growthTimePerStage <= 0 ||
    numFrames === 0) {
    return 0;
  }

  calculatedStage = Math.floor(
    elapsedTime / growthTimePerStage
  );
  calculatedStage = Math.max(
    0,
    Math.min(
      calculatedStage,
      numFrames - 1
    )
  );
  // Debugging: Find Current Stage Index
  // console.debug(
  //   `[cropUtilsHelper _findCurrentStageIndex] ` + 
  //   `Calculated stage: ${calculatedStage}`
  // );
  return calculatedStage;
};

/**
 * Calculates the timestamp for when the crop will reach the next growth
 * stage. Returns null if the crop is already at the final stage or if
 * stage data is invalid.
 *
 * @private
 * @param {object} stagesData - Configuration data containing `frames` (array)
 *   and `growthTime` (number).
 * @param {number} calculatedStage - The current stage index of the crop.
 * @param {number} cropPlantedAt - The timestamp when the crop was planted.
 * @returns {number|null} The timestamp for the next stage transition, or null
 *   if the crop is mature or inputs are invalid.
 */
export const _calculateNextStageTimestamp = (
  stagesData,
  calculatedStage,
  cropPlantedAt
) => {
  const numFrames = stagesData.frames?.length ?? 0;
  const growthTimePerStage = stagesData.growthTime;

  if (calculatedStage >= numFrames - 1 ||
    !growthTimePerStage ||
    growthTimePerStage <= 0) {
    return null;
  }

  const timeToNextStage = (calculatedStage + 1) * growthTimePerStage;
  return cropPlantedAt + timeToNextStage;
};