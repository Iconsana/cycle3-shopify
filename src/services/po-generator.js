// src/services/po-generator.js
import { ProductSupplier, PurchaseOrder } from '../models/index.js';

export async function generatePurchaseOrders(order) {
  try {
    const { line_items, shipping_address, order_number } = order;
    const supplierItems = await groupItemsBySupplier(line_items);
    const purchaseOrders = [];

    for (const [supplierId, items] of Object.entries(supplierItems)) {
      // Generate unique PO number combining order number and supplier
      const poNumber = `PO-${order_number}-${supplierId.slice(-4)}`;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.supplierPrice), 0);
      const total = subtotal; // Add tax/shipping logic if needed
      
      const purchaseOrder = new PurchaseOrder({
        poNumber,
        supplierId,
        orderReference: order_number,
        status: 'pending_approval',
        items: items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          title: item.title,
          variant_id: item.variant_id,
          supplierPrice: item.supplierPrice,
          lineTotal: item.quantity * item.supplierPrice
        })),
        shippingAddress: formatShippingAddress(shipping_address),
        subtotal,
        total,
        notes: `Order #${order_number}`,
        requiredBy: calculateRequiredDate(items)
      });

      await purchaseOrder.save();
      purchaseOrders.push(purchaseOrder);
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
    // Find all suppliers for this product
    const productSuppliers = await ProductSupplier.find({ 
      productId: item.product_id 
    }).populate('supplierId')
    .sort({ priority: 1 }); // Lower number = higher priority

    if (!productSuppliers.length) {
      console.warn(`No supplier found for product: ${item.product_id}`);
      continue;
    }

    // Find best supplier based on priority, stock, and lead time
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
  // First try primary supplier with sufficient stock
  const primarySupplier = suppliers.find(s => s.stockLevel >= quantity);
  if (primarySupplier) return primarySupplier;

  // If no supplier has enough stock, look at lead times
  const availableSuppliers = suppliers.filter(s => s.stockLevel > 0);
  if (availableSuppliers.length > 0) {
    // Choose supplier with shortest lead time
    return availableSuppliers.sort((a, b) => a.leadTime - b.leadTime)[0];
  }

  // If no supplier has stock, use highest priority supplier
  return suppliers[0];
}

function formatShippingAddress(address) {
  return {
    name: address.name,
    company: address.company,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    province: address.province,
    zip: address.zip,
    country: address.country,
    phone: address.phone
  };
}

function calculateRequiredDate(items) {
  // Get longest lead time from items
  const maxLeadTime = Math.max(...items.map(item => item.leadTime || 0));
  const date = new Date();
  date.setDate(date.getDate() + maxLeadTime);
  return date;
}
