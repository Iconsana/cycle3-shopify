import express from 'express';
import dotenv from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';
import { connectDB } from './database.js';
import mongoose from 'mongoose';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

// Debug logging for paths
const publicPath = path.join(__dirname, '../public');
console.log('Public directory path:', publicPath);

// Initialize Shopify API with Node adapter
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'],
  hostName: process.env.SHOPIFY_SHOP_NAME?.replace('.myshopify.com', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

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

// Add this with other middleware
app.use('/webhooks', webhookRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Public directory serving from: ${publicPath}`);
});

export default app;
