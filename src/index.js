import express from 'express';
import dotenv from 'dotenv';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

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

// Basic health check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'Multi-Supplier Management App Running'
  });
});

// Connection test endpoint
app.get('/test-connection', async (req, res) => {
  try {
    const results = {
      adminAPI: false,
      storefrontAPI: false,
      details: {},
      environment: {
        hasAdminToken: !!process.env.SHOPIFY_ACCESS_TOKEN,
        hasApiKey: !!process.env.SHOPIFY_API_KEY,
        hasStorefrontToken: !!process.env.SHOPIFY_STOREFRONT_TOKEN,
        hasShopName: !!process.env.SHOPIFY_SHOP_NAME
      }
    };

    // Test Admin API
    try {
      const client = new shopify.clients.Rest({
        session: {
          shop: process.env.SHOPIFY_SHOP_NAME,
          accessToken: process.env.SHOPIFY_ACCESS_TOKEN
        }
      });

      const response = await client.get({
        path: 'shop'
      });

      results.adminAPI = true;
      results.details.adminAPI = response.body.shop;
    } catch (error) {
      results.details.adminAPI = { error: error.message };
    }

    // Test Storefront API
    try {
      const response = await fetch(
        `https://${process.env.SHOPIFY_SHOP_NAME}/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
          },
          body: JSON.stringify({
            query: `{
              shop {
                name
              }
            }`
          })
        }
      );

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      results.storefrontAPI = true;
      results.details.storefrontAPI = data.data;
    } catch (error) {
      results.details.storefrontAPI = { error: error.message };
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
