// src/routes/quote-processing.js
import express from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import processPDF from '../utils/pdf-parser.js';
import { getDB } from '../services/database.js';
import shopify from '../../config/shopify.js';
import { processQuoteWithClaude } from '../services/claude-service.js';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'quote-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    // Accept images and PDFs
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'image/png' || 
        file.mimetype === 'image/jpeg' || 
        file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

// Routes for quote processing
router.post('/upload', upload.single('quoteFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const supplierName = req.body.supplierName;
    const supplierId = req.body.supplierId;
    const validUntil = req.body.validUntil; // Format: YYYY-MM-DD
    
    // Store the uploaded file info
    const quoteId = Date.now().toString();
    const fileInfo = {
      id: quoteId,
      originalName: req.file.originalname,
      filePath: filePath,
      supplierName: supplierName,
      supplierId: supplierId,
      validUntil: validUntil || null,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      fileInfo: {
        type: req.file.mimetype,
        size: req.file.size
      },
      products: []
    };
    
    // Save to database
    const db = await getDB();
    await db.read();
    
    // Initialize quotes array if it doesn't exist
    if (!db.data.quotes) {
      db.data.quotes = [];
    }
    
    db.data.quotes.push(fileInfo);
    await db.write();
    
    // Immediately start processing in background
    // We don't await this to avoid blocking the response
    processQuoteInBackground(quoteId, filePath, req.file.mimetype);
    
    res.status(201).json({ 
      message: 'Quote uploaded successfully',
      quote: fileInfo
    });
  } catch (error) {
    console.error('Error uploading quote:', error);
    res.status(500).json({ error: 'Quote upload failed', message: error.message });
  }
});

// Process the quote using OCR - Now manually triggerable for retries
router.post('/:quoteId/process', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    
    // Retrieve the quote info from the database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes found in database' });
    }
    
    const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    
    if (quoteIndex === -1) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const quote = db.data.quotes[quoteIndex];
    
    // Update status to processing
    db.data.quotes[quoteIndex].status = 'processing';
    await db.write();
    
    // Return immediate response that processing has started
    res.status(202).json({ 
      message: 'Quote processing started',
      quoteId: quoteId,
      status: 'processing',
      estimatedTime: '30 seconds'
    });
    
    // Start processing in background
    processQuoteInBackground(quoteId, quote.filePath, quote.fileInfo.type);
    
  } catch (error) {
    console.error('Error processing quote:', error);
    res.status(500).json({ error: 'Quote processing failed', message: error.message });
  }
});

async function processQuoteInBackground(quoteId, filePath, mimeType) {
  try {
    console.log(`Starting background processing for quote ${quoteId}...`);
    
    // Update status to processing
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      db.data.quotes = [];
    }
    
    const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    
    if (quoteIndex === -1) {
      console.error(`Quote ${quoteId} not found in database`);
      return;
    }
    
    db.data.quotes[quoteIndex].status = 'processing';
    await db.write();
    
    // Process using Claude for both PDF and images
    let extractedProducts = [];
    
    try {
      console.log(`Processing file of type: ${mimeType}`);
      console.log(`Processing file: ${filePath}`);
      
      // Use Claude for processing
      extractedProducts = await processQuoteWithClaude(filePath);
      
      console.log(`Extraction completed for quote ${quoteId}. Found ${extractedProducts.length} products.`);
      
    } catch (extractionError) {
      console.error(`Extraction error for quote ${quoteId}:`, extractionError);
      
      // Fall back to basic extraction if Claude fails
      extractedProducts = [];
    }
    
    // Update the database with results
    await db.read(); // Reload in case it changed
    
    const updatedQuoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    
    if (updatedQuoteIndex !== -1) {
     // FIXED: ensure status is set to 'processed' when extraction is successful
  db.data.quotes[updatedQuoteIndex].status = extractedProducts.length > 0 ? 'processed' : 'error';
  db.data.quotes[updatedQuoteIndex].processedAt = new Date().toISOString();
  db.data.quotes[updatedQuoteIndex].products = extractedProducts;
      
      // Make sure this writes to the database
      await db.write();
      console.log(`Quote ${quoteId} processing completed and saved to database`);
    }
    
  } catch (error) {
    console.error(`Background processing error for quote ${quoteId}:`, error);
    
    // Update DB with error status
    try {
      const db = await getDB();
      await db.read();
      
      const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
      if (quoteIndex !== -1) {
        db.data.quotes[quoteIndex].status = 'error';
        db.data.quotes[quoteIndex].error = error.message;
        await db.write();
      }
    } catch (dbError) {
      console.error(`Failed to update quote status after error:`, dbError);
    }
  }
}

