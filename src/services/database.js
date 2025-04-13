import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Render's /tmp directory for file storage in production
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'cycle3-shopify-db.json')
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

// Create database instance
let db;

/**
 * Initialize the database with default structure
 */
export const initDB = async () => {
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
    db = new Low(adapter, defaultData); // Pass default data to prevent "missing default data" error
    
    // Load existing data
    await db.read();
    
    // Set default structure if none exists
    db.data ||= defaultData;
    
    // Write back to ensure file exists
    await db.write();
    
    console.log(`Database initialized successfully at: ${dbPath}`);
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    // Create a memory-only fallback if file operations fail
    console.log('Creating in-memory database as fallback');
    db = { data: {...defaultData}, write: async () => true, read: async () => true };
    return db;
  }
};

/**
 * Get all suppliers
 */
export const getSuppliers = async () => {
  try {
    if (!db) await initDB();
    await db.read();
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
    if (!db) await initDB();
    await db.read();
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
    if (!db) await initDB();
    await db.read();
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
    if (!db) await initDB();
    await db.read();
    db.data.productSuppliers.push(productSupplier);
    await db.write();
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
    if (!db) await initDB();
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
    if (!db) await initDB();
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
 * Update product suppliers
 */
export const updateProductSupplierStock = async (productSupplierId, newStockLevel) => {
  try {
    if (!db) await initDB();
    await db.read();
    const index = db.data.productSuppliers.findIndex(ps => ps.id === productSupplierId);
    if (index !== -1) {
      db.data.productSuppliers[index].stockLevel = newStockLevel;
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
    if (!db) await initDB();
    await db.read();
    db.data.products = products;
    db.data.syncTimestamp = new Date().toISOString();
    await db.write();
    return products;
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
    if (!db) await initDB();
    await db.read();
    return db.data.products || [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

export default db;