import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import shopify from '@shopify/shopify-api';

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
app.post('/api/products/:productId/suppliers', async (req, res) => {
  try {
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

    // Store in our app's data
    if (!productSuppliers.has(productId)) {
      productSuppliers.set(productId, new Map());
    }
    productSuppliers.get(productId).set(supplierId, assignment);

    // Store in Shopify metafields
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: 'suppliers',
          key: `supplier_${supplierId}`,
          value: JSON.stringify(assignment),
          type: 'json'
        }
      }
    });
    
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning supplier:', error);
    res.status(500).json({ error: 'Failed to assign supplier' });
  }
});

app.get('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get suppliers from our app's data
    const appSuppliers = productSuppliers.has(productId) 
      ? Array.from(productSuppliers.get(productId).values())
      : [];

    // Get suppliers from Shopify metafields
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const metafields = await client.get({
      path: `products/${productId}/metafields`
    });

    // Combine and deduplicate suppliers
    const allSuppliers = [...appSuppliers];
    for (const metafield of metafields.data) {
      if (metafield.namespace === 'suppliers') {
        const supplierData = JSON.parse(metafield.value);
        if (!allSuppliers.find(s => s.id === supplierData.id)) {
          allSuppliers.push(supplierData);
        }
      }
    }

    res.json(allSuppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