// Implement OCR processing with Tesseract.js for images
async function processQuoteWithOCR(filePath) {
  try {
    // For images, use Tesseract OCR
    const worker = await createWorker({
      logger: m => console.log(m) // Optional: Enable for detailed logging
    });
    
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Increase image processing quality for better results
    await worker.setParameters({
      tessedit_ocr_engine_mode: 3, // Use the LSTM neural network for OCR
      preserve_interword_spaces: 1, // Preserve spaces between words
    });
    
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    
    console.log(`OCR completed with confidence: ${data.confidence}%`);
    
    // Process the extracted text
    return {
      ...processExtractedText(data.text, {}),
      confidence: data.confidence / 100 // Convert to 0-1 scale
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw error;
  }
}

// Improved processExtractedText function with fixes for extraction issues
function processExtractedText(text, metadata = {}) {
  console.log("Starting text extraction with text length:", text.length);
  
  // Split into lines and clean up
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // Log for debugging
  console.log(`Found ${lines.length} lines in the document`);
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    console.log(`Line ${i}: ${lines[i]}`);
  }
  
  // IMPROVED: Better patterns for South African quotes
  // Made the SKU pattern more inclusive
  const skuPattern = /\b([A-Z0-9]{3,}(?:[-][A-Z0-9]+)*)\b/;
  // More flexible price pattern that handles commas and dots
  const pricePattern = /R\s*(\d+(?:[.,]\d{3})*(?:\.\d{1,2})?)/i;
  const quantityPattern = /\b(\d+)\s*(?:units?|pcs|boxes|rolls)?\b/i;
  
  // IMPROVED: Removed most blacklist items to avoid filtering valid SKUs
  const skuBlacklist = []; // Empty blacklist to include all products
  
  // Store extracted products
  let products = [];
  
  // Special handling for BuildCore format (match even without table headers)
  let inBuildCoreFormat = false;
  
  // Look for BuildCore indicators
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].includes("BuildCore") || 
        lines[i].includes("Item Description") || 
        lines[i].includes("SKU") || 
        lines[i].includes("Unit Price")) {
      inBuildCoreFormat = true;
      console.log("Detected BuildCore quote format");
      break;
    }
  }
  
  // Debug for table structure detection
  let foundTable = false;
  let tableHeadings = [];
  
  // Try to find table headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("sku") && 
        (line.includes("description") || line.includes("item")) && 
        (line.includes("price") || line.includes("unit") || line.includes("cost"))) {
      
      foundTable = true;
      tableHeadings = lines[i].split(/\s{2,}/).map(h => h.trim());
      console.log("Found table headings:", tableHeadings);
      break;
    }
  }
  
  // IMPROVED: Table-based processing
  if (foundTable) {
    console.log("Processing using table structure detection");
    
    let tableStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes("sku") && 
          (lines[i].toLowerCase().includes("description") || lines[i].toLowerCase().includes("item"))) {
        tableStartIndex = i + 1; // Start after the header
        break;
      }
    }
    
    if (tableStartIndex > 0) {
      // Process each line after the table header
      for (let i = tableStartIndex; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip if line is too short or likely a footer
        if (line.length < 5 || 
            line.toLowerCase().includes("total") || 
            line.toLowerCase().includes("notes")) {
          continue;
        }
        
        // Try to extract SKU
        const skuMatch = line.match(skuPattern);
        if (!skuMatch) continue;
        
        const sku = skuMatch[1];
        console.log(`Processing product with SKU: ${sku}`);
        
        // Extract price using more flexible pattern
        const priceMatch = line.match(pricePattern) || 
                           (i < lines.length - 1 ? lines[i+1].match(pricePattern) : null);
        
        if (!priceMatch) {
          console.log(`No price found for SKU ${sku}, skipping`);
          continue;
        }
        
        // Process the price (handle both comma and dot as decimal separator)
        let priceText = priceMatch[1].replace(/,/g, '.');
        // If there are multiple dots (like 1.000.00), keep only the last one
        if ((priceText.match(/\./g) || []).length > 1) {
          const parts = priceText.split('.');
          priceText = parts.slice(0, -1).join('') + '.' + parts[parts.length-1];
        }
        const price = parseFloat(priceText);
        
        // Extract quantity with improved pattern
        const quantityMatch = line.match(quantityPattern) || 
                              (i > 0 ? lines[i-1].match(quantityPattern) : null) ||
                              (i < lines.length - 1 ? lines[i+1].match(quantityPattern) : null);
        
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 10; // Default quantity
        
        // IMPROVED: Better description extraction by using surrounding context
        let description = '';
        
        // Create a context window for finding description
        const prevLine = i > 0 ? lines[i-1] : '';
        const nextLine = i < lines.length - 1 ? lines[i+1] : '';
        const contextWindow = [prevLine, line, nextLine];
        
        // Look through context for description
        for (const contextLine of contextWindow) {
          if (contextLine.length > sku.length && !contextLine.match(/^(R\s*\d+)/) && 
              !contextLine.toLowerCase().includes("total") &&
              !contextLine.toLowerCase().includes("note")) {
            
            // If line contains the SKU, extract text before or after it
            if (contextLine.includes(sku)) {
              const parts = contextLine.split(sku);
              if (parts[0] && parts[0].trim().length > 3) {
                description = parts[0].trim();
              } else if (parts[1] && parts[1].trim().length > 3) {
                // Remove price information if present
                description = parts[1].replace(pricePattern, '').trim();
              }
            } 
            // Otherwise, if it's not the same line as the SKU, use it as description
            else if (contextLine !== line) {
              description = contextLine.trim();
            }
            
            // If we found a good description, break
            if (description.length > 3) break;
          }
        }
        
        // If no description found, use a generic one
        if (description.length < 3) {
          description = `Product ${sku}`;
        }
        
        // Clean up description - remove price patterns and extra spaces
        description = description
          .replace(pricePattern, '')
          .replace(quantityPattern, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Log the extracted product data
        console.log(`Extracted product: SKU=${sku}, Price=${price}, Quantity=${quantity}, Description=${description}`);
        
        // Add the product
        products.push({
          sku: sku,
          description: description,
          unitPrice: price,
          availableQuantity: quantity,
          leadTime: 3 // Default lead time
        });
      }
    }
  } 
  // Fallback to line-by-line processing if table not detected
  else {
    console.log("Using line-by-line processing for product extraction");
    
    // Process the document using more flexible detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip short lines or headers/footers
      if (line.length < 10 || 
          line.toLowerCase().includes("notes:") || 
          line.toLowerCase().includes("total")) {
        continue;
      }
      
      // Create a context by combining current line with adjacent lines
      // This creates a 3-line window for better context
      const prevLine = i > 0 ? lines[i-1] : '';
      const nextLine = i < lines.length - 1 ? lines[i+1] : '';
      const context = `${prevLine} ${line} ${nextLine}`;
      
      // Extract SKU with improved pattern
      const skuMatch = line.match(skuPattern);
      if (!skuMatch) continue;
      
      // Get the SKU
      const sku = skuMatch[1];
      console.log(`Found potential SKU: ${sku}`);
      
      // Skip if SKU is in blacklist (which is now empty by default)
      if (skuBlacklist.some(term => sku.includes(term))) {
        console.log(`Skipping blacklisted SKU: ${sku}`);
        continue;
      }
      
      // Extract price with improved pattern that handles different formats
      // Look in the current line and adjacent lines
      const priceMatch = line.match(pricePattern) || 
                         context.match(pricePattern);
      
      if (!priceMatch) {
        console.log(`No price found for SKU ${sku}, checking next lines...`);
        // Look ahead a few more lines for price
        for (let j = 1; j <= 2; j++) {
          if (i + j < lines.length) {
            const priceLine = lines[i + j];
            const furtherPriceMatch = priceLine.match(pricePattern);
            if (furtherPriceMatch) {
              // Process the price
              let priceText = furtherPriceMatch[1].replace(/,/g, '.');
              const price = parseFloat(priceText);
              
              // Extract quantity
              const quantityMatch = line.match(quantityPattern) || 
                                    context.match(quantityPattern) ||
                                    priceLine.match(quantityPattern);
              
              const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 10; // Default quantity
              
              // Extract description - more sophisticated with multi-line context
              let description = extractDescription(lines, i, sku);
              
              console.log(`Found delayed price match: SKU=${sku}, Price=${price}, Description=${description}`);
              
              // Add the product
              products.push({
                sku: sku,
                description: description,
                unitPrice: price,
                availableQuantity: quantity,
                leadTime: 3 // Default lead time
              });
              
              break; // Found a price, no need to look further
            }
          }
        }
        continue; // Skip to next line
      }
      
      // Process the price (handle both comma and dot as decimal separator)
      let priceText = priceMatch[1].replace(/,/g, '.');
      const price = parseFloat(priceText);
      
      // Extract quantity with improved pattern
      const quantityMatch = line.match(quantityPattern) || 
                            context.match(quantityPattern);
      
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 10; // Default quantity
      
      // Extract description with improved logic
      let description = extractDescription(lines, i, sku);
      
      console.log(`Extracted product: SKU=${sku}, Price=${price}, Quantity=${quantity}, Description=${description}`);
      
      // Add the product
      products.push({
        sku: sku,
        description: description,
        unitPrice: price,
        availableQuantity: quantity,
        leadTime: 3 // Default lead time
      });
    }
  }
  
  // If BuildCore format but no products found, try a more targeted approach
  if (inBuildCoreFormat && products.length === 0) {
    console.log("Using specialized BuildCore extraction");
    
    // Find sections that look like product entries
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("R") && /[A-Z0-9]{4,}/.test(lines[i])) {
        // This likely contains a product, price and SKU
        const line = lines[i];
        
        // Extract parts
        const skuMatch = line.match(/\b([A-Z0-9]{3,}(?:[-][A-Z0-9]+)*)\b/);
        const priceMatch = line.match(/R\s*(\d+(?:[.,]\d{1,2})?)/);
        
        if (skuMatch && priceMatch) {
          // Skip if SKU is in blacklist
          if (skuBlacklist.some(term => skuMatch[1].includes(term))) continue;
          
          const sku = skuMatch[1];
          // Clean up price (handle comma as decimal separator)
          let priceText = priceMatch[1].replace(/,/g, '.');
          const price = parseFloat(priceText);
          
          // Look for description in adjacent lines
          let description = extractDescription(lines, i, sku);
          
          console.log(`BuildCore format extraction: SKU=${sku}, Price=${price}, Description=${description}`);
          
          products.push({
            sku: sku,
            description: description,
            unitPrice: price,
            availableQuantity: 10, // Default
            leadTime: 3
          });
        }
      }
    }
  }
  
  // Remove duplicates based on SKU
  const uniqueProducts = [];
  const seenSKUs = new Set();
  
  for (const product of products) {
    if (!seenSKUs.has(product.sku)) {
      seenSKUs.add(product.sku);
      uniqueProducts.push(product);
    }
  }
  
  console.log(`Total products extracted (before deduplication): ${products.length}`);
  console.log(`Total products extracted (after deduplication): ${uniqueProducts.length}`);
  
  return {
    text: text,
    products: uniqueProducts,
    metadata: metadata
  };
}

