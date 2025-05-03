// src/services/fallback-logic.js
/**
 * Fallback Logic for Multi-Supplier Management
 * 
 * This module contains the core business logic for determining which supplier
 * to use when processing orders, factoring in stock levels, priorities, and lead times.
 */

/**
 * Determines the best supplier for a product order line item
 * 
 * @param {Array} suppliers - Array of suppliers for this product
 * @param {Number} quantity - Quantity being ordered
 * @param {Object} options - Optional configuration for the algorithm
 * @returns {Object} The selected supplier object
 */
export function determineSupplier(suppliers, quantity, options = {}) {
  // If no suppliers available, return null
  if (!suppliers || suppliers.length === 0) {
    return null;
  }
  
  // Default options
  const config = {
    prioritizeStock: true,     // Whether to prioritize suppliers with sufficient stock
    prioritizeLeadTime: true,  // Whether to consider lead time in decision
    minStockThreshold: 0,      // Minimum stock level to consider
    ...options
  };
  
  // Sort suppliers by priority (lower number = higher priority)
  const prioritizedSuppliers = [...suppliers].sort((a, b) => a.priority - b.priority);
  
  // First, try to find the highest priority supplier with enough stock
  if (config.prioritizeStock) {
    const sufficientStockSupplier = prioritizedSuppliers.find(supplier => 
      supplier.stockLevel >= quantity
    );
    
    if (sufficientStockSupplier) {
      return sufficientStockSupplier;
    }
  }
  
  // If no supplier has enough stock, try to find suppliers with any stock
  // according to the minimum threshold
  const availableSuppliers = prioritizedSuppliers.filter(supplier => 
    supplier.stockLevel > config.minStockThreshold
  );
  
  if (availableSuppliers.length > 0) {
    if (config.prioritizeLeadTime) {
      // Sort by lead time and return the quickest
      return availableSuppliers.sort((a, b) => 
        (a.leadTime || 999) - (b.leadTime || 999)
      )[0];
    }
    
    // Otherwise, return the highest priority one with any stock
    return availableSuppliers[0];
  }
  
  // If no supplier has any stock, return the highest priority supplier
  return prioritizedSuppliers[0];
}

/**
 * Determines optimal allocation of an order across multiple suppliers
 * 
 * @param {Array} suppliers - Array of suppliers for this product
 * @param {Number} quantity - Total quantity needed
 * @returns {Array} Array of allocation objects {supplierId, quantity}
 */
export function allocateOrderAcrossSuppliers(suppliers, quantity) {
  // If no suppliers available, return empty array
  if (!suppliers || suppliers.length === 0 || quantity <= 0) {
    return [];
  }
  
  // Sort suppliers by priority
  const prioritizedSuppliers = [...suppliers].sort((a, b) => a.priority - b.priority);
  
  // Calculate available stock across all suppliers
  const totalAvailableStock = prioritizedSuppliers.reduce(
    (sum, supplier) => sum + (supplier.stockLevel || 0), 0
  );
  
  // If there's not enough total stock, we'll need to indicate backorder
  const isBackorderNeeded = totalAvailableStock < quantity;
  
  // Start allocation
  let remainingQuantity = quantity;
  const allocation = [];
  
  // First, try to fulfill from suppliers with stock, by priority
  for (const supplier of prioritizedSuppliers) {
    if (remainingQuantity <= 0) break;
    
    const supplierStock = supplier.stockLevel || 0;
    
    if (supplierStock > 0) {
      // Determine how much to allocate from this supplier
      const allocationQuantity = Math.min(supplierStock, remainingQuantity);
      
      allocation.push({
        supplierId: supplier.id,
        supplierName: supplier.name || supplier.supplierName,
        quantity: allocationQuantity,
        price: supplier.price,
        isBackorder: false
      });
      
      // Update remaining quantity
      remainingQuantity -= allocationQuantity;
    }
  }
  
  // If there's still quantity needed and backorder is allowed, allocate to highest priority supplier
  if (remainingQuantity > 0 && prioritizedSuppliers.length > 0) {
    allocation.push({
      supplierId: prioritizedSuppliers[0].id,
      supplierName: prioritizedSuppliers[0].name || prioritizedSuppliers[0].supplierName,
      quantity: remainingQuantity,
      price: prioritizedSuppliers[0].price,
      isBackorder: true
    });
  }
  
  return allocation;
}

/**
 * Calculates the expected lead time for an order based on supplier allocations
 * 
 * @param {Array} allocation - Array of allocation objects from allocateOrderAcrossSuppliers
 * @param {Array} suppliers - Array of all available suppliers
 * @returns {Object} Lead time information {minDays, maxDays, hasBackorder}
 */
