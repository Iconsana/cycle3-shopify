// src/routes/webhooks.js
import express from 'express';
import { generatePurchaseOrders } from '../services/po-generator.js';

const router = express.Router();

router.post('/order-created', async (req, res) => {
  try {
    const order = req.body;
    const purchaseOrders = await generatePurchaseOrders(order);
    res.json({ success: true, purchaseOrders });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
