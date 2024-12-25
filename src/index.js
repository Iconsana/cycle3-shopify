import express from 'express';
import dotenv from 'dotenv';
import { shopifyWebhooks } from './routes/webhooks.js';
import { setupWebhooks } from './services/shopify.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/webhooks', shopifyWebhooks);

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
