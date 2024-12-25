import shopify from '../../config/shopify.js';

export async function setupWebhooks() {
  const client = new shopify.clients.Rest({
    session: {
      shop: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    }
  });

  try {
    // Register webhook for order creation
    await client.post({
      path: 'webhooks',
      data: {
        webhook: {
          topic: 'orders/create',
          address: `${process.env.HOST}/webhooks/order/create`,
          format: 'json'
        }
      }
    });
    
    console.log('Webhook registered successfully');
  } catch (error) {
    console.error('Error registering webhook:', error);
    throw error;
  }
}
