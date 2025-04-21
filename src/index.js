import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webhookRoutes from './routes/webhooks.js';
import { connectDB } from './database.js';
import { registerWebhooks } from './services/webhook-registration.js';
import shopify from '../config/shopify.js';
import { 
  initDB, 
  getDB,
  getSuppliers, 
  addSupplier, 
  getProductSuppliers, 
  addProductSupplier,
  getPurchaseOrders,
  addPurchaseOrders,
  updateProductSupplierStock,
  storeProducts,
  getProducts,
  getProductById
} from './services/database.js';

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

// Initialize Express app
const app = express();
const port = process.env.PORT || 10000;

// Define paths properly - going up one directory from src to reach public
const publicPath = path.join(__dirname, '..', 'public');
console.log('Public directory path:', publicPath);

// Middleware
app.use(express.json());
app.use('/webhooks', webhookRoutes);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files from public directory - ENSURE THIS COMES BEFORE ROUTES
app.use(express.static(publicPath));

// Database connection and initialization
let dbConnection = null;

// Initialize function to handle database setup
const initializeDatabase = async () => {
  // Try to connect to MongoDB, but continue even if it fails
  if (process.env.MONGODB_URI) {
    try {
      console.log("Attempting to connect to MongoDB...");
      console.log("Connection string starts with:", process.env.MONGODB_URI.substring(0, 20) + '...');
      dbConnection = await connectDB();
      if (dbConnection) {
        console.log('MongoDB connected successfully');
      } else {
        console.log('MongoDB connection failed, but continuing with file-based storage');
      }
    } catch (error) {
      console.error('MongoDB connection error, continuing with file-based storage:', error.message);
    }
  } else {
    console.log('No MongoDB URI provided, using file-based storage');
  }

  // Initialize LowDB
  await initDB();

  // Initialize app.locals with data from database
  app.locals.useInMemoryStorage = !dbConnection;
  app.locals.suppliers = await getSuppliers();
  app.locals.productSuppliers = await getProductSuppliers();
  app.locals.purchaseOrders = await getPurchaseOrders();
  app.locals.products = await getProducts();

  console.log('Data loaded from database:');
  console.log(`- Suppliers: ${app.locals.suppliers.length}`);
  console.log(`- Product-Supplier relationships: ${app.locals.productSuppliers.length}`);
  console.log(`- Purchase Orders: ${app.locals.purchaseOrders.length}`);
  console.log(`- Products: ${app.locals.products?.length || 0}`);

  // Create the components directory if it doesn't exist
  const componentsDir = path.join(publicPath, 'components');
  if (!fs.existsSync(componentsDir)) {
    try {
      fs.mkdirSync(componentsDir, { recursive: true });
    } catch (err) {
      console.error('Error creating components directory:', err);
    }
  }

  // Create the navigation HTML file if it doesn't exist
  const navFilePath = path.join(componentsDir, 'nav.html');
  if (!fs.existsSync(navFilePath)) {
    try {
      const navContent = `<!-- shared navigation bar -->
<div class="bg-white shadow-sm mb-6">
  <div class="container mx-auto px-4">
    <div class="flex items-center justify-between py-4">
      <h1 class="text-xl font-bold">Multi-Supplier Management</h1>
      <div class="bg-green-100 text-green-800 px-2 py-1 text-sm rounded">
        ONLINE
      </div>
    </div>
    <div class="flex border-b pb-1">
      <a href="/" class="px-4 py-2 font-medium hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500 transition">Home</a>
      <a href="/suppliers" class="px-4 py-2 font-medium hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500 transition">Suppliers</a>
      <a href="/suppliers?tab=product-suppliers" class="px-4 py-2 font-medium hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500 transition">Product Suppliers</a>
      <a href="/products" class="px-4 py-2 font-medium hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500 transition">Products</a>
      <a href="/suppliers?tab=purchase-orders" class="px-4 py-2 font-medium hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500 transition">Purchase Orders</a>
    </div>
  </div>
</div>`;
      fs.writeFileSync(navFilePath, navContent);
      console.log('Created navigation component file');
    } catch (err) {
      console.error('Error creating navigation file:', err);
    }
  }

  // Register webhooks after initialization
  try {
    await registerWebhooks();
  } catch (error) {
    console.error('Failed to register webhooks:', error);
  }
};