// Helper function to extract description from surrounding context
function extractDescription(lines, currentIndex, sku) {
  // Look for description in current line and surrounding lines
  const currentLine = lines[currentIndex];
  const prevLine = currentIndex > 0 ? lines[currentIndex-1] : '';
  const nextLine = currentIndex < lines.length - 1 ? lines[currentIndex+1] : '';
  const prevPrevLine = currentIndex > 1 ? lines[currentIndex-2] : '';
  
  // Pattern to filter out SKU, price, and quantity
  const skuPattern = new RegExp(`\\b${sku}\\b`, 'i');
  const pricePattern = /R\s*(\d+(?:[.,]\d{3})*(?:\.\d{1,2})?)/i;
  const quantityPattern = /\b(\d+)\s*(?:units?|pcs|boxes|rolls)?\b/i;
  
  // Check current line - split by SKU and use non-empty part
  if (currentLine.includes(sku)) {
    const parts = currentLine.split(sku);
    
    if (parts[0] && parts[0].trim().length > 3 && !parts[0].match(pricePattern)) {
      return cleanDescription(parts[0]);
    }
    
    if (parts[1] && parts[1].trim().length > 3 && !parts[1].match(pricePattern)) {
      return cleanDescription(parts[1]);
    }
  }
  
  // Check previous line if it doesn't contain the SKU or price
  if (prevLine && prevLine.length > 5 && 
      !prevLine.match(skuPattern) && 
      !prevLine.match(pricePattern) &&
      !prevLine.toLowerCase().includes("sku") &&
      !prevLine.toLowerCase().includes("description")) {
    return cleanDescription(prevLine);
  }
  
  // Check earlier line for potential item description
  if (prevPrevLine && prevPrevLine.length > 5 && 
      !prevPrevLine.match(skuPattern) && 
      !prevPrevLine.match(pricePattern) &&
      !prevPrevLine.toLowerCase().includes("sku")) {
    return cleanDescription(prevPrevLine);
  }
  
  // Check next line if it doesn't contain price or SKU
  if (nextLine && nextLine.length > 5 && 
      !nextLine.match(skuPattern) && 
      !nextLine.match(pricePattern) &&
      !nextLine.toLowerCase().includes("total")) {
    return cleanDescription(nextLine);
  }
  
  // Fallback: Extract potential description from current line
  // Remove SKU, price, and quantity information
  let description = currentLine
    .replace(skuPattern, '')
    .replace(pricePattern, '')
    .replace(quantityPattern, '')
    .trim();
  
  if (description.length > 3) {
    return cleanDescription(description);
  }
  
  // If all else fails, use a generic description
  return `Product ${sku}`;
}

