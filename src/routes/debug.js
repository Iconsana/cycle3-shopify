import express from 'express';
import { initDB } from '../services/database.js';

const router = express.Router();

// Get app state for debugging
router.get('/app-state', async (req, res) => {
  try {
    // Get data from app.locals
    const { suppliers, productSuppliers, purchaseOrders, products, useInMemoryStorage } = req.app.locals;
    
    const state = {
      suppliers: {
        count: Array.isArray(suppliers) ? suppliers.length : 'unavailable',
        samples: Array.isArray(suppliers) ? suppliers.slice(0, 2) : []
      },
      productSuppliers: {
        count: Array.isArray(productSuppliers) ? productSuppliers.length : 'unavailable',
        uniqueProductIds: Array.isArray(productSuppliers) 
          ? [...new Set(productSuppliers.map(ps => ps.productId))]
          : [],
        samples: Array.isArray(productSuppliers) ? productSuppliers.slice(0, 2) : []
      },
      purchaseOrders: {
        count: Array.isArray(purchaseOrders) ? purchaseOrders.length : 'unavailable',
        samples: Array.isArray(purchaseOrders) ? purchaseOrders.slice(0, 1) : []
      },
      products: {
        count: Array.isArray(products) ? products.length : 'unavailable',
        samples: Array.isArray(products) ? products.slice(0, 1) : []
      },
      storageMode: useInMemoryStorage ? 'file-based' : 'mongodb',
      serverTime: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(state);
  } catch (error) {
    console.error('Error getting app state:', error);
    res.status(500).json({ 
      error: 'Error getting app state',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// Get environment variables (sanitized)
router.get('/env', (req, res) => {
  // Only show select environment variables, and sanitize sensitive values
  const safeEnv = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_URL: process.env.APP_URL,
    SHOPIFY_SHOP_NAME: process.env.SHOPIFY_SHOP_NAME,
    PORT: process.env.PORT,
    // Show presence but not actual values of sensitive info
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? '[SET]' : '[NOT SET]',
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? '[SET]' : '[NOT SET]',
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN ? '[SET]' : '[NOT SET]',
    MONGODB_URI: process.env.MONGODB_URI ? '[SET]' : '[NOT SET]',
    // Add more env vars as needed
    DB_PATH: process.env.NODE_ENV === 'production' 
      ? '/tmp/cycle3-shopify-db.json'
      : './data/cycle3-shopify-db.json'
  };
  
  res.json(safeEnv);
});

// Initialize database
router.post('/init-db', async (req, res) => {
  try {
    const db = await initDB();
    
    // Update app.locals with fresh data
    const { suppliers, productSuppliers, purchaseOrders, products } = db.data;
    req.app.locals.suppliers = suppliers || [];
    req.app.locals.productSuppliers = productSuppliers || [];
    req.app.locals.purchaseOrders = purchaseOrders || [];
    req.app.locals.products = products || [];
    
    res.json({
      success: true,
      message: '