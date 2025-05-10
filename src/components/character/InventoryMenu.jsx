import { useState, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  CardTitle,
  CardSubtitle,
  Button,
  ListGroup,
  ListGroupItem,
  Spinner,
  Alert,
  Input,
} from 'reactstrap';

import {
  getCharacterInventory,
  getMarketItems,
  sellCharacterItem,
  buyCharacterItem,
} from '../../api/inventoryApi';

import CustomLoader from '../main/Game';

/**
 * Represents an item in the inventory or market.
 * @typedef {object} Item
 * @property {string} _id - Unique identifier.
 * @property {string} itemType - Type of item (e.g., 'crop', 'seed').
 * @property {string} itemName - Name of the item (e.g., 'wheat').
 * @property {number} quantity - Quantity held.
 * @property {number} [currentPrice] - Market price (if applicable).
 * @property {string} [currency] - Currency for market price.
 */

/**
 * Represents character inventory data.
 * @typedef {object} InventoryData
 * @property {string} _id - Inventory ID.
 * @property {string} characterId - Owning character ID.
 * @property {number} capacity - Inventory capacity.
 * @property {number} level - Inventory level.
 * @property {Item[]} items - Array of items.
 * @property {Date} lastUpdated - Last update timestamp.
 */

// --- Helper Functions for InventoryListItem ---

/**
 * Calculates derived state for a sellable inventory item based on market
 * conditions and user input.
 *
 * @param {Item} item The inventory item being considered for sale.
 * @param {object|null} marketInfo Market data for the item (price, etc.).
 *   Can be null if the item isn't on the market or data isn't loaded.
 * @param {string} currentSellQuantityStr The current quantity entered by the
 *   user in the input field, as a string.
 * @returns {object} An object containing derived state properties:
 *   - `actualSellPrice` (number|undefined): The price per item.
 *   - `isSellableCrop` (boolean): If the item is a 'crop'.
 *   - `currentSellQuantity` (number): Parsed integer of quantity input.
 *   - `maxSellQuantity` (number): Total quantity available in inventory.
 *   - `canSell` (boolean): If the item can be sold (is crop, has market info).
 *   - `isSellInputDisabled` (boolean): If the quantity input should be
 *     disabled.
 *   - `isSellButtonDisabled` (boolean): If the sell button should be disabled.
 *   - `sellButtonTitle` (string): Tooltip text for the sell button.
 */
const calculateSellItemState = (item, marketInfo, currentSellQuantityStr) => {
  const actualSellPrice = marketInfo?.currentPrice;
  const isSellableCrop = item.itemType === 'crop';
  const currentSellQuantity = parseInt(currentSellQuantityStr || '0', 10);
  const maxSellQuantity = item.quantity;
  const canSell = !!(marketInfo && isSellableCrop);

  const isSellInputDisabled = maxSellQuantity < 1 || !isSellableCrop;
  const isSellButtonDisabled =
    isSellInputDisabled ||
    currentSellQuantity <= 0 ||
    currentSellQuantity > maxSellQuantity;

  let sellButtonTitle;
  if (!isSellableCrop) {
    sellButtonTitle = 'Only crops can be sold';
  } else if (isSellButtonDisabled) {
    sellButtonTitle = 'Invalid quantity';
  } else {
    sellButtonTitle = 'Sell Item';
  }

  return {
    actualSellPrice,
    isSellableCrop,
    currentSellQuantity,
    maxSellQuantity,
    canSell,
    isSellInputDisabled,
    isSellButtonDisabled,
    sellButtonTitle,
  };
};

/**
 * Handles changes to the sell quantity input field.
 *
 * It parses the input value, clamps it between 1 and the maximum available
 * quantity, and calls the provided state update function. Handles empty input
 * specifically.
 *
 * @param {string} value The raw value from the input event (e.g., '5', '').
 * @param {string} itemKey The unique identifier for the item's quantity state
 *   in the parent component's state object.
 * @param {number} maxSellQuantity The maximum allowed quantity that can be
 *   entered (typically the item's total quantity in inventory).
 * @param {Function} handleSellQuantityChange The state setter function (from
 *   `useState` or similar) provided by the parent component to update the
 *   quantity state for this specific item. It expects `(itemKey, newValue)` as
 *   arguments.
 */