// Helper to clean up description text
function cleanDescription(text) {
  return text
    .replace(/R\s*\d+(?:[.,]\d{3})*(?:\.\d{1,2})?/g, '') // Remove price
    .replace(/\b\d+\s*(?:units?|pcs|boxes|rolls)\b/ig, '') // Remove quantity
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
    .trim();
}

// Get extracted data from a processed quote
router.get('/:quoteId', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    
    // Fetch the actual processed quote data from the database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes found in database' });
    }
    
    const quote = db.data.quotes.find(q => q.id === quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Return the quote data
    res.json(quote);
    
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote data', message: error.message });
  }
});

// Update the create products endpoint
router.post('/:quoteId/create-products', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    const markup = req.body.markup || 50; // Default 50% markup
    
    console.log(`Starting product creation for quote ${quoteId} with markup ${markup}%`);
    
    // Fetch the quote from the database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes found in database' });
    }
    
    const quote = db.data.quotes.find(q => q.id === quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    if (quote.status !== 'processed') {
      return res.status(400).json({ error: 'Quote has not been processed yet' });
    }
    
    if (!quote.products || quote.products.length === 0) {
      return res.status(400).json({ error: 'No products found in the quote' });
    }
    
    // Create Shopify client
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });
    
    // Get existing products to check for SKU matches
    console.log('Fetching existing products from Shopify...');
    const existingProducts = await getExistingProducts(client);
    console.log(`Found ${existingProducts.length} existing products in Shopify`);
    
    const createdProducts = [];
    const updatedProducts = [];
    const skippedProducts = [];
    
    // Process each product from the quote
    for (const product of quote.products) {
      try {
        // Ensure we use the full description from the original quote
        const fullDescription = product.description.trim();
        
        // Calculate price with markup
        const supplierPrice = parseFloat(product.unitPrice);
        const markupPrice = supplierPrice * (1 + markup / 100);
        
        console.log(`Processing product: ${product.sku} - ${fullDescription}`);
        console.log(`Supplier price: R${supplierPrice.toFixed(2)}, Marked up price: R${markupPrice.toFixed(2)}`);
        
        // Check if product with this SKU already exists
        const existingProduct = findProductBySku(existingProducts, product.sku);
        
        if (existingProduct) {
          console.log(`Found existing product with SKU ${product.sku}, updating...`);
          // Update existing product
          const updatedProduct = await updateShopifyProduct(
            client, 
            existingProduct.id, 
            {
              ...product,
              description: fullDescription
            }, 
            markupPrice
          );
          updatedProducts.push(updatedProduct);
        } else {
          // Try to find product by similar description if SKU doesn't match
          const similarProduct = findProductBySimilarDescription(existingProducts, fullDescription);
          
          if (similarProduct) {
            console.log(`Found similar product "${similarProduct.title}", updating...`);
            const updatedProduct = await updateShopifyProduct(
              client, 
              similarProduct.id, 
              {
                ...product,
                description: fullDescription
              }, 
              markupPrice
            );
            updatedProducts.push(updatedProduct);
          } else {
            console.log(`Creating new product with SKU ${product.sku}...`);
            // Create new product
            const newProduct = await createShopifyProduct(
              client,
              {
                ...product,
                description: fullDescription
              },
              markupPrice
            );
            createdProducts.push(newProduct);
          }
        }
      } catch (productError) {
        console.error(`Error processing product ${product.sku}:`, productError);
        skippedProducts.push({
          sku: product.sku,
          description: product.description,
          error: productError.message
        });
      }
    }
    
    // Update the quote in the database
    const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    if (quoteIndex !== -1) {
      db.data.quotes[quoteIndex].shopifyProductsCreated = true;
      db.data.quotes[quoteIndex].shopifyProducts = [
        ...createdProducts.map(p => ({
          id: p.id,
          title: p.title,
          sku: p.variants[0]?.sku,
          price: p.variants[0]?.price,
          originalPrice: p.variants[0]?.sku && quote.products.find(qp => qp.sku === p.variants[0].sku)?.unitPrice,
          markup: markup,
          created: true
        })),
        ...updatedProducts.map(p => ({
          id: p.id,
          title: p.title,
          sku: p.variants[0]?.sku,
          price: p.variants[0]?.price,
          originalPrice: p.variants[0]?.sku && quote.products.find(qp => qp.sku === p.variants[0].sku)?.unitPrice,
          markup: markup,
          updated: true
        }))
      ];
      await db.write();
    }
    
    // Format response for client
    const results = {
      created: createdProducts.length,
      updated: updatedProducts.length,
      skipped: skippedProducts.length,
      products: [
        ...createdProducts.map(p => ({
          id: p.id,
          title: p.title,
          sku: p.variants && p.variants[0] ? p.variants[0].sku : null,
          price: p.variants && p.variants[0] ? p.variants[0].price : null,
          type: 'created'
        })),
        ...updatedProducts.map(p => ({
          id: p.id,
          title: p.title,
          sku: p.variants && p.variants[0] ? p.variants[0].sku : null,
          price: p.variants && p.variants[0] ? p.variants[0].price : null,
          type: 'updated'
        }))
      ],
      errors: skippedProducts
    };
    
    console.log(`Product creation complete: Created ${results.created}, Updated ${results.updated}, Skipped ${results.skipped}`);
    
    res.status(201).json({
      message: `Created ${results.created} products and updated ${results.updated} products in Shopify`,
      results
    });
    
  } catch (error) {
    console.error('Error creating products:', error);
    res.status(500).json({ error: 'Failed to create products', message: error.message });
  }
});

