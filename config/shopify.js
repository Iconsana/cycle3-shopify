// config/shopify.js

import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_orders', 'write_orders', 'write_files'],
  hostName: process.env.SHOPIFY_SHOP_NAME,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

async function generatePurchaseOrder(order) {
  try {
    const { line_items, shipping_address, order_number } = order;
    
    const purchaseOrder = {
      poNumber: `PO-${order_number}`,
      items: line_items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        title: item.title,
        variant_id: item.variant_id
      })),
      shippingAddress: shipping_address,
      createdAt: new Date().toISOString()
    };
    await createMetafield(order.id, purchaseOrder);
    
    console.log('Purchase Order generated:', purchaseOrder.poNumber);
    return purchaseOrder;
  } catch (error) {
    console.error('Error generating purchase order:', error);
    throw error;
  }
}

async function createMetafield(orderId, purchaseOrder) {
  const client = new shopify.clients.Rest({
    session: {
      shop: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    }
  });
  
  await client.post({
    path: `orders/${orderId}/metafields`,
    data: {
      metafield: {
        namespace: 'cycle3_po',
        key: 'purchase_order',
        value: JSON.stringify(purchaseOrder),
        type: 'json'
      }
    }
  });
}

export { shopify as default, generatePurchaseOrder };
