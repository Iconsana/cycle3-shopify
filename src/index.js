import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// In-memory storage
const suppliers = new Map();
const productSuppliers = new Map();

app.use(express.json());

// Supplier Management Endpoints
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

// Webhook handling
app.post('/webhooks/order/create', async (req, res) => {
  try {
    const order = req.body;
    console.log('Processing order:', order.order_number);
    
    // Generate POs grouped by supplier
    const posBySupplier = new Map();
    
    for (const item of order.line_items || []) {
      const productSupplierList = productSuppliers.get(item.product_id);
      if (!productSupplierList) {
        console.log(`No suppliers found for product ${item.product_id}`);
        continue;
      }
      
      // Find best supplier (highest priority with stock)
      const assignments = Array.from(productSupplierList.values())
        .sort((a, b) => b.priority - a.priority);
      
      const supplier = assignments.find(s => s.stockLevel >= item.quantity)
        || assignments[0]; // Fallback to highest priority if none have stock
        
      if (!posBySupplier.has(supplier.supplierId)) {
        posBySupplier.set(supplier.supplierId, {
          poNumber: `PO-${order.order_number}-${supplier.supplierId.slice(0,4)}`,
          supplierId: supplier.supplierId,
          items: [],
          status: 'pending_approval'
        });
      }
      
      posBySupplier.get(supplier.supplierId).items.push({
        sku: item.sku,
        quantity: item.quantity,
        title: item.title,
        price: supplier.price
      });
    }
    
    const purchaseOrders = Array.from(posBySupplier.values());
    console.log('Generated POs:', purchaseOrders);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Health check endpoint
app.get('/', (req, res) => {
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
