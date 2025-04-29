import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webhookRoutes from './routes/webhooks.js';
import { connectDB } from './database.js';
import cookieParser from 'cookie-parser';
import { verifyAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
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

// Add auth routes
app.use('/', authRoutes);

// Apply auth middleware to protected routes
app.use('/api/suppliers', verifyAuth, supplierRoutes);
app.use('/api/products', verifyAuth, productRoutes);
// Other protected routes...

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Public routes that don't need auth
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
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


// Make sure these lines appear BEFORE your routes in index.js
// But AFTER your middleware setup

// Define paths properly
// const publicPath = path.join(__dirname, '..', 'public');

// Serve static files from public directory
app.use(express.static(publicPath));

// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}
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


// API endpoint for product detail with suppliers
app.get('/api/products/:productId/detail', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`GET /api/products/${productId}/detail - Loading product detail`);
    
    // FIX: Ensure consistent string comparison for product IDs
    const stringProductId = String(productId);
    
    // First - Try to find the product in our database
    let product = await getProductById(stringProductId);
    
    // If not found in our database, try to fetch from Shopify
    if (!product) {
      console.log(`Product ${stringProductId} not found in database, trying Shopify API`);
      
      try {
        // Create a client using the app's access token
        const client = new shopify.clients.Rest({
          session: {
            shop: process.env.SHOPIFY_SHOP_NAME,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN
          }
        });

        const response = await client.get({
          path: `products/${productId}`
        });

        if (response.body.product) {
          product = {
            id: response.body.product.id,
            title: response.body.product.title,
            handle: response.body.product.handle,
            variants: response.body.product.variants.map(v => ({
              id: v.id,
              title: v.title,
              sku: v.sku || '',
              price: parseFloat(v.price),
              inventory_quantity: v.inventory_quantity
            }))
          };
        }
      } catch (shopifyError) {
        console.error(`Error fetching product from Shopify: ${shopifyError.message}`);
      }
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get suppliers for this product
    const suppliers = await getProductSuppliers(stringProductId);
    
    console.log(`Found ${suppliers.length} suppliers for product ${stringProductId}`);
    
    // Send the response
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
// API routes for specific product's suppliers
// Improved route to get a specific product's suppliers
app.get('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Find suppliers from productSuppliers array
    const suppliers = await getProductSuppliers(productId);
    
    // Debug logging
    console.log(`GET /api/products/${productId}/suppliers`);
    console.log(`Returning: ${suppliers.length} suppliers for product ${productId}`);
    
    res.json(suppliers);
  } catch (error) {
    console.error(`Error fetching suppliers for product ${req.params.productId}:`, error);
    res.status(500).json({ error: 'Error fetching suppliers', message: error.message });
  }
});

