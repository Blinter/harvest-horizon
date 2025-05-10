import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Use a different port, e.g., 3001
const PORT = process.env.DOC_PORT || 3001;
// Path to the generated JSDoc documentation (relative to the root)
const DOCS_PATH = path.join(__dirname, '..', 'docs');

// Middleware to serve static files from the 'docs' directory
app.use(express.static(DOCS_PATH));

// Basic route for confirmation
app.get('/', (req, res) => {
  // You could redirect to index.html or send a simple message
  // For now, let's just confirm it's running
  res.send('JSDoc server is running. Navigate to index.html.');
});

app.listen(PORT, () => {
  console.log(`JSDoc server listening at http://0.0.0.0:${PORT}`);
});

export default app; // Export for potential testing or extension
