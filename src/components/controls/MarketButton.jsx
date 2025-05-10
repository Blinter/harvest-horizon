/**
 * @file MarketButton.jsx
 * @description Button component that displays and manages the market
 *   interface. Provides a button that opens a modal Market component when
 *   clicked, allowing players to purchase seeds and other farm items. Manages
 *   the visibility state of the Market component and handles callbacks for
 *   purchases.
 * @module components/controls/MarketButton
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import Market from './Market';
import '../../styles/market.css';

/**
 * Renders a button that opens the Market modal.
 *
 * Manages the visibility state of the Market component.
 *
 * @param {object} props - Component props.
 * @param {string} props.characterId - The ID of the character, passed to the
 *   Market component.
 * @param {Function} [props.onItemPurchased] - Callback function passed to the
 *   Market component, invoked after an item purchase. Defaults to null.
 * @returns {React.ReactElement} The rendered market button and conditionally
 *   rendered Market modal.
 */
const MarketButton = ({ characterId, onItemPurchased }) => {
  /**
   * @state {boolean} isMarketOpen - Tracks whether the Market modal is open.
   * @default false
   */
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  /** Opens the Market modal by setting `isMarketOpen` to true. */
  const openMarket = () => {
    setIsMarketOpen(true);
  };

  /** Closes the Market modal by setting `isMarketOpen` to false. */
  const closeMarket = () => {
    setIsMarketOpen(false);
  };

  /**
   * Handler function that calls the `onItemPurchased` prop if it exists. Passed
   * down to the Market component.
   *
   * @param {object} item - The item that was purchased.
   */
  const handleItemPurchased = (item) => {
    if (onItemPurchased) {
      onItemPurchased(item);
    }
  };

  return (
    <>
      <button
        className="market-button"
        onClick={openMarket}
        title="Open Seed Market"
      >
        Seed Market
      </button>

      {isMarketOpen && (
        <Market
          characterId={characterId}
          onClose={closeMarket}
          onItemPurchased={handleItemPurchased}
        />
      )}
    </>
  );
};

MarketButton.propTypes = {
  characterId: PropTypes.string.isRequired,
  onItemPurchased: PropTypes.func,
};

MarketButton.defaultProps = {
  onItemPurchased: null,
};

export default MarketButton;