const handleSellQuantityInputChange = (
  value,
  itemKey,
  maxSellQuantity,
  handleSellQuantityChange
) => {
  let numericValue = parseInt(value, 10);

  if (isNaN(numericValue) || numericValue < 1) {
    if (value === '') {
      handleSellQuantityChange(itemKey, ''); // Allow empty input
      return;
    }
    numericValue = 1; // Default to 1 if invalid and not empty
  }

  // Clamp the value between 1 and maxSellQuantity
  const clampedValue = Math.min(Math.max(numericValue, 1), maxSellQuantity);

  // Update only if the clamped value results in a change or it was empty
  if (clampedValue.toString() !== value && value !== '') {
    handleSellQuantityChange(itemKey, clampedValue.toString());
  } else {
    handleSellQuantityChange(
      itemKey,
      value === '' ? '' : clampedValue.toString()
    );
  }
};

// Define InventoryListItem outside of InventoryMenu
const InventoryListItem = memo(
  ({
    itemKey,
    item,
    marketInfo,
    sellQuantities,
    handleSellQuantityChange,
    handleSellItem,
  }) => {
    const {
      actualSellPrice,
      isSellableCrop,
      currentSellQuantity,
      maxSellQuantity,
      canSell,
      isSellInputDisabled,
      isSellButtonDisabled,
      sellButtonTitle,
    } = calculateSellItemState(item, marketInfo, sellQuantities[itemKey]);

    return (
      <ListGroupItem
        key={itemKey}
        className="d-flex justify-content-between align-items-center flex-wrap"
      >
        <div className="mb-2 me-md-3">
          {item.itemName} ({item.itemType}) - Qty: {maxSellQuantity}
          {isSellableCrop && marketInfo && actualSellPrice !== undefined && (
            <small className="d-block text-muted">
              Sell Value: {actualSellPrice} coins each
            </small>
          )}
        </div>
        {canSell && (
          <div
            className="d-flex flex-column align-items-end"
            style={{ minWidth: '170px' }}
          >
            {/* Quantity Input Row */}
            <div
              className="d-flex align-items-center mb-1"
              style={{ gap: '5px' }}
            >
              {/* -1 Button */}
              <Button
                color="danger"
                size="sm"
                onClick={() => {
                  const currentVal = parseInt(sellQuantities[itemKey] || '1', 10);
                  const newVal = Math.max(
                    1,
                    isNaN(currentVal) ? 1 : currentVal - 1
                  );
                  handleSellQuantityInputChange(
                    newVal.toString(),
                    itemKey,
                    maxSellQuantity,
                    handleSellQuantityChange
                  );
                }}
                disabled={
                  isSellInputDisabled ||
                  parseInt(sellQuantities[itemKey] || '1', 10) <= 1
                }
                title="Subtract 1 from quantity (min 1)"
                style={{ padding: '0.2rem 0.4rem', lineHeight: '1' }}
              >
                -1
              </Button>
              <Input
                type="number"
                min="1"
                max={maxSellQuantity}
                placeholder="Qty"
                bsSize="sm"
                style={{ maxWidth: '60px', textAlign: 'center' }}
                value={sellQuantities[itemKey] || ''}
                onChange={(e) =>
                  handleSellQuantityInputChange(
                    e.target.value,
                    itemKey,
                    maxSellQuantity,
                    handleSellQuantityChange
                  )
                }
                disabled={isSellInputDisabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isSellButtonDisabled) {
                      handleSellItem(
                        item.itemName,
                        item.itemType,
                        currentSellQuantity
                      );
                    }
                  }
                }}
              />
              {/* +1 Button */}
              <Button
                color="primary"
                size="sm"
                onClick={() => {
                  const currentVal = parseInt(
                    sellQuantities[itemKey] || '0',
                    10
                  );
                  const newVal = Math.min(
                    isNaN(currentVal) ? 1 : currentVal + 1,
                    maxSellQuantity
                  );
                  handleSellQuantityInputChange(
                    newVal.toString(),
                    itemKey,
                    maxSellQuantity,
                    handleSellQuantityChange
                  );
                }}
                disabled={
                  isSellInputDisabled ||
                  parseInt(sellQuantities[itemKey] || '0', 10) >=
                  maxSellQuantity
                }
                title="Add 1 to quantity"
                style={{ padding: '0.2rem 0.4rem', lineHeight: '1' }}
              >
                +1
              </Button>
            </div>
            {/* Buttons Container */}
            <div className="d-flex" style={{ gap: '5px' }}>
              <Button
                color="warning"
                size="sm"
                onClick={() =>
                  handleSellItem(
                    item.itemName,
                    item.itemType,
                    currentSellQuantity
                  )
                }
                disabled={isSellButtonDisabled}
                title={sellButtonTitle}
              >
                Sell
              </Button>
              {/* Sell All Button */}
              <Button
                color="danger"
                size="sm"
                onClick={() =>
                  handleSellItem(item.itemName, item.itemType, maxSellQuantity)
                }
                disabled={isSellInputDisabled || maxSellQuantity <= 0}
                title="Sell All Items"
                style={{ whiteSpace: 'nowrap' }}
              >
                Sell All
              </Button>
            </div>
          </div>
        )}
      </ListGroupItem>
    );
  }
);
// Add display name for debugging
InventoryListItem.displayName = 'InventoryListItem';
// Define PropTypes for the new component
InventoryListItem.propTypes = {
  /** A unique key identifying the specific item entry (e.g., 'wheat-crop'). */
  itemKey: PropTypes.string.isRequired,
  /** The inventory item data object. */
  item: PropTypes.shape({
    /** The display name of the item. */
    itemName: PropTypes.string.isRequired,
    /** The category of the item (e.g., 'crop', 'seed'). */
    itemType: PropTypes.string.isRequired,
    /** The total quantity of this item held in the inventory. */
    quantity: PropTypes.number.isRequired,
  }).isRequired,
  /**
   * Market information for this specific item, if available. Null otherwise.
   */
  marketInfo: PropTypes.shape({
    _id: PropTypes.string,
    itemType: PropTypes.string,
    itemName: PropTypes.string,
    /** The current selling price per unit. */
    currentPrice: PropTypes.number,
    /** The currency used for the price (e.g., 'coins'). */
    currency: PropTypes.string,
  }), // Can be null or object
  /**
   * An object holding the current input values for sell quantities, keyed by
   * itemKey.
   */
  sellQuantities: PropTypes.object.isRequired,
  /** Callback function to update the sell quantity state in the parent. */
  handleSellQuantityChange: PropTypes.func.isRequired,
  /** Callback function to initiate the sell action in the parent. */
  handleSellItem: PropTypes.func.isRequired,
};