// Modify the API route for adding suppliers to products to handle different input formats
app.post('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    const supplierData = req.body;
    console.log(`POST /api/products/${productId}/suppliers - data:`, supplierData);

    const db = await getDB();
    await db.read();
    
    // FIX: Ensure consistent string comparison for product IDs
    const stringProductId = String(productId);
    
    // Validate if product exists (but don't block if product ID is in a different format)
    const product = db.data.products.find(p => String(p.id) === stringProductId);
    
    // Find or create supplier
    let supplierId = supplierData.supplierId;
    let supplierName = supplierData.name || supplierData.supplierName;
    
    if (supplierId) {
      // Using existing supplier - look it up to get the name
      const existingSupplier = db.data.suppliers.find(s => s.id === supplierId);
      if (existingSupplier) {
        supplierName = existingSupplier.name;
      }
    } else if (supplierName) {
      // Check if supplier already exists with this name
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
        
        console.log(`Created new supplier: ${newSupplier.name} with ID: ${supplierId}`);
      }
    } else {
      return res.status(400).json({ error: 'Either supplierId or name must be provided' });
    }

    // Get product name from either the product or the supplier data
    const productName = product?.title || supplierData.productName || 'Unknown Product';

    // Check if this relationship already exists
    const existingRelationship = db.data.productSuppliers.find(ps => 
      String(ps.productId) === stringProductId && 
      ps.supplierId === supplierId
    );
    
    if (existingRelationship) {
      // Update existing relationship
      existingRelationship.priority = parseInt(supplierData.priority) || existingRelationship.priority;
      existingRelationship.price = parseFloat(supplierData.price) || existingRelationship.price;
      existingRelationship.stockLevel = parseInt(supplierData.stockLevel) || existingRelationship.stockLevel;
      existingRelationship.updatedAt = new Date().toISOString();
      
      console.log(`Updated existing relationship: ${existingRelationship.id}`);
      
      await db.write();
      return res.json(existingRelationship);
    }

    // Create new product-supplier relationship
    const newRelationship = {
      id: Date.now().toString(),
      productId: stringProductId,
      supplierId: supplierId,
      name: supplierName, // Keep name for backward compatibility
      supplierName: supplierName,
      productName: productName,
      priority: parseInt(supplierData.priority) || 1,
      price: parseFloat(supplierData.price),
      stockLevel: parseInt(supplierData.stockLevel) || 0,
      createdAt: new Date().toISOString()
    };
    
    console.log(`Creating new relationship with ID: ${newRelationship.id} for product: ${stringProductId} and supplier: ${supplierName}`);
    
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
// PATCH route to update supplier stock or other properties
app.patch('/api/products/:productId/suppliers/:relationshipId', async (req, res) => {
  try {
    const { productId, relationshipId } = req.params;
    const updateData = req.body;
    
    console.log(`PATCH /api/products/${productId}/suppliers/${relationshipId} - data:`, updateData);
    
    const db = await getDB();
    await db.read();
    
    // FIX: Ensure consistent string comparison for IDs
    const stringProductId = String(productId);
    const stringRelationshipId = String(relationshipId);
    
    // Find relationship
    const relationship = db.data.productSuppliers.find(ps => 
      String(ps.id) === stringRelationshipId && 
      String(ps.productId) === stringProductId
    );
    
    if (!relationship) {
      console.error(`Relationship not found: ProductID=${stringProductId}, RelationshipID=${stringRelationshipId}`);
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

// Improved product sync functionality
app.post('/api/products/sync', async (req, res) => {
  try {
    console.log('Starting product sync...');
    
    // Create a client with proper error handling
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });
    
    console.log('Created Shopify client, fetching products...');
    
    // Better error handling for the API request
    let response;
    try {
      response = await client.get({
        path: 'products',
        query: { limit: 20 } // Reduced limit for testing
      });
    } catch (apiError) {
      console.error('Shopify API error:', apiError.message);
      console.error('Status:', apiError.status);
      console.error('Headers:', apiError.headers);
      
      // Check for common issues
      if (apiError.message.includes('access')) {
        return res.status(403).json({ 
          error: 'Shopify API access denied. Check access token and permissions.',
          details: apiError.message
        });
      }
      
      throw apiError; // Re-throw to be caught by outer catch
    }
    
    // Process products with careful error handling
    const products = response.body.products || [];
    console.log(`Fetched ${products.length} products from shop`);
    
    if (products.length === 0) {
      console.log('Warning: No products returned from Shopify');
      // This isn't an error - store may be empty
    }
    
    // Format products for storage with error resilience
    const formattedProducts = products.map(product => ({
      id: product.id,
      title: product.title || 'Unnamed Product',
      handle: product.handle || '',
      variants: Array.isArray(product.variants) ? product.variants.map(v => ({
        id: v.id,
        title: v.title || '',
        sku: v.sku || '',
        price: parseFloat(v.price || 0),
        inventory_quantity: parseInt(v.inventory_quantity || 0, 10)
      })) : []
    }));
    
    // Safely store in database
    try {
      const db = await getDB();
      await db.read();
      db.data.products = formattedProducts;
      await db.write();
      console.log(`Successfully stored ${formattedProducts.length} products in database`);
    } catch (dbError) {
      console.error('Database error when storing products:', dbError);
      return res.status(500).json({ 
        error: 'Failed to store products in database',
        message: dbError.message 
      });
    }
    
    // Update in-memory state
    req.app.locals.products = formattedProducts;
    
    console.log(`Synchronized ${formattedProducts.length} products`);
    
    // Return success response
    res.json({ 
      success: true, 
      message: `Synchronized ${formattedProducts.length} products`,
      products: formattedProducts.map(p => ({id: p.id, title: p.title})) // Just return minimal info
    });
  } catch (error) {
    console.error('Product sync failed:', error);
    res.status(500).json({ 
      error: 'Error syncing products', 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
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

// Add this route to src/index.js to get all product-supplier relationships
app.get('/api/product-suppliers', async (req, res) => {
  try {
    const { productId } = req.query;
    
    const db = await getDB();
    await db.read();
    
    let relationships = db.data.productSuppliers || [];
    
    // Filter by product ID if provided
    if (productId) {
      // Ensure string comparison
      const stringProductId = String(productId);
      relationships = relationships.filter(ps => String(ps.productId) === stringProductId);
      console.log(`Filtered to ${relationships.length} relationships for product ${stringProductId}`);
    }
    
    // Enrich with product and supplier names if needed
    const enrichedRelationships = relationships.map(rel => {
      // If missing product name, try to find it
      if (!rel.productName) {
        const product = db.data.products.find(p => String(p.id) === String(rel.productId));
        if (product) {
          rel.productName = product.title;
        }
      }
      
      // If missing supplier name, try to find it
      if (!rel.supplierName && rel.supplierId) {
        const supplier = db.data.suppliers.find(s => s.id === rel.supplierId);
        if (supplier) {
          rel.supplierName = supplier.name;
        }
      }
      
      return rel;
    });
    
    console.log(`GET /api/product-suppliers - returning: ${enrichedRelationships.length} relationships`);
    res.json(enrichedRelationships);
  } catch (error) {
    console.error('Error fetching product-supplier relationships:', error);
    res.status(500).json({ 
      error: 'Error fetching product-supplier relationships', 
      message: error.message 
    });
  }
});

// Add this route to handle getting products for a specific supplier
app.get('/api/suppliers/:supplierId/products', async (req, res) => {
  try {
    const { supplierId } = req.params;
    console.log(`GET /api/suppliers/${supplierId}/products`);
    
    const db = await getDB();
    await db.read();
    
    // Find all relationships for this supplier
    const relationships = db.data.productSuppliers.filter(ps => ps.supplierId === supplierId);
    console.log(`Found ${relationships.length} relationships for supplier ${supplierId}`);
    
    // Enrich with product details
    const enrichedRelationships = relationships.map(rel => {
      // Try to find product in products array
      if (!rel.productName) {
        const product = db.data.products.find(p => String(p.id) === String(rel.productId));
        if (product) {
          rel.productName = product.title;
        }
      }
      return rel;
    });
    
    res.json(enrichedRelationships);
  } catch (error) {
    console.error(`Error fetching products for supplier ${req.params.supplierId}:`, error);
    res.status(500).json({ 
      error: 'Error fetching supplier products', 
      message: error.message 
    });
  }
});

// Add a debug route to get the application state
app.get('/api/debug/app-state', async (req, res) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Create a summary of the app state
    const state = {
      suppliers: {
        count: db.data.suppliers.length,
        samples: db.data.suppliers.slice(0, 3) // Just show a few samples
      },
      productSuppliers: {
        count: db.data.productSuppliers.length,
        uniqueProductIds: [...new Set(db.data.productSuppliers.map(ps => ps.productId))],
        uniqueSupplierIds: [...new Set(db.data.productSuppliers.map(ps => ps.supplierId))],
        samples: db.data.productSuppliers.slice(0, 3) // Just show a few samples
      },
      products: {
        count: db.data.products.length,
        samples: db.data.products.slice(0, 2).map(p => ({
          id: p.id,
          title: p.title
        }))
      },
      storage: app.locals.useInMemoryStorage ? 'file-based' : 'mongodb',
      serverTime: new Date().toISOString()
    };
    
    console.log(`GET /api/debug/app-state - Returning app state summary`);
    res.json(state);
  } catch (error) {
    console.error('Error getting app state:', error);
    res.status(500).json({ 
      error: 'Error getting app state', 
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