// Helper function to inject navigation into HTML responses
const injectNavigation = (html) => {
  try {
    const navHtml = fs.readFileSync(path.join(publicPath, 'components/nav.html'), 'utf8');
    return html.replace('<body', '<body>' + navHtml + '<body').replace('<body><body', '<body');
  } catch (error) {
    console.error('Error injecting navigation:', error);
    return html;
  }
};

// Helper function to send file (without navigation injection)
const sendFileWithNav = (res, filePath) => {
  res.sendFile(filePath);
};

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'Multi-Supplier Management App Running',
    storage: app.locals?.useInMemoryStorage ? 'file-based' : 'mongodb',
    time: new Date().toISOString()
  });
});

// Root route - serve index.html or API status based on content type
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    sendFileWithNav(res, path.join(publicPath, 'index.html'));
  } else {
    res.status(200).json({ 
      status: 'healthy',
      message: 'Multi-Supplier Management App Running',
      storage: app.locals?.useInMemoryStorage ? 'file-based' : 'mongodb' 
    });
  }
});

// Special route for test page
app.get('/test', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'test.html'));
});

// Test connection endpoint
app.get('/test-connection', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({ 
    status: 'success',
    message: 'API connection successful',
    time: new Date().toISOString()
  });
});

// Supplier Management UI Route
app.get('/suppliers', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'supplier-management.html'));
});

// Product Management UI Route
app.get('/products', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'product-management.html'));
});

// Product Detail UI Route
app.get('/product-detail', (req, res) => {
  sendFileWithNav(res, path.join(publicPath, 'product-detail.html'));
});

// API Routes for Suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await getSuppliers();
    console.log('GET /api/suppliers - returning:', suppliers.length, 'suppliers');
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Error fetching suppliers', message: error.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
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
    
    // Add to database
    await addSupplier(supplier);
    
    // Update in-memory
    app.locals.suppliers = await getSuppliers();
    
    console.log('Added new supplier:', supplier.name);
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ error: 'Error adding supplier', message: error.message });
  }
});

// DELETE a supplier
app.delete('/api/suppliers/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const db = await getDB();
    await db.read();
    
    // Find supplier index
    const index = db.data.suppliers.findIndex(s => s.id === supplierId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Remove supplier
    const removedSupplier = db.data.suppliers.splice(index, 1)[0];
    
    // Also remove any product-supplier relationships with this supplier
    db.data.productSuppliers = db.data.productSuppliers.filter(ps => 
      ps.supplierId !== supplierId
    );
    
    await db.write();
    
    // Update app.locals
    app.locals.suppliers = db.data.suppliers;
    app.locals.productSuppliers = db.data.productSuppliers;
    
    res.json({ 
      message: 'Supplier deleted successfully',
      supplier: removedSupplier
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Error deleting supplier', message: error.message });
  }
});

// DELETE a product-supplier relationship
app.delete('/api/products/:productId/suppliers/:relationshipId', async (req, res) => {
  try {
    const { productId, relationshipId } = req.params;
    const db = await getDB();
    await db.read();
    
    // Find relationship index
    const index = db.data.productSuppliers.findIndex(ps => 
      ps.id === relationshipId && ps.productId === productId
    );
    
    if (index === -1) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    
    // Remove relationship
    const removedRelationship = db.data.productSuppliers.splice(index, 1)[0];
    
    await db.write();
    
    // Update app.locals
    app.locals.productSuppliers = db.data.productSuppliers;
    
    res.json({ 
      message: 'Supplier removed from product successfully',
      relationship: removedRelationship
    });
  } catch (error) {
    console.error('Error removing supplier from product:', error);
    res.status(500).json({ error: 'Error removing supplier', message: error.message });
  }
});

// Get products for a specific supplier
app.get('/api/suppliers/:supplierId/products', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const db = await getDB();
    await db.read();
    
    // Find all product-supplier relationships for this supplier
    const relationships = db.data.productSuppliers.filter(ps => 
      ps.supplierId === supplierId
    );
    
    // Enrich with product data if available
    const enrichedRelationships = await Promise.all(relationships.map(async (rel) => {
      // Try to find product in our database
      const product = db.data.products.find(p => String(p.id) === String(rel.productId));
      
      if (product) {
        return {
          ...rel,
          title: product.title
        };
      }
      
      return rel;
    }));
    
    res.json(enrichedRelationships);
  } catch (error) {
    console.error(`Error fetching products for supplier ${req.params.supplierId}:`, error);
    res.status(500).json({ error: 'Error fetching products', message: error.message });
  }
});

