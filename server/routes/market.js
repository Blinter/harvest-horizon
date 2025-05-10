/**
 * @file Market Routes
 * @module server/routes/market
 * @description Provides API routes for accessing market data.
 */
import express from 'express';
import Market from '../models/market.js';
import { ExpressError } from '../expressError.js';

const router = express.Router();

/**
 * GET /
 * Fetches all available items from the market.
 *
 * @name GET /api/market
 * @route {GET} /api/market
 * @function
 * @memberof module:server/routes/market
 * @inner
 * @returns {Promise<Array<object>>} A promise that resolves to an array of
 *   market item objects.
 * @throws {ExpressError} If there's an error fetching items from the
 *   database.
 */
// If authentication is required, uncomment the line below
// router.get('/', authenticateJWT, async (req, res, next) => {
router.get('/', async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString();
    console.debug(
      `[${timestamp}] [DEBUG] [MarketRoutes]: ` +
      `Fetching all market items via Market model.`
    );

    // Use the Market model to get items
    const items = await Market.getAllItems();

    const timestamp2 = new Date().toISOString();
    console.debug(
      `[${timestamp2}] [DEBUG] [MarketRoutes]: Successfully retrieved ` +
      `${items.length} items from model.`
    );

    return res.json(items);
  } catch (err) {
    // Log the error that bubbles up from the model or route
    const errorTimestamp = new Date().toISOString();
    console.error(
      `[${errorTimestamp}] [ERROR] [MarketRoutes]: Error in GET / route:`,
      err
    );
    // Pass the error to the Express error handler
    // Ensure it's an ExpressError or wrap it
    if (err instanceof ExpressError) {
      return next(err);
    } else {
      return next(
        new ExpressError(
          err.message || 'Failed to retrieve market items',
          err.status || 500
        )
      );
    }
  }
});

export default router;
