// src/routes/webhooks.js
import express from 'express';
import { ProductSupplier, Supplier } from '../models/index.js';

const router = express.Router();

// Helper function to verify Shopify webhook
const verifyShopifyWebhook = (req) => {
  // TODO: Add webhook verification when going to production
  // For MVP/testing, we'll return true
  return true;
};

// Helper to format customer data
const formatCustomerData = async (customerId) => {
  try {
    // Get all product-supplier relationships involving this customer
    const relationships = await ProductSupplier.find({
      'customerData.customerId': customerId
    });

    return {
      customer_id: customerId,
      relationships: relationships.map(rel => ({
        product_id: rel.productId,
        supplier_id: rel.supplierId,
        created_at: rel.createdAt,
        last_updated: rel.updatedAt
      }))
    };
  } catch (error) {
    console.error('Error formatting customer data:', error);
    return null;
  }
};

// Customer Data Request
router.post('/customers/data_request', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { customer } = req.body;
    const customerData = await formatCustomerData(customer.id);

    if (!customerData) {
      return res.status(404).json({ 
        message: 'No data found for this customer' 
      });
    }

    res.status(200).json(customerData);
  } catch (error) {
    console.error('Error processing customer data request:', error);
    res.status(500).json({ 
      error: 'Error processing customer data request' 
    });
  }
});

// Customer Data Erasure
router.post('/customers/data_erasure', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { customer } = req.body;

    // Delete all customer-related data
    await ProductSupplier.updateMany(
      { 'customerData.customerId': customer.id },
      { $unset: { customerData: 1 } }
    );

    res.status(200).json({ 
      message: 'Customer data deleted successfully' 
    });
  } catch (error) {
    console.error('Error processing customer data erasure:', error);
    res.status(500).json({ 
      error: 'Error processing customer data erasure' 
    });
  }
});

// Shop Data Erasure
router.post('/shop/data_erasure', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { shop_domain } = req.body;

    // Delete all data related to this shop
    await Promise.all([
      ProductSupplier.deleteMany({ shopDomain: shop_domain }),
      Supplier.deleteMany({ shopDomain: shop_domain })
    ]);

    res.status(200).json({ 
      message: 'Shop data deleted successfully' 
    });
  } catch (error) {
    console.error('Error processing shop data erasure:', error);
    res.status(500).json({ 
      error: 'Error processing shop data erasure' 
    });
  }
});

// Order Creation webhook (for future use with PO generation)
router.post('/orders/create', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const order = req.body;
    console.log('New order received:', order.order_number);
    
    // Here we'll add PO generation logic later
    // For now, just acknowledge receipt
    
    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing order creation webhook:', error);
    res.status(500).json({ 
      error: 'Error processing order webhook' 
    });
  }
});

export default router;
