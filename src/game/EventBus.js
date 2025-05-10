/**
 * @file EventBus.js
 * @description A simple event bus implementation for decoupled communication
 *   between components in the Harvest Horizon game. Implements the
 *   publish-subscribe pattern to allow for loosely coupled event handling.
 * @module EventBus
 */

/**
 * Implements a basic publish-subscribe pattern (Event Bus).
 *
 * Allows registering listeners for named events and emitting events with
 * arguments.
 * @class EventBusClass
 */
class EventBusClass {
  /**
   * Initializes the event bus with an empty events registry.
   */
  constructor() {
    /**
     * Stores registered event listeners, keyed by event name.
     * @property {object.<string, Function[]>} events
     * @private
     */
    this.events = {};
  }

  /**
   * Registers a callback function to be executed when a specific event is
   * emitted.
   * @param {string} eventName - The name of the event to listen for.
   * @param {Function} callback - The function to execute when the event is
   *   emitted.
   * @returns {Function} An unsubscribe function to remove this specific
   *   listener.
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    this.events[eventName].push(callback);

    return () => {
      this.events[eventName] = this.events[eventName].filter(
        (eventCallback) => eventCallback !== callback
      );
    };
  }

  /**
   * Removes a specific callback function for a given event.
   * @param {string} eventName - The name of the event.
   * @param {Function} callback - The specific callback function to remove.
   */
  off(eventName, callback) {
    if (!this.events[eventName]) {
      return;
    }

    this.events[eventName] = this.events[eventName].filter(
      (eventCallback) => eventCallback !== callback
    );
  }

  /**
   * Registers a callback function to be executed only once for a specific
   * event.
   * The listener is automatically removed after the first execution.
   * @param {string} eventName - The name of the event to listen for.
   * @param {Function} callback - The function to execute once when the event
   *   is emitted.
   * @returns {Function} An unsubscribe function to remove the listener before
   *   its first execution (if needed).
   */
  once(eventName, callback) {
    const wrapper = (...args) => {
      unsubscribe();
      callback(...args);
    };

    const unsubscribe = this.on(eventName, wrapper);

    return unsubscribe;
  }

  /**
   * Emits an event, executing all registered callback functions for that
   * event name.
   * Arguments passed after eventName will be passed to the callbacks.
   * Includes basic error handling for callback execution.
   * @param {string} eventName - The name of the event to emit.
   * @param {...*} args - Arguments to pass to the event listeners.
   */
  emit(eventName, ...args) {
    if (!this.events[eventName]) {
      return;
    }

    this.events[eventName].forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(
          `Error in EventBus callback for event ${eventName}:`,
          error
        );
      }
    });
  }

  /**
   * Removes all listeners for a specific event, or clears all listeners if no
   * event name is provided.
   * @param {string} [eventName] - The name of the event to clear. If omitted,
   *   all events are cleared.
   */
  clear(eventName) {
    if (eventName) {
      delete this.events[eventName];
    } else {
      this.events = {};
    }
  }

  /**
   * Gets the number of listeners registered for a specific event.
   * @param {string} eventName - The name of the event.
   * @returns {number} The number of listeners for the event.
   */
  listenerCount(eventName) {
    return this.events[eventName]?.length || 0;
  }

  /**
   * Gets an array of all event names that currently have listeners
   * registered.
   * @returns {string[]} An array of event names.
   */
  eventNames() {
    return Object.keys(this.events);
  }
}

/**
 * Singleton instance of the EventBusClass used throughout the application.
 * @type {EventBusClass}
 */
const eventBus = new EventBusClass();

eventBus.on('move-left', () => {
  eventBus.emit('move', 'left');
});

eventBus.on('move-right', () => {
  eventBus.emit('move', 'right');
});

eventBus.on('move-up', () => {
  eventBus.emit('move', 'up');
});

eventBus.on('move-down', () => {
  eventBus.emit('move', 'down');
});

eventBus.on('game-started', () => {
  console.info('GAME STARTED');
});

eventBus.on('game-stopped', () => {
  console.info('GAME STOPPED');
});

eventBus.on('tiles-selected', (_tiles) => {
  // Keep this for debugging purposes
  // console.info('TILES SELECTED', tiles);
});

/**
 * Exported singleton instance of the EventBus.
 */
export const EventBus = eventBus;

/**
 * Exported EventBusClass for potential extension or direct instantiation
 * (less common).
 */
export default EventBusClass;
