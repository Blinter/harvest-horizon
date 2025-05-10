/**
 * @file Map Helper functions for the socket handlers.
 * @module server/sockets/mapHelpers
 * @description Provides helper functions for map-related socket actions,
 *   encapsulating database interactions and business logic for planting,
 *   harvesting, clearing rubble, speed growing, leasing, and paying rent on
 *   map tiles.
 */
// Required for map operations
import Map from '../models/map.js';
// Required for seed checking/deduction
import Inventory from '../models/inventory.js';
// Required for character skill level checking
import Character from '../models/character.js';
// Required for Wallet operations
import {
  getWalletByCharacterId,
  processTransaction
} from '../models/wallet.js';
// Required for checking if a tile is rubble
// Required for crop data and harvesting
import {
  isRubble,
  isActionAllowed,
  getCropGrowthTime,
  canLeaseTile,
  isPlantable,
  leaseTime,
  canPayRent,
  costToLeaseTile,
  costToRentTile,
} from '../../src/library/gameData.js';
import {
  canHarvestTile,
  canSpeedGrowTile,
} from '../../src/library/cropUtils.js';

// --- START PRIVATE HELPER FUNCTIONS --- //

/**
 * Helper: Broadcasts tile updates to the relevant map room via Socket.IO.
 * @private
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {Array<object>} updates - An array of update objects to broadcast.
 *   Each object should contain at least `x`, `y`, and `updates` properties.
 * @returns {void}
 */
function _broadcastUpdates(
  io,
  mapId,
  updates
) {
  if (!updates || updates.length === 0) return;
  const mapIdStr = mapId.toString();
  console.info(
    `[_broadcastUpdates] Broadcasting ${updates.length} updates to ` +
    `room ${mapIdStr}.`
  );
  for (const update of updates) {
    io.to(mapIdStr).emit('tileUpdate', update);
  }
}

// --- Planting Helpers ---

/**
 * Helper: Fetches the map document and filters a list of requested tile
 * coordinates, returning only those that are valid and suitable for planting
 * according to `isPlantable`.
 * @private
 * @async
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {Array<{x: number, y: number}>} requestedTiles - An array of tile
 *   coordinate objects to validate.
 * @returns {Promise<Array<{x: number, y: number, coordString: string}>>} A
 *   promise that resolves with an array of valid tile objects, each including
 *   `x`, `y`, and the `coordString` (e.g., "10,5").
 * @throws {Error} If the map document is not found in the database.
 */
async function _validateAndFilterTilesForPlanting(
  mapId,
  requestedTiles
) {
  const map = await Map.get(mapId);
  if (!map) {
    throw new Error(`Map not found: ${mapId.toString()}`);
  }
  const mapIdStr = mapId.toString();
  const validTiles = [];

  for (const tileCoords of requestedTiles) {
    const { x, y } = tileCoords || {};
    if (typeof x === 'undefined' ||
      typeof y === 'undefined' ||
      isNaN(x) ||
      isNaN(y)
    ) {
      console.warn(
        `[_validateAndFilterTilesForPlanting] Invalid coordinates skipped:`,
        tileCoords
      );
      continue;
    }

    const coordString = `${x},${y}`;
    const currentTile = map.tiles?.[coordString];

    if (!currentTile) {
      console.warn(
        `[_validateAndFilterTilesForPlanting] Tile not found at (${x},${y}) ` +
        `on map ${mapIdStr}.`
      );
      continue;
    }

    // Check to make sure tile can be planted on, push to validTiles
    if (isPlantable(currentTile)) {
      validTiles.push({ x, y, coordString });
    }
  }
  return validTiles;
}

/**
 * Helper: Executes the core planting logic. This includes fetching the
 * character's skill level for the crop, deducting the required seeds from the
 * character's inventory, and performing a bulk update operation on the Map
 * model to set the crop details on the specified tiles.
 *
 * NOTE: This operation is NOT atomic due to standalone MongoDB limitations.
 * It relies on prior checks in the calling function (`handlePlantCropBatch`)
 * to minimize inconsistency, but failure during the map update after seed
 * deduction is possible, which could lead to a state where seeds are gone
 * but the crop is not planted.
 *
 * @private
 * @async
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character planting.
 * @param {string} cropType - The type identifier of the crop being planted.
 * @param {Array<{x: number, y: number, coordString: string}>}
 *   validTilesForPlanting - An array of pre-validated tile objects where the
 *   crop will be planted.
 * @returns {Promise<Array<{x: number, y: number, updates: object}>>} A promise
 *   that resolves with an array of update objects suitable for broadcasting
 *   via `_broadcastUpdates`, or an empty array if the operation failed early
 *   (e.g., invalid skill level).
 * @throws {Error} If seed deduction via `Inventory.deductItem` fails or if the
 *   `Map.bulkUpdateTiles` operation fails. Rethrows the error after logging
 *   potential inconsistencies if the map update fails after seed deduction.
 */
async function _executePlantingOperation(
  mapId,
  characterId,
  cropType,
  validTilesForPlanting
) {
  // 1. Fetch character data to get skill

  // Use the specific skill
  const cropLevel = Math.max(1,
    await Character.getSkillLevel(
      characterId,
      cropType
    )
  );
  if (isNaN(cropLevel)) {
    console.error(`[Planting Op] Invalid crop level: ${cropLevel} ${cropType}`);
    return [];
  }

  console.debug(`[Planting Op] Crop level: ${cropLevel} ${cropType}`);

  let updatesToBroadcast = [];

  try {
    const requiredSeeds = validTilesForPlanting.length;

    // 2. Deduct Seeds (First critical operation)
    await Inventory.deductItem(
      characterId,
      'seed',
      cropType,
      requiredSeeds
    );

    const plantedAt = new Date();
    const bulkOps = [];

    for (const tile of validTilesForPlanting) {
      const updatePayload = {
        [`tiles.${tile.coordString}.cropType`]: cropType,
        [`tiles.${tile.coordString}.cropPlantedAt`]: plantedAt,
        [`tiles.${tile.coordString}.cropLevel`]: cropLevel,
      };
      bulkOps.push({
        updateOne: {
          filter: { _id: mapId },
          update: { $set: updatePayload },
        },
      });
      updatesToBroadcast.push({
        x: tile.x,
        y: tile.y,
        updates: {
          cropType: cropType,
          cropPlantedAt: plantedAt,
          cropLevel: cropLevel,
        }
      });
    }

    // 3. Update Map Tiles (Second critical operation)
    if (bulkOps.length > 0) {
      await Map.bulkUpdateTiles(bulkOps);
    }

    // 4. If both succeed, return updates for broadcasting
    return updatesToBroadcast;

  } catch (error) {
    console.error(
      `[Planting Op Error] Operation failed for char ${characterId} ` +
      `on map ${mapId.toString()}:`, error
    );
    // Log potential inconsistency if error occurred after seed deduction
    // Basic check, might need refinement based on actual error types
    if (error.message.includes('bulkWrite') ||
      error.message.includes('bulkUpdateTiles')) {
      console.error(
        `[POTENTIAL INCONSISTENCY] Seeds may have been deducted for ` +
        `char ${characterId} but map update failed.`
      );
    }
    // required array broadcast cleanup as attempt was already made to execute
    // planting
    // Ignore linter error
    updatesToBroadcast = [];

    throw error; // Re-throw error to be caught by the main handler
  }
}

// --- Harvesting Helpers ---

