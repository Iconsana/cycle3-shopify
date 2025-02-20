import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';
import authRoutes from './routes/auth.js';
import { connectDB } from './database.js';
import { verifyRequest, validateHmac } from './middleware/auth.js';
import shopify from '../config/shopify.js';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to MongoDB
await connectDB();

const app = express();
const port = process.env.PORT || 10000;

// Debug logging for paths
const publicPath = path.join(__dirname, '../public');
console.log('Public directory path:', publicPath);

// Middleware
app.use(express.json());
app.use(validateHmac);

// Auth routes (unprotected)
app.use(authRoutes);

// Webhook routes (needs different auth)
app.use('/webhooks', webhookRoutes);

// Static files (protected)
app.use('/static', verifyRequest, express.static(publicPath));

// API Routes (protected)
app.get('/api/products/:productId/suppliers', verifyRequest, (req, res) => {
  const { productId } = req.params;
  const suppliers = suppliersByProduct.get(productId) || [];
  res.json(suppliers);
});

app.post('/api/products/:productId/suppliers', verifyRequest, (req, res) => {
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

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Public directory serving from: ${publicPath}`);
});

export default app;
