import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Render's /tmp directory for file storage
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'cycle3-shopify-db.json')
  : path.join(__dirname, '..', '..', 'data', 'cycle3-shopify-db.json');

// Create database instance
const adapter = new JSONFile(dbPath);
const db = new Low(adapter);

/**
 * Initialize the database with default structure
 */
export const initDB = async () => {
  try {
    // Load existing data
    await db.read();
    
    // Set default structure if none exists
    db.data ||= { 
      suppliers: [], 
      productSuppliers: [], 
      purchaseOrders: [],
      syncTimestamp: null
    };
    
    // Write back to ensure file exists
    await db.write();
    
    console.log(`Database initialized at: ${dbPath}`);
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    // Create a memory-only fallback if file operations fail
    db.data = { 
      suppliers: [], 
      productSuppliers: [], 
      purchaseOrders: [],
      syncTimestamp: null
    };
    return db;
  }
};

/**
 * Get all suppliers
 */
export const getSuppliers = async () => {
  await db.read();
  return db.data.suppliers || [];
};

/**
 * Add a supplier
 */
export const addSupplier = async (supplier) => {
  await db.read();
  db.data.suppliers.push(supplier);
  await db.write();
  return supplier;
};

/**
 * Get product suppliers
 */
export const getProductSuppliers = async (productId = null) => {
  await db.read();
  if (productId) {
    return db.data.productSuppliers.filter(ps => ps.productId === productId) || [];
  }
  return db.data.productSuppliers || [];
};

/**
 * Add product supplier
 */
export const addProductSupplier = async (productSupplier) => {
  await db.read();
  db.data.productSuppliers.push(productSupplier);
  await db.write();
  return productSupplier;
};

/**
 * Get purchase orders
 */
export const getPurchaseOrders = async () => {
  await db.read();
  return db.data.purchaseOrders || [];
};

/**
 * Add purchase orders
 */
export const addPurchaseOrders = async (orders) => {
  await db.read();
  db.data.purchaseOrders.push(...orders);
  await db.write();
  return orders;
};

/**
 * Update product suppliers
 */
export const updateProductSupplierStock = async (productSupplierId, newStockLevel) => {
  await db.read();
  const index = db.data.productSuppliers.findIndex(ps => ps.id === productSupplierId);
  if (index !== -1) {
    db.data.productSuppliers[index].stockLevel = newStockLevel;
    await db.write();
    return db.data.productSuppliers[index];
  }
  return null;
};

/**
 * Store Shopify products
 */
export const storeProducts = async (products) => {
  await db.read();
  db.data.products = products;
  db.data.syncTimestamp = new Date().toISOString();
  await db.write();
  return products;
};

/**
 * Get stored products
 */
export const getProducts = async () => {
  await db.read();
  return db.data.products || [];
};

export default db;