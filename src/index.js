import express from 'express';
import dotenv from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

// In-memory storage for MVP testing
const suppliersByProduct = new Map();

// Initialize Shopify API with Node adapter
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'],
  hostName: process.env.SHOPIFY_SHOP_NAME.replace('.myshopify.com', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

// Middleware
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check and test page
app.get('/', (req, res) => {
  if (req.headers.accept?.includes('text/html')) {
    res.sendFile(path.join(__dirname, '../public/test.html'));
  } else {
    res.status(200).json({ 
      status: 'healthy',
      message: 'Multi-Supplier Management App Running'
    });
  }
});

[... rest of the routes stay the same ...]
