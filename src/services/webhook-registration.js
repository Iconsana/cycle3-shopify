// src/services/webhook-registration.js
import shopify from '../../config/shopify.js';

export async function registerWebhooks() {
  const webhooks = [
    {
      path: '/webhooks/orders/create',
      topic: 'orders/create',
      deliveryMethod: 'HTTP',
    },
    {
      path: '/webhooks/orders/cancelled',
      topic: 'orders/cancelled',
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

    // First, get existing webhooks
    const response = await client.get({
      path: 'webhooks',
    });
    
    const existingWebhooks = response.body.webhooks || [];
    console.log(`Found ${existingWebhooks.length} existing webhooks`);
    
    let registered = 0;
    let skipped = 0;

    for (const webhook of webhooks) {
      // Check if webhook already exists with same topic and address
      const webhookAddress = `${process.env.APP_URL}${webhook.path}`;
      const exists = existingWebhooks.some(w => 
        w.topic === webhook.topic && 
        w.address === webhookAddress
      );
      
      if (exists) {
        console.log(`Skipping ${webhook.topic} webhook - already exists`);
        skipped++;
        continue;
      }
      
      try {
        // Register new webhook
        await client.post({
          path: 'webhooks',
          data: {
            webhook: {
              topic: webhook.topic,
              address: webhookAddress,
              format: 'json'
            }
          }
        });
        console.log(`Registered ${webhook.topic} webhook`);
        registered++;
      } catch (error) {
        if (error.code === 422) {
          console.log(`Webhook ${webhook.topic} already exists but wasn't detected in our list`);
          skipped++;
        } else {
          throw error;
        }
      }
    }
    
    console.log(`Webhook registration summary: ${registered} registered, ${skipped} skipped`);
  } catch (error) {
    console.error('Error registering webhooks:', error);
    // Don't throw the error, just log it - let the app continue to run
  }
}