/**
 * Validates a single tile for the harvestCrop action and prepares operations.
 * Also returns the cropType and cropLevel if the tile is ready.
 * Checks if the tile has a crop and if it's ready for harvest.
 * Prepares the update to clear crop data and potentially change tile type.
 * @private
 * @param {object} tileCoords - The tile coordinates ({x, y}).
 * @param {object} map - The map object containing tile data.
 * @param {string} mapIdStr - The map ID string (for logging/context).
 * @returns {{
 *   bulkOp: object,
 *   updateToBroadcast: object,
 *   harvestedCrop: {cropType: string, cropLevel: number}
 * } | null} Prepared operation object containing bulkOp, updateToBroadcast,
 *   and harvestedCrop details, or null if the tile is invalid or not ready
 *   for harvest.
 */
function _prepareHarvestOp(
  tileCoords,
  map,
  mapIdStr
) {
  const {
    x,
    y
  } = tileCoords || {};
  if (typeof x === 'undefined' ||
    typeof y === 'undefined' ||
    isNaN(x) ||
    isNaN(y)
  ) {
    console.warn(
      `[_prepareHarvestOp] Invalid coordinates skipped:`, tileCoords
    );
    return null;
  }

  const coordString = `${x},${y}`;
  const currentTile = map.tiles?.[coordString];

  if (!currentTile) {
    console.warn(
      `[_prepareHarvestOp] Tile not found at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  // Check if the tile has a crop and if it's ready for harvest
  if (!canHarvestTile(currentTile)) {
    console.debug(
      `[_prepareHarvestOp] Tile (${x},${y}) not ready for harvest or has ` +
      `no crop. Skipping.`
    );
    return null;
  }

  // If valid and ready, extract crop info and prepare the update
  const { cropType, cropLevel } = currentTile;
  // Remove crop data
  const updateData = {
    cropType: null,
    cropPlantedAt: null,
    cropLevel: null,
  };

  const bulkOp = {
    updateOne: {
      filter: {
        _id: map._id,
        // Add condition to ensure we only update if the tile still has this
        // crop
        // This helps prevent race conditions if the tile state changes between
        //  fetch and update
        [`tiles.${coordString}.cropPlantedAt`]: currentTile.cropPlantedAt,
        [`tiles.${coordString}.cropType`]: currentTile.cropType,
        [`tiles.${coordString}.cropLevel`]: currentTile.cropLevel,
      },
      update: {
        $set: {
          [`tiles.${coordString}.cropType`]: null,
          [`tiles.${coordString}.cropPlantedAt`]: null,
          [`tiles.${coordString}.cropLevel`]: null,
        }
      },
    },
  };
  const updateToBroadcast = {
    x,
    y,
    updates: updateData
  };

  // Return crop info along with operations
  return {
    bulkOp,
    updateToBroadcast,
    harvestedCrop: { cropType, cropLevel }, // Add harvested crop details
  };
}

/**
 * Calculates yield, aggregates harvested items, and updates the character's
 * inventory using `Inventory.addItems`.
 * The yield calculation is simple: `yieldAmount = cropLevel`.
 * Logs errors during the inventory update process but does not throw, allowing
 * the main harvest flow to continue even if the inventory update fails.
 *
 * @private
 * @async
 * @param {string} characterId - The MongoDB ObjectId of the character whose
 *   inventory should be updated.
 * @param {Array<{cropType: string, cropLevel: number}>} harvestedData - An
 *   array of objects, each containing the `cropType` and `cropLevel` of a
 *   successfully harvested crop.
 * @param {string} timestamp - An ISO timestamp string, used for consistent
 *   logging across related operations.
 * @returns {Promise<void>} A promise that resolves once the inventory
 *   operations (attempted or skipped) are complete.
 */
async function _addHarvestedItemsToInventory(
  characterId,
  harvestedData,
  timestamp
) {
  if (!characterId ||
    !Array.isArray(harvestedData) ||
    harvestedData.length === 0
  ) {
    console.warn(
      `[${timestamp}] [_addHarvestedItemsToInventory] Invalid parameters or ` +
      `empty harvested data.`
    );
    return;
  }

  // Aggregate harvested items by type
  const itemsToAddMap = harvestedData.reduce((acc, crop) => {
    if (crop?.cropType) {
      // Simple yield: crop level = yield amount per tile harvested

      const yieldAmount = crop.cropLevel;

      // Use cropType as the itemName for the harvested item
      const itemName = crop.cropType;

      // Define the item type as 'crop'
      const itemType = 'crop';

      const key = `${itemType}_${itemName}`;
      acc[key] = acc[key] || { itemType, itemName, quantity: 0 };
      acc[key].quantity += yieldAmount;
    }
    return acc;
  }, {});

  const itemsToAddArray = Object.values(itemsToAddMap);

  if (itemsToAddArray.length > 0) {
    try {
      console.debug(
        `[${timestamp}] [_addHarvestedItemsToInventory] Adding ` +
        `harvested items to inventory for ${characterId}:`,
        itemsToAddArray
      );
      // Call the Inventory.addItems method
      await Inventory.addItems(characterId, itemsToAddArray);
      console.info(
        `[${timestamp}] [_addHarvestedItemsToInventory] Successfully added ` +
        `harvested items to inventory for ${characterId}.`
      );
    } catch (invError) {
      // Log error but don't necessarily fail the whole harvest operation
      console.error(
        `[${timestamp}] [ERROR] [_addHarvestedItemsToInventory] Failed ` +
        `to add harvested items to inventory for ${characterId}:`,
        invError
      );
      // Optionally emit a specific warning to the client?
      // io.to(mapIdStr).emit('warning', {
      //   message: 'Harvest successful, but inventory update failed.'
      // });
    }
  } else {
    console.warn(
      `[${timestamp}] [_addHarvestedItemsToInventory] No valid items ` +
      `aggregated to add to inventory.`
    );
  }
}

/**
 * Executes the MongoDB bulk write operation to update harvested tiles on the
 * map and subsequently calls `_addHarvestedItemsToInventory` to update the
 * character's inventory if the bulk write modified any documents. Handles
 * errors related to the bulk write operation and emits an error event via
 * Socket.IO if it fails.
 *
 * @private
 * @async
 * @param {string} characterId - The MongoDB ObjectId of the character.
 * @param {Array<object>} bulkOps - An array of MongoDB bulk write operation
 *   objects (specifically `updateOne` operations prepared by
 *   `_prepareHarvestOp`).
 * @param {Array<{cropType: string, cropLevel: number}>} harvestedData - An
 *   array of objects, each containing the `cropType` and `cropLevel` of a
 *   successfully harvested crop.
 * @param {string} timestamp - An ISO timestamp string for consistent logging.
 * @param {string} mapIdStr - The string representation of the map's ObjectId,
 *   used for logging and emitting errors.
 * @param {object} io - The Socket.IO server instance for emitting errors.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the bulk
 *   write operation was executed and the inventory update was attempted (note:
 *   inventory update errors don't cause a `false` return). Resolves to `false`
 *   if the `Map.bulkUpdateTiles` operation itself fails.
 */
async function _processHarvestResultsAndInventory(
  characterId,
  bulkOps,
  harvestedData,
  timestamp,
  mapIdStr,
  io
) {
  try {
    console.debug(
      `[${timestamp}] [_processHarvestResultsAndInventory] ` +
      `Executing bulkWrite for ${bulkOps.length} tiles on map ${mapIdStr}...`
    );
    const result = await Map.bulkUpdateTiles(bulkOps);
    console.debug(
      `[${timestamp}] [_processHarvestResultsAndInventory] ` +
      `bulkWrite result for map ${mapIdStr}:`, {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      deletedCount: result.deletedCount,
      writeErrors: result.hasWriteErrors() ? result.getWriteErrors().length : 0,
    }
    );

    // Add harvested items to inventory if the write modified anything
    if (result.modifiedCount > 0) {
      if (harvestedData.length > 0) {
        // Note: _addHarvestedItemsToInventory handles its own errors/logging
        await _addHarvestedItemsToInventory(
          characterId,
          harvestedData,
          timestamp
        );
      } else {
        // This case might indicate a logic issue elsewhere if tiles were modified
        // but no harvested data was collected.
        console.warn(
          `[${timestamp}] [_processHarvestResultsAndInventory] ` +
          `Harvest bulkWrite modified ${result.modifiedCount} tiles, ` +
          `but no harvested data was available for inventory update ` +
          `on map ${mapIdStr}.`
        );
      }
    }
    return true; // Indicate success
  } catch (error) {
    console.error(
      `[${timestamp}] [ERROR] [_processHarvestResultsAndInventory] ` +
      `Error during bulkWrite or inventory update on map ${mapIdStr}:`,
      error
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Batch harvest processing failed: ${error.message || 'Server error'} `,
    });
    return false; // Indicate failure
  }
}

