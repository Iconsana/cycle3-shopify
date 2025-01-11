import { ProductSupplier, PurchaseOrder } from '../models/index.js';
import shopify from '../../config/shopify.js';

async function generatePurchaseOrders(order) {
  try {
    const { line_items, shipping_address, order_number } = order;
    const supplierItems = await groupItemsBySupplier(line_items);
    const purchaseOrders = [];

    for (const [supplierId, items] of Object.entries(supplierItems)) {
      const poNumber = `PO-${order_number}-${supplierId}`;
      
      const purchaseOrder = new PurchaseOrder({
        poNumber,
        supplierId,
        orderReference: order_number,
        items: items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          title: item.title,
          variant_id: item.variant_id,
          supplierPrice: item.supplierPrice,
          leadTime: item.leadTime
        })),
        shippingAddress: shipping_address
      });

      await purchaseOrder.save();
      purchaseOrders.push(purchaseOrder);
      
      // Create Shopify metafield for reference
      await createPoMetafield(order.id, purchaseOrder);
    }

    return purchaseOrders;
  } catch (error) {
    console.error('Error generating purchase orders:', error);
    throw error;
  }
}

async function groupItemsBySupplier(lineItems) {
  const supplierItems = {};
  
  for (const item of lineItems) {
    // Find supplier assignments for this product
    const productSuppliers = await ProductSupplier.find({ 
      productId: item.product_id 
    }).populate('supplierId').sort({ priority: -1 });

    if (!productSuppliers.length) {
      console.warn(`No supplier found for product: ${item.product_id}`);
      continue;
    }

    // Get primary supplier or available alternative
    const supplier = await determineSupplier(productSuppliers, item.quantity);
    
    if (!supplierItems[supplier._id]) {
      supplierItems[supplier._id] = [];
    }
    
    supplierItems[supplier._id].push({
      ...item,
      supplierPrice: supplier.price,
      leadTime: supplier.leadTime
    });
  }
  
  return supplierItems;
}

async function determineSupplier(suppliers, quantity) {
  // Find first supplier with enough stock
  for (const supplier of suppliers) {
    if (supplier.stockLevel >= quantity) {
      return supplier;
    }
  }
  
  // If no supplier has enough stock, return highest priority supplier
  return suppliers[0];
}

async function createPoMetafield(orderId, purchaseOrder) {
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
        namespace: 'multi_supplier_pos',
        key: `po_${purchaseOrder.poNumber}`,
        value: JSON.stringify(purchaseOrder),
        type: 'json'
      }
    }
  });
}

export { generatePurchaseOrders };
