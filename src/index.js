import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Basic health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    message: 'Multi-Supplier Management App Running'
  });
});

// Simple webhook endpoint
app.post('/webhooks/order/create', (req, res) => {
  console.log('Order webhook received');
  res.status(200).send('OK');
});

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
