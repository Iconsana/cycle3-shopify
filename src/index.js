import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// In-memory storage
const suppliers = new Map();
const purchaseOrders = new Map();

app.use(express.json());
app.use(express.static('public'));

// Mount webhook routes
app.use('/webhooks', webhookRoutes);

// Basic Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Supplier Routes
app.post('/api/suppliers', (req, res) => {
  const supplier = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  suppliers.set(supplier.id, supplier);
  res.status(201).json(supplier);
});

app.get('/api/suppliers', (req, res) => {
  res.json(Array.from(suppliers.values()));
});

// Status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    features: {
      suppliers: suppliers.size,
      purchaseOrders: purchaseOrders.size,
      webhooks: 'enabled'
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Webhooks configured for order processing');
});
