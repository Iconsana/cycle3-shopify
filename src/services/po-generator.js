import shopify from '../../config/shopify.js';

export async function generatePurchaseOrder(order) {
  try {
    // Extract order details
    const { line_items, shipping_address, order_number } = order;
    
    // Create PO structure
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

    // Store PO details in Shopify metafields
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
