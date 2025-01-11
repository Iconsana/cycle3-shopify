import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from '../config/database.js';
import { generatePurchaseOrders } from './services/po-generator.js';
import supplierRoutes from './routes/suppliers.js';
import webhookRoutes from './routes/webhooks.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/suppliers', supplierRoutes);
app.use('/webhooks', webhookRoutes);

app.post('/webhooks/order/create', async (req, res) => {
  try {
    console.log('Order webhook received');
    const order = req.body;
    
    const purchaseOrders = await generatePurchaseOrders(order);
    
    // Notify merchant if any POs need approval
    const needsApproval = purchaseOrders.some(po => po.approvalRequired);
    if (needsApproval) {
      // TODO: Implement merchant notification
      console.log('POs pending approval:', purchaseOrders.map(po => po.poNumber));
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing order webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.get('/', (req, res) => {
  res.send('Multi-Supplier Management App Running');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
