import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;

// In-memory storage
const suppliers = new Map();
const productSuppliers = new Map();
const purchaseOrders = new Map();

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    res.json({ status: 'healthy' });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Supplier Management
app.post('/api/suppliers', (req, res) => {
  const supplier = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  suppliers.set(supplier.id, supplier);
  res.status(201).json(supplier);
});

app.get('/api/suppliers', (req, res) => {
  res.json(Array.from(suppliers.values()));
});

// Product-Supplier Management
app.post('/api/products/:productId/suppliers', (req, res) => {
  const { productId } = req.params;
  const { supplierId, priority, price, stockLevel } = req.body;
  
  if (!suppliers.has(supplierId)) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  const assignment = {
    id: Date.now().toString(),
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

// Purchase Order Management
app.post('/api/purchase-orders', (req, res) => {
  const { orderId, items } = req.body;
  
  // Group items by supplier based on priority and stock
  const posBySupplier = new Map();
  
  for (const item of items) {
    const productSupplierList = productSuppliers.get(item.productId);
    if (!productSupplierList) {
      continue;
    }
    
    // Find best supplier (highest priority with stock)
    const assignments = Array.from(productSupplierList.values())
      .sort((a, b) => b.priority - a.priority);
    
    const supplier = assignments.find(s => s.stockLevel >= item.quantity)
      || assignments[0]; // Fallback to highest priority if none have stock
      
    if (!posBySupplier.has(supplier.supplierId)) {
      posBySupplier.set(supplier.supplierId, {
        poNumber: `PO-${orderId}-${supplier.supplierId.slice(0,4)}`,
        supplierId: supplier.supplierId,
        status: 'pending_approval',
        items: [],
        createdAt: new Date().toISOString()
      });
    }
    
    posBySupplier.get(supplier.supplierId).items.push({
      ...item,
      supplierPrice: supplier.price
    });
  }
  
  // Save POs
  const purchaseOrders = Array.from(posBySupplier.values());
  purchaseOrders.forEach(po => {
    purchaseOrders.set(po.poNumber, po);
  });
  
  res.status(201).json(purchaseOrders);
});

app.get('/api/purchase-orders', (req, res) => {
  res.json(Array.from(purchaseOrders.values()));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
