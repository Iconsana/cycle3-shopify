import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from '../config/database.js';
import { generatePurchaseOrders } from './services/po-generator.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'healthy', message: 'Multi-Supplier Management App Running' });
});

// Webhook endpoint
app.post('/webhooks/order/create', async (req, res) => {
  try {
    console.log('Order webhook received');
    const order = req.body;
    
    const purchaseOrders = await generatePurchaseOrders(order);
    console.log('Generated POs:', purchaseOrders.map(po => po.poNumber));
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing order webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Initialize the server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start listening
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
  // Don't exit the process, just log the error
});

// Start the server
startServer();
