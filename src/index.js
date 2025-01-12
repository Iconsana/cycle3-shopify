import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// In-memory storage
const suppliers = new Map();
const productSuppliers = new Map();

app.use(express.json());
app.use(express.static('public'));

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API Routes
app.post('/api/suppliers', (req, res) => {
  const supplier = {
    id: crypto.randomUUID(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  suppliers.set(supplier.id, supplier);
  res.status(201).json(supplier);
});

app.get('/api/suppliers', (req, res) => {
  res.json(Array.from(suppliers.values()));
});

app.post('/api/products/:productId/suppliers', (req, res) => {
  const { productId } = req.params;
  const { supplierId, priority, price, stockLevel } = req.body;
  
  const assignment = {
    id: crypto.randomUUID(),
    productId,
    supplierId,
    priority: priority || 0,
    price,
    stockLevel,
    updatedAt: new Date().toISOString()
  };
  
  if (!productSuppliers.has(productId)) {
    productSuppliers.set(productId, new Map());
  }
  productSuppliers.get(productId).set(supplierId, assignment);
  
  res.status(201).json(assignment);
});

app.get('/api/products/:productId/suppliers', (req, res) => {
  const { productId } = req.params;
  const assignments = productSuppliers.has(productId) 
    ? Array.from(productSuppliers.get(productId).values())
    : [];
  res.json(assignments);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    message: 'Multi-Supplier Management App Running',
    stats: {
      suppliers: suppliers.size,
      productAssignments: productSuppliers.size
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Ready to manage suppliers and process orders');
});
