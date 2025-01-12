import express from 'express';
import { generatePurchaseOrder } from '../services/po-generator.js';

const router = express.Router();

router.post('/order/create', async (req, res) => {
  try {
    const order = req.body;
    console.log('New order received:', order.order_number);
    
    // Generate PO for the order
    const purchaseOrder = await generatePurchaseOrder(order);
    console.log('Generated PO:', purchaseOrder.poNumber);
    
    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

export default router;
