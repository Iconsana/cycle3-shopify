// src/services/webhook-registration.js
import shopify from '../../config/shopify.js';

export async function registerWebhooks() {
  const webhooks = [
    {
      path: '/webhooks/orders/create',
      topic: 'orders/create',  // Changed from ORDERS_CREATE
      deliveryMethod: 'HTTP',
    },
    {
      path: '/webhooks/orders/cancelled',
      topic: 'orders/cancelled',  // Changed from ORDERS_CANCELLED
      deliveryMethod: 'HTTP',
    }
  ];

  try {
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    for (const webhook of webhooks) {
      const response = await client.post({
        path: 'webhooks',
        data: {
          webhook: {
            topic: webhook.topic,
            address: `${process.env.APP_URL}${webhook.path}`,
            format: 'json'
          }
        }
      });
      console.log(`Registered ${webhook.topic} webhook`);
    }
  } catch (error) {
    console.error('Error registering webhooks:', error);
    throw error;
  }
}
