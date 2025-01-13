import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import shopify from '@shopify/shopify-api';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;

// In-memory storage for demo (will be replaced by metaobjects)
const purchaseOrders = new Map();

app.use(express.json());
app.use(express.static('public'));

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
      const client = new shopify.clients.Graphql({
        session: {
          shop: process.env.SHOPIFY_SHOP_NAME,
          accessToken: process.env.SHOPIFY_ACCESS_TOKEN
        }
      });

      const response = await client.query({
        data: {
          query: `{
            shop {
              name
              primaryDomain {
                url
              }
            }
          }`
        }
      });

      results.adminAPI = true;
      results.details.adminAPI = {
        shopName: response.body.data.shop.name,
        domain: response.body.data.shop.primaryDomain.url
      };
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
                products(first: 1) {
                  edges {
                    node {
                      title
                    }
                  }
                }
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
      results.details.storefrontAPI = {
        shopName: data.data.shop.name,
        firstProduct: data.data.shop.products.edges[0]?.node.title || 'No products found'
      };
    } catch (error) {
      results.details.storefrontAPI = { error: error.message };
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supplier Management with Metaobjects
app.post('/api/suppliers', async (req, res) => {
  try {
    const client = new shopify.clients.Graphql({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const { name, email, leadTime } = req.body;
    
    const response = await client.query({
      data: {
        query: `
          mutation CreateSupplier($input: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $input) {
              metaobject {
                id
                handle
                fields {
                  key
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            type: "supplier",
            fields: [
              { key: "name", value: name },
              { key: "email", value: email },
              { key: "lead_time", value: leadTime.toString() },
              { key: "status", value: "active" }
            ]
          }
        }
      }
    });

    res.status(201).json(response.body.data.metaobjectCreate.metaobject);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

app.get('/api/suppliers', async (req, res) => {
  try {
    const client = new shopify.clients.Graphql({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const response = await client.query({
      data: {
        query: `
          {
            metaobjects(type: "supplier", first: 100) {
              edges {
                node {
                  id
                  handle
                  fields {
                    key
                    value
                  }
                }
              }
            }
          }
        `
      }
    });

    const suppliers = response.body.data.metaobjects.edges.map(edge => {
      const fields = edge.node.fields.reduce((acc, field) => {
        acc[field.key] = field.value;
        return acc;
      }, {});

      return {
        id: edge.node.id,
        handle: edge.node.handle,
        ...fields
      };
    });

    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Environment check:', {
    hasAdminToken: !!process.env.SHOPIFY_ACCESS_TOKEN,
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasStorefrontToken: !!process.env.SHOPIFY_STOREFRONT_TOKEN,
    hasShopName: !!process.env.SHOPIFY_SHOP_NAME
  });
});
