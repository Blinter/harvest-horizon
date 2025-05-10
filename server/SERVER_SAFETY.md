# Server Safety and Process Management Guide

## ⚠️ IMPORTANT: Node Process Management Safety

When developing with any Node.js-based IDE, while developing in a test environment and using agentic mode, **NEVER** use commands like:

- `killall -9 node`
- `pkill -9 node`
- `taskkill /F /IM node.exe` (Windows)

These commands will terminate **ALL** Node.js processes, including the IDE itself, which will:

- Immediately terminate your development environment
- Cause loss of unsaved work
- Disrupt your development workflow
- Potentially corrupt files in rare cases

## Preventing Duplicate Server Instances

Nodemon can sometimes spawn multiple Express server instances when restarting, which can cause port conflicts on port 3000. To prevent this, the project includes:

1. A custom nodemon configuration (`nodemon.json`) that:

   - Properly watches only relevant server files
   - Uses the kill-port utility during restarts
   - Sets appropriate delay between restarts

2. The `NODEMON_RESTART` environment variable to detect restarts

3. Logic in `startServer()` to:
   - Detect when nodemon is restarting the server
   - Ensure clean environment before database connections
   - Safely clear port 3000 if it's already in use

If you encounter port conflicts, try:

- Running `npm run safe-dev` instead of `npm run dev`
- Manually clearing port 3000 with `npx kill-port 3000`
- Checking if multiple server instances are running with `ps -ef | grep node`

## ✅ Safe Process Management

Instead, use these safe approaches for process management:

### 1. Use the Built-in Safe Kill Function

```javascript
// Import from server.js
import { safeKillNodeProcesses } from './server/server.js';

// Kill all non-IDE Node processes
await safeKillNodeProcesses();

// Kill only processes on a specific port
await safeKillNodeProcesses(3000);
```

### 2. Use the Safe Reset API Endpoint (Development)

Make a POST request to:

```
POST /api/dev/safe-reset
```

This will safely shut down the server and exit with code 100, which can be used by process managers to restart the application.

### 3. Use Process PID Instead of Node Name

Find a specific PID and kill only that process:

```
ps -ef | grep node
kill <specific_pid>  # not kill -9, use regular SIGTERM
```

## How the Safety System Works

1. The `safeKillNodeProcesses()` function:

   - Lists all running Node processes
   - Identifies IDE processes by command line arguments
   - Skips all processes containing IDE processes, etc.
   - Only terminates processes that are clearly not part of the IDE

2. Port Clearing:

   - Server startup automatically checks if port 3000 is in use
   - Uses the safe kill mechanism to free the port
   - Falls back to alternative ports if clearing fails

3. Graceful Shutdown:
   - Signal handlers properly release all resources
   - Database connections are properly closed
   - Server port is properly released

## Best Practices

1. Always let the server exit naturally via signals (`SIGINT`, `SIGTERM`)
2. Use the safe reset API endpoint during development for clean restarts
3. If clearing port 3000 manually, use the safe utility function
4. For custom scripts, always check process command lines before terminating

## Troubleshooting

If port 3000 remains unavailable after server shutdown:

1. Use the safe process management endpoint:

   ```
   curl -X POST http://localhost:3000/api/dev/safe-reset
   ```

2. Check which process is using port 3000:

   ```
   lsof -i :3000
   ```

3. Use the safe kill function in a separate Node script:
   ```javascript
   import { safeKillNodeProcesses } from './server/server.js';
   await safeKillNodeProcesses(3000);
   ```
