/**
 * @file Client-Side Crop Management Utilities.
 * @module src/library/cropUtils
 * @description Provides functions for checking crop stages based on static
 *   game data. 
 */

import {
  totalCropData,
  getCropData,
  getCropStagesCount,
  isActionAllowed,
} from '../library/gameData.js';

import {
  _validateStageInfoInputs,
  _findCurrentStageIndex,
  _calculateNextStageTimestamp,
} from './cropUtilsHelper.js';

/**
 * Determines if a a Map Tile has crop data.
 *
 * @param {object} tile - The tile object containing crop data.
 * @returns {boolean} True if the tile has crop data, false otherwise.
 */
export const hasCropTile = tile => {
  return tile?.cropType &&
    tile?.cropPlantedAt &&
    tile?.cropLevel;
};

/**
 * Determines if a crop can speed up growth.
 *
 * @param {object} tile - The tile object containing crop data.
 * @returns {boolean} True if the crop can speed up growth, false otherwise.
 */
export const canSpeedGrowTile = tile => {
  if (!tile ||
    !tile.cropType ||
    !tile.cropPlantedAt ||
    !tile.cropLevel
  ) {
    return false;
  }

  // Check if the tile has a valid lease
  if (!isActionAllowed(tile.properties)) {
    return false;
  }

  const currentStage = getCurrentStageIndex(
    tile.cropType,
    tile.cropPlantedAt,
    tile.cropLevel
  );

  const totalStages = getCropStagesCount(
    tile.cropType,
    tile.cropLevel
  );
  // Enable if stage is valid and not the last one
  return currentStage !== undefined &&
    totalStages !== undefined &&
    currentStage < totalStages - 1;
};

/**
 * Determine if a map tile is ready for harvest.
 *
 * @param {object} tile - The tile object containing crop data.
 * @returns {boolean} True if the crop is ready for harvest, false otherwise.
 */
export const canHarvestTile = tile => {
  // Basic check for tile object
  if (!tile) {
    return false;
  }

  // Check if the tile is action allowed
  if (!isActionAllowed(tile.properties)) {
    return false;
  }

  const {
    cropType,
    cropPlantedAt,
    cropLevel
  } = tile;

  // Validate core crop info extracted from the tile
  // Use the more robust canHarvestCrop which includes checks for these
  return canHarvestCrop(cropType, cropLevel, cropPlantedAt);
};

/**
 * Determine if a map tile is ready for harvest based on its properties.
 *
 * @param {object} tileProperties - The tile properties object.
 * @returns {boolean} True if the crop is ready for harvest, false otherwise.
 */
export const canHarvestTileProperties = tileProperties => {
  // Basic check for tile object
  if (!tileProperties) {
    return false;
  }

  // Check if the tile is action allowed
  if (!isActionAllowed(tileProperties)) {
    return false;
  }

  const {
    cropType,
    cropPlantedAt,
    cropLevel
  } = tileProperties;

  // Validate core crop info extracted from the tile
  // Use the more robust canHarvestCrop which includes checks for these
  return canHarvestCrop(cropType, cropLevel, cropPlantedAt);
};


/**
 * Efficiently checks if a crop is ready for harvest based on its type, level,
 * and planting time. Performs necessary validations. Does not validate tile
 * leases.
 *
 * @param {string} cropType - The type of the crop (e.g., 'wheat').
 * @param {number} cropLevel - The level of the crop.
 * @param {Date | string | number} cropPlantedAt - The timestamp or Date object
 *   when the crop was planted.
 * @returns {boolean} True if the crop is ready for harvest, false otherwise.
 */
export const canHarvestCrop = (
  cropType,
  cropLevel,
  cropPlantedAt
) => {
  // 1. Basic Input Validation
  if (!cropType ||
    cropLevel === undefined ||
    cropLevel === null ||
    !cropPlantedAt) {
    // for debugging
    // console.debug('[canHarvestCrop] Invalid input');
    return false;
  }

  // 2. Get Crop Data (minimal error handling for performance)
  const cropData = totalCropData[cropType]?.stages?.[
    cropType + cropLevel.toString()
  ];

  // 3. Validate Crop Data & Growth Time
  // Check for frames array existence and positive growth time
  if (!cropData?.frames ||
    cropData.growthTime <= 0) {
    return false;
  }

  // 4. Time Calculation
  const plantedAtTime = new Date(cropPlantedAt).getTime();

  // Check if plantedAtTime is a valid number
  if (isNaN(plantedAtTime)) {
    return false;
  }

  const currentTime = Date.now();
  const elapsedTime = currentTime - plantedAtTime;

  // 5. Check Elapsed Time
  if (elapsedTime < 0) {
    // Crop planted in the future or slight clock skew, not ready.
    return false;
  }

  // 6. Stage Calculation
  const totalTimePerStage = cropData.growthTime; // Already validated > 0
  const maxStageIndex = cropData.frames.length - 1;

  const currentStageIndex = Math.min(
    Math.floor(elapsedTime / totalTimePerStage),
    maxStageIndex
  );

  // 7. Compare Stages
  return currentStageIndex === maxStageIndex;
};

/**
 * Determines the current growth stage index of a crop based on planting time.
 *
 * @function getCurrentStageIndex
 * @param {string} cropType - The type of the crop.
 * @param {Date | string | number} cropPlantedAt - The date/time the crop was
 *   planted.
 * @param {number} [cropLevel=1] - The level of the crop. Defaults to 1.
 * @returns {number | undefined} The current stage index (zero-based), or
 *   undefined if data is missing or invalid.
 */