// Helper to get existing products from Shopify
async function getExistingProducts(client) {
  try {
    let allProducts = [];
    let response = await client.get({
      path: 'products',
      query: { limit: 250 } // Get a substantial number of products
    });
    
    allProducts = response.body.products || [];
    
    // Handle pagination if there are more products
    while (response.body?.products?.length === 250) {
      const lastId = allProducts[allProducts.length - 1]?.id;
      if (!lastId) break;
      
      response = await client.get({
        path: 'products',
        query: { limit: 250, since_id: lastId }
      });
      
      if (response.body.products && response.body.products.length > 0) {
        allProducts = [...allProducts, ...response.body.products];
      } else {
        break;
      }
    }
    
    return allProducts;
  } catch (error) {
    console.error('Error fetching existing products:', error);
    return [];
  }
}

// Helper to find a product by SKU
function findProductBySku(products, sku) {
  if (!sku) return null;
  
  // Look through all products and their variants
  for (const product of products) {
    if (product.variants) {
      for (const variant of product.variants) {
        if (variant.sku === sku) {
          return product;
        }
      }
    }
  }
  return null;
}

// Helper to find a product by similar description
function findProductBySimilarDescription(products, description) {
  if (!description) return null;
  
  // Normalize the description for comparison
  const normalizedDescription = description.toLowerCase().trim();
  
  // Look for products with similar titles
  for (const product of products) {
    const productTitle = product.title?.toLowerCase().trim() || '';
    
    // Check if the product title contains the description or vice versa
    if (productTitle.includes(normalizedDescription) || 
        normalizedDescription.includes(productTitle)) {
      return product;
    }
  }
  
  return null;
}

