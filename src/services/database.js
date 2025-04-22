// Modified getProductSuppliers function in database.js
export const getProductSuppliers = async (productId = null) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Log info for debugging
    if (productId) {
      console.log(`Getting suppliers for product: ${productId}`);
      console.log(`Total product-supplier relationships: ${db.data.productSuppliers.length}`);
      console.log(`All product IDs: ${[...new Set(db.data.productSuppliers.map(ps => ps.productId))].join(', ')}`);
    }
    
    if (productId) {
      // FIX: Convert both sides to strings for comparison
      return db.data.productSuppliers.filter(ps => String(ps.productId) === String(productId)) || [];
    }
    return db.data.productSuppliers || [];
  } catch (error) {
    console.error('Error getting product suppliers:', error);
    return [];
  }
};

// Modified addProductSupplier function
export const addProductSupplier = async (productSupplier) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Ensure the productSupplier has an ID
    if (!productSupplier.id) {
      productSupplier.id = Date.now().toString();
    }
    
    // Add timestamps if not present
    if (!productSupplier.createdAt) {
      productSupplier.createdAt = new Date().toISOString();
    }
    
    // FIX: Make sure productId is stored as a string for consistent comparison
    if (productSupplier.productId) {
      productSupplier.productId = String(productSupplier.productId);
    }
    
    // Check if supplier exists in main suppliers collection
    const supplierName = productSupplier.supplierName || productSupplier.name;
    let supplier = db.data.suppliers.find(s => 
      (s.id === productSupplier.supplierId) || 
      (s.name === supplierName)
    );
    
    // If not found, add it to suppliers collection
    if (!supplier && supplierName) {
      supplier = {
        id: productSupplier.supplierId || Date.now().toString(),
        name: supplierName,
        email: productSupplier.email || `${supplierName.replace(/[^a-z0-9]/gi, '').toLowerCase()}@example.com`,
        leadTime: productSupplier.leadTime || 3,
        apiType: 'email',
        status: 'active',
        createdAt: new Date().toISOString()
      };
      
      db.data.suppliers.push(supplier);
      console.log(`Added new supplier: ${supplier.name}`);
      
      // Update supplierId in productSupplier
      productSupplier.supplierId = supplier.id;
    } else if (supplier) {
      // Ensure we're using the correct supplierId
      productSupplier.supplierId = supplier.id;
    }
    
    console.log(`Adding product-supplier relationship: ProductID=${productSupplier.productId}, SupplierName=${supplierName}`);
    
    db.data.productSuppliers.push(productSupplier);
    await db.write();
    
    // Log after adding
    console.log(`Total product-supplier relationships after add: ${db.data.productSuppliers.length}`);
    return productSupplier;
  } catch (error) {
    console.error('Error adding product supplier:', error);
    throw error;
  }
};
