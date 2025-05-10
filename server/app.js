/**
 * @file Manages the core Express application configuration and setup.
 * @module server/app
 * @description Initializes the Express app, integrating essential middleware
 *   (CORS, JSON parsing, URL encoding, Morgan logging, Helmet security,
 *   rate limiting). Configures API routes, a 404 handler for unmatched
 *   paths, and a centralized error handler. Sets 'trust proxy' for
 *   compatibility with reverse proxies like Nginx.
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// Import path module
import path from 'path';
// Import fileURLToPath
import { fileURLToPath } from 'url';
import { NotFoundError } from './expressError.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import characterRoutes from './routes/character.js';
import marketRoutes from './routes/market.js';
import walletRoutes from './routes/wallet.js';
import statusLogRoutes from './routes/statusLog.js';
import mapsRouter from './routes/maps.js';
import quickStartRoutes from './routes/quickStart.js';

// Determine if running in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

const app = express();

// Trust the first proxy (e.g., Nginx)
app.set('trust proxy', 1);

// Middleware
// Allow only the farm.blinter.link
if (!isDevelopment) {
  app.use(cors({ origin: 'https://farm.blinter.link' }));
} else {
  // Development
  app.use(cors());
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// Configure Helmet
let helmetConfig;

if (isDevelopment) {
  // Relax CSP for inline scripts *only* in development
  helmetConfig = {
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "default-src": ["'self'"],
        "script-src": ["'self'"], // Base policy
        "connect-src": ["'self'"], // Base policy for connections
        "font-src": ["'self'"], // Allow only self-hosted fonts
        "img-src": ["'self'", "data:", "blob:"],
        // Add other directives as needed
      },
    },
    // Set COOP to unsafe-none to TRY and reduce warnings on HTTP in any 
    // environment
    // This is NOT recommended for production due to security implications.
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  };

  // Allow WebSocket connections for Vite HMR *only* in development
  helmetConfig.contentSecurityPolicy.directives["connect-src"].push("ws:");
  // COOP is already set to unsafe-none above for all environments based on request
} else {
  // Stricter Production CSP
  helmetConfig = {
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'default-src': ["'self'"],
        // Initially allow only self, add unsafe-inline
        'script-src': ["'self'", "'unsafe-inline'"],
        // Allow inline styles
        'style-src': ["'self'", "'unsafe-inline'"],
        // Allow self, data URIs, and blob URLs for images
        'img-src': ["'self'", 'data:', 'blob:'],
        // Allow self for API calls, WebSocket connections will be added later
        'connect-src': ["'self'"],
        // Allow self, data URIs
        'font-src': ["'self'", 'data:'],
        // Disallow plugins like Flash
        'object-src': ["'none'"],
        // Disallow audio/video unless specifically needed
        'media-src': ["'none'"],
        // Disallow embedding in frames
        'frame-src': ["'none'"],
        // Send upgrade header
        'upgrade-insecure-requests': [],
      },
    },
  };

  // Allow WebSocket connections
  // TODO: Replace ws://* with specific origin in production
  helmetConfig.contentSecurityPolicy.directives['connect-src'].push("ws:");
}

// Apply Helmet middleware
// disable helmet for development on production builds
app.use(helmet(helmetConfig));

// Rate Limiting Middleware
const limiter = rateLimit({
  // 5 minutes
  windowMs: 5 * 60 * 1000,
  // Limit each IP to 10000 requests per `window` (here, per 5 minutes)
  max: 10000,
  // Return rate limit info in the `RateLimit-*` headers
  standardHeaders: true,
  // Disable the `X-RateLimit-*` headers
  legacyHeaders: false,
});
app.use(limiter); // Apply the rate limiting middleware to all requests

// Determine the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the frontend build directory (assuming it's one level up)
const frontendDistPath = path.resolve(__dirname, '..', 'dist');

// Serve static files from the React app build directory
app.use(express.static(frontendDistPath));

// Custom request logger middleware
app.use((req, res, next) => {
  console.info({
    timestamp: new Date().toISOString(),
    service: 'AppMiddleware',
    message: `Incoming Request: ${req.method} ${req.originalUrl}`,
    context: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      // Add other relevant request details if needed
    },
  });
  next(); // Pass control to the next middleware (morgan, routes, etc.)
});

// API Routes
console.log('Loading /api/auth routes...');
app.use('/api/auth', authRoutes);
console.log('Loading /api/user routes...');
app.use('/api/user', userRoutes);
console.log('Loading /api/character routes...');
app.use('/api/character', characterRoutes);
console.log('Loading /api/market routes...');
app.use('/api/market', marketRoutes);
console.log('Loading /api/wallets routes...');
app.use('/api/wallets', walletRoutes);
console.log('Loading /api/status-logs routes...');
app.use('/api/status-logs', statusLogRoutes);
console.log('Loading /api/maps routes...');
app.use('/api/maps', mapsRouter);
console.log('Loading /api/quick-start routes...');
app.use('/api/quick-start', quickStartRoutes);
console.log('Finished loading API routes.');

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// This needs to be AFTER API routes but BEFORE the 404 handler.
app.get(/^.*$/, (req, res, next) => {
  // Ensure the request is not for an API endpoint before sending index.html
  if (!req.originalUrl.startsWith('/api/')) {
    res.sendFile(path.resolve(frontendDistPath, 'index.html'));
  } else {
    // If it's an API route that wasn't caught, let it fall through to 404
    next();
  }
});

// 404 Handler - This is the ONLY 404 handler for the API
// It will catch any requests that don't match the defined routes above OR the '*' route
app.use((req, res, next) => {
  return next(new NotFoundError());
});

// Error Handler
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(status).json({
    error: { message, status },
  });
});

export default app;
