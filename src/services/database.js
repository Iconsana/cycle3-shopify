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
    
// Default data structure
const defaultData = {
  suppliers: [],
  productSuppliers: [],
  purchaseOrders: [],
  products: [],
  quotes: []  // Add this line
};

    // Create db file if it doesn't exist
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    }

    // Initialize lowdb - FIX: Pass defaultData as second argument
    const adapter = new JSONFile(dbPath);
    db = new Low(adapter, defaultData); // Pass defaultData here
    await db.read();

    // Ensure the database has all required arrays
    if (!db.data) {
      db.data = defaultData;
      await db.write();
    }

   // Make sure all collections exist
if (!db.data.suppliers) db.data.suppliers = [];
if (!db.data.productSuppliers) db.data.productSuppliers = [];
if (!db.data.purchaseOrders) db.data.purchaseOrders = [];
if (!db.data.products) db.data.products = [];
if (!db.data.quotes) db.data.quotes = []; 

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
// Add a supplier - ensure consistent handling
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
    
    // Check for duplicate supplier names
    const existingSupplier = db.data.suppliers.find(s => 
      s.name.toLowerCase() === supplier.name.toLowerCase()
    );
    
    if (existingSupplier) {
      console.log(`Supplier with name ${supplier.name} already exists with ID: ${existingSupplier.id}`);
      return existingSupplier;
    }
    
    console.log(`Adding new supplier: ${supplier.name} with ID ${supplier.id}`);
    
    db.data.suppliers.push(supplier);
    await db.write();
    
    return supplier;
  } catch (error) {
    console.error('Error adding supplier:', error);
    throw error;
  }
};

// Get product suppliers - fixed version to ensure consistent comparison
export const getProductSuppliers = async (productId = null) => {
  try {
    const db = await getDB();
    await db.read();
    
    // Log info for debugging
    if (productId) {
      console.log(`Getting suppliers for product: ${productId}`);
      console.log(`Total product-supplier relationships: ${db.data.productSuppliers.length}`);
      
      // List all product IDs for debugging
      const allProductIds = [...new Set(db.data.productSuppliers.map(ps => ps.productId))];
      console.log(`All product IDs in database: ${allProductIds.join(', ')}`);
    }
    
    if (productId) {
      // IMPORTANT FIX: Always convert both IDs to strings for comparison
      const stringProductId = String(productId);
      
      const matchingSuppliers = db.data.productSuppliers.filter(ps => 
        String(ps.productId) === stringProductId
      );
      
      console.log(`Found ${matchingSuppliers.length} suppliers for product ${productId}`);
      
      // Enrich with supplier names if needed
      return matchingSuppliers.map(supplier => {
        // If supplier name is missing, try to find it
        if (!supplier.supplierName && supplier.supplierId) {
          const relatedSupplier = db.data.suppliers.find(s => s.id === supplier.supplierId);
          if (relatedSupplier) {
            supplier.supplierName = relatedSupplier.name;
          }
        }
        return supplier;
      });
    }
    
    return db.data.productSuppliers || [];
  } catch (error) {
    console.error('Error getting product suppliers:', error);
    return [];
  }
};

// Add product supplier - fixed version for consistent data
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
    
    // First check if this relationship already exists (by product ID and supplier ID)
    if (productSupplier.supplierId && productSupplier.productId) {
      const existingRelationship = db.data.productSuppliers.find(ps => 
        String(ps.productId) === String(productSupplier.productId) && 
        ps.supplierId === productSupplier.supplierId
      );
      
      if (existingRelationship) {
        console.log(`Relationship already exists for Product=${productSupplier.productId} and Supplier=${productSupplier.supplierId}`);
        
        // Update existing relationship
        existingRelationship.priority = productSupplier.priority || existingRelationship.priority;
        existingRelationship.price = productSupplier.price || existingRelationship.price;
        existingRelationship.stockLevel = productSupplier.stockLevel || existingRelationship.stockLevel;
        existingRelationship.updatedAt = new Date().toISOString();
        
        await db.write();
        return existingRelationship;
      }
    }
    
    // Check if supplier exists in main suppliers collection
    const supplierName = productSupplier.supplierName || productSupplier.name;
    let supplier = null;
    
    if (productSupplier.supplierId) {
      supplier = db.data.suppliers.find(s => s.id === productSupplier.supplierId);
    } else if (supplierName) {
      supplier = db.data.suppliers.find(s => s.name === supplierName);
    }
    
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
      console.log(`Added new supplier: ${supplier.name} with ID ${supplier.id}`);
      
      // Update supplierId in productSupplier
      productSupplier.supplierId = supplier.id;
    } else if (supplier) {
      // Ensure we're using the correct supplierId
      productSupplier.supplierId = supplier.id;
      
      // Update supplierName if missing
      if (!productSupplier.supplierName) {
        productSupplier.supplierName = supplier.name;
      }
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
// Update product supplier stock - fixed version
export const updateProductSupplierStock = async (id, stockLevel) => {
  try {
    console.log(`Updating stock level for supplier relationship ${id} to ${stockLevel}`);
    
    const db = await getDB();
    await db.read();
    
    const index = db.data.productSuppliers.findIndex(ps => String(ps.id) === String(id));
    
    if (index === -1) {
      console.error(`Product supplier relationship with ID ${id} not found`);
      throw new Error(`Product supplier with ID ${id} not found`);
    }
    
    console.log(`Found relationship at index ${index}, updating stock level`);
    
    db.data.productSuppliers[index].stockLevel = parseInt(stockLevel);
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

// Get product by ID - fixed version
export const getProductById = async (productId) => {
  try {
    const db = await getDB();
    await db.read();
    
    // IMPORTANT FIX: Always convert both IDs to strings for comparison
    const stringProductId = String(productId);
    
    const product = db.data.products.find(p => String(p.id) === stringProductId);
    
    if (product) {
      console.log(`Found product with ID ${productId} in database`);
    } else {
      console.log(`Product with ID ${productId} not found in database`);
    }
    
    return product || null;
  } catch (error) {
    console.error(`Error getting product ${productId}:`, error);
    return null;
  }
};

