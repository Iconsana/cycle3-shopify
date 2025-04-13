import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Render's /tmp directory for file storage in production
// But make the path more specific to our app to avoid conflicts
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'cycle3-shopify-db-v2.json')
  : path.join(__dirname, '..', '..', 'data', 'cycle3-shopify-db.json');

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  } catch (error) {
    console.error(`Failed to create database directory: ${error.message}`);
  }
}

// Default data structure
const defaultData = { 
  suppliers: [], 
  productSuppliers: [], 
  purchaseOrders: [],
  products: [],
  syncTimestamp: null
};

// Single database instance that will be shared across the application
let dbInstance = null;

/**
 * Initialize the database with default structure
 */
export const initDB = async () => {
  // If we already have an initialized instance, return it
  if (dbInstance) {
    return dbInstance;
  }

  try {
    console.log(`Initializing database at: ${dbPath}`);
    
    // Ensure we have a valid JSON file before creating the adapter
    try {
      // Check if file exists
      if (!fs.existsSync(dbPath)) {
        // Create new file with default data
        fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2), 'utf8');
        console.log(`Created new database file with default structure at: ${dbPath}`);
      } else {
        // Validate existing file
        try {
          const content = fs.readFileSync(dbPath, 'utf8');
          JSON.parse(content); // This will throw if not valid JSON
        } catch (parseError) {
          console.error(`Database file exists but contains invalid JSON. Resetting with defaults.`);
          fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2), 'utf8');
        }
      }
    } catch (fsError) {
      console.error(`File system error: ${fsError.message}`);
      // We'll proceed and let lowdb handle it, potentially using memory adapter
    }

    // Create adapter and db instances
    const adapter = new JSONFile(dbPath);
    dbInstance = new Low(adapter, defaultData); // Pass default data to prevent "missing default data" error
    
    // Load existing data
    await dbInstance.read();
    
    // Set default structure if none exists
    dbInstance.data ||= defaultData;
    
    // Write back to ensure file exists
    await dbInstance.write();
    
    console.log(`Database initialized successfully at: ${dbPath}`);
    return dbInstance;
  } catch (error) {
    console.error('Error initializing database:', error);
    // Create a memory-only fallback if file operations fail
    console.log('Creating in-memory database as fallback');
    dbInstance = { data: {...defaultData}, write: async () => true, read: async () => true };
    return dbInstance;
  }
};

/**
 * Get the database instance (initializing if needed)
 */
export const getDB = async () => {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
};

/**
 * Get all suppliers
 */
export const getSuppliers = async () => {
  try {
    const db = await getDB();
    await db.read(); // Always read fresh data to avoid stale state
    return db.data.suppliers || [];
  } catch (error) {
    console.error('Error getting suppliers:', error);
    return [];
  }
};

/**
 * Add a supplier
 */
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
    
    db.data.suppliers.push(supplier);
    await db.write();
    return supplier;
  } catch (error) {
    console.error('Error adding supplier:', error);
    throw error;
  }
};

/**
 * Get product suppliers
 */
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
      return db.data.productSuppliers.filter(ps => ps.productId === productId) || [];
    }
    return db.data.productSuppliers || [];
  } catch (error) {
    console.error('Error getting product suppliers:', error);
    return [];
  }
};

/**
 * Add product supplier
 */
export const addProductSupplier = async (productSupplier) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Ensure the relationship has an ID
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
    
    console.log(`Adding product-supplier relationship: ProductID=${productSupplier.productId}, SupplierName=${productSupplier.name || productSupplier.supplierName}`);
    
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

/**
 * Get purchase orders
 */
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

/**
 * Add purchase orders
 */
export const addPurchaseOrders = async (orders) => {
  try {
    const db = await getDB();
    await db.read();
    db.data.purchaseOrders.push(...orders);
    await db.write();
    return orders;
  } catch (error) {
    console.error('Error adding purchase orders:', error);
    throw error;
  }
};

/**
 * Update product supplier stock level
 */
export const updateProductSupplierStock = async (productSupplierId, newStockLevel) => {
  try {
    const db = await getDB();
    await db.read();
    const index = db.data.productSuppliers.findIndex(ps => ps.id === productSupplierId);
    if (index !== -1) {
      db.data.productSuppliers[index].stockLevel = newStockLevel;
      db.data.productSuppliers[index].updatedAt = new Date().toISOString();
      await db.write();
      return db.data.productSuppliers[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating product supplier stock:', error);
    return null;
  }
};

/**
 * Store Shopify products
 */
export const storeProducts = async (products) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Ensure product IDs are strings for consistent comparison
    const formattedProducts = products.map(p => ({
      ...p,
      id: String(p.id)
    }));
    
    db.data.products = formattedProducts;
    db.data.syncTimestamp = new Date().toISOString();
    await db.write();
    return formattedProducts;
  } catch (error) {
    console.error('Error storing products:', error);
    throw error;
  }
};

/**
 * Get stored products
 */
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

/**
 * Get a single product by ID
 */
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

// Export the db instance for direct access if needed
export default { getDB, initDB };