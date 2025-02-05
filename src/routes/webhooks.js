// src/routes/webhooks.js
import express from 'express';
import { generatePurchaseOrders } from '../services/po-generator.js';
import { ProductSupplier, Supplier } from '../models/index.js';

const router = express.Router();

// Verify Shopify webhook authenticity
const verifyShopifyWebhook = (req) => {
  // TODO: Add proper signature verification for production
  return true;
};

// Handle new orders
router.post('/orders/create', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const order = req.body;
    console.log('New order received:', order.order_number);

    // Generate POs for the order
    const purchaseOrders = await generatePurchaseOrders(order);
    
    // Log PO generation success
    console.log(`Generated ${purchaseOrders.length} purchase orders for order ${order.order_number}`);
    
    // Return success even if there are no POs (some products might not need them)
    res.status(200).json({
      success: true,
      message: `Generated ${purchaseOrders.length} purchase orders`,
      purchaseOrders: purchaseOrders.map(po => po.poNumber)
    });

  } catch (error) {
    console.error('Error processing order webhook:', error);
    res.status(500).json({ 
      error: 'Error processing order webhook',
      details: error.message
    });
  }
});

// Handle order cancellations
router.post('/orders/cancelled', async (req, res) => {
  try {
    if (!verifyShopifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const order = req.body;
    
    // TODO: Implement PO cancellation logic
    // This could include:
    // - Finding related POs
    // - Updating their status
    // - Notifying suppliers

    res.status(200).json({
      success: true,
      message: 'Order cancellation processed'
    });

  } catch (error) {
    console.error('Error processing order cancellation:', error);
    res.status(500).json({ error: 'Error processing order cancellation' });
  }
});

// Export the router
export default router;