// --- MarketListItem Component ---
const MarketListItem = memo(
  ({
    item,
    characterCoins,
    buyQuantities,
    handleBuyQuantityChange,
    handleBuyItem,
    handleBuyMaxItem,
  }) => {
    // Check if the character can afford at least one item
    const canAfford = characterCoins >= item.currentPrice;
    // Check if the item is a seed (only seeds are buyable)
    const isBuyableSeed = item.itemType === 'seed';
    const itemKey = item._id; // Use market item ID for buy quantities
    // Calculate max affordable quantity
    const maxAffordable = canAfford
      ? Math.floor(characterCoins / item.currentPrice)
      : 0;

    // Determine the buy button title based on conditions
    let buyButtonTitle = 'Buy Item';
    if (!isBuyableSeed) {
      buyButtonTitle = 'Only seeds can be bought';
    } else if (!canAfford) {
      buyButtonTitle = 'Insufficient funds';
    }

    // Determine disabled state for standard buy
    const isBuyDisabled = !canAfford || !isBuyableSeed;
    // Determine disabled state for buy max
    const isBuyMaxDisabled = !isBuyableSeed || maxAffordable < 1;

    const handleLocalBuyQuantityChange = (rawValue) => {
      let numericValue = parseInt(rawValue, 10);

      // Handle non-numeric input or values less than 1
      if (isNaN(numericValue) || numericValue < 1) {
        // If the input field is empty, allow it, otherwise default to 1
        if (rawValue === '') {
          handleBuyQuantityChange(itemKey, '');
          return;
        }
        numericValue = 1;
      }

      // Clamp the value to maxAffordable
      const clampedValue = Math.min(numericValue, maxAffordable);

      // Update the state only if the clamped value is different
      // or if the raw value was initially empty (to allow typing '1')
      if (clampedValue.toString() !== rawValue && rawValue !== '') {
        handleBuyQuantityChange(itemKey, clampedValue.toString());
      } else {
        handleBuyQuantityChange(
          itemKey,
          rawValue === '' ? '' : clampedValue.toString()
        );
      }
    };

    return (
      <ListGroupItem
        key={itemKey}
        className="d-flex justify-content-between align-items-center"
      >
        <div className="mb-2 mb-md-0">
          {' '}
          {/* Margin bottom on small screens */}
          {item.itemName} ({item.itemType})
          {/* Only show Price if it's a buyable seed */}
          {isBuyableSeed && (
            <small className="d-block text-muted">
              Price: {item.currentPrice} {item.currency} each
            </small>
          )}
        </div>
        {/* Adjusted Buy Controls Section */}
        <div
          className="d-flex flex-column align-items-end"
          style={{ minWidth: '150px' }}
        >
          {/* Quantity Input Row */}
          <div
            className="d-flex align-items-center mb-1"
            style={{ gap: '5px' }}
          >
            {/* -1 Button */}
            <Button
              color="danger"
              size="sm"
              onClick={() => {
                const currentVal = parseInt(buyQuantities[itemKey] || '1', 10);
                // Ensure it doesn't go below 1
                const newVal = Math.max(
                  1,
                  isNaN(currentVal) ? 1 : currentVal - 1
                );
                handleLocalBuyQuantityChange(newVal.toString());
              }}
              disabled={
                isBuyDisabled ||
                parseInt(buyQuantities[itemKey] || '1', 10) <= 1
              }
              title="Subtract 1 from quantity (min 1)"
              style={{ padding: '0.2rem 0.4rem', lineHeight: '1' }}
            >
              -1
            </Button>
            <Input
              type="number"
              min="1"
              bsSize="sm"
              style={{ maxWidth: '60px', textAlign: 'center' }}
              value={buyQuantities[itemKey] || ''}
              onChange={(e) => handleLocalBuyQuantityChange(e.target.value)}
              placeholder="Qty"
              disabled={isBuyDisabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (
                    !isBuyDisabled &&
                    parseInt(buyQuantities[itemKey] || '0', 10) > 0
                  ) {
                    handleBuyItem(item);
                  }
                }
              }}
            />
            {/* +1 Button */}
            <Button
              color="primary"
              size="sm"
              onClick={() => {
                const currentVal = parseInt(buyQuantities[itemKey] || '0', 10);
                // Clamp the new value to be at most maxAffordable
                const newVal = Math.min(
                  isNaN(currentVal) ? 1 : currentVal + 1,
                  maxAffordable
                );
                handleLocalBuyQuantityChange(newVal.toString());
              }}
              // Keep disabled logic: prevent clicking if already at/above max
              disabled={
                isBuyDisabled ||
                parseInt(buyQuantities[itemKey] || '0', 10) >= maxAffordable
              }
              title="Add 1 to quantity"
              style={{ padding: '0.2rem 0.4rem', lineHeight: '1' }}
            >
              +1
            </Button>
          </div>
          {/* Buttons Container */}
          <div className="d-flex" style={{ gap: '5px' }}>
            <Button
              color="success"
              size="sm"
              onClick={() => handleBuyItem(item)} // Pass the whole item
              disabled={
                isBuyDisabled ||
                parseInt(buyQuantities[itemKey] || '0', 10) <= 0
              } // Also disable if qty <= 0
              title={buyButtonTitle} // Use the calculated title
            >
              Buy
            </Button>
            <Button
              color="info"
              size="sm"
              onClick={() => handleBuyMaxItem(item)}
              disabled={isBuyMaxDisabled}
              title={
                isBuyMaxDisabled
                  ? 'Cannot buy max'
                  : `Buy Max (${maxAffordable})`
              }
              style={{ whiteSpace: 'nowrap' }} // Prevent wrapping
            >
              Buy Max
            </Button>
          </div>
        </div>
      </ListGroupItem>
    );
  }
);

