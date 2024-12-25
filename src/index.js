import express from 'express';
import dotenv from 'dotenv';
import shopify, { generatePurchaseOrder, setupWebhooks } from '../config/shopify.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Webhook endpoint for new orders
app.post('/webhooks/order/create', async (req, res) => {
  try {
    const order = req.body;
    console.log('New order received:', order.id);
    
    await generatePurchaseOrder(order);
    
    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.get('/', (req, res) => {
  res.send('Cycle3 Shopify PO Automation');
});

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  try {
    await setupWebhooks();
    console.log('Webhooks configured successfully');
  } catch (error) {
    console.error('Error configuring webhooks:', error);
  }
});
