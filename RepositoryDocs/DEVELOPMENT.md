[← Back to Main README](../README.md)

## Development

- [Development](#development)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Database Setup](#database-setup)
    - [Installation](#installation)
    - [Accessing from Other Devices](#accessing-from-other-devices)
- [ESM (ECMAScript Modules) Usage](#esm-ecmascript-modules-usage)
- [Shared `/src/library` Guidelines](#shared-srclibrary-guidelines)
---

### Getting Started

#### Prerequisites
- Git ([Installation Guide for Ubuntu/Debian](https://git-scm.com/downloads/linux))
- Node.js (v22+) ([Installation Guide for Ubuntu/Debian](https://nodejs.org/en/download/package-manager/all#debian-and-ubuntu-based-linux-distributions))
- PostgreSQL ([Installation Guide for Ubuntu/Debian](https://www.postgresql.org/download/linux/ubuntu/))
- MongoDB ([Installation Guide for Ubuntu/Debian](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/))

#### Database Setup

**PostgreSQL:**

1. Connect to PostgreSQL using `psql` (may need `sudo -u postgres psql`).
2. Create a new user:  
   ```sql
   CREATE USER farm WITH PASSWORD 'NEWPASSWORDzzzz';
   CREATE USER farm_test WITH PASSWORD 'NEWPASSWORDzzzz';
   ```
3. Create the database:  
   ```sql
   CREATE DATABASE farm TEMPLATE=template0 OWNER farm;
   CREATE DATABASE farm_test TEMPLATE=template0 OWNER farm_test;
   ```
4. Grant privileges:  
   ```sql
   GRANT CONNECT ON DATABASE farm TO farm;
   GRANT CONNECT ON DATABASE farm_test TO farm_test;
   GRANT CONNECT ON DATABASE farm_test TO farm;

   GRANT USAGE ON SCHEMA public TO farm;
   GRANT USAGE ON SCHEMA public TO farm_test;
   
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO farm;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO farm_test;
   ```
5. Exit `psql` (`\q`).
6. Run seed script:  
   ```bash
   psql -U farm -d farm -f server/database/postgres/seeds/all.sql
   ```

**MongoDB:**

1. Connect via `mongosh` as `mongodb` user with security options under /etc/mongod.conf disabled.
   ```text
   # security:
   #   authorization: "enabled"
   ```

	```bash
	sudo -u mongod mongosh
	```

2. Use Database Administrator:  
   ```javascript
   use admin
   ```

3. Create a necessary role:  
   ```bash
   db.createRole({
   role: "dropCollectionsRole",
   privileges: [
      {
         resource: { db: "farm", collection: "markets" }, 
         actions: ["dropCollection"]
      }
   ],
   roles: []
   });
   ```

4. Create user with role:  
   ```bash
   db.createUser({ 
      user: "farm", 
      pwd: "NEWPASSWORDxxxx", 
      roles: [{ role: "readWrite", db: "farm" }] })
   ```

5. Grant the new role to the user:
   ```bash
   db.grantRolesToUser("farm", [{ role: "dropCollectionsRole", db: "farm" }]);
   ```

6. Do the same for the `farm_test` database:
   ```bash
   use admin

   db.createRole({
   role: "dropCollectionsRole",
   privileges: [
      {
         resource: { db: "farm_test", collection: "markets" }, 
         actions: ["dropCollection"]
      }
   ],
   roles: []
   });

   db.createUser({ 
      user: "farm_test", 
      pwd: "NEWPASSWORDxxxx", 
      roles: [{ role: "readWrite", db: "farm_test" }] })
   db.grantRolesToUser("farm_test", [{ role: "dropCollectionsRole", db: "farm_test" }]);
   ```

7. Exit `mongosh` (`exit`).

8. Run seed script:  
   ```bash
   node server/database/mongo/seeds/all.js
   ```

9. Enable security options in `/etc/mongod.conf`
   ```text
   security:
      authorization: "enabled"
   ```

10. Run the MongoDB seed script. This should run successfully without errors.
   ```bash
   node server/database/mongo/seeds/all.js
   ```

#### Installation

1. Clone the repo:  
   ```bash
   git clone https://github.com/Blinter/harvest-horizon.git && cd harvest-horizon
   ```
2. Install dependencies:  
   ```bash
   npm install
   ```
3. Create `.env` in project root:  
   ```text
   DATABASE_URL=postgres://farm:NEWPASSWORDzzzz@localhost:5432/farm
   DATABASE_URL_TEST=postgres://farm_test:NEWPASSWORDzzzz@localhost:5432/farm_test
   MONGODB_URI=mongodb://farm:NEWPASSWORDxxxx@127.0.0.1:27017/farm?authSource=farm&retryWrites=true&ssl=false&directConnection=true
   MONGODB_URI_TEST==mongodb://farm_test:NEWPASSWORDxxxx@127.0.0.1:27017/farm_test?authSource=farm_test&retryWrites=true&ssl=false&directConnection=true
   PORT=3000
   ```
4. Start development servers:  
   ```bash
   npm run dev
   ```
   *(Or run `npm run dev-frontend` or `npm run dev-backend` individually.)*

5. Production build & start:  
   ```bash
   npm run build && npm start
   ```

#### Accessing from Other Devices

1. Find IP:  
   ```bash
   hostname -I
   ```
2. Open:  
   ```
   http://YOUR_IP_ADDRESS:3000
   ```
3. Vite server (on development):  
   ```
   http://YOUR_IP_ADDRESS:5173
   ```

---

## ESM (ECMAScript Modules) Usage

This project is fully ESM-only—CommonJS (`require`, `module.exports`) is **not supported**.

**Why ESM? (Hybrid Architecture Rationale):**
- The codebase merges backend (Node.js/Express), frontend (React/Vite), and shared utilities into a single, modern JavaScript monorepo.
- ESM (ECMAScript Modules) is the only module format natively supported by both browsers and modern Node.js (v22+), enabling true code sharing between server and client.
- Using ESM ensures consistent syntax and tooling across all parts of the stack—no more context switching between `require`/`module.exports` and `import`/`export`.
- Many modern tools (Vite, modern ESLint, Vitest, etc.) and libraries are ESM-first or ESM-only.
- Hybrid setups (like this one) that use a single codebase for both client and server benefit from ESM’s interoperability and tree-shaking.

**Key Points:**
- The root `package.json` sets `"type": "module"`, so all `.js` files are treated as ES Modules.
- All code (frontend and backend) must use `import`/`export` syntax.
- Linter configs (`eslint.config.js`, `.eslintrc.server.js`) are set to `sourceType: 'module'` to enforce ESM syntax.
- Utilities like `server/serverPath.js` provide ESM-compatible replacements for `__dirname` and `__filename`.
- If you see references to "convert-all-to-esm" in documentation or scripts, this refers to ensuring all files are ESM-compliant.
- When adding new dependencies, ensure they support ESM or provide an ESM build.

**Development Tips:**
- If you encounter import/export errors, double-check that you are not using any CommonJS syntax.
- Node.js must be v22+ for best ESM compatibility and performance.
- If you migrate code, use tools or scripts to convert legacy CommonJS modules to ESM.

**Linter Enforcement:**
- ESLint will flag any non-ESM syntax as errors.
- Run `npm run lint` to check for violations.

---

## Shared `/src/library` Guidelines

This directory contains core, reusable library functions and services for both the frontend and game logic. These modules are designed for modularity, clarity, and reusability across the project.

---
**Shared Libraries used by both frontend and backend**

`cropUtils.js`
- Utility functions for crop management (client-side).
- Checks crop stages, readiness for harvest, and validates tile crop data.
- Relies on static game data and helper functions.
- Depends on `gameData.js` for crop data and helper functions.

`cropUtilsHelper.js`
- Helper functions for cropUtils, such as stage validation and calculation logic.
- Not intended for direct use outside cropUtils.

`gameData.js`
- Contains static game data definitions (e.g., crop growth stages, tile progression).
- Provides accessors for crop data, growth times, and tile states.
- Used by both crop and map utilities.

---

**When Creating New Library Functions**

Only add functions that are generic, stateless, and potentially reusable across multiple parts of the application (not just a single component or feature).
  - Use ES Modules (`export`/`import` only).
  - Place related helpers in a dedicated helper file (e.g., `cropUtilsHelper.js`).
  - Use JSDoc for all exported functions and classes (document parameters, return types, and side effects).

- **Best Practices:**  
  - Avoid side effects unless necessary (e.g., for service classes).
  - Handle errors gracefully and provide meaningful error messages.
  - Write pure functions where possible.
  - Keep functions small and focused on a single responsibility.
  - If stateful, use service class patterns (see `MapService.js`).
  - Prefer named exports for utility functions; default export for main service classes.

- **Security:**  
  - Do not store secrets or credentials.
  - Sanitize and validate all inputs where applicable.