// Create a new product in Shopify with complete details
async function createShopifyProduct(client, product, price) {
  console.log(`Creating new product: ${product.description} (${product.sku})`);
  
  // Format vendor from the original quote if available
  const vendor = "BuildCore Distributors";
  
  // Create product tags based on product description
  const tags = extractTags(product.description);
  
  // Create a new product
  const response = await client.post({
    path: 'products',
    data: {
      product: {
        title: product.description,
        body_html: `<p>${product.description}</p>`,
        vendor: vendor,
        product_type: determineProductType(product.description),
        tags: tags.join(', '),
        status: "active",
        variants: [
          {
            sku: product.sku,
            price: price.toFixed(2),
            inventory_management: "shopify",
            inventory_quantity: product.availableQuantity || 0,
            requires_shipping: true,
            taxable: true,
            barcode: "" // Can be populated if barcode info is available
          }
        ],
        options: [
          {
            name: "Size",
            values: ["Default"]
          }
        ]
      }
    }
  });
  
  if (response.body.product) {
    console.log(`Successfully created product: ${response.body.product.title} (ID: ${response.body.product.id})`);
  }
  
  return response.body.product;
}

// Update an existing product in Shopify
async function updateShopifyProduct(client, productId, product, price) {
  console.log(`Updating product ID ${productId} with SKU ${product.sku}`);
  
  // First get the current product data
  const getResponse = await client.get({
    path: `products/${productId}`
  });
  
  const existingProduct = getResponse.body.product;
  
  if (!existingProduct) {
    throw new Error(`Product with ID ${productId} not found`);
  }
  
  // Find the variant matching our SKU, or the primary variant
  let variantToUpdate = null;
  if (existingProduct.variants) {
    variantToUpdate = existingProduct.variants.find(v => v.sku === product.sku);
    if (!variantToUpdate && existingProduct.variants.length > 0) {
      variantToUpdate = existingProduct.variants[0];
    }
  }
  
  if (!variantToUpdate) {
    throw new Error(`Could not find a variant to update for product ${productId}`);
  }
  
  // Update the variant with new price and inventory
  await client.put({
    path: `variants/${variantToUpdate.id}`,
    data: {
      variant: {
        id: variantToUpdate.id,
        price: price.toFixed(2),
        inventory_quantity: product.availableQuantity || 0,
        sku: product.sku // Update SKU if it was different
      }
    }
  });
  
  // Now get the updated product
  const updateResponse = await client.get({
    path: `products/${productId}`
  });
  
  console.log(`Successfully updated product: ${updateResponse.body.product.title}`);
  
  return updateResponse.body.product;
}

