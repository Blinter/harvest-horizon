/**
 * @file Static game data definitions.
 * @module server/library/gameData
 * @description Contains constant data structures defining game elements like
 *   crop properties (stages, growth times) and tile progression.
 */

/**
 * Data defining the stages, frames, and growth time for different levels of
 *   Wheat crops.
 * - `frames`: Array representing tile indices for each growth stage. Nested
 *             objects/arrays indicate animated frames for a stage.
 * - `growthTime`: Time in milliseconds for the crop to advance to the next
 *                 stage (or be ready for harvest).
 * - `currentFrame`: Initial frame index (usually 0).
 * - `plantedAt`: Placeholder, typically set dynamically when planted.
 *
 * @type {Object.<string, {
 *   frames: Array<number | object>,
 *   growthTime: number,
 *   currentFrame: number,
 *   plantedAt: null
 * }>}
 */
export const wheatCropData = {
  wheat1: {
    frames: [
      3,
      7,
      15,
      { frames: [23, 19] },
      { frames: [31, 27] },
    ],
    // total growth time: 34324 ms = 34.324 seconds
    growthTime: 34324,
    currentFrame: 0,
    plantedAt: null,
  },
  wheat2: {
    frames: [
      2,
      6,
      14,
      { frames: [22, 18] },
      { frames: [30, 26] }],
    // total growth time: 123750 ms = 2 minutes 3.75 seconds
    growthTime: 123750,
    currentFrame: 0,
    plantedAt: null,
  },
  wheat3: {
    frames: [
      1,
      5,
      { frames: [13, 9] },
      { frames: [21, 17] },
      { frames: [29, 25] },
    ],
    // total growth time: 385250 ms = 6 minutes 25.25 seconds
    growthTime: 385250,
    currentFrame: 0,
    plantedAt: null,
  },
  wheat4: {
    frames: [
      0,
      4,
      { frames: [12, 8] },
      { frames: [20, 16] },
      { frames: [28, 24] },
    ],
    // total growth time: 1606563 ms = 26 minutes 46.563 seconds
    growthTime: 1606563,
    currentFrame: 0,
    plantedAt: null,
  },
};

/**
 * Aggregated data structure for all crop types. Organizes crop data by type
 *   (e.g., 'wheat').
 * - `stages`: Object containing stage data for different levels (e.g.,
 *             wheatCropData).
 * - `size`: The number of defined levels/stages for the crop type.
 *
 * @type {Object.<string, {stages: object, size: number}>}
 */
export const totalCropData = {
  wheat: {
    stages: wheatCropData,
    size: Object.keys(wheatCropData).length,
  },
};

/**
 * The cost to lease a tile at base rate.
 * Set to 1 for testing. Default is 27
 *
 * @type {number}
 */
export const costToLeaseTile = 27;

/**
 * The cost to rent a tile at base rate. This rate is used for subsequent
 * rents.
 * Set to 1 for testing. Default is 4
 *
 * @type {number}
 */
export const costToRentTile = 4;

/**
 * The lease time in milliseconds.
 * Set to 10 seconds for testing.
 * Default is 77 minutes
 *
 * @type {number}
 */
export const leaseTime = 77 * 60 * 1000;

/**
 * Retrieves the specific data object for a given crop type and level.
 *
 * @param {string} cropType - The type of crop (e.g., 'wheat').
 * @param {number} cropLevel - The level of the crop (e.g., 1, 2, 3).
 * @returns {object | undefined} The crop data object containing frames,
 *   growthTime, etc., or undefined if not found. Throws an error if
 *   parameters are invalid.
 */
export const getCropData = (cropType, cropLevel) => {
  if (!cropType || !cropLevel) {
    console.warn(
      `[gameData getCropData] Missing required parameters: ` +
      `cropType: ${cropType}, cropLevel: ${cropLevel}.`
    );
    throw new Error("Invalid crop data retrieval parameters.");
  }
  return totalCropData[cropType]?.stages?.[cropType + cropLevel.toString()];
};

/**
 * Retrieves the frames array for a specific crop type and level.
 *
 * @param {string} cropType - The type of crop.
 * @param {number} cropLevel - The level of the crop.
 * @returns {Array<number | object>} The array of frame definitions for the
 *   crop's growth stages.
 */
