import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import webhookRoutes from './routes/webhooks.js';
import { connectDB } from './database.js';
import { registerWebhooks } from './services/webhook-registration.js';
import shopify from '../config/shopify.js';
import fs from 'fs';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to load data from JSON file
const loadDataFromFile = (filename) => {
  const dataPath = path.join(__dirname, '..', 'data', filename);
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Check if file exists, if not return empty array
    if (!fs.existsSync(dataPath)) {
      return [];
    }
    
    // Read and parse file
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading data from ${filename}:`, error);
    return [];
  }
};

// Function to save data to JSON file
const saveDataToFile = (filename, data) => {
  const dataPath = path.join(__dirname, '..', 'data', filename);
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write data to file
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Data saved to ${filename}`);
    return true;
  } catch (error) {
    console.error(`Error saving data to ${filename}:`, error);
    return false;
  }
};

// Initialize app.locals with data from files
const initializeAppData = (app) => {
  app.locals.suppliers = loadDataFromFile('suppliers.json');
  app.locals.productSuppliers = loadDataFromFile('product-suppliers.json');
  app.locals.purchaseOrders = loadDataFromFile('purchase-orders.json');
  
  console.log('Data loaded from files:');
  console.log(`- Suppliers: ${app.locals.suppliers.length}`);
  console.log(`- Product-Supplier relationships: ${app.locals.productSuppliers.length}`);
  console.log(`- Purchase Orders: ${app.locals.purchaseOrders.length}`);
};

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

// Try to connect to MongoDB, but continue even if it fails
// This makes MongoDB optional for the MVP testing phase
let dbConnection = null;
if (process.env.MONGODB_URI) {
  try {
    dbConnection = await connectDB();
    if (dbConnection) {
      console.log('MongoDB connected successfully');
    } else {
      console.log('MongoDB connection failed, but continuing with in-memory storage');
    }
  } catch (error) {
    console.error('MongoDB connection error, continuing with in-memory storage:', error.message);
  }
} else {
  console.log('No MongoDB URI provided, using in-memory storage only');
}

// App setup
const app = express();
const port = process.env.PORT || 10000;

// Define paths properly - going up one directory from src to reach public
const publicPath = path.join(__dirname, '..', 'public');
console.log('Public directory path:', publicPath);

// In-memory storage for MVP testing
app.locals.useInMemoryStorage = !dbConnection;
// Initialize data from files
initializeAppData(app);

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
    message: 'Multi-Supplier Management App Running',
    storage: app.locals.useInMemoryStorage ? 'in-memory' : 'mongodb',
    time: new Date().toISOString()
  });
});