// --- Clear Rubble Helpers ---

/**
 * Validates a single tile for the clearRubble action and prepares the database
 * operation and broadcast data.
 * Checks if the tile coordinates are valid, if the tile exists, if the action
 * is allowed based on tile properties (`isActionAllowed`), and if the tile
 * type indicates it is rubble (`isRubble`). If valid, it prepares a MongoDB
 * `updateOne` operation to increment the tile's `type` and constructs the
 * data packet for broadcasting the update.
 *
 * @private
 * @param {{x: number, y: number}} tileCoords - The coordinates of the tile
 *   to check and prepare for clearing rubble.
 * @param {object} map - The fetched Map document containing the tiles data.
 * @param {string} mapIdStr - The string representation of the map's ObjectId,
 *   used for logging context.
 * @returns {{
 *   bulkOp: object,
 *   updateToBroadcast: {x: number, y: number, updates: object}
 * } | null} An object containing the `bulkOp` for `Map.bulkUpdateTiles` and
 *   the `updateToBroadcast` object for `_broadcastUpdates`, or `null` if the
 *   tile is invalid, not found, action is not allowed, or it's not rubble.
 */
function _prepareClearRubbleOp(
  tileCoords,
  map,
  mapIdStr
) {
  const { x, y } = tileCoords || {};
  if (typeof x === 'undefined' ||
    typeof y === 'undefined' ||
    isNaN(x) ||
    isNaN(y)
  ) {
    console.warn(
      `[_prepareClearRubbleOp] Invalid coordinates skipped:`, tileCoords
    );
    return null;
  }

  const coordString = `${x},${y}`;
  const currentTile = map.tiles?.[coordString];

  if (!currentTile) {
    console.warn(
      `[_prepareClearRubbleOp] Tile not found at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  // Skip if tile action is not allowed
  if (!isActionAllowed(currentTile.properties)) {
    console.warn(
      `[_prepareClearRubbleOp] Tile action not allowed at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  // Skip if not rubble (already fully cleared)
  if (!isRubble(currentTile.type)) {
    // Already cleared, skip
    return null;
  }

  // If valid (type is 0, 1, 2, or 3), prepare the update
  const newType = currentTile.type + 1; // Increment the type
  const updateData = { type: newType };

  const bulkOp = {
    updateOne: {
      filter: { _id: map._id }, // Use map._id directly
      update: { $set: { [`tiles.${coordString}.type`]: newType } },
    },
  };
  const updateToBroadcast = { x, y, updates: updateData };

  return { bulkOp, updateToBroadcast };
}

// --- Speed Grow Helpers ---

/**
 * Helper: Fetches the character's wallet, checks if they have sufficient funds
 * for a given cost, and processes the transaction (deducts coins) using
 * `processTransaction`. Emits specific error events via Socket.IO if the
 * wallet is not found or funds are insufficient.
 *
 * @private
 * @async
 * @param {string} characterId - The MongoDB ObjectId of the character whose
 *   wallet needs checking and deduction.
 * @param {number} totalCost - The total amount of coins required for the
 *   action.
 * @param {string} actionType - A string identifying the action (e.g., 'Lease',
 *   'PayRent', 'SpeedGrow') used for logging and error message context.
 * @param {string} timestamp - An ISO timestamp string for consistent logging.
 * @param {string} mapIdStr - The string representation of the map's ObjectId,
 *   used for emitting errors to the map room.
 * @param {object} io - The Socket.IO server instance for emitting errors.
 * @returns {Promise<object|null>} A promise that resolves with the updated
 *   wallet object (containing at least `_id` and `coins`) if the transaction
 *   was successful, or `null` if the wallet was not found, funds were
 *   insufficient, or the transaction failed.
 */
async function _checkAndDeductCost(
  characterId,
  totalCost,
  actionType, // Added for logging context
  timestamp,
  mapIdStr,
  io
) {
  // Fetch the wallet using characterId first
  const wallet = await getWalletByCharacterId(characterId);

  // Check if wallet exists
  if (!wallet) {
    console.error(
      `[${timestamp}] [ERROR] [${actionType}Cost] Wallet not found for char ` +
      `${characterId}. Cannot process transaction.`
    );
    io.to(mapIdStr).emit('error', {
      message: `Wallet not found for character ${characterId}.`
    });
    return null; // Indicate failure: Wallet not found
  }

  const walletBalance = wallet.coins;
  const walletId = wallet._id; // Get the actual walletId

  if (walletBalance < totalCost) {
    console.warn(
      `[${timestamp}] [${actionType}Cost] Insufficient coins for char ` +
      `${characterId}. Required: ${totalCost}, Available: ${walletBalance}`
    );
    io.to(mapIdStr).emit(
      'server:action_failed', {
      action: actionType,
      reason:
        `Not enough coins or wallet error.`,
      context: {
        required: totalCost,
        available: walletBalance,
      },
    });
    return null; // Indicate failure
  }

  try {
    // Deduct the coins using the correct walletId
    const updatedWallet = await processTransaction(walletId, totalCost);
    console.info(
      `[${timestamp}] [${actionType}Cost] Deducted ${totalCost} coins ` +
      `from wallet ${walletId} (char ${characterId}).`
    );
    // Return the updated wallet object on success
    return updatedWallet;
  } catch (error) {
    // processTransaction throws specific errors for insufficient funds etc.
    console.error(
      `[${timestamp}] [ERROR] [${actionType}Cost] Failed to deduct ` +
      `${totalCost} coins from wallet ${walletId} ` +
      `(char ${characterId}):`, error.message
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Coin deduction failed for ` +
        `${actionType.toLowerCase()}: ` +
        `${error.message}`
    });
    // Return null on failure during transaction
    return null;
  }
}

/**
 * Helper: Validates a single tile for the speedGrow action and prepares the
 * database operation, broadcast data, and calculates the cost.
 *
 * Checks if the tile coordinates are valid, if the tile exists, if the action
 * is allowed (`isActionAllowed`), if a crop is planted and not already
 * harvestable (`canHarvestTile`), and if speed grow is permitted
 * (`canSpeedGrowTile`). If valid, it calculates the new `cropPlantedAt` time
 * by subtracting one stage's growth duration (`getCropGrowthTime`). It also
 * calculates the `speedGrowCost` based on the `cropLevel`. Finally, it
 * prepares a MongoDB `updateOne` operation to set the new `cropPlantedAt` and
 * constructs the data packet for broadcasting.
 *
 * @private
 * @param {{x: number, y: number}} tileCoords - The coordinates of the tile to
 *   check and prepare for speed growing.
 * @param {object} map - The fetched Map document containing the tiles data.
 * @param {string} mapIdStr - The string representation of the map's ObjectId,
 *   used for logging context.
 * @returns {{
 *   bulkOp: object,
 *   updateToBroadcast: {x: number, y: number, updates: object},
 *   cost: number
 * } | null} An object containing the `bulkOp`, `updateToBroadcast` object, and
 *   the calculated `cost` for this tile, or `null` if the tile is invalid,
 *   not found, or not eligible for speed grow for any reason.
 */
function _prepareSpeedGrowOp(
  tileCoords,
  map,
  mapIdStr
) {
  const { x, y } = tileCoords || {};
  if (typeof x === 'undefined' ||
    typeof y === 'undefined' ||
    isNaN(x) ||
    isNaN(y)
  ) {
    console.warn(
      `[_prepareSpeedGrowOp] Invalid coordinates skipped:`, tileCoords
    );
    return null;
  }

  const coordString = `${x},${y}`;
  const currentTile = map.tiles?.[coordString];

  if (!currentTile) {
    console.warn(
      `[_prepareSpeedGrowOp] Tile not found at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  // Skip if tile action is not allowed
  if (!isActionAllowed(currentTile.properties)) {
    console.warn(
      `[_prepareSpeedGrowOp] Tile action not allowed at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  // Skip if no crop is planted or if the crop is already harvested
  if (!currentTile.cropType ||
    !currentTile.cropPlantedAt ||
    !currentTile.cropLevel) {
    return null;
  }

  // Skip if the crop is already ready for harvest (no need to speed grow)
  if (canHarvestTile(currentTile)) {
    return null;
  }

  // Skip if not allowed to speed grow (using the utility function)
  if (!canSpeedGrowTile(currentTile)) {
    return null;
  }

  // Get the growth time for one stage for this crop type and level
  const growthTimeForOneStage = getCropGrowthTime(
    currentTile.cropType,
    currentTile.cropLevel
  );

  if (!growthTimeForOneStage) {
    console.warn(
      `[_prepareSpeedGrowOp] Couldn't determine growth time for ` +
      `${currentTile.cropType} level ${currentTile.cropLevel}`
    );
    return null;
  }

  // Calculate new plantedAt time by moving it back by one stage duration
  const currentPlantedAt = new Date(currentTile.cropPlantedAt);
  const newPlantedAt = new Date(currentPlantedAt.getTime() - growthTimeForOneStage);

  // Calculate cost based on crop level (example: cost = cropLevel)
  // Trade coins for speed grow
  const speedGrowCost = Math.floor(currentTile.cropLevel * 1.345);

  // Prepare the update operation
  const updateData = { cropPlantedAt: newPlantedAt };

  const bulkOp = {
    updateOne: {
      filter: { _id: map._id },
      update: {
        $set: {
          [`tiles.${coordString}.cropPlantedAt`]: newPlantedAt
        }
      },
    },
  };
  const updateToBroadcast = { x, y, updates: updateData };

  // Return the operation details, including the cost for later deduction
  return { bulkOp, updateToBroadcast, cost: speedGrowCost };
}

// Add this helper function before _executeCostedBatchOperation
/**
 * Helper: Emits wallet update to the requesting client
 * @private
 * @param {object} socket - The client socket
 * @param {object} updatedWallet - The wallet after update
 * @param {object} context - The operation context
 */
function _emitWalletUpdate(socket, updatedWallet, context) {
  const { timestamp, mapIdStr, characterId } = context;

  if (!socket) {
    console.warn(
      `[${timestamp}] [WARN] Socket object missing. Cannot emit walletUpdate.`
    );
    return;
  }

  console.debug(
    `[${timestamp}] Emitting 'server:walletUpdate' to socket ${socket.id} ` +
    `with new balance: ${updatedWallet.coins}`
  );

  socket.emit('server:walletUpdate', {
    mapIdStr,
    characterId,
    coins: updatedWallet.coins
  });
}

// Modify the main function
async function _executeCostedBatchOperation(
  bulkOps,
  updatesToBroadcast,
  characterId,
  totalCost,
  costDeductionFn,
  context
) {
  const { timestamp, mapIdStr, io, socket, actionType } = context;
  let walletDeducted = false;

  try {
    // Use the provided cost deduction function
    const updatedWallet = await costDeductionFn(
      characterId, totalCost, actionType, timestamp, mapIdStr, io
    );

    // If cost check/deduction failed, stop processing
    if (!updatedWallet) {
      if (socket) {
        socket.emit('server:action_failed', {
          action: actionType,
          reason: `Not enough coins or wallet error.`,
          context: { required: totalCost },
        });
      }
      return;
    }

    walletDeducted = true;

    // Proceed with bulk write operation
    console.debug(
      `[${timestamp}] Executing bulkWrite for ${bulkOps.length} ${actionType} ` +
      `tiles on map ${mapIdStr}...`
    );

    const result = await Map.bulkUpdateTiles(bulkOps);
    console.debug(`[${timestamp}] bulkWrite result for map ${mapIdStr}:`, {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      deletedCount: result.deletedCount,
      writeErrors: result.hasWriteErrors() ? result.getWriteErrors().length : 0,
    });

    // Broadcast updates and emit wallet update
    _broadcastUpdates(io, mapIdStr, updatesToBroadcast);
    _emitWalletUpdate(socket, updatedWallet, context);

    console.info(
      `[${timestamp}] Batch ${actionType} processed ${updatesToBroadcast.length} ` +
      `tiles on map ${mapIdStr} by ${characterId}. Total cost: ${totalCost}`
    );
  } catch (error) {
    _handleOperationError(error, walletDeducted, context);
  }
}

/**
 * Helper: Handles operation errors and emits appropriate messages
 * @private
 * @param {Error} error - The error that occurred
 * @param {boolean} walletDeducted - Whether wallet was already deducted
 * @param {object} context - The operation context
 */
function _handleOperationError(error, walletDeducted, context) {
  const { timestamp, mapIdStr, characterId, totalCost, actionType, io } = context;

  console.error(
    `[${timestamp}] [ERROR] Error during ${actionType} on map ${mapIdStr}:`,
    error
  );

  if (walletDeducted) {
    console.error(
      `[POTENTIAL INCONSISTENCY] Coins (${totalCost}) were deducted for ` +
      `char ${characterId} for ${actionType} but map update failed.`
    );
  }

  // Only emit error if not already handled by cost deduction
  if (!error.message.includes('Coin deduction failed')) {
    io.to(mapIdStr).emit('error', {
      message: `Batch ${actionType.toLowerCase()} failed${walletDeducted ?
        ' AFTER cost deduction' : ''}: ${error.message || 'Server error'}`,
    });
  }
}

// --- Lease Tile Helpers ---

/**
 * Helper: Validates a single tile for the leaseTile action and prepares the
 * database operation, broadcast data, and calculates the cost.
 *
 * Checks if the tile coordinates are valid, if the tile exists, and if it's
 * currently leasable and not a base tile (`canLeaseTile`). If valid, it
 * calculates the `nextLeaseDue` date based on the current time and
 * `leaseTime`. It uses the imported `costToLeaseTile` as the cost. It then
 * prepares a MongoDB `updateOne` operation to set `properties.leasable` to
 * `false` and update `properties.nextRentDue`, ensuring via the filter that
 * the tile is still leasable to prevent race conditions. Finally, it
 * constructs the data packet for broadcasting the property updates.
 *
 * @private
 * @param {{x: number, y: number}} tileCoords - The coordinates of the tile
 *   to check and prepare for leasing.
 * @param {object} map - The fetched Map document containing the tiles data.
 * @param {string} mapIdStr - The string representation of the map's
 *   ObjectId, used for logging context.
 * @returns {{
 *   bulkOp: object,
 *   updateToBroadcast: {x: number, y: number, updates: object},
 *   cost: number
 * } | null} An object containing the `bulkOp`, `updateToBroadcast` object,
 *   and the `cost` for leasing this tile, or `null` if the tile is
 *   invalid, not found, or not eligible for leasing.
 */
function _prepareLeaseTileOp(
  tileCoords,
  map,
  mapIdStr,
) {
  const { x, y } = tileCoords || {};
  if (typeof x === 'undefined' ||
    typeof y === 'undefined' ||
    isNaN(x) ||
    isNaN(y)
  ) {
    console.warn(
      `[_prepareLeaseTileOp] Invalid coordinates skipped:`, tileCoords
    );
    return null;
  }

  const coordString = `${x},${y}`;
  const currentTile = map.tiles?.[coordString];

  if (!currentTile) {
    console.warn(
      `[_prepareLeaseTileOp] Tile not found at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  if (!canLeaseTile(currentTile)) {
    console.warn(
      `[_prepareLeaseTileOp] Tile action not allowed at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  const leasedAt = new Date();
  // Add lease time in minutes to current time.
  const nextLeaseDue = new Date(leasedAt.getTime() + leaseTime);
  // Use imported cost
  const cost = costToLeaseTile;

  const updateData = {
    properties: {
      leasable: false,
      nextRentDue: nextLeaseDue,
    }
  };

  const bulkOp = {
    updateOne: {
      filter: {
        _id: map._id,
        // Ensure it's still unowned
        [`tiles.${coordString}.properties.leasable`]: true,
        [`tiles.${coordString}.properties.base`]: false,
      },
      update: {
        $set: {
          [`tiles.${coordString}.properties.leasable`]: false,
          [`tiles.${coordString}.properties.nextRentDue`]: nextLeaseDue,
        }
      },
    },
  };
  const updateToBroadcast = { x, y, updates: updateData };

  return { bulkOp, updateToBroadcast, cost };
}

/**
 * Helper: Validates a single tile for the payRent action and prepares the
 * database operation, broadcast data, and calculates the cost.
 *
 * Checks if the tile coordinates are valid, if the tile exists, and if rent
 * can currently be paid on it (`canPayRent`). If valid, it calculates the new
 * `nextRentDue` date based on the current time and `leaseTime`. It uses the
 * imported `costToRentTile` as the cost. It then prepares a MongoDB
 * `updateOne` operation to update `properties.nextRentDue`, ensuring via the
 * filter that the tile is still marked as not leasable (i.e., it's currently
 * leased). Finally, it constructs the data packet for broadcasting the
 * property update.
 *
 * @private
 * @param {{x: number, y: number}} tileCoords - The coordinates of the tile
 *   to check and prepare for paying rent.
 * @param {object} map - The fetched Map document containing the tiles data.
 * @param {string} mapIdStr - The string representation of the map's
 *   ObjectId, used for logging context.
 * @returns {{
 *   bulkOp: object,
 *   updateToBroadcast: {x: number, y: number, updates: object},
 *   cost: number
 * } | null} An object containing the `bulkOp`, `updateToBroadcast` object,
 *   and the `cost` for paying rent on this tile, or `null` if the tile is
 *   invalid, not found, or not eligible for rent payment.
 */
function _preparePayRentOp(
  tileCoords,
  map,
  mapIdStr,
) {
  const { x, y } = tileCoords || {};
  if (typeof x === 'undefined' ||
    typeof y === 'undefined' ||
    isNaN(x) ||
    isNaN(y)
  ) {
    console.warn(
      `[_preparePayRentOp] Invalid coordinates skipped:`, tileCoords
    );
    return null;
  }

  const coordString = `${x},${y}`;
  const currentTile = map.tiles?.[coordString];

  if (!currentTile) {
    console.warn(
      `[_preparePayRentOp] Tile not found at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  if (!canPayRent(currentTile.properties)) {
    console.warn(
      `[_preparePayRentOp] Tile action not allowed at (${x},${y}) on map ` +
      `${mapIdStr}. Skipping.`
    );
    return null;
  }

  const paidRentAt = new Date();
  // Add lease time in minutes to current time.
  const nextRentDue = new Date(paidRentAt.getTime() + leaseTime);
  // Use imported cost
  const cost = costToRentTile;

  const updateData = {
    properties: {
      nextRentDue,
    }
  };

  const bulkOp = {
    updateOne: {
      filter: {
        _id: map._id,
        // Ensure it's still leased
        [`tiles.${coordString}.properties.leasable`]: false,
      },
      update: {
        $set: {
          [`tiles.${coordString}.properties.nextRentDue`]: nextRentDue,
        }
      },
    },
  };
  const updateToBroadcast = { x, y, updates: updateData };

  return { bulkOp, updateToBroadcast, cost };
}

// --- END PRIVATE HELPER FUNCTIONS --- //


// --- START EXPORTED ACTION HANDLERS --- //

/**
 * Handles the request to plant a specific crop type on a batch of tiles.
 *
 * Workflow:
 * 1. Validates the input `actionData` (presence of `tiles` array and
 *    `cropType`).
 * 2. Fetches the map and filters the requested tiles to get valid plantable
 *    locations using `_validateAndFilterTilesForPlanting`.
 * 3. Checks if the character has enough seeds of the specified `cropType`
 *    using `Inventory.hasEnoughSeeds`. Emits `server:action_failed` if not.
 * 4. Executes the planting operation (deduct seeds, update map tiles) using
 *    `_executePlantingOperation`. This step is not atomic.
 * 5. If planting is successful, broadcasts the tile updates using
 *    `_broadcastUpdates`.
 * 6. Catches and logs errors from any step, emitting a generic 'error'
 *    event to the map room.
 *
 * @public
 * @async
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character
 *   performing the action.
 * @param {{
 *   tiles: Array<{x: number, y: number}>,
 *   cropType: string
 * }} actionData - Object containing:
 *   - `tiles`: An array of coordinates `{x, y}` where planting is
 *     requested.
 *   - `cropType`: The string identifier for the crop to plant.
 * @returns {Promise<void>} Resolves after the batch planting attempt is
 *   completed and relevant events (updates or errors) have been emitted.
 */
export async function handlePlantCropBatch(
  io,
  mapId,
  characterId,
  actionData
) {
  const { tiles: requestedTiles, cropType } = actionData || {};
  const timestamp = new Date().toISOString();
  const mapIdStr = mapId.toString();

  // 1. Basic Input Validation
  if (!Array.isArray(requestedTiles) || requestedTiles.length === 0 || !cropType || typeof cropType !== 'string') {
    console.warn(
      `[${timestamp}] [PlantBatch] Invalid input data for map ${mapIdStr}.`
    );
    io.to(mapIdStr).emit('error', {
      message: 'Invalid planting request data.'
    });
    return;
  }

  try {
    // 2. Validate and Filter Tiles
    const validTilesForPlanting = await _validateAndFilterTilesForPlanting(
      mapId,
      requestedTiles
    );
    if (validTilesForPlanting.length === 0) {
      console.info(
        `[${timestamp}] [PlantBatch] No valid tiles for planting on map ` +
        `${mapIdStr}.`
      );
      // No eligible tiles, operation successful in a way, but nothing done
      return;
    }

    // 3. Check Seed Availability
    const requiredSeeds = validTilesForPlanting.length;
    const seedCheck = await Inventory.hasEnoughSeeds(
      characterId,
      cropType,
      requiredSeeds
    );

    if (!seedCheck.sufficient) {
      console.warn(
        `[${timestamp}] [PlantBatch] Insufficient ${cropType} seeds for char` +
        ` ${characterId}. Required: ${requiredSeeds}, Available: ` +
        `${seedCheck.available}`
      );

      // Emit the action failed event for inventory
      io.to(mapIdStr).emit('server:action_failed', {
        action: 'PlantCrop',
        reason:
          `Not enough seeds`,
        context: {
          required: requiredSeeds,
          available: seedCheck.available,
        },
      });
      return;
    }

    // 4. Execute Planting Operations (No Transaction)
    const updatesToBroadcast = await _executePlantingOperation(
      mapId,
      characterId,
      cropType,
      validTilesForPlanting
    );

    // 5. Broadcast Updates if Operations Succeeded
    if (updatesToBroadcast && updatesToBroadcast.length > 0) {
      _broadcastUpdates(io, mapId, updatesToBroadcast);
      console.info(
        `[${timestamp}] [PlantBatch] Successfully planted ` +
        `${updatesToBroadcast.length} ${cropType} on map ${mapIdStr} ` +
        `for char ${characterId}.`
      );
    } else if (updatesToBroadcast) { // If it returns an empty array (shouldn't happen now, but safe check)
      console.info(
        `[${timestamp}] [PlantBatch] Planting operation completed but ` +
        `yielded no updates for map ${mapIdStr}.`
      );
    } else { // If it was null/undefined (error occurred and was caught)
      // Error during operation, already logged inside helper
      console.warn(
        `[${timestamp}] [PlantBatch] Planting operation failed ` +
        `for map ${mapIdStr}. See previous error log for details.`
      );
      // Error message already emitted by the catch block in the main try/catch
    }

  } catch (error) {
    // Catch errors from filtering, seed check, or the operation itself
    console.error(
      `[${timestamp}] [ERROR] [PlantBatch] ` +
      `Failed for map ${mapIdStr}: ${error.message}`
    );

    // Ensure an error message is sent back to the client
    io.to(mapIdStr).emit('error', {
      message: `Planting failed: ${error.message || 'Server error'}`
    });
  }
}

/**
 * Handles the request to clear rubble from a batch of tiles.
 *
 * Workflow:
 * 1. Validates the input `actionData` (presence of `tiles` array).
 * 2. Fetches the map document using `Map.get`. Handles map not found
 *    errors.
 * 3. Iterates through the requested `tiles`, preparing a clear rubble
 *    operation for each valid tile using `_prepareClearRubbleOp`. This
 *    checks if the tile exists, is rubble, and allows the action.
 * 4. If any valid operations were prepared, executes them using a single
 *    `Map.bulkUpdateTiles` call.
 * 5. Broadcasts the successful tile updates using `_broadcastUpdates`.
 * 6. Catches and logs errors during map fetch or bulk update, emitting a
 *    generic 'error' event to the map room.
 *
 * @public
 * @async
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character
 *   performing the action (used for logging context).
 * @param {{tiles: Array<{x: number, y: number}>}} actionData - Object
 *   containing `tiles`: An array of coordinates `{x, y}` where clearing
 *   rubble is requested.
 * @returns {Promise<void>} Resolves after the batch clear rubble attempt is
 *   completed and relevant events (updates or errors) have been emitted.
 */
export async function handleClearRubbleBatch(
  io,
  mapId,
  characterId,
  actionData
) {
  const timestamp = new Date().toISOString();
  if (!Array.isArray(actionData?.tiles) || actionData.tiles.length === 0) {
    console.warn(`[${timestamp}] [handleClearRubbleBatch] No tiles provided.`);
    // Consider emitting an error if this is an invalid state
    // io.to(mapId.toString()).emit('error', { message: 'No tiles provided.' });
    return;
  }

  const mapIdStr = mapId.toString();
  const bulkOps = [];
  const updatesToBroadcast = [];

  let map;
  try {
    map = await Map.get(mapId);
    if (!map) {
      console.warn(
        `[${timestamp}] [handleClearRubbleBatch] Map not found: ${mapIdStr}`
      );
      io.to(mapIdStr).emit(
        'error', { message: `Map not found: ${mapIdStr}` }
      );
      return;
    }
  } catch (mapError) {
    console.error(
      `[${timestamp}] [ERROR] [handleClearRubbleBatch] ` +
      `Error fetching map ${mapIdStr}:`,
      mapError
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Error retrieving map data: ${mapError.message || 'Server error'}`,
    });
    return;
  }


  for (const tileCoords of actionData.tiles) {
    const preparedOp = _prepareClearRubbleOp(tileCoords, map, mapIdStr);
    if (preparedOp) {
      bulkOps.push(preparedOp.bulkOp);
      updatesToBroadcast.push(preparedOp.updateToBroadcast);
    }
  }

  // Execute bulk write if there are operations
  if (bulkOps.length > 0) {
    try {
      console.debug(
        `[${timestamp}] [handleClearRubbleBatch] Executing bulkWrite for ` +
        `${bulkOps.length} tiles on map ${mapIdStr}...`
      );
      // Use the static method from the Map model
      const result = await Map.bulkUpdateTiles(bulkOps);

      // Log the result details received from the model method
      console.debug(
        `[${timestamp}] [handleClearRubbleBatch] bulkWrite result for map ` +
        `${mapIdStr}:`,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
          deletedCount: result.deletedCount,
          writeErrors: result.hasWriteErrors()
            ? result.getWriteErrors().length : 0,
        }
      );

      // Placeholder: Deduct cost
      // const successfulOps = result.modifiedCount;
      // await deductCost(characterId, Costs.CLEAR_TILE * successfulOps);

      // Broadcast individual updates
      _broadcastUpdates(io, mapId, updatesToBroadcast);

      console.info(
        `[${timestamp}] [INFO] Batch clearRubble processed ` +
        `${updatesToBroadcast.length} tiles on map ${mapIdStr} by ` +
        `${characterId}`
      );
    } catch (error) {
      console.error(
        `[${timestamp}] [ERROR] Error during bulkWrite ` +
        `for clearRubble on map ${mapIdStr}:`,
        error
      );
      // Emit a general error for the batch
      io.to(mapIdStr).emit('error', {
        message:
          `Batch clear rubble failed: ${error.message || 'Database error'}`,
      });
    }
  } else {
    console.info(
      `[${timestamp}] [INFO] No eligible tiles for clear rubble on map ` +
      `${mapIdStr} for char ${characterId}.`
    );
  }
}


/**
 * Handles the request to harvest crops from a batch of tiles.
 *
 * Workflow:
 * 1. Validates the input `actionData` (presence of `tiles` array).
 * 2. Fetches the map document using `Map.get`. Handles map not found
 *    errors.
 * 3. Iterates through requested `tiles`, preparing harvest operations using
 *    `_prepareHarvestOp`. This checks if a crop exists and is ready. It also
 *    collects data (`cropType`, `cropLevel`) for harvested crops.
 * 4. If valid operations exist, processes them using
 *    `_processHarvestResultsAndInventory`. This function executes the bulk map
 *    update and then updates the character's inventory. It handles errors
 *    internally.
 * 5. If processing was successful (bulk write succeeded), broadcasts the
 *    tile updates using `_broadcastUpdates`.
 * 6. Catches and logs errors during the initial map fetch, emitting a
 *    generic 'error' event. Errors during processing/inventory are handled
 *    within `_processHarvestResultsAndInventory`.
 *
 * @public
 * @async
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character
 *   performing the action.
 * @param {{tiles: Array<{x: number, y: number}>}} actionData - Object
 *   containing `tiles`: An array of coordinates `{x, y}` where harvesting
 *   is requested.
 * @returns {Promise<void>} Resolves after the batch harvest attempt is
 *   completed and relevant events (updates or errors) have been emitted.
 */
export async function handleHarvestCropBatch(
  io,
  mapId,
  characterId,
  actionData
) {
  const timestamp = new Date().toISOString();
  if (!Array.isArray(actionData?.tiles) ||
    actionData.tiles.length === 0) {
    console.warn(
      `[${timestamp}] [handleHarvestCropBatch] No tiles provided.`
    );
    // Consider emitting an error
    // io.to(mapId.toString()).emit('error', { message: 'No tiles provided.' });
    return;
  }

  const mapIdStr = mapId.toString();
  const bulkOps = [];
  const updatesToBroadcast = [];
  const harvestedData = []; // Store info for harvested crops

  let map;
  try {
    // Fetch map safely
    map = await Map.get(mapId);
    if (!map) {
      console.warn(
        `[${timestamp}] [handleHarvestCropBatch] Map not found: ` +
        `${mapIdStr}`
      );
      io.to(mapIdStr).emit(
        'error', {
        message: `Map not found: ${mapIdStr}`
      }
      );
      return;
    }
  } catch (mapError) {
    console.error(
      `[${timestamp}] [ERROR] [handleHarvestCropBatch] ` +
      `Error fetching map ${mapIdStr}:`,
      mapError
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Error retrieving map data: ${mapError.message || 'Server error'} `,
    });
    return;
  }

  // Prepare operations and collect harvested data
  for (const tileCoords of actionData.tiles) {
    const preparedOp = _prepareHarvestOp(tileCoords, map, mapIdStr);
    if (preparedOp) {
      bulkOps.push(preparedOp.bulkOp);
      updatesToBroadcast.push(preparedOp.updateToBroadcast);
      harvestedData.push(preparedOp.harvestedCrop);
    }
  }

  // Execute bulk write and inventory update if there are operations
  if (bulkOps.length > 0) {
    const processingSuccessful = await _processHarvestResultsAndInventory(
      characterId,
      bulkOps,
      harvestedData,
      timestamp,
      mapIdStr,
      io
    );

    // Only broadcast if the processing (including bulk write) was successful
    if (processingSuccessful) {
      _broadcastUpdates(io, mapId, updatesToBroadcast);
      console.info(
        `[${timestamp}] [INFO] Batch harvestCrop processed ` +
        `${updatesToBroadcast.length} tiles on map ` +
        `${mapIdStr} by ${characterId}`
      );
    }
    // If processing failed, error was already logged and emitted by the helper

  } else {
    console.info(
      `[${timestamp}] [INFO] No eligible tiles for harvest on map ` +
      `${mapIdStr} for char ${characterId}.`
    );
  }
}

/**
 * Handles the request to apply speed grow to crops on a batch of tiles.
 *
 * Workflow:
 * 1. Validates the input `actionData` (presence of `tiles` array).
 * 2. Fetches the map document using `Map.get`. Handles map not found
 *    errors.
 * 3. Iterates through requested `tiles`, preparing speed grow operations
 *    using `_prepareSpeedGrowOp`. This checks eligibility (planted, not
 *    ready, etc.) and calculates the cost for each tile.
 * 4. Aggregates the total cost for all eligible tiles.
 * 5. If valid operations exist, executes the costed batch operation using
 *    `_executeCostedBatchOperation`. This function handles:
 *    - Checking wallet balance and deducting `totalCost` via
 *      `_checkAndDeductCost`.
 *    - Executing the bulk map update (`Map.bulkUpdateTiles`) to adjust
 *      `cropPlantedAt`.
 *    - Broadcasting tile updates (`_broadcastUpdates`).
 *    - Emitting a direct wallet update (`server:walletUpdate`) to the
 *      requesting client's `socket`.
 *    - Handling errors during cost deduction or map update.
 * 6. Catches and logs errors during the initial map fetch, emitting a
 *    generic 'error' event. Errors during the costed operation are handled
 *    within `_executeCostedBatchOperation`.
 *
 * @public
 * @async
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character
 *   performing the action.
 * @param {{tiles: Array<{x: number, y: number}>}} actionData - Object
 *   containing `tiles`: An array of coordinates `{x, y}` where speed grow
 *   is requested.
 * @param {object} socket - The specific client Socket.IO instance that
 *   initiated the request, used for direct feedback (e.g., wallet
 *   updates).
 * @returns {Promise<void>} Resolves after the batch speed grow attempt is
 *   completed and relevant events have been emitted.
 */
export async function handleSpeedGrowBatch(
  io,
  mapId,
  characterId,
  actionData,
  socket
) {
  const timestamp = new Date().toISOString();
  if (!Array.isArray(actionData?.tiles) ||
    actionData.tiles.length === 0) {
    console.warn(
      `[${timestamp}] [handleSpeedGrowBatch] No tiles provided.`
    );
    io.to(mapId.toString()).emit('error', {
      message: 'Invalid speed grow request data.'
    });
    return;
  }

  const mapIdStr = mapId.toString();
  let map;
  try {
    // Fetch map safely
    map = await Map.get(mapId);
    if (!map) {
      console.warn(
        `[${timestamp}] [handleSpeedGrowBatch] Map not found: ` +
        `${mapIdStr}`
      );
      io.to(mapIdStr).emit('error', {
        message: `Map not found: ${mapIdStr}`
      });
      return;
    }
  } catch (mapError) {
    console.error(
      `[${timestamp}] [ERROR] [handleSpeedGrowBatch] ` +
      `Error fetching map ${mapIdStr}:`,
      mapError
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Error retrieving map data: ${mapError.message || 'Server error'}`,
    });
    return;
  }

  const bulkOps = [];
  const updatesToBroadcast = [];
  let totalCost = 0;

  // Prepare operations for each eligible tile
  for (const tileCoords of actionData.tiles) {
    const preparedOp = _prepareSpeedGrowOp(tileCoords, map, mapIdStr);
    if (preparedOp) {
      bulkOps.push(preparedOp.bulkOp);
      updatesToBroadcast.push(preparedOp.updateToBroadcast);
      totalCost += preparedOp.cost;
    }
  }

  // Execute or log if no operations
  if (bulkOps.length > 0) {
    await _executeCostedBatchOperation(
      bulkOps,
      updatesToBroadcast,
      characterId,
      totalCost,
      _checkAndDeductCost, // Use the unified cost function
      {
        timestamp,
        mapIdStr,
        io,
        socket,
        actionType: 'SpeedGrow' // Specify action type
      }
    );
  } else {
    console.info(
      `[${timestamp}] [INFO] No eligible tiles for speed grow on map ` +
      `${mapIdStr} for char ${characterId}.`
    );
  }
}

/**
 * Handles the request to lease a batch of currently unowned tiles.
 *
 * Workflow:
 * 1. Validates the input `actionData` (presence of `tiles` array).
 * 2. Fetches the map document using `Map.get`. Handles map not found
 *    errors.
 * 3. Iterates through requested `tiles`, preparing lease operations using
 *    `_prepareLeaseTileOp`. This checks eligibility (leasable, not base)
 *    and calculates the cost (`costToLeaseTile`) for each.
 * 4. Aggregates the total cost for all eligible tiles.
 * 5. If valid operations exist, executes the costed batch operation using
 *    `_executeCostedBatchOperation`. This function handles:
 *    - Checking wallet balance and deducting `totalCost` via
 *      `_checkAndDeductCost`.
 *    - Executing the bulk map update (`Map.bulkUpdateTiles`) to set
 *      `properties.leasable = false` and `properties.nextRentDue`.
 *    - Broadcasting tile updates (`_broadcastUpdates`).
 *    - Emitting a direct wallet update (`server:walletUpdate`) to the
 *      requesting client's `socket`.
 *    - Handling errors during cost deduction or map update.
 * 6. Catches and logs errors during the initial map fetch, emitting a
 *    generic 'error' event. Errors during the costed operation are handled
 *    within `_executeCostedBatchOperation`.
 *
 * @public
 * @async
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character
 *   performing the action.
 * @param {{tiles: Array<{x: number, y: number}>}} actionData - Object
 *   containing `tiles`: An array of coordinates `{x, y}` where leasing is
 *   requested.
 * @param {object} socket - The specific client Socket.IO instance that
 *   initiated the request, used for direct feedback.
 * @returns {Promise<void>} Resolves after the batch lease attempt is
 *   completed and relevant events have been emitted.
 */
export async function handleLeaseTileBatch(
  io,
  mapId,
  characterId,
  actionData,
  socket
) {
  const timestamp = new Date().toISOString();
  if (!Array.isArray(actionData?.tiles) ||
    actionData.tiles.length === 0) {
    console.warn(
      `[${timestamp}] [handleLeaseTileBatch] No tiles provided.`
    );
    // Emit specific error to the client for bad input
    if (socket) {
      socket.emit('error', { message: 'Invalid lease tile request data.' });
    }
    return;
  }

  const mapIdStr = mapId.toString();
  let map;
  try {
    // Fetch map safely
    map = await Map.get(mapId);
    if (!map) {
      console.warn(
        `[${timestamp}] [handleLeaseTileBatch] Map not found: ` +
        `${mapIdStr}`
      );
      io.to(mapIdStr).emit('error', {
        message: `Map not found: ${mapIdStr}`
      });
      return;
    }
  } catch (mapError) {
    console.error(
      `[${timestamp}] [ERROR] [handleLeaseTileBatch] ` +
      `Error fetching map ${mapIdStr}:`,
      mapError
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Error retrieving map data: ${mapError.message || 'Server error'}`,
    });
    return;
  }

  const bulkOps = [];
  const updatesToBroadcast = [];
  let totalCost = 0;

  // Prepare operations for each eligible tile
  for (const tileCoords of actionData.tiles) {
    // Pass characterId to _prepareLeaseTileOp
    const preparedOp = _prepareLeaseTileOp(
      tileCoords,
      map,
      mapIdStr,
    );
    if (preparedOp) {
      bulkOps.push(preparedOp.bulkOp);
      updatesToBroadcast.push(preparedOp.updateToBroadcast);
      totalCost += preparedOp.cost;
    }
  }

  // Execute or log if no operations
  if (bulkOps.length > 0) {
    await _executeCostedBatchOperation(
      bulkOps,
      updatesToBroadcast,
      characterId,
      totalCost,
      _checkAndDeductCost, // Use the unified cost function
      {
        timestamp,
        mapIdStr,
        io,
        socket,
        actionType: 'Lease' // Specify action type
      }
    );
  } else {
    console.info(
      `[${timestamp}] [INFO] No eligible tiles for lease tile on map ` +
      `${mapIdStr} for char ${characterId}.`
    );
    // Optionally notify the user if no tiles were eligible
    if (socket) {
      socket.emit('info', { message: 'No eligible tiles found to lease.' });
    }
  }
}

/**
 * Handles the request to pay rent for a batch of currently leased tiles.
 *
 * Workflow:
 * 1. Validates the input `actionData` (presence of `tiles` array).
 * 2. Fetches the map document using `Map.get`. Handles map not found
 *    errors.
 * 3. Iterates through requested `tiles`, preparing rent payment operations
 *    using `_preparePayRentOp`. This checks eligibility (`canPayRent`) and
 *    calculates the cost (`costToRentTile`) for each.
 * 4. Aggregates the total cost for all eligible tiles.
 * 5. If valid operations exist, executes the costed batch operation using
 *    `_executeCostedBatchOperation`. This function handles:
 *    - Checking wallet balance and deducting `totalCost` via
 *      `_checkAndDeductCost`.
 *    - Executing the bulk map update (`Map.bulkUpdateTiles`) to update
 *      `properties.nextRentDue`.
 *    - Broadcasting tile updates (`_broadcastUpdates`).
 *    - Emitting a direct wallet update (`server:walletUpdate`) to the
 *      requesting client's `socket`.
 *    - Handling errors during cost deduction or map update.
 * 6. Catches and logs errors during the initial map fetch, emitting a
 *    generic 'error' event. Errors during the costed operation are handled
 *    within `_executeCostedBatchOperation`.
 *
 * @public
 * @async
 * @param {object} io - The Socket.IO server instance.
 * @param {string} mapId - The MongoDB ObjectId of the map.
 * @param {string} characterId - The MongoDB ObjectId of the character
 *   performing the action.
 * @param {{tiles: Array<{x: number, y: number}>}} actionData - Object
 *   containing `tiles`: An array of coordinates `{x, y}` where paying rent
 *   is requested.
 * @param {object} socket - The specific client Socket.IO instance that
 *   initiated the request, used for direct feedback.
 * @returns {Promise<void>} Resolves after the batch pay rent attempt is
 *   completed and relevant events have been emitted.
 */
export async function handlePayRentBatch(
  io,
  mapId,
  characterId,
  actionData,
  socket
) {
  const timestamp = new Date().toISOString();
  if (!Array.isArray(actionData?.tiles) ||
    actionData.tiles.length === 0) {
    console.warn(
      `[${timestamp}] [handlePayRentBatch] No tiles provided.`
    );
    return;
  }

  const mapIdStr = mapId.toString();
  let map;
  try {
    // Fetch map safely
    map = await Map.get(mapId);
    if (!map) {
      console.warn(
        `[${timestamp}] [handlePayRentBatch] Map not found: ` +
        `${mapIdStr}`
      );
      io.to(mapIdStr).emit('error', {
        message: `Map not found: ${mapIdStr}`
      });
      return;
    }
  } catch (mapError) {
    console.error(
      `[${timestamp}] [ERROR] [handlePayRentBatch] ` +
      `Error fetching map ${mapIdStr}:`,
      mapError
    );
    io.to(mapIdStr).emit('error', {
      message:
        `Error retrieving map data: ${mapError.message || 'Server error'}`,
    });
    return;
  }

  const bulkOps = [];
  const updatesToBroadcast = [];
  let totalCost = 0;

  // Prepare operations for each eligible tile
  for (const tileCoords of actionData.tiles) {
    const preparedOp = _preparePayRentOp(tileCoords, map, mapIdStr);
    if (preparedOp) {
      bulkOps.push(preparedOp.bulkOp);
      updatesToBroadcast.push(preparedOp.updateToBroadcast);
      totalCost += preparedOp.cost;
    }
  }

  // Execute or log if no operations
  if (bulkOps.length > 0) {
    await _executeCostedBatchOperation(
      bulkOps,
      updatesToBroadcast,
      characterId,
      totalCost,
      _checkAndDeductCost, // Use the unified cost function
      {
        timestamp,
        mapIdStr,
        io,
        socket,
        actionType: 'PayRent' // Specify action type
      }
    );
  } else {
    console.info(
      `[${timestamp}] [INFO] No eligible tiles for pay rent on map ` +
      `${mapIdStr} for char ${characterId}.`
    );
    // Optionally notify the user if no tiles were eligible
    if (socket) {
      socket.emit('info', { message: 'No eligible tiles found to pay rent.' });
    }
  }
}

// --- End Batch Action Handlers --- //