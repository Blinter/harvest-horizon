/**
 * @file Market.jsx
 * @description Modal component that implements an in-game marketplace for
 *   buying and selling items. Provides interfaces for viewing available
 *   products, filtering by category, and conducting transactions. Handles
 *   inventory management, currency updates, and transaction feedback.
 * @module components/controls/Market
 */
import {
  useReducer,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import marketService from '../../services/market.service';
import {
  purchaseItem,
  sellItem,
  getInventory,
} from '../../services/inventoryService';
import { getCharacter } from '../../services/character.service';
import {
  marketReducer,
  initialMarketState,
} from '../../state/reducers/marketReducer';
import '../../styles/market.css';
import MarketHeader from './Market/MarketHeader';
import CategoryFilter from './Market/CategoryFilter';
import ItemList from './Market/ItemList';
import StatusDisplay from './Market/StatusDisplay';

/**
 * Renders a market interface for buying and selling items.
 *
 * Fetches market items, character inventory, and currency. Manages market
 * state using a reducer. Allows switching between 'buy' and 'sell' views
 * and filtering by category. Handles item purchase and sale transactions,
 * updating character currency and inventory.
 *
 * @param {object} props - Component props.
 * @param {string} props.characterId - The ID of the character interacting
 *   with the market.
 * @param {Function} props.onClose - Callback function invoked when the
 *   market is closed.
 * @param {Function} [props.onItemPurchased] - Optional callback invoked
 *   after an item is successfully purchased.
 * @param {Function} [props.onItemSold] - Optional callback invoked after an
 *   item is successfully sold.
 * @returns {React.ReactElement} The rendered market component.
 */
const Market = ({ characterId, onClose, onItemPurchased, onItemSold }) => {
  /** @state {object} Market state managed by marketReducer */
  const [state, dispatch] = useReducer(marketReducer, initialMarketState);

  /** @state {'buy'|'sell'} Current view mode of the market */
  const [viewMode, setViewMode] = useState('buy');
  /** @state {string} Currently selected item category filter */
  const [selectedCategory, setSelectedCategory] = useState('all');
  /** @state {string[]} List of available item categories */
  const [categories, setCategories] = useState(['all']);
  /** @state {object[]} List of items currently in the character's inventory */
  const [inventory, setInventory] = useState([]);
  /** @state {boolean} Loading state for character inventory */
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Destructure relevant state properties
  const { items, loading, error, currency, purchaseStatus, sellStatus } = state;

  // Memoized calculation for items displayed in 'buy' view
  const buyItemsFiltered = useMemo(() => {
    if (viewMode !== 'buy') return [];
    if (selectedCategory === 'all') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [viewMode, selectedCategory, items]);

  // Memoized calculation for items displayed in 'sell' view
  const filteredSellItems = useMemo(() => {
    if (viewMode !== 'sell') return [];
    if (selectedCategory === 'all') return inventory;
    return inventory.filter((item) => item.category === selectedCategory);
  }, [viewMode, selectedCategory, inventory]);

  // Effect to load initial market data and character currency
  useEffect(() => {
    /**
     * Loads initial market items and character currency. Fetches data from
     * market and character services, updates state via dispatch, and sets
     * up item categories. Logs errors if fetches fail.
     */
    const loadMarketData = async () => {
      try {
        dispatch({ type: 'FETCH_MARKET_START' });
        const marketItems = await marketService.getMarketItems();
        dispatch({
          type: 'FETCH_MARKET_SUCCESS',
          payload: marketItems,
        });
        const uniqueCategories = [
          ...new Set(marketItems.map((item) => item.category)),
        ];
        setCategories(['all', ...uniqueCategories]);
        const character = await getCharacter(characterId);
        dispatch({
          type: 'SET_CURRENCY',
          payload: character.wallet.balance,
        });
      } catch (err) {
        dispatch({
          type: 'FETCH_MARKET_ERROR',
          payload:
            'Failed to load market data. Please try again later.',
        });
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR]: Market load error:`, err);
      }
    };

    loadMarketData();
  }, [characterId]);

  /**
   * Refreshes the character's inventory data by calling `getInventory`.
   * Sets loading state during fetch. Filters out items with zero quantity
   * or no sell price defined. Logs errors if inventory fetch fails.
   *
   * @async
   * @function refreshInventory
   * @returns {Promise<void>}
   */
  const refreshInventory = useCallback(async () => {
    try {
      setInventoryLoading(true);
      const inventoryItems = await getInventory(characterId);
      setInventory(
        inventoryItems.filter(
          (item) => item.quantity > 0 && item.sellPrice > 0
        )
      );
    } catch (err) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [ERROR]: Error loading inventory:`, err);
    } finally {
      setInventoryLoading(false);
    }
  }, [characterId]);

  /**
   * Effect hook to refresh the inventory data whenever the view mode
   * changes to 'sell'. Ensures the sell view always shows current items.
   *
   * @effect
   * @listens viewMode
   */
  useEffect(() => {
    if (viewMode === 'sell') {
      refreshInventory();
    }
  }, [viewMode, refreshInventory]);

  /**
   * Toggles the market view between 'buy' and 'sell' modes. Resets the
   * category filter to 'all' whenever the view mode changes.
   *
   * @type {Function}
   * @param {'buy'|'sell'} mode - The view mode to switch to.
   */
  const toggleViewMode = useCallback((mode) => {
    setViewMode(mode);
    setSelectedCategory('all');
  }, []);

  /**
   * Updates the selected item category filter based on user selection.
   *
   * @type {Function}
   * @param {string} category - The category to filter by.
   */
  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  /**
   * Handles the purchase of an item. Dispatches actions for purchase start,
   * success/error, and updates character currency. Calls the optional
   * `onItemPurchased` prop. Refreshes inventory if currently in 'sell'
   * view. Clears the purchase status message after a delay. Logs errors if
   * purchase fails.
   *
   * @type {Function}
   * @param {object} item - The market item to purchase.
   */
  const handlePurchase = useCallback(
    async (item) => {
      try {
        dispatch({ type: 'PURCHASE_START' });
        const result = await purchaseItem(characterId, item.id, 1);
        const character = await getCharacter(characterId);
        dispatch({
          type: 'SET_CURRENCY',
          payload: character.wallet.balance,
        });

        dispatch({
          type: 'PURCHASE_SUCCESS',
          payload: `Purchased ${item.name}!`,
        });

        if (onItemPurchased) {
          onItemPurchased(result);
        }

        // Refresh inventory if the user buys something while potentially
        // looking at their sell list.
        if (viewMode === 'sell') {
          refreshInventory();
        }
      } catch (err) {
        dispatch({
          type: 'PURCHASE_ERROR',
          payload:
            err.message || 'Failed to purchase item. Please try again.',
        });
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR]: Purchase error:`, err);
      } finally {
        setTimeout(() => {
          dispatch({ type: 'CLEAR_PURCHASE_STATUS' });
        }, 3000);
      }
    },
    [characterId, onItemPurchased, viewMode, refreshInventory]
  );

  /**
   * Handles the sale of an inventory item. Calculates sell price (currently
   * 70% of base price). Dispatches actions for sale start, success/error,
   * and updates character currency. Refreshes inventory after sale. Calls
   * the optional `onItemSold` prop. Clears the status message after a
   * delay. Logs errors if sale fails. Ensures inventory is refreshed even
   * on error.
   *
   * @type {Function}
   * @param {object} item - The inventory item to sell.
   */
  const handleSell = useCallback(
    async (item) => {
      try {
        dispatch({ type: 'SELL_START' });

        const sellPrice = Math.floor(item.price * 0.7);

        await sellItem(characterId, item.id, 1, sellPrice);

        const character = await getCharacter(characterId);
        dispatch({
          type: 'SET_CURRENCY',
          payload: character.wallet.balance,
        });

        await refreshInventory();

        dispatch({
          type: 'SELL_SUCCESS',
          payload: `Sold ${item.name} for ${sellPrice} currency!`,
        });

        if (onItemSold) {
          onItemSold({
            item,
            quantity: 1,
            currency: sellPrice,
          });
        }
      } catch (err) {
        dispatch({
          type: 'SELL_ERROR',
          payload: err.message || 'Failed to sell item. Please try again.',
        });
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR]: Sale error:`, err);
        refreshInventory();
      } finally {
        setTimeout(() => {
          dispatch({ type: 'CLEAR_SELL_STATUS' });
        }, 3000);
      }
    },
    [characterId, onItemSold, refreshInventory]
  );

  // Determine items to display based on view mode
  const displayItems =
    viewMode === 'buy' ? buyItemsFiltered : filteredSellItems;
  const isItemListLoading = viewMode === 'buy' ? loading : inventoryLoading;

  return (
    <div className="market-container modal-dialog modal-lg">
      <div className="modal-content">
        <MarketHeader
          currency={currency}
          viewMode={viewMode}
          onToggleView={toggleViewMode}
          onClose={onClose}
        />
        <div className="modal-body">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategoryChange}
          />
          <StatusDisplay
            loading={loading}
            error={error}
            purchaseStatus={purchaseStatus}
            sellStatus={sellStatus}
          />
          <ItemList
            items={displayItems}
            viewMode={viewMode}
            isLoading={isItemListLoading}
            onPurchase={handlePurchase}
            onSell={handleSell}
          />
        </div>
      </div>
    </div>
  );
};

Market.propTypes = {
  characterId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onItemPurchased: PropTypes.func,
  onItemSold: PropTypes.func,
};

Market.defaultProps = {
  onItemPurchased: null,
  onItemSold: null,
};

export default Market;