export const getCropFrames = (cropType, cropLevel) =>
  getCropData(cropType, cropLevel).frames;

/**
 * Retrieves the total growth time for a specific crop type and level.
 *
 * @param {string} cropType - The type of crop.
 * @param {number} cropLevel - The level of the crop.
 * @returns {number} The total growth time in milliseconds.
 */
export const getCropGrowthTime = (cropType, cropLevel) =>
  getCropData(cropType, cropLevel).growthTime;

/**
 * Generates the texture key used for loading crop assets in Phaser.
 * Assumes a naming convention like 'cropsWheat'.
 *
 * @param {string} cropType - The type of crop (e.g., 'wheat').
 * @returns {string} The texture key (e.g., 'cropsWheat').
 */
export const getTextureKey = cropType =>
  `crops${cropType.charAt(0).toUpperCase() + cropType.slice(1)}`;

/**
 * Gets the number of growth stages for a specific crop type and level.
 *
 * @param {string} cropType - The type of crop.
 * @param {number} [cropLevel=1] - The level of the crop. Defaults to 1.
 * @returns {number | undefined} The number of stages, or undefined if data is
 *   missing.
 */
export const getCropStagesCount = (
  cropType,
  cropLevel = 1
) => {
  if (
    !cropType ||
    cropLevel === undefined
  ) {
    console.warn(
      `[gameData getCropStagesCount] Missing data for ${cropType} level ` +
      `${cropLevel} in getCropStagesCount`
    );
    return undefined;
  }

  return getCropFrames(cropType, cropLevel).length;
};

/**
 * Calculates the exact date and time the crop will reach its next growth
 *   stage or be ready for harvest.
 *
 * @param {string} cropType - The type of crop.
 * @param {number} cropStage - The current stage of the crop (index).
 * @param {Date} cropPlantedAt - The Date object representing when the crop was
 *   planted.
 * @param {number} cropLevel - The level of the crop.
 * @returns {Date | undefined} The calculated Date object for the next stage,
 *   or undefined if crop data is missing.
 */
export const getNextStageDateTime = (
  cropType,
  cropStage,
  cropPlantedAt,
  cropLevel
) => {
  const cropData = getCropData(cropType, cropLevel);
  if (!cropData) {
    console.warn(
      `[gameData getNextStageDateTime] Missing data for ${cropType} level ` +
      `${cropLevel} in getNextStageDateTime`
    );
  }
  const growthTime = getCropGrowthTime(cropType, cropLevel);
  const nextStageDateTime = new Date(
    cropPlantedAt.getTime() + growthTime
  );
  return nextStageDateTime;
};

/**
 * Array defining the progression states/types for map tiles. Represents
 *   different stages like rubble, cleared, etc. The actual meaning of each
 *   index depends on game logic implementation.
 *
 * @type {number[]}
 */
export const mapTileProgress = [
  0, // x4 Rubble
  1, // x3 Rubble
  2, // x2 Rubble
  3, // x1 Rubble
  4, // Plantable Land
];

/**
 * Checks if a tile type represents any kind of rubble.
 *
 * @param {number} tileType - The numerical type of the tile to check.
 * @returns {boolean} True if the tile type is considered rubble (not the final
 *   'plantable' stage), false otherwise.
 */
export const isRubble = tileType =>
  tileType !== mapTileProgress.at(4);

/**
 * Checks if a tile is designated as a 'base' tile, typically meaning it
 *   doesn't require leasing or rent.
 *
 * @param {object} tileDataProperties - The properties object associated with
 *   the tile data.
 * @returns {boolean} True if the `base` property is explicitly true, false
 *   otherwise or if properties are missing.
 */
export const isBase = tileDataProperties =>
  tileDataProperties?.base === true;

/**
 * Checks if a tile is currently suitable for planting a crop. It must not be
 *   rubble, must not already have a crop, and actions must be allowed (e.g.,
 *   rent paid if leased). Does not check if the player has the required item.
 *
 * @param {object} tile - The tile data object, including type and properties.
 * @returns {boolean} True if the tile is plantable based on its state, false
 *   otherwise.
 */