// Helper to extract meaningful tags from product description
function extractTags(description) {
  if (!description) return [];
  
  // Basic tag extraction - split words and filter
  const words = description
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .map(word => word.toLowerCase());
  
  // Remove duplicates
  return [...new Set(words)];
}

// Determine product type from description
function determineProductType(description) {
  if (!description) return "Hardware";
  
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes("paint")) return "Paint";
  if (lowerDesc.includes("brush")) return "Brushes";
  if (lowerDesc.includes("drill") || lowerDesc.includes("grinder")) return "Power Tools";
  if (lowerDesc.includes("mask")) return "Safety Equipment";
  if (lowerDesc.includes("mop") || lowerDesc.includes("clean")) return "Cleaning Supplies";
  
  return "Hardware"; // Default category
}

// Access the uploaded file
router.get('/:quoteId/file', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    
    // Fetch the quote from the database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes found in database' });
    }
    
    const quote = db.data.quotes.find(q => q.id === quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    if (!quote.filePath || !fs.existsSync(quote.filePath)) {
      return res.status(404).json({ error: 'Quote file not found' });
    }
    
    // Determine content type based on file extension
    const ext = path.extname(quote.filePath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      contentType = 'image/jpeg';
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${quote.originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(quote.filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving quote file:', error);
    res.status(500).json({ error: 'Failed to serve quote file', message: error.message });
  }
});

// List all quotes
router.get('/', async (req, res) => {
  try {
    // Get filter parameters
    const { search, status } = req.query;
    
    // Fetch quotes from database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      db.data.quotes = [];
      await db.write();
    }
    
    let quotes = db.data.quotes;
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      quotes = quotes.filter(quote => 
        (quote.supplierName && quote.supplierName.toLowerCase().includes(searchLower)) ||
        (quote.originalName && quote.originalName.toLowerCase().includes(searchLower))
      );
    }
    
    if (status) {
      quotes = quotes.filter(quote => quote.status === status);
    }
    
    // Sort by upload date, most recent first
    quotes.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    // Return quotes with limited fields for the list view
    const quotesForList = quotes.map(quote => ({
      id: quote.id,
      supplierName: quote.supplierName,
      uploadedAt: quote.uploadedAt,
      processedAt: quote.processedAt,
      status: quote.status,
      validUntil: quote.validUntil,
      products: quote.products || [],
      shopifyProductsCreated: !!quote.shopifyProductsCreated,
      error: quote.error
    }));
    
    res.json(quotesForList);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes', message: error.message });
  }
});

