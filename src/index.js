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

// Database connection and initialization will be done after routes are set up
let dbConnection = null;

// Initialize function to handle database setup
const initializeDatabase = async () => {
  // Try to connect to MongoDB, but continue even if it fails
  if (process.env.MONGODB_URI) {
    try {
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

  // Register webhooks (after server is started)
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

// Helper function to send file with navigation
const sendFileWithNav = (res, filePath) => {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.send(injectNavigation(html));
  } catch (error) {
    console.error('Error serving file with navigation:', error);
    res.sendFile(filePath); // Fallback to regular sendFile
  }
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

// Start the server first, then initialize the database
app.listen(port, () => {
  console.log(`Multi-Supplier Management app listening on port ${port}`);
  
  // Initialize database after server has started
  initializeDatabase().catch(error => {
    console.error('Database initialization error:', error);
  });
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

// Additional routes would go here, but for simplicity we're keeping this minimal
// The main goal is to fix the initialization order issue