MarketListItem.displayName = 'MarketListItem';
MarketListItem.propTypes = {
  /** The market item data object. */
  item: PropTypes.shape({
    /** Unique identifier for the market item listing. */
    _id: PropTypes.string.isRequired,
    /** Display name of the item. */
    itemName: PropTypes.string.isRequired,
    /** Category of the item (e.g., 'seed'). */
    itemType: PropTypes.string.isRequired,
    /** The current buying price per unit. */
    currentPrice: PropTypes.number.isRequired,
    /** Currency used for the price (e.g., 'coins'). */
    currency: PropTypes.string.isRequired,
  }).isRequired,
  /** The character's current amount of currency. */
  characterCoins: PropTypes.number.isRequired,
  /**
   * State object holding current input values for buy quantities,
   * keyed by item._id.
   */
  buyQuantities: PropTypes.object.isRequired,
  /** Callback to update the buy quantity state in the parent. */
  handleBuyQuantityChange: PropTypes.func.isRequired,
  /** Callback to initiate the buy action in the parent. */
  handleBuyItem: PropTypes.func.isRequired,
  /** Callback to initiate buying the maximum affordable quantity. */
  handleBuyMaxItem: PropTypes.func.isRequired,
};

/**
 * Renders the main inventory and marketplace interface component.
 *
 * Fetches and displays the character's items and available market items,
 * allowing the user to buy seeds and sell crops.
 *
 * @param {object} props Component props.
 * @param {string} props.characterId The ID of the character whose inventory
 *   and market interactions are being managed. Used for API calls.
 * @param {Function} [props.onClose] Optional callback function invoked when a
 *   designated close action (if available) is triggered within the component.
 * @param {Function} [props.onInventoryUpdate] Optional callback function
 *   invoked after a successful buy or sell operation that modifies the
 *   character's inventory.
 * @returns {React.ReactElement} The rendered InventoryMenu component.
 */