// This might be in src/routes/quote-processing.js or another file that handles background processing

// Existing code
db.updateQuote(quoteId, {
  products: extractedProducts,
  // Add this line to update the status
  status: 'completed'
}, (err) => {
  if (err) {
    console.error(`Error updating quote ${quoteId}:`, err);
  } else {
    console.log(`Quote ${quoteId} processing completed and saved to database`);
  }
});

// Delete a quote
router.delete('/:quoteId', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    
    // Fetch the database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes found in database' });
    }
    
    const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    
    if (quoteIndex === -1) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Get the file path before removing from database
    const filePath = db.data.quotes[quoteIndex].filePath;
    
    // Remove from database
    db.data.quotes.splice(quoteIndex, 1);
    await db.write();
    
    // Try to delete the file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ 
      message: 'Quote deleted successfully',
      id: quoteId
    });
    
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote', message: error.message });
  }
});

// Debug route to get extraction details
router.get('/:quoteId/debug', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    const db = await getDB();
    await db.read();
    
    const quote = db.data.quotes.find(q => q.id === quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Return extraction debugging info
    res.json({
      extractedText: quote.extractedText,
      products: quote.products,
      status: quote.status,
      processingInfo: {
        fileType: quote.fileInfo?.type,
        ocrConfidence: quote.ocrConfidence
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to view a quote's raw products 
router.get('/:quoteId/products-raw', async (req, res) => {
  try {
    const { quoteId } = req.params;
    const db = await getDB();
    await db.read();
    
    const quote = db.data.quotes.find(q => q.id === quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json({
      id: quoteId,
      products: quote.products || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// In src/routes/quote-processing.js

router.get('/:id', async (req, res) => {
  const quoteId = req.params.id;
  console.log(`Fetching quote ${quoteId} details`);
  
  try {
    // Your existing database fetch logic - replace this with your actual database access code
    const quote = await Quote.findById(quoteId); // Or however you access your database
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Add processing status info to the response
    const response = {
      id: quote.id,
      products: quote.products || [],
      status: quote.status || 'processing',
      processingComplete: quote.status === 'completed',
      timestamp: new Date().toISOString()
    };
    
    console.log(`Returning quote ${quoteId} with status: ${response.status}, products: ${response.products.length}`);
    res.json(response);
  } catch (error) {
    console.error(`Error fetching quote ${quoteId}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to test Claude directly
router.post('/debug-claude', upload.single('quoteFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    console.log(`Debug test with file: ${filePath}`);
    
    // Process with Claude
    const extractedProducts = await processQuoteWithClaude(filePath);
    
    // Return detailed response
    res.json({
      success: true,
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      extractedProducts,
      productsCount: extractedProducts.length
    });
  } catch (error) {
    console.error('Debug Claude test error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
