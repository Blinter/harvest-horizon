/**
 * @file Provides utility functions for generating random names for characters
 *   and maps within the game.
 * @module utils/nameGenerator
 */

// List of evocative/character-like adjectives
const characterAdjectives = [
  'Brave',
  'Bold',
  'Clever',
  'Quick',
  'Sturdy',
  'Wise',
  'Keen',
  'Swift',
  'Steady',
  'Silent',
  'Nimble',
  'Noble',
  'Valiant',
  'Wily',
  'Daring',
  'Fearless',
  'Resourceful',
  'Vigilant',
  'Steadfast',
  'Loyal',
];

// List of more character-like nouns or titles
const characterNouns = [
  'Adventurer',
  'Scout',
  'Wanderer',
  'Ranger',
  'Pioneer',
  'Wayfarer',
  'Guardian',
  'Seeker',
  'Voyager',
  'Pathfinder',
  'Traveler',
  'Explorer',
  'Protector',
  'Steward',
  'Champion',
  'Hero',
  'Nomad',
  'Settler',
  'Warden',
  'Hermit',
];

/**
 * Selects a random element from the provided array.
 *
 * @param {Array<any>} arr - The array from which to select a random element.
 * @returns {any} A randomly selected element from the input array.
 */
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generates a random, evocative name suitable for a game character.
 * Combines a predefined adjective and noun.
 *
 * @returns {string} A randomly generated character name (e.g., "Brave Scout").
 */
export const generateCharacterName = () => {
  const adjective = getRandomElement(characterAdjectives);
  const noun = getRandomElement(characterNouns);
  const name = `${adjective} ${noun}`;
  console.debug(`Generated Name: ${name}`); // Log the generated name
  return name;
};

// --- Map Name Generation ---

// List of calming/relaxing adjectives evocative of places or farms
const mapAdjectives = [
  'Quiet',
  'Sunny',
  'Peaceful',
  'Gentle',
  'Verdant',
  'Serene',
  'Golden',
  'Amber',
  'Pastoral',
  'Tranquil',
  'Mellow',
  'Halcyon',
  'Balmy',
  'Shady',
  'Whispering',
  'Crystal',
  'Emerald',
  'Hidden',
  'Forgotten',
  'Sparkling',
];

// List of calming/relaxing nouns related to places, farms, or natural features
const mapNouns = [
  'Acres',
  'Hollow',
  'Ridge',
  'Meadow',
  'Pasture',
  'Grove',
  'Brook',
  'Springs',
  'Haven',
  'Creek',
  'Retreat',
  'Dale',
  'Willow',
  'Clearing',
  'Valley',
  'Orchard',
  'Glade',
  'Plateau',
  'Terrace',
  'Sanctuary',
];

/**
 * Generates a random, descriptive name suitable for a game map or farm area.
 * Combines a predefined adjective and noun related to places or nature. This
 * is useful for providing default names for user-created maps.
 *
 * @returns {string} A randomly generated map name (e.g., "Sunny Hollow").
 */
export const generateMapName = () => {
  const adjective = getRandomElement(mapAdjectives);
  const noun = getRandomElement(mapNouns);
  const name = `${adjective} ${noun}`;
  console.debug(`Generated Map Name: ${name}`);
  return name;
};

// --- Farmer Name Generation (Deprecated) ---

// Keep the old farmer name generator for compatibility if needed elsewhere
// ... existing code ...
