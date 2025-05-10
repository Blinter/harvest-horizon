# Capstone 2 Proposal

# Harvest Horizon

Harvest Horizon is a simplified farming simulation game designed to be fun and relaxing. The game allows players to plant and harvest crops, gradually increasing their skills to access more challenging and valuable crops. As players progress, they unlock additional features, tools, and harvesting methods.

### Levels

- Capacity farm increase
- Unlock Crop Water Speed (2x)
- Speed Increase (5x)
- Yield Increase (10x)
- Increase Batch Sizes (per plot, multi-select)
- Unlock multi-gather tiles (Speed Harvesting)
- Unlock multi-zone tiles (Max Tier Harvesting)
- Unlock speed collect auto animations(Level Gaps)
- Unlock multiplayer? (Initial Implementation)

Max Crop Growth: every 6 hours - Crops farmed in real-time.

Players can lose access to their crops, requiring them to recover their extra area/tiles. The player's plot is their available yield.

Every few minutes, more tasks can be found at several 'special areas' in the game. The game will allow zooming and panning, with strict range limits. Players are introduced to 'static' RNG generated maps of their farm, saved on the server. Multiple areas can be loaded in real-time, using **Sockets.io**

Each map tile has a randomly generated map. It will also allow their map name to be changed.

New users can plant crops with varying degrees of difficulty. To play the game, players can learn the basics of growing crops and then increase their skills, improving the ability to grow more expensive crops or crops that require unlockable skillsets. Progression in the game opens up additional features of the game such as accessibility to tools and other unique harvesting methods.

The initial implementation will allow an 'end-game' to persist, allowing the player to continue growing their area before the 'soft cap'. This may decrease depending on the server's load.

---

### Technical Implementation

1. Set up React project with a suitable 2D rendering library (e.g., **Pixi.js**)
2. Implement state management using React hooks
3. Use sockets when a player loads a map. These are real-time events to the map due to user interactions.
4. Use Express-based backend/frontend setup, creating the game SPA and enabling the back-end routes running on the same express server.

### Technical Limitations

1. Multiple stages of testing development (E2E+) should be implemented to provide a bug-free user experience on all screen sizes.
2. For suitable server resource allocation, imposing a hard cap on the maximum amount of resources a player can consume can be difficult to profile.
3. Combining the Express and React applications can be potentially confusing to maintain, but makes testing more convenient.

### **MongoDB** 
 - Saves game states, other unstructured variables required for game thread processing (Inventory, Map attributes)

### **Postgres**

- Saves user SSO or password, allowing GitHub or Email login.
- Saves Exp of user, levels, etc.
- Saves Plot ID's mapped to each user. checks permissions, shows name.
- Game Thread (latest committed snapshot)

### **UI System**

- Menu Control buttons, EXP Bar, only render scenes that are available to the user.
- 2D scenes shared in MongoDB, allow hot reloading.
- Scene data loaded by client: Server tracks User state in MongoDB
- Menu Control change UI Size with + or - Button
- Pixi.js 2D rendering system, and some sprites to show map.
- Randomly generated maps, with map details stored on MongoDB, with map state.

### **Tools**

- Vite
- React
- Express.js
- Node
- PostgreSQL
- MongoDB
- Debian

**Other NPM Packages**

- Pixi.js 2D Rendering Library [https://pixijs.com/](https://pixijs.com/)
- jwt-decode
- lodash (debouncer)

### Resources

Sprite packs or free content from

- [https://itch.io](https://itch.io/)