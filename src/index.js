import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePurchaseOrder } from './services/po-generator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// In-memory storage
const suppliers = new Map();
const productSuppliers = new Map();
const purchaseOrders = new Map();

app.use(express.json());
app.use(express.static('public'));

// Basic Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    message: 'Multi-Supplier Management App Running',
    stats: {
      suppliers: suppliers.size,
      productAssignments: productSuppliers.size,
      purchaseOrders: purchaseOrders.size
    }
  });
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

// Purchase Order Routes
app.post('/api/purchase-orders', async (req, res) => {
  try {
    const order = req.body;
    const po = await generatePurchaseOrder(order);
    purchaseOrders.set(po.poNumber, po);
    res.status(201).json(po);
  } catch (error) {
    console.error('Error creating PO:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

app.get('/api/purchase-orders', (req, res) => {
  res.json(Array.from(purchaseOrders.values()));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Ready to manage suppliers and purchase orders!');
});
