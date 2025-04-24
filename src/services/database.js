// Add the missing export by adding this to src/services/database.js
// Import this at the top if not already present
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// File path for database
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/cycle3-shopify-db.json' 
  : path.join(__dirname, '../../data/cycle3-shopify-db.json');

let db = null;

// Initialize database
export const initDB = async () => {
  try {
    // Make sure the data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create or load database file
    if (!fs.existsSync(dbPath)) {
      const defaultData = {
        suppliers: [],
        productSuppliers: [],
        purchaseOrders: [],
        products: []
      };
      fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    }

    // Initialize lowdb
    const adapter = new JSONFile(dbPath);
    db = new Low(adapter);
    await db.read();

    // Ensure the database has all required arrays
    if (!db.data) {
      db.data = { 
        suppliers: [], 
        productSuppliers: [],
        purchaseOrders: [],
        products: []
      };
      await db.write();
    }

    if (!db.data.suppliers) db.data.suppliers = [];
    if (!db.data.productSuppliers) db.data.productSuppliers = [];
    if (!db.data.purchaseOrders) db.data.purchaseOrders = [];
    if (!db.data.products) db.data.products = [];

    console.log(`Database initialized with: ${db.data.suppliers.length} suppliers, ${db.data.productSuppliers.length} product-supplier relationships`);
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Get database instance
export const getDB = async () => {
  if (!db) {
    await initDB();
  }
  return db;
};

// Get all suppliers
export const getSuppliers = async () => {
  try {
    const db = await getDB();
    await db.read();
    return db.data.suppliers || [];
  } catch (error) {
    console.error('Error getting suppliers:', error);
    return [];
  }
};

// Add a supplier - THIS IS THE MISSING FUNCTION
export const addSupplier = async (supplier) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Ensure the supplier has an ID
    if (!supplier.id) {
      supplier.id = Date.now().toString();
    }
    
    // Add timestamps if not present
    if (!supplier.createdAt) {
      supplier.createdAt = new Date().toISOString();
    }
    
    console.log(`Adding new supplier: ${supplier.name}`);
    
    db.data.suppliers.push(supplier);
    await db.write();
    
    return supplier;
  } catch (error) {
    console.error('Error adding supplier:', error);
    throw error;
  }
};

// Get purchase orders
export const getPurchaseOrders = async () => {
  try {
    const db = await getDB();
    await db.read();
    return db.data.purchaseOrders || [];
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    return [];
  }
};

// Update product supplier stock
export const updateProductSupplierStock = async (id, stockLevel) => {
  try {
    const db = await getDB();
    await db.read();
    
    const index = db.data.productSuppliers.findIndex(ps => ps.id === id);
    if (index === -1) {
      throw new Error(`Product supplier with ID ${id} not found`);
    }
    
    db.data.productSuppliers[index].stockLevel = stockLevel;
    db.data.productSuppliers[index].updatedAt = new Date().toISOString();
    
    await db.write();
    return db.data.productSuppliers[index];
  } catch (error) {
    console.error('Error updating product supplier stock:', error);
    throw error;
  }
};

// Store products
export const storeProducts = async (products) => {
  try {
    const db = await getDB();
    await db.read();
    
    db.data.products = products;
    await db.write();
    
    return products;
  } catch (error) {
    console.error('Error storing products:', error);
    throw error;
  }
};

