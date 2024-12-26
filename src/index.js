import express from 'express';
import dotenv from 'dotenv';
import shopify, { generatePurchaseOrder, setupWebhooks } from '../config/shopify.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Add more detailed homepage
app.get('/', (req, res) => {
  console.log('Homepage accessed from:', req.headers.host);
  res.send(`
    <h1>Cycle3 Shopify PO Automation</h1>
    <p>Server is running</p>
    <p>Current host: ${req.headers.host}</p>
  `);
});

app.listen(port, async () => {
  console.log('==================================');
  console.log(`Server running on port ${port}`);
  console.log('Current environment:');
  console.log('HOST:', process.env.HOST);
  console.log('Server URL:', `http://localhost:${port}`);
  console.log('==================================');
  
  try {
    await setupWebhooks();
    console.log('Webhooks configured successfully');
  } catch (error) {
    console.error('Error configuring webhooks:', error);
  }
});