// API Routes for Product Suppliers
app.get('/api/product-suppliers', async (req, res) => {
  try {
    const productId = req.query.productId;
    const result = await getProductSuppliers(productId);
    
    console.log(`GET /api/product-suppliers - returning: ${result.length} suppliers`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching product suppliers:', error);
    res.status(500).json({ error: 'Error fetching product suppliers', message: error.message });
  }
});

app.post('/api/product-suppliers', async (req, res) => {
  try {
    const suppliers = await getSuppliers();
    const productSupplier = {
      id: Date.now().toString(),
      productId: req.body.productId,
      productName: req.body.productName || req.body.productId,
      supplierId: req.body.supplierId,
      supplierName: suppliers.find(s => s.id === req.body.supplierId)?.name || 'Unknown',
      priority: parseInt(req.body.priority) || 1,
      price: parseFloat(req.body.price),
      stockLevel: parseInt(req.body.stockLevel) || 0,
      lastUpdated: new Date().toISOString()
    };
    
    // Add to database
    await addProductSupplier(productSupplier);
    
    // Update in-memory
    app.locals.productSuppliers = await getProductSuppliers();
    
    console.log('Added new product supplier for product:', productSupplier.productId);
    res.status(201).json(productSupplier);
  } catch (error) {
    console.error('Error adding product supplier:', error);
    res.status(500).json({ error: 'Error adding product supplier', message: error.message });
  }
});

// API route to get a specific product with suppliers
app.get('/api/products/:productId/detail', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get the product
    const product = await getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get suppliers for this product
    const suppliers = await getProductSuppliers(productId);
    
    res.json({
      product,
      suppliers
    });
  } catch (error) {
    console.error(`Error fetching product ${req.params.productId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch product detail',
      message: error.message
    });
  }
});
          
          // Return product with suppliers
          return res.json({
            product: response.body.product,
            suppliers: suppliers
          });
        }
      } catch (shopifyError) {
        console.error(`Error fetching product from Shopify:`, shopifyError);
      }
      
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get suppliers for this product
    const suppliers = db.data.productSuppliers.filter(ps => 
      String(ps.productId) === String(productId)
    );
    
    // Enrich suppliers with full supplier details if available
    const enrichedSuppliers = await Promise.all(suppliers.map(async (ps) => {
      if (ps.supplierId) {
        const supplier = db.data.suppliers.find(s => s.id === ps.supplierId);
        if (supplier) {
          return {
            ...ps,
            supplierName: supplier.name,
            leadTime: supplier.leadTime
          };
        }
      }
      return ps;
    }));
    
    res.json({
      product,
      suppliers: enrichedSuppliers
    });
  } catch (error) {
    console.error(`Error fetching product detail ${req.params.productId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch product detail',
      message: error.message
    });
  }
});