// Root route - serve index.html or API status based on content type
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(200).json({ 
      status: 'healthy',
      message: 'Multi-Supplier Management App Running',
      storage: app.locals.useInMemoryStorage ? 'in-memory' : 'mongodb' 
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

// Product Management UI Route
app.get('/products', (req, res) => {
  res.sendFile(path.join(publicPath, 'product-management.html'));
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
    
    // Save to file
    saveDataToFile('suppliers.json', app.locals.suppliers);
    
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
    
    // Save to file
    saveDataToFile('product-suppliers.json', app.locals.productSuppliers);
    
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
    
    // Find suppliers from productSuppliers array
    let suppliers = app.locals.productSuppliers.filter(ps => ps.productId === productId) || [];
    
    // Debug logging
    console.log(`GET /api/products/${productId}/suppliers`);
    console.log('Total productSuppliers in memory:', app.locals.productSuppliers.length);
    console.log('Product IDs in storage:', [...new Set(app.locals.productSuppliers.map(ps => ps.productId))]);
    console.log(`Returning: ${suppliers.length} suppliers for product ${productId}`);
    
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

    // Log before adding
    console.log('Current productSuppliers count:', app.locals.productSuppliers.length);
    console.log('Adding new supplier for product:', productId);
    
    // Add to in-memory storage
    app.locals.productSuppliers.push(newSupplier);
    
    // Save to file for persistence
    saveDataToFile('product-suppliers.json', app.locals.productSuppliers);
    
    // Log after adding
    console.log('New productSuppliers count:', app.locals.productSuppliers.length);
    
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

// API route to get a specific product from Shopify
app.get('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`GET /api/products/${productId}`);
    
    // For MVP testing, create a client using the app's access token
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const response = await client.get({
      path: `products/${productId}`
    });

    res.json(response.body.product || {});
    
  } catch (error) {
    console.error(`Error fetching product ${req.params.productId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch product',
      message: error.message
    });
  }
});

// API routes for all products
app.get('/api/products', (req, res) => {
  try {
    const products = app.locals.products || [];
    console.log(`GET /api/products - returning: ${products.length} products`);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products', message: error.message });
  }
});

// API route to sync products from Shopify
app.post('/api/products/sync', async (req, res) => {
  try {
    console.log('Starting product sync...');
    
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });
    
    // Fetch products from Shopify
    let allProducts = [];
    let params = { limit: 50 };
    let hasNextPage = true;
    
    while (hasNextPage) {
      const response = await client.get({
        path: 'products',
        query: params
      });
      
      const products = response.body.products || [];
      allProducts = [...allProducts, ...products];
      
      // Check if there's a next page
      hasNextPage = false;
      if (response.pageInfo?.nextPage?.query) {
        params = response.pageInfo.nextPage.query;
        hasNextPage = true;
      }
    }
    
    console.log(`Fetched ${allProducts.length} products from shop`);
    
    // Store in app.locals
    app.locals.products = allProducts.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      variants: product.variants?.map(v => ({
        id: v.id,
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        inventory_quantity: v.inventory_quantity || 0
      })) || []
    }));
    
    console.log(`Synchronized ${app.locals.products.length} products`);
    
    res.json({ 
      success: true, 
      message: `Synchronized ${app.locals.products.length} products` 
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({ error: 'Error syncing products', message: error.message });
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
    
    // Save updated data to files
    saveDataToFile('product-suppliers.json', app.locals.productSuppliers);
    saveDataToFile('purchase-orders.json', app.locals.purchaseOrders);
    
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

// Debug endpoint to view app state
app.get('/api/debug/app-state', (req, res) => {
  const state = {
    suppliers: {
      count: app.locals.suppliers.length,
      data: app.locals.suppliers
    },
    productSuppliers: {
      count: app.locals.productSuppliers.length,
      uniqueProductIds: [...new Set(app.locals.productSuppliers.map(ps => ps.productId))],
      data: app.locals.productSuppliers
    },
    purchaseOrders: {
      count: app.locals.purchaseOrders.length
    },
    products: {
      count: app.locals.products?.length || 0
    },
    storageMode: app.locals.useInMemoryStorage ? 'in-memory' : 'mongodb',
    dataFiles: {
      suppliersFile: fs.existsSync(path.join(__dirname, '..', 'data', 'suppliers.json')),
      productSuppliersFile: fs.existsSync(path.join(__dirname, '..', 'data', 'product-suppliers.json')),
      purchaseOrdersFile: fs.existsSync(path.join(__dirname, '..', 'data', 'purchase-orders.json'))
    }
  };
  
  res.json(state);
});

// Webhook routes
app.use('/webhooks', webhookRoutes);

// Test connection route
app.get('/test-connection', (req, res) => {
  console.log('GET /test-connection');
  res.status(200).json({ 
    status: 'connected',
    message: 'API is connected and working properly',
    storage: app.locals.useInMemoryStorage ? 'in-memory' : 'mongodb',
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

// Initial product sync at startup
(async () => {
  try {
    console.log('Starting initial product sync...');
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });
    
    // Fetch products from Shopify
    let allProducts = [];
    let params = { limit: 50 };
    let hasNextPage = true;
    
    while (hasNextPage) {
      const response = await client.get({
        path: 'products',
        query: params
      });
      
      const products = response.body.products || [];
      allProducts = [...allProducts, ...products];
      
      // Check if there's a next page
      hasNextPage = false;
      if (response.pageInfo?.nextPage?.query) {
        params = response.pageInfo.nextPage.query;
        hasNextPage = true;
      }
    }
    
    console.log(`Fetched ${allProducts.length} products from shop`);
    
    // Store in app.locals
    app.locals.products = allProducts.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      variants: product.variants?.map(v => ({
        id: v.id,
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        inventory_quantity: v.inventory_quantity || 0
      })) || []
    }));
    
    console.log(`Successfully synchronized ${app.locals.products.length} products from Shopify`);
  } catch (error) {
    console.error('Initial product sync failed, but continuing app startup:', error.message);
  }
})();

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
    console.log(`Storage mode: ${app.locals.useInMemoryStorage ? 'in-memory (MongoDB not connected)' : 'mongodb'}`);
  });
})();

export default app;