export const getCurrentStageIndex = (
  cropType,
  cropPlantedAt,
  cropLevel = 1
) => {
  if (
    !cropType ||
    !totalCropData[cropType]?.stages ||
    cropLevel === undefined ||
    !cropPlantedAt
  ) {
    console.warn(
      `[CropUtils] Missing data for 
      ${cropType}, level ${cropLevel}, or ` +
      `plantedAt: ${cropPlantedAt} in getCurrentStageIndex`,
      totalCropData[cropType]?.stages
    );
    return undefined;
  }

  const stageData = getCropData(cropType, cropLevel);

  if (!stageData?.frames || !stageData.growthTime) {
    console.warn(
      `[CropUtils] Missing frames or growthTime for ${cropType}${cropLevel}`
    );
    return undefined;
  }

  const currentTime = Date.now();
  const plantTime = new Date(cropPlantedAt).getTime();

  if (isNaN(plantTime)) {
    console.warn(
      `[CropUtils] Invalid plantedAt date: ${cropPlantedAt}`
    );
    return 0;
  }

  const elapsedTime = currentTime - plantTime;

  // Define a threshold for ignoring small negative differences (e.g., 5 seconds)
  const negativeTimeThreshold = 5000; // milliseconds

  if (elapsedTime < 0) {
    // Only log a warning if the negative difference is significant
    if (Math.abs(elapsedTime) > negativeTimeThreshold) {
      console.warn(
        `[CropUtils] Elapsed time is significantly negative ` +
        `(${elapsedTime}ms). Possible clock issue or invalid plantedAt?`
      );
    }
    // Always return stage 0 for crops planted 'in the future'
    return 0;
  }

  const totalTimePerStage = stageData.growthTime;
  const maxStageIndex = stageData.frames.length - 1;

  const currentStageIndex = Math.min(
    Math.floor(elapsedTime / totalTimePerStage),
    maxStageIndex
  );

  return currentStageIndex;
};

/**
 * Calculates the current visual stage (frame index) and the timestamp for the
 * next stage advancement based on the crop type, level, and planting time.
 *
 * @export
 * @param {string} cropType - The type identifier of the crop (e.g., 'wheat').
 * @param {Date | string | number} cropPlantedAt - The timestamp (ms) or Date
 *   object when the crop was planted.
 * @param {number} cropLevel - The level of the crop.
 * @returns {{
 *   cropStage: number | null,
 *   cropNextStage: number | null
 * }} An object containing the calculated `cropStage` index and the
 *   `cropNextStage` timestamp (ms). `cropNextStage` will be `null` if the
 *   crop is at its final stage or if data is invalid. Returns an empty object
 *   if required parameters are missing, or an object with `cropStage` 0 and
 *   `cropNextStage` null if inputs are invalid or the date format is wrong.
 */
export const calculateCropStageInfo = (
  cropType,
  cropPlantedAt,
  cropLevel
) => {
  if (!cropType ||
    !cropPlantedAt ||
    !cropLevel
  ) {
    console.warn(
      `[cropUtils calculateCropStageInfo] Missing required parameters: ` +
      `cropType: ${cropType}, cropPlantedAt: ${cropPlantedAt}, ` +
      `cropLevel: ${cropLevel}.`
    );
    return {};
  }
  const stagesData = getCropData(cropType, cropLevel);
  // stagesData:
  //{frames: Array(5), growthTime: 5000, currentFrame: 0}
  if (!stagesData) {
    console.warn(
      `[cropUtils calculateCropStageInfo] No stages data found for ` +
      `${cropType} Lvl ${cropLevel}. ` +
      `StagesData: ${JSON.stringify(stagesData)}.`
    );
    return {
      cropType,
      cropPlantedAt,
      cropLevel,
      cropStage: null,
      cropNextStage: null
    };
  }

  if (!_validateStageInfoInputs(
    stagesData,
    cropPlantedAt,
    cropType,
    cropLevel
  )) {
    console.warn(
      `[cropUtils calculateCropStageInfo] Invalid stage info inputs: ` +
      `stagesData: ${JSON.stringify(stagesData)}, ` +
      `cropPlantedAt: ${cropPlantedAt}, ` +
      `cropType: ${cropType}, ` +
      `cropLevel: ${cropLevel}.`
    );
    return {
      cropStage: 0,
      cropNextStage: null
    };
  }

  const plantTimeMs = new Date(cropPlantedAt).getTime();

  if (isNaN(plantTimeMs)) {
    console.warn(
      `[cropUtils calculateCropStageInfo] Invalid cropPlantedAt date ` +
      `format: ${cropPlantedAt}. Could not parse to timestamp.`
    );
    // Return a default state or handle appropriately
    return {
      cropStage: 0, // Or null, depending on desired error handling
      cropNextStage: null
    };
  }

  const elapsedTime = Date.now() - plantTimeMs;

  const calculatedStage = _findCurrentStageIndex(
    stagesData,
    elapsedTime // Use the calculated elapsed time
  );

  // Debugging: Calculate Crop Stage Info
  // console.debug(
  //   `[cropUtils calculateCropStageInfo] Calculated stage: ${calculatedStage}`
  // );

  return {
    cropStage: calculatedStage,
    cropNextStage: _calculateNextStageTimestamp(
      stagesData,
      calculatedStage,
      plantTimeMs // Pass the timestamp in ms
    ),
  };
}; 