// Get all products
export const getProducts = async () => {
  try {
    const db = await getDB();
    await db.read();
    return db.data.products || [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

// Get product by ID
export const getProductById = async (productId) => {
  try {
    const db = await getDB();
    await db.read();
    
    return db.data.products.find(p => String(p.id) === String(productId)) || null;
  } catch (error) {
    console.error(`Error getting product ${productId}:`, error);
    return null;
  }
};

#!/bin/bash

# Create the services directory if it doesn't exist
mkdir -p src/services

# Back up the current file if it exists
if [ -f src/services/database.js ]; then
  cp src/services/database.js src/services/database.js.bak
fi

# Write the updated database.js file
cat > src/services/database.js << 'EOL'
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// File path for database
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/cycle3-shopify-db.json' 
  : path.join(__dirname, '../../data/cycle3-shopify-db.json');

let db = null;

// Initialize database
export const initDB = async () => {
  try {
    // Make sure the data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create or load database file
    if (!fs.existsSync(dbPath)) {
      const defaultData = {
        suppliers: [],
        productSuppliers: [],
        purchaseOrders: [],
        products: []
      };
      fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    }

    // Initialize lowdb
    const adapter = new JSONFile(dbPath);
    db = new Low(adapter);
    await db.read();

    // Ensure the database has all required arrays
    if (!db.data) {
      db.data = { 
        suppliers: [], 
        productSuppliers: [],
        purchaseOrders: [],
        products: []
      };
      await db.write();
    }

    if (!db.data.suppliers) db.data.suppliers = [];
    if (!db.data.productSuppliers) db.data.productSuppliers = [];
    if (!db.data.purchaseOrders) db.data.purchaseOrders = [];
    if (!db.data.products) db.data.products = [];

    console.log(`Database initialized with: ${db.data.suppliers.length} suppliers, ${db.data.productSuppliers.length} product-supplier relationships`);
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Get database instance
export const getDB = async () => {
  if (!db) {
    await initDB();
  }
  return db;
};

// Get all suppliers
export const getSuppliers = async () => {
  try {
    const db = await getDB();
    await db.read();
    return db.data.suppliers || [];
  } catch (error) {
    console.error('Error getting suppliers:', error);
    return [];
  }
};

// Add a supplier - THIS IS THE MISSING FUNCTION
export const addSupplier = async (supplier) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Ensure the supplier has an ID
    if (!supplier.id) {
      supplier.id = Date.now().toString();
    }
    
    // Add timestamps if not present
    if (!supplier.createdAt) {
      supplier.createdAt = new Date().toISOString();
    }
    
    console.log(`Adding new supplier: ${supplier.name}`);
    
    db.data.suppliers.push(supplier);
    await db.write();
    
    return supplier;
  } catch (error) {
    console.error('Error adding supplier:', error);
    throw error;
  }
};

// Modified getProductSuppliers function
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
      // Convert both sides to strings for comparison
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
    
    // Make sure productId is stored as a string for consistent comparison
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

// Get purchase orders
export const getPurchaseOrders = async () => {
  try {
    const db = await getDB();
    await db.read();
    return db.data.purchaseOrders || [];
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    return [];
  }
};

// Update product supplier stock
export const updateProductSupplierStock = async (id, stockLevel) => {
  try {
    const db = await getDB();
    await db.read();
    
    const index = db.data.productSuppliers.findIndex(ps => ps.id === id);
    if (index === -1) {
      throw new Error(`Product supplier with ID ${id} not found`);
    }
    
    db.data.productSuppliers[index].stockLevel = stockLevel;
    db.data.productSuppliers[index].updatedAt = new Date().toISOString();
    
    await db.write();
    return db.data.productSuppliers[index];
  } catch (error) {
    console.error('Error updating product supplier stock:', error);
    throw error;
  }
};

// Store products
export const storeProducts = async (products) => {
  try {
    const db = await getDB();
    await db.read();
    
    db.data.products = products;
    await db.write();
    
    return products;
  } catch (error) {
    console.error('Error storing products:', error);
    throw error;
  }
};

// Get all products
export const getProducts = async () => {
  try {
    const db = await getDB();
    await db.read();
    return db.data.products || [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

// Get product by ID
export const getProductById = async (productId) => {
  try {
    const db = await getDB();
    await db.read();
    
    return db.data.products.find(p => String(p.id) === String(productId)) || null;
  } catch (error) {
    console.error(`Error getting product ${productId}:`, error);
    return null;
  }
};
EOL

echo "Updated database.js file with missing exports"