export function calculateOrderLeadTime(allocation, suppliers) {
  if (!allocation || allocation.length === 0) {
    return { minDays: null, maxDays: null, hasBackorder: false };
  }
  
  // Find if any allocations are backorders
  const hasBackorder = allocation.some(item => item.isBackorder);
  
  // Get lead times for all suppliers in the allocation
  const leadTimes = allocation.map(item => {
    const supplier = suppliers.find(s => s.id === item.supplierId);
    return supplier ? (supplier.leadTime || 0) : 0;
  });
  
  // For backorders, we might want to add additional time
  let backorderAdditionalDays = 0;
  if (hasBackorder) {
    backorderAdditionalDays = 14; // Default additional days for backorder
  }
  
  // Calculate min and max lead times
  const minLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes) : 0;
  const maxLeadTime = leadTimes.length > 0 ? Math.max(...leadTimes) + backorderAdditionalDays : 0;
  
  return {
    minDays: minLeadTime,
    maxDays: maxLeadTime,
    hasBackorder
  };
}

/**
 * Checks if a supplier needs reordering based on its stock level and threshold
 * 
 * @param {Object} supplier - Supplier object with stockLevel
 * @param {Number} reorderPoint - Stock level at which to reorder
 * @param {Number} reorderQuantity - How much to order when reordering
 * @returns {Object} Reorder information {needsReorder, reorderAmount}
 */
export function checkReorderStatus(supplier, reorderPoint = 5, reorderQuantity = 10) {
  if (!supplier) return { needsReorder: false, reorderAmount: 0 };
  
  const currentStock = supplier.stockLevel || 0;
  const needsReorder = currentStock <= reorderPoint;
  
  return {
    needsReorder,
    reorderAmount: needsReorder ? reorderQuantity : 0
  };
}

/**
 * Generates purchase orders for a Shopify order based on supplier allocations
 * 
 * @param {Object} order - Shopify order object
 * @returns {Array} Array of purchase order objects
 */
export async function generatePurchaseOrders(order) {
  try {
    const { line_items, shipping_address, order_number } = order;
    const purchaseOrders = {};
    
    // Process each line item
    for (const item of line_items) {
      // Get suppliers for this product
      const productId = item.product_id;
      const productTitle = item.title;
      const quantity = item.quantity;
      
      // Fetch suppliers for this product from the database
      // This would be replaced with your actual data access
      const suppliers = await getProductSuppliers(productId);
      
      if (!suppliers || suppliers.length === 0) {
        console.warn(`No suppliers found for product ${productId}`);
        continue;
      }
      
      // Determine optimal allocation
      const allocation = allocateOrderAcrossSuppliers(suppliers, quantity);
      
      // Create or update purchase orders for each supplier in the allocation
      for (const alloc of allocation) {
        const supplierId = alloc.supplierId;
        
        // Create PO for this supplier if it doesn't exist
        if (!purchaseOrders[supplierId]) {
          purchaseOrders[supplierId] = {
            poNumber: `PO-${order_number}-${supplierId.slice(-4)}`,
            supplierId: supplierId,
            supplierName: alloc.supplierName,
            orderReference: order_number,
            status: 'pending_approval',
            items: [],
            shippingAddress: shipping_address,
            createdAt: new Date().toISOString()
          };
        }
        
        // Add item to PO
        purchaseOrders[supplierId].items.push({
          productId: productId,
          title: productTitle,
          quantity: alloc.quantity,
          price: alloc.price,
          isBackorder: alloc.isBackorder
        });
        
        // Update supplier stock levels (this would be a database operation)
        if (!alloc.isBackorder) {
          await updateSupplierStock(supplierId, productId, -alloc.quantity);
        }
      }
    }
    
    // Convert purchase orders object to array
    const poArray = Object.values(purchaseOrders);
    
    // Calculate totals for each PO
    poArray.forEach(po => {
      po.subtotal = po.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      po.total = po.subtotal; // Add tax, shipping logic as needed
    });
    
    return poArray;
  } catch (error) {
    console.error('Error generating purchase orders:', error);
    throw error;
  }
}

// Helper function to get suppliers for a product (placeholder)
async function getProductSuppliers(productId) {
  // This would be replaced with your actual data access code
  try {
    // Example implementation that would interface with your database
    return []; // Return suppliers from database
  } catch (error) {
    console.error(`Error fetching suppliers for product ${productId}:`, error);
    return [];
  }
}

// Helper function to update supplier stock levels (placeholder)
async function updateSupplierStock(supplierId, productId, quantityChange) {
  // This would be replaced with your actual data access code
  try {
    // Example implementation that would update the database
    console.log(`Updating stock for supplier ${supplierId}, product ${productId}: ${quantityChange}`);
    return true;
  } catch (error) {
    console.error(`Error updating stock for supplier ${supplierId}:`, error);
    return false;
  }
}
