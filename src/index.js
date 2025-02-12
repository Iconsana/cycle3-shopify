import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';
import { connectDB } from './database.js';
import mongoose from 'mongoose';
import { registerWebhooks } from './services/webhook-registration.js';
import shopify from '../config/shopify.js';

// Add this after your imports in index.js
// Debug logging
console.log('Environment Check:', {
  hasShopifyKey: !!process.env.SHOPIFY_API_KEY,
  hasShopifySecret: !!process.env.SHOPIFY_API_SECRET,
  appUrl: process.env.APP_URL,
  shopName: process.env.SHOPIFY_SHOP_NAME,
  hasMongoUri: !!process.env.MONGODB_URI
});

// Update your MongoDB connection to include more error details
try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected successfully');
} catch (error) {
  console.error('MongoDB connection error details:', {
    name: error.name,
    message: error.message,
    code: error.code,
    errorType: error.constructor.name
  });
}

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT || 10000;

// Debug logging for paths
const publicPath = path.join(__dirname, '../public');
console.log('Public directory path:', publicPath);

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files from public directory
app.use(express.static(publicPath));

// In-memory storage for MVP testing
const suppliersByProduct = new Map();

// Basic health check and test page
app.get('/', (req, res) => {
  if (req.headers.accept?.includes('text/html')) {
    res.sendFile(path.join(publicPath, 'test.html'));
  } else {
    res.status(200).json({ 
      status: 'healthy',
      message: 'Multi-Supplier Management App Running'
    });
  }
});

// API Routes
app.get('/api/products/:productId/suppliers', (req, res) => {
  const { productId } = req.params;
  const suppliers = suppliersByProduct.get(productId) || [];
  res.json(suppliers);
});

app.post('/api/products/:productId/suppliers', (req, res) => {
  const { productId } = req.params;
  const supplierData = req.body;

  if (!suppliersByProduct.has(productId)) {
    suppliersByProduct.set(productId, []);
  }

  const suppliers = suppliersByProduct.get(productId);
  suppliers.push({
    id: Date.now().toString(),
    ...supplierData
  });

  res.status(201).json(supplierData);
});

// Webhook routes
app.use('/webhooks', webhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not Found'
  });
});

// Register webhooks and start server
(async () => {
  try {
    await registerWebhooks();
    console.log('Webhooks registered successfully');
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Public directory serving from: ${publicPath}`);
    });
  } catch (error) {
    console.error('Failed to register webhooks:', error);
    // Still start the server even if webhook registration fails
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Public directory serving from: ${publicPath}`);
    });
  }
})();

export default app;
