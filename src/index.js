import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';
import { connectDB } from './database.js';
import { registerWebhooks } from './services/webhook-registration.js';
import shopify from '../config/shopify.js';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Debug logging
console.log('Environment Check:', {
  hasShopifyKey: !!process.env.SHOPIFY_API_KEY,
  hasShopifySecret: !!process.env.SHOPIFY_API_SECRET,
  appUrl: process.env.APP_URL,
  shopName: process.env.SHOPIFY_SHOP_NAME,
  hasMongoUri: !!process.env.MONGODB_URI
});

// Connect to MongoDB with improved error handling
try {
  await connectDB();
} catch (error) {
  console.error('MongoDB connection error but continuing app startup:', error);
}

const app = express();
const port = process.env.PORT || 10000;

// Define paths properly - going up one directory from src to reach public
const publicPath = path.join(__dirname, '..', 'public');
console.log('Public directory path:', publicPath);

// In-memory storage for MVP testing
app.locals.suppliers = [];
app.locals.productSuppliers = [];
app.locals.purchaseOrders = [];

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files from public directory - ENSURE THIS COMES BEFORE ROUTES
app.use(express.static(publicPath));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'Multi-Supplier Management App Running'
  });
});

// Root route - serve index.html or API status based on content type
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(200).json({ 
      status: 'healthy',
      message: 'Multi-Supplier Management App Running'
    });
  }
});

// Special route for test page
app.get('/test', (req, res) => {
  res.sendFile(path.join(publicPath, 'test.html'));
});

// Supplier Management UI Route
app.get('/suppliers', (req, res) => {
  res.sendFile(path.join(publicPath, 'supplier-management.html'));
});

// API Routes for Suppliers
app.get('/api/suppliers', (req, res) => {
  console.log('GET /api/suppliers - returning:', app.locals.suppliers?.length || 0, 'suppliers');
  res.json(app.locals.suppliers || []);
});

app.post('/api/suppliers', (req, res) => {
  try {
    const supplier = {
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      leadTime: parseInt(req.body.leadTime) || 1,
      apiType: req.body.apiType || 'email',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    app.locals.suppliers.push(supplier);
    console.log('Added new supplier:', supplier.name);
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ error: 'Error adding supplier', message: error.message });
  }
});

// API Routes for Product Suppliers
app.get('/api/product-suppliers', (req, res) => {
  try {
    const productId = req.query.productId;
    let result = app.locals.productSuppliers || [];
    
    if (productId) {
      result = result.filter(ps => ps.productId === productId);
    }
    
    console.log(`GET /api/product-suppliers - returning: ${result.length} suppliers`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching product suppliers:', error);
    res.status(500).json({ error: 'Error fetching product suppliers', message: error.message });
  }
});

app.post('/api/product-suppliers', (req, res) => {
  try {
    const productSupplier = {
      id: Date.now().toString(),
      productId: req.body.productId,
      productName: req.body.productName || req.body.productId,
      supplierId: req.body.supplierId,
      supplierName: app.locals.suppliers.find(s => s.id === req.body.supplierId)?.name || 'Unknown',
      priority: parseInt(req.body.priority) || 1,
      price: parseFloat(req.body.price),
      stockLevel: parseInt(req.body.stockLevel) || 0,
      lastUpdated: new Date().toISOString()
    };
    
    app.locals.productSuppliers.push(productSupplier);
    console.log('Added new product supplier for product:', productSupplier.productId);
    res.status(201).json(productSupplier);
  } catch (error) {
    console.error('Error adding product supplier:', error);
    res.status(500).json({ error: 'Error adding product supplier', message: error.message });
  }
});

// API routes for specific product's suppliers
app.get('/api/products/:productId/suppliers', (req, res) => {
  try {
    const { productId } = req.params;
    const suppliers = app.locals.productSuppliers.filter(ps => ps.productId === productId) || [];
    console.log(`GET /api/products/${productId}/suppliers - returning: ${suppliers.length} suppliers`);
    res.json(suppliers);
  } catch (error) {
    console.error(`Error fetching suppliers for product ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Error fetching suppliers', message: error.message });
  }
});

app.post('/api/products/:productId/suppliers', (req, res) => {
  try {
    const { productId } = req.params;
    const supplierData = req.body;
    console.log(`POST /api/products/${productId}/suppliers - data:`, supplierData);

    // Find the supplier name if supplierId is provided
    let supplierName = supplierData.name;
    if (supplierData.supplierId) {
      const supplier = app.locals.suppliers.find(s => s.id === supplierData.supplierId);
      if (supplier) {
        supplierName = supplier.name;
      }
    }

    const newSupplier = {
      id: Date.now().toString(),
      productId,
      supplierId: supplierData.supplierId,
      supplierName: supplierName || supplierData.name || 'Unknown',
      priority: parseInt(supplierData.priority) || 1,
      price: parseFloat(supplierData.price),
      stockLevel: parseInt(supplierData.stockLevel) || 0,
      createdAt: new Date().toISOString()
    };

    app.locals.productSuppliers.push(newSupplier);
    console.log('Added new supplier for product:', productId);
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error(`Error adding supplier for product ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Error adding supplier', message: error.message });
  }
});

// API route for product metafields
app.get('/api/products/:productId/metafields', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`GET /api/products/${productId}/metafields`);
    
    // For MVP testing, create a client using the app's access token
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const response = await client.get({
      path: `products/${productId}/metafields`,
      query: {
        namespace: 'cycle3_supplier'
      }
    });

    // Return the metafields
    console.log(`Found ${response.body.metafields?.length || 0} metafields`);
    res.json(response.body.metafields || []);
    
  } catch (error) {
    console.error('Error fetching product metafields:', error);
    res.status(500).json({
      error: 'Failed to fetch product metafields',
      message: error.message
    });
  }
});

