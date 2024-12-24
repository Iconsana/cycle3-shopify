import express from 'express';
import dotenv from 'dotenv';
import { shopifyWebhooks } from './routes/webhooks.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/webhooks', shopifyWebhooks);

app.get('/', (req, res) => {
  res.send('Cycle3 Shopify PO Automation');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
