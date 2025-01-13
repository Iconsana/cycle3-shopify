import express from 'express';
import dotenv from 'dotenv';
import shopify from '@shopify/shopify-api';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

// In-memory storage for demo (will be replaced by metaobjects)
const purchaseOrders = new Map();

app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    res.json({ status: 'healthy' });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
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

// Product-Supplier Assignment
app.post('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    const { supplierId, priority, price, stockLevel } = req.body;

    const client = new shopify.clients.Graphql({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const response = await client.query({
      data: {
        query: `
          mutation CreateProductSupplier($input: MetaobjectCreateInput!) {
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
            type: "product_supplier",
            fields: [
              { key: "product_id", value: productId },
              { key: "supplier_id", value: supplierId },
              { key: "priority", value: priority.toString() },
              { key: "price", value: price.toString() },
              { key: "stock_level", value: stockLevel.toString() }
            ]
          }
        }
      }
    });

    res.status(201).json(response.body.data.metaobjectCreate.metaobject);
  } catch (error) {
    console.error('Error assigning supplier:', error);
    res.status(500).json({ error: 'Failed to assign supplier' });
  }
});

app.get('/api/products/:productId/suppliers', async (req, res) => {
  try {
    const { productId } = req.params;
    
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
            metaobjects(type: "product_supplier", first: 100) {
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

    const assignments = response.body.data.metaobjects.edges
      .map(edge => {
        const fields = edge.node.fields.reduce((acc, field) => {
          acc[field.key] = field.value;
          return acc;
        }, {});

        return {
          id: edge.node.id,
          handle: edge.node.handle,
          ...fields
        };
      })
      .filter(assignment => assignment.product_id === productId);

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching supplier assignments:', error);
    res.status(500).json({ error: 'Failed to fetch supplier assignments' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