// Purchase Order routes
app.get('/api/purchase-orders', (req, res) => {
  try {
    console.log(`GET /api/purchase-orders - returning: ${app.locals.purchaseOrders?.length || 0} orders`);
    res.json(app.locals.purchaseOrders || []);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Error fetching purchase orders', message: error.message });
  }
});

app.post('/api/purchase-orders/simulate', (req, res) => {
  try {
    console.log('POST /api/purchase-orders/simulate');
    
    // Implement order simulation with fallback logic
    const order = {
      id: 'ORD-' + Date.now(),
      items: req.body.items || [],
      status: 'processing',
      createdAt: new Date().toISOString()
    };
    
    // Group suppliers by product
    const productSuppliers = {};
    app.locals.productSuppliers.forEach(ps => {
      if (!productSuppliers[ps.productId]) {
        productSuppliers[ps.productId] = [];
      }
      productSuppliers[ps.productId].push(ps);
    });
    
    // For each product in order, find available supplier
    const pos = [];
    order.items.forEach(item => {
      const suppliers = productSuppliers[item.productId] || [];
      suppliers.sort((a, b) => a.priority - b.priority);
      
      // Find first supplier with stock
      let selectedSupplier = null;
      for (const supplier of suppliers) {
        if (supplier.stockLevel >= item.quantity) {
          selectedSupplier = supplier;
          break;
        }
      }
      
      // Fallback to highest priority if none has enough stock
      if (!selectedSupplier && suppliers.length > 0) {
        selectedSupplier = suppliers[0];
      }
      
      if (selectedSupplier) {
        // Create or update PO
        let po = pos.find(p => p.supplierId === selectedSupplier.supplierId);
        if (!po) {
          po = {
            poNumber: 'PO-' + Date.now() + '-' + selectedSupplier.supplierId.substr(0, 4),
            supplierId: selectedSupplier.supplierId,
            supplierName: selectedSupplier.supplierName,
            items: [],
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          pos.push(po);
        }
        
        // Add item to PO
        po.items.push({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: selectedSupplier.price
        });
        
        // Update stock (for simulation)
        selectedSupplier.stockLevel = Math.max(0, selectedSupplier.stockLevel - item.quantity);
      }
    });
    
    // Add POs to storage
    app.locals.purchaseOrders.push(...pos);
    console.log(`Generated ${pos.length} purchase orders`);
    
    res.status(201).json({
      orderId: order.id,
      purchaseOrders: pos
    });
  } catch (error) {
    console.error('Error simulating order:', error);
    res.status(500).json({
      error: 'Failed to simulate order',
      message: error.message
    });
  }
});

// Webhook routes
app.use('/webhooks', webhookRoutes);

// Test connection route
app.get('/test-connection', (req, res) => {
  console.log('GET /test-connection');
  res.status(200).json({ 
    status: 'connected',
    message: 'API is connected and working properly',
    time: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message
  });
});

// 404 handler - Return index.html for client-side routing
app.use((req, res) => {
  // If API route, return 404 JSON
  if (req.path.startsWith('/api')) {
    console.log(`404 API route not found: ${req.path}`);
    return res.status(404).json({
      status: 'error',
      message: 'API Endpoint Not Found'
    });
  }
  
  // For all other routes, return the main index.html (for SPA routing)
  console.log(`Serving index.html for path: ${req.path}`);
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Register webhooks and start server
(async () => {
  try {
    await registerWebhooks();
  } catch (error) {
    console.error('Error registering webhooks but continuing app startup:', error);
  }
  
  // Start the server
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Public directory serving from: ${publicPath}`);
  });
})();

export default app;