// API routes for specific product's suppliers
app.get('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Find suppliers from productSuppliers array
    const suppliers = await getProductSuppliers(productId);
    
    // Debug logging
    console.log(`GET /api/products/${productId}/suppliers`);
    const allProductSuppliers = await getProductSuppliers();
    console.log('Total productSuppliers in database:', allProductSuppliers.length);
    console.log('Product IDs in storage:', [...new Set(allProductSuppliers.map(ps => ps.productId))]);
    console.log(`Returning: ${suppliers.length} suppliers for product ${productId}`);
    
    res.json(suppliers);
  } catch (error) {
    console.error(`Error fetching suppliers for product ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Error fetching suppliers', message: error.message });
  }
});

// Add a supplier to a product with proper two-way connection
app.post('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    const supplierData = req.body;
    console.log(`POST /api/products/${productId}/suppliers - data:`, supplierData);

    const db = await getDB();
    await db.read();
    
    // Validate if product exists
    const product = db.data.products.find(p => String(p.id) === String(productId));
    if (!product && !productId.includes('gid://')) {
      // Only validate if not using a Shopify GID
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Find supplier if supplierId is provided
    let supplierName = supplierData.name;
    let supplierId = supplierData.supplierId;
    
    if (supplierId) {
      const supplier = db.data.suppliers.find(s => s.id === supplierId);
      if (supplier) {
        supplierName = supplier.name;
      }
    } else if (supplierName) {
      // If supplierId is not provided but name is, try to find or create supplier
      const existingSupplier = db.data.suppliers.find(s => 
        s.name.toLowerCase() === supplierName.toLowerCase()
      );
      
      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        // Create a new supplier
        const newSupplier = {
          id: Date.now().toString(),
          name: supplierName,
          email: supplierData.email || `${supplierName.replace(/[^a-z0-9]/gi, '').toLowerCase()}@example.com`,
          leadTime: supplierData.leadTime || 3,
          apiType: supplierData.apiType || 'email',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        
        db.data.suppliers.push(newSupplier);
        supplierId = newSupplier.id;
      }
    }

    // Check if this relationship already exists
    const existingRelationship = db.data.productSuppliers.find(ps => 
      String(ps.productId) === String(productId) && 
      (ps.supplierId === supplierId || ps.name === supplierName)
    );
    
    if (existingRelationship) {
      // Update existing relationship
      existingRelationship.priority = parseInt(supplierData.priority) || existingRelationship.priority;
      existingRelationship.price = parseFloat(supplierData.price) || existingRelationship.price;
      existingRelationship.stockLevel = parseInt(supplierData.stockLevel) || existingRelationship.stockLevel;
      existingRelationship.updatedAt = new Date().toISOString();
      
      await db.write();
      return res.json({
        message: 'Supplier relationship updated',
        relationship: existingRelationship
      });
    }

    // Create new product-supplier relationship
    const newRelationship = {
      id: Date.now().toString(),
      productId: String(productId),
      supplierId: supplierId,
      name: supplierName, // Keep name for backward compatibility
      supplierName: supplierName,
      priority: parseInt(supplierData.priority) || 1,
      price: parseFloat(supplierData.price),
      stockLevel: parseInt(supplierData.stockLevel) || 0,
      createdAt: new Date().toISOString()
    };
    
    // Add product name if available
    if (product) {
      newRelationship.productName = product.title;
    } else if (supplierData.productName) {
      newRelationship.productName = supplierData.productName;
    }

    // Save to database
    db.data.productSuppliers.push(newRelationship);
    await db.write();
    
    // Update app.locals for consistency
    app.locals.productSuppliers = db.data.productSuppliers;
    app.locals.suppliers = db.data.suppliers;
    
    res.status(201).json(newRelationship);
  } catch (error) {
    console.error(`Error adding supplier for product ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Error adding supplier', message: error.message });
  }
});

