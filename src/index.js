import express from 'express';
import dotenv from 'dotenv';
import shopify, { generatePurchaseOrder } from '../config/shopify.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/webhooks/order/create', async (req, res) => {
  try {
    console.log('Order webhook received');
    const order = req.body;
    
    await generatePurchaseOrder(order);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing order webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.get('/', (req, res) => {
  res.send('Cycle3 Shopify PO Automation Running');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
