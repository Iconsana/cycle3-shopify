import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// In-memory storage
const suppliers = new Map();
const purchaseOrders = new Map();

app.use(express.json());

// Health check endpoint (MUST be before static files)
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'Supplier Management App Running'
  });
});

// API Routes
app.post('/api/suppliers', (req, res) => {
  const supplier = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  suppliers.set(supplier.id, supplier);
  res.status(201).json(supplier);
});

app.get('/api/suppliers', (req, res) => {
  res.json(Array.from(suppliers.values()));
});

// Webhook endpoint
app.post('/webhooks/order/create', async (req, res) => {
  try {
    const order = req.body;
    console.log('New order received:', order.order_number);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