// PATCH to update a product-supplier relationship (e.g., stock level)
app.patch('/api/products/:productId/suppliers/:relationshipId', async (req, res) => {
  try {
    const { productId, relationshipId } = req.params;
    const updateData = req.body;
    
    const db = await getDB();
    await db.read();
    
    // Find relationship
    const relationship = db.data.productSuppliers.find(ps => 
      ps.id === relationshipId && String(ps.productId) === String(productId)
    );
    
    if (!relationship) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    
    // Update fields
    if (updateData.stockLevel !== undefined) {
      relationship.stockLevel = parseInt(updateData.stockLevel);
    }
    
    if (updateData.price !== undefined) {
      relationship.price = parseFloat(updateData.price);
    }
    
    if (updateData.priority !== undefined) {
      relationship.priority = parseInt(updateData.priority);
    }
    
    relationship.updatedAt = new Date().toISOString();
    
    await db.write();
    
    // Update app.locals
    app.locals.productSuppliers = db.data.productSuppliers;
    
    res.json({
      message: 'Relationship updated successfully',
      relationship
    });
  } catch (error) {
    console.error(`Error updating supplier for product ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Error updating supplier', message: error.message });
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
app.get('/api/products', async (req, res) => {
  try {
    const products = await getProducts();
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
    
    // Format products for storage
    const formattedProducts = allProducts.map(product => ({
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
    
    // Store in database
    await storeProducts(formattedProducts);
    
    // Update in-memory
    app.locals.products = formattedProducts;
    
    console.log(`Synchronized ${formattedProducts.length} products`);
    
    res.json({ 
      success: true, 
      message: `Synchronized ${formattedProducts.length} products` 
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({ error: 'Error syncing products', message: error.message });
  }
});

// Purchase Order routes
app.get('/api/purchase-orders', async (req, res) => {
  try {
    const purchaseOrders = await getPurchaseOrders();
    console.log(`GET /api/purchase-orders - returning: ${purchaseOrders.length} orders`);
    res.json(purchaseOrders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Error fetching purchase orders', message: error.message });
  }
});

app.post('/api/purchase-orders/simulate', async (req, res) => {
  try {
    console.log('POST /api/purchase-orders/simulate');
    
    // Implement order simulation with fallback logic
    const order = {
      id: 'ORD-' + Date.now(),
      items: req.body.items || [],
      status: 'processing',
      createdAt: new Date().toISOString()
    };
    
    // Get all product suppliers
    const allProductSuppliers = await getProductSuppliers();
    
    // Group suppliers by product
    const productSuppliers = {};
    allProductSuppliers.forEach(ps => {
      if (!productSuppliers[ps.productId]) {
        productSuppliers[ps.productId] = [];
      }
      productSuppliers[ps.productId].push(ps);
    });
    
    // For each product in order, find available supplier
    const pos = [];
    order.items.forEach(item => {
      const suppliers = productSuppliers[item.productId] || [];
      suppliers.sort((a, b) => a.priority - b.priority); // Sort by priority
      
      if (suppliers.length === 0) {
        console.log(`No suppliers found for product ${item.productId}`);
        return;
      }
      
      // Find supplier with enough stock
      let selectedSupplier = suppliers.find(s => s.stockLevel >= item.quantity);
      
      // If no supplier has enough stock, use the highest priority one
      if (!selectedSupplier) {
        selectedSupplier = suppliers[0];
        console.log(`No supplier has enough stock for product ${item.productId}, using highest priority supplier`);
      }
      
      // Check if there's already a PO for this supplier
      let po = pos.find(po => po.supplierId === selectedSupplier.supplierId);
      
      if (!po) {
        // Create new PO
        po = {
          poNumber: `PO-${Date.now()}-${selectedSupplier.supplierId.substring(0, 4)}`,
          supplierId: selectedSupplier.supplierId,
          supplierName: selectedSupplier.supplierName || selectedSupplier.name,
          status: 'pending_approval',
          items: [],
          createdAt: new Date().toISOString()
        };
        pos.push(po);
      }
      
      // Add item to PO
      po.items.push({
        productId: item.productId,
        productName: item.name || item.productId,
        quantity: item.quantity,
        price: selectedSupplier.price,
        stockLevel: selectedSupplier.stockLevel
      });
      
      // Update stock level for the supplier
      selectedSupplier.stockLevel = Math.max(0, selectedSupplier.stockLevel - item.quantity);
    });
    
    // Save POs to database and update product suppliers
    if (pos.length > 0) {
      const db = await getDB();
      await db.read();
      
      // Add POs to database
      db.data.purchaseOrders = [...db.data.purchaseOrders, ...pos];
      
      // Update suppliers stock levels
      for (const supplier of Object.values(productSuppliers).flat()) {
        const index = db.data.productSuppliers.findIndex(ps => ps.id === supplier.id);
        if (index !== -1) {
          db.data.productSuppliers[index].stockLevel = supplier.stockLevel;
          db.data.productSuppliers[index].updatedAt = new Date().toISOString();
        }
      }
      
      await db.write();
      
      // Update app.locals
      app.locals.purchaseOrders = db.data.purchaseOrders;
      app.locals.productSuppliers = db.data.productSuppliers;
    }
    
    res.json({
      success: true,
      orderId: order.id,
      purchaseOrders: pos
    });
  } catch (error) {
    console.error('Error simulating order:', error);
    res.status(500).json({ 
      error: 'Error simulating order', 
      message: error.message 
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Multi-Supplier Management app listening on port ${port}`);
  
  // Initialize database after server has started
  initializeDatabase().catch(error => {
    console.error('Database initialization error:', error);
  });
});
