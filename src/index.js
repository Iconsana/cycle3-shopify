import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Shopify webhook verification middleware
const verifyShopifyWebhook = (req, res, next) => {
  try {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];
    
    if (!hmac || !topic) {
      console.log('Missing required headers');
      return res.status(401).send('Invalid webhook');
    }

    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      console.log('SHOPIFY_API_SECRET not configured - skipping verification');
      return next();
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('base64');

    const verified = hash === hmac;
    if (!verified) {
      console.log('Invalid HMAC');
      return res.status(401).send('Invalid webhook signature');
    }

    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Webhook verification failed');
  }
};

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    message: 'Multi-Supplier Management App Running',
    features: {
      webhooks: 'enabled',
      shopify: process.env.SHOPIFY_API_SECRET ? 'configured' : 'not configured'
    }
  });
});

// Webhook endpoint with verification
app.post('/webhooks/order/create', verifyShopifyWebhook, (req, res) => {
  try {
    const order = req.body;
    console.log('Order webhook received:', {
      id: order.id,
      order_number: order.order_number,
      total_price: order.total_price,
      line_items_count: order.line_items?.length
    });
    
    // Process order here
    // For now, just acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Shopify webhooks:', process.env.SHOPIFY_API_SECRET ? 'Configured' : 'Not configured');
});
