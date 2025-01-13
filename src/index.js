import express from 'express';
import dotenv from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { getProductSuppliers, addProductSupplier, updateProductSupplier } from './api/productSuppliers.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

// Initialize Shopify API with Node adapter
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'],
  hostName: process.env.SHOPIFY_SHOP_NAME.replace('.myshopify.com', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

app.use(express.json());

// Product Supplier Routes
app.get('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const suppliers = await getProductSuppliers(req.params.productId);
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const supplier = await addProductSupplier(req.params.productId, req.body);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:productId/suppliers/:supplierId', async (req, res) => {
  try {
    const supplier = await updateProductSupplier(req.params.supplierId, req.body);
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint stays the same...

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