export const isPlantable = tile =>
  !isRubble(tile?.type) &&
  (tile?.cropType === null ||
    !Object.hasOwn(tile, "cropType")) &&
  isActionAllowed(tile?.properties);

/**
 * Checks if a tile is currently in a 'leased' state. This implies it's not a
 *   base tile, not currently available for leasing, and has a rent schedule
 *   (nextRentDue is set). It does not check if the rent is currently paid.
 *
 * @param {object} tileDataProperties - The properties object associated with
 *   the tile data.
 * @returns {boolean} True if the tile meets the criteria for being leased,
 *   false otherwise.
 */
export const isLeashed = tileDataProperties =>
  tileDataProperties?.base === false &&
  tileDataProperties?.leasable === false &&
  Object.hasOwn(tileDataProperties, "nextRentDue") &&
  tileDataProperties?.nextRentDue !== null;

/**
 * Checks if the rent for a currently leased tile is considered paid up. A
 *   tile's rent is paid if it's leased and its next rent due date is in the
 *   future.
 *
 * @param {object} tileDataProperties - The properties object associated with
 *   the tile data.
 * @returns {boolean} True if the tile is leased and the rent is paid (due
 *   date is in the future), false otherwise.
 */
export const isRentPaid = tileDataProperties => {
  return isLeashed(tileDataProperties) &&
    new Date(tileDataProperties?.nextRentDue) >= Date.now();
};

/**
 * Checks if rent can be paid for a tile that is already leased. This is true
 *   only if the tile is leased and the `nextRentDue` date has passed (is in
 *   the past).
 *
 * @param {object} tileDataProperties - The properties object associated with
 *   the tile data.
 * @returns {boolean} True if the tile is leased and rent payment is currently
 *   due, false otherwise.
 */
export const canPayRent = tileDataProperties => {
  return isLeashed(tileDataProperties) &&
    new Date(tileDataProperties?.nextRentDue) < Date.now();
};

/**
 * Checks if rent can be paid for a specific tile object. This is a convenience
 *   wrapper around `canPayRent` that extracts the properties.
 *
 * @param {object} tile - The tile data object containing properties.
 * @returns {boolean} True if rent can be paid for this tile, false otherwise.
 */
export const canPayRentTile = tile =>
  canPayRent(tile?.properties);

/**
 * Checks if actions (like planting, harvesting, clearing) are currently
 *   allowed on a tile. Actions are permitted on base tiles or on leased tiles
 *   where the rent is currently paid up.
 *
 * @param {object} tileDataProperties - The properties object associated with
 *   the tile data.
 * @returns {boolean} True if actions are allowed based on the tile's base or
 *   lease/rent status, false otherwise.
 */
export const isActionAllowed = tileDataProperties => {
  return isBase(tileDataProperties) ||
    isRentPaid(tileDataProperties);
};

/**
 * Determines if a tile currently containing rubble can be cleared. The tile
 *   must be rubble, and actions must be allowed on it (either base or leased
 *   with rent paid).
 *
 * @param {object} tile - The tile object containing type and properties.
 * @returns {boolean} True if the tile is rubble and clearing action is
 *   allowed, false otherwise.
 */
export const canClearRubbleTile = tile => {
  // --> for debugging: Log the tile being checked
  // console.debug('[canClearRubbleTile] Checking tile', tile);
  if (!tile) return false;
  return isRubble(tile.type) &&
    isActionAllowed(tile.properties);
};

/**
 * Checks if a tile is currently available to be leased. It must not be a base
 *   tile, must be marked as 'leasable', and must not currently have an active
 *   lease (nextRentDue should be null or undefined).
 *
 * @param {object} tile - The tile data object containing properties.
 * @returns {boolean} True if the tile meets the criteria to be leased, false
 *   otherwise.
 */
export const canLeaseTile = tile =>
  // Check if tile and properties exist, if base is false, leasable is true,
  // and nextRentDue is either null or undefined (doesn't exist).
  tile?.properties?.base === false &&
  tile?.properties?.leasable === true &&
  tile?.properties?.nextRentDue == null;