function InventoryMenu({ characterId, onClose, onInventoryUpdate }) {
  const [inventoryData, setInventoryData] =
    useState(/** @type {InventoryData | null} */(null));
  const [characterCoins, setCharacterCoins] = useState(0);
  const [marketItems, setMarketItems] =
    useState(/** @type {MarketItem[]} */([]));
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [error, setError] = useState('');
  const [buyQuantities, setBuyQuantities] = useState({});
  const [sellQuantities, setSellQuantities] = useState({});

  // --- Data Fetching ---

  const fetchInventory = useCallback(async () => {
    if (!characterId) return;
    setLoadingInventory(true);
    setError('');
    try {
      const data = await getCharacterInventory(characterId);
      setInventoryData(data.inventory || null);
      setCharacterCoins(data.coins || 0);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load inventory. ${message}`);
      setInventoryData(null); // Clear potentially stale data
    } finally {
      setLoadingInventory(false);
    }
  }, [characterId]);

  const fetchMarket = useCallback(async () => {
    setLoadingMarket(true);
    setError('');
    try {
      const data = await getMarketItems();
      setMarketItems(data || []); // Ensure it's an array
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load market data. ${message}`);
      setMarketItems([]); // Clear potentially stale data
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    fetchMarket();
  }, [fetchInventory, fetchMarket]);

  // --- Event Handlers ---

  const handleSellItem = useCallback(
    async (itemName, itemType, quantityToSell = 1) => {
      if (!characterId || !inventoryData) return;
      setError('');

      try {
        await sellCharacterItem(
          characterId,
          itemName,
          itemType,
          quantityToSell
        );

        await fetchInventory();

        if (onInventoryUpdate) {
          onInventoryUpdate();
        }
        // Clear the quantity input for the sold item
        const itemKey = `${itemName}-${itemType}`;
        setSellQuantities((prev) => ({ ...prev, [itemKey]: '' }));
      } catch (err) {
        console.error('Failed to sell item:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to sell ${itemName}. ${message}`);
      }
    },
    [characterId, inventoryData, fetchInventory, onInventoryUpdate]
  );

  const handleBuyItem = useCallback(
    async (marketItem) => {
      if (!characterId) return;
      setError('');
      const quantityToBuy = parseInt(buyQuantities[marketItem._id] || '1', 10);

      if (isNaN(quantityToBuy) || quantityToBuy <= 0) {
        setError('Please enter a valid quantity greater than 0.');
        return;
      }

      try {
        await buyCharacterItem(
          characterId,
          marketItem._id,
          marketItem.itemName,
          marketItem.itemType,
          quantityToBuy
        );

        await fetchInventory();
        // Reset buy quantity for this item
        setBuyQuantities((prev) => ({ ...prev, [marketItem._id]: '' }));

        if (onInventoryUpdate) {
          onInventoryUpdate();
        }
      } catch (err) {
        console.error('Failed to buy item:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to buy ${marketItem.itemName}. ${message}`);
      }
    },
    [characterId, fetchInventory, buyQuantities, onInventoryUpdate]
  );

  // Handler for buying the maximum affordable quantity
  const handleBuyMaxItem = useCallback(
    async (marketItem) => {
      if (!characterId) return;
      setError('');

      const maxAffordable = Math.floor(
        characterCoins / marketItem.currentPrice
      );

      if (maxAffordable < 1) {
        setError('You cannot afford any of this item.');
        return;
      }

      try {
        await buyCharacterItem(
          characterId,
          marketItem._id,
          marketItem.itemName,
          marketItem.itemType,
          maxAffordable // Use calculated max quantity
        );

        await fetchInventory();
        // Reset buy quantity for this item just in case
        setBuyQuantities((prev) => ({ ...prev, [marketItem._id]: '' }));

        if (onInventoryUpdate) {
          onInventoryUpdate();
        }
      } catch (err) {
        console.error('Failed to buy max items:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(
          `Failed to buy max ${marketItem.itemName}. ${message}`
        );
      }
    },
    // Added characterCoins dependency
    [characterId, fetchInventory, onInventoryUpdate, characterCoins]
  );

  const handleBuyQuantityChange = (marketItemId, value) => {
    setBuyQuantities((prev) => ({
      ...prev,
      [marketItemId]: value,
    }));
  };

  const handleSellQuantityChange = (itemKey, value) => {
    setSellQuantities((prev) => ({
      ...prev,
      [itemKey]: value,
    }));
  };

  // --- Rendering ---

  const renderInventoryItems = () => {
    if (loadingInventory) {
      return (
        <Spinner size="sm">Loading inventory...</Spinner>
      );
    }
    if (!inventoryData?.items || inventoryData.items.length === 0) {
      return <p>Your inventory is empty.</p>;
    }

    // Aggregate items by name and type for selling display
    const aggregatedItems = inventoryData.items.reduce((acc, item) => {
      const key = `${item.itemName}-${item.itemType}`;
      if (!acc[key]) {
        acc[key] = { ...item, quantity: 0 };
      }
      acc[key].quantity += item.quantity;
      return acc;
    }, {});

    return (
      <ListGroup flush>
        {Object.entries(aggregatedItems).map(([itemKey, item]) => {
          // Find corresponding market item
          const marketInfo = marketItems.find(
            (mi) =>
              mi.itemName === item.itemName && mi.itemType === item.itemType
          );

          // Render the memoized list item component
          return (
            <InventoryListItem
              key={itemKey}
              itemKey={itemKey}
              item={item}
              marketInfo={marketInfo}
              sellQuantities={sellQuantities}
              handleSellQuantityChange={handleSellQuantityChange}
              handleSellItem={handleSellItem}
            />
          );
        })}
      </ListGroup>
    );
  };

  const renderMarketItems = () => {
    if (loadingMarket) {
      return (
        <div className="loading-container">
          <div className="loading-spinner" />
          <Spinner size="sm">Loading market data...</Spinner>
        </div>
      );
    }
    if (!marketItems || marketItems.length === 0) {
      return <p>The market is currently empty.</p>;
    }

    return (
      <ListGroup flush>
        {marketItems
          // Filter out items that are crops
          .filter((item) => item.itemType !== 'crop')
          .map((item) => {
            // Now render the MarketListItem component
            return (
              <MarketListItem
                key={item._id}
                item={item}
                characterCoins={characterCoins}
                buyQuantities={buyQuantities}
                handleBuyQuantityChange={handleBuyQuantityChange}
                handleBuyItem={handleBuyItem}
                handleBuyMaxItem={handleBuyMaxItem}
              />
            );
          })}
      </ListGroup>
    );
  };

  // --- Main Return ---

  return (
    <Container fluid> {/* Use fluid for better responsiveness */}
      {error && <Alert color="danger">{error}</Alert>}
      <Row>
        {/* Inventory Section */}
        <Col md={6} className="mb-4 mb-md-0">
          {/* Add margin bottom on small screens */}
          <Card>
            <CardBody>
              <CardTitle tag="h5">Your Inventory</CardTitle>
              <CardSubtitle tag="h6" className="mb-2 text-muted">
                {inventoryData
                  ? (() => {
                    // Note: This counts slots, not total quantity.
                    // Might need adjustment based on game logic.
                    const itemCount = inventoryData.items.length;
                    return `Capacity: ${itemCount} / ${inventoryData.capacity} slots | Level: ${inventoryData.level}`;
                  })()
                  : 'Loading...'}
              </CardSubtitle>
              {renderInventoryItems()}
            </CardBody>
          </Card>
        </Col>

        {/* Market Section */}
        <Col md={6}>
          <Card>
            <CardBody>
              <CardTitle tag="h5">Marketplace</CardTitle>
              <CardSubtitle tag="h6" className="mb-2 text-muted">
                Items available for purchase
              </CardSubtitle>
              {renderMarketItems()}
            </CardBody>
          </Card>
        </Col>

        {/* Close button is optional */}
        {onClose && (
          <Col xs="12" className="text-end mt-2">
            <Button color="danger" size="sm" onClick={onClose}>
              Close Inventory
            </Button>
          </Col>
        )}
      </Row>
    </Container>
  );
}

InventoryMenu.propTypes = {
  /** The MongoDB ID of the character whose inventory is being displayed. */
  characterId: PropTypes.string.isRequired,
  /** Optional callback function to close the inline inventory view. */
  onClose: PropTypes.func,
  /**
   * Optional callback function triggered after a successful inventory update
   * (buy/sell). Useful for parent components needing to react to changes.
   */
  onInventoryUpdate: PropTypes.func,
};

export default InventoryMenu;
