import express from 'express';
import dotenv from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

// In-memory storage for MVP testing
const suppliersByProduct = new Map();

// Initialize Shopify API with Node adapter
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products'],
  hostName: process.env.SHOPIFY_SHOP_NAME.replace('.myshopify.com', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

app.use(express.json());

// POST endpoint to add a supplier to a product
app.post('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, priority, price, stockLevel } = req.body;

    // Validate required fields
    if (!name || priority === undefined || !price || stockLevel === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'priority', 'price', 'stockLevel']
      });
    }

    // Verify product exists
    const client = new shopify.clients.Graphql({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const formattedProductId = productId.includes('/') ? productId : `gid://shopify/Product/${productId}`;

    const response = await client.query({
      data: `{
        product(id: "${formattedProductId}") {
          id
          title
        }
      }`
    });

    // If we get here, product exists
    // Create new supplier
    const supplier = {
      id: Date.now().toString(),
      name,
      priority,
      price,
      stockLevel,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // Store supplier (in-memory for now)
    if (!suppliersByProduct.has(productId)) {
      suppliersByProduct.set(productId, []);
    }
    
    const suppliers = suppliersByProduct.get(productId);
    suppliers.push(supplier);
    
    // Sort suppliers by priority
    suppliers.sort((a, b) => a.priority - b.priority);

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

// GET endpoint to retrieve suppliers for a product
app.get('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get suppliers from our storage
    const suppliers = suppliersByProduct.get(productId) || [];
    
    // Return sorted by priority
    res.json(suppliers.sort((a, b) => a.priority - b.priority));
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Basic health check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'Multi-Supplier Management App Running'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
