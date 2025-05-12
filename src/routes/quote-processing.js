// src/routes/quote-processing.js - Enhanced Implementation
import express from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { getDB } from '../services/database.js';

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

// Background processing function
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
    
    // Process the file
    let extractionResult;
    
    try {
      // Process based on file type
      if (mimeType === 'application/pdf') {
        extractionResult = await processPDF(filePath);
      } else {
        // Image processing for png, jpg, etc.
        extractionResult = await processQuoteWithOCR(filePath);
      }
      
      console.log(`Extraction completed for quote ${quoteId}. Found ${extractionResult.products.length} products.`);
      
      // Update the database with results
      await db.read(); // Reload in case it changed
      
      const updatedQuoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
      
      if (updatedQuoteIndex !== -1) {
        db.data.quotes[updatedQuoteIndex].status = 'processed';
        db.data.quotes[updatedQuoteIndex].processedAt = new Date().toISOString();
        db.data.quotes[updatedQuoteIndex].products = extractionResult.products;
        db.data.quotes[updatedQuoteIndex].extractedText = extractionResult.text.substring(0, 1000); // Save first 1000 chars only
        db.data.quotes[updatedQuoteIndex].ocrConfidence = extractionResult.confidence || 0.85; // Default or actual confidence
        
        await db.write();
        console.log(`Quote ${quoteId} processing completed and saved to database`);
      } else {
        console.error(`Quote ${quoteId} disappeared from database during processing`);
      }
      
    } catch (extractionError) {
      console.error(`Extraction error for quote ${quoteId}:`, extractionError);
      
      // Update quote with error status
      await db.read();
      const errorQuoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
      
      if (errorQuoteIndex !== -1) {
        db.data.quotes[errorQuoteIndex].status = 'error';
        db.data.quotes[errorQuoteIndex].error = extractionError.message;
        await db.write();
      }
    }
    
  } catch (error) {
    console.error(`Background processing error for quote ${quoteId}:`, error);
  }
}

// Process PDF files
async function processPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    // Process the text content
    return processExtractedText(pdfData.text, pdfData.info);
  } catch (error) {
    console.error('PDF processing error:', error);
    throw error;
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

// Process extracted text to find products
function processExtractedText(text, metadata = {}) {
  // Simple text parsing for the MVP
  // In a real implementation, this would be more sophisticated
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // Regular expressions for finding product information
  const skuPattern = /\b([A-Z0-9]+-[A-Z0-9]+|[A-Z0-9]{4,})\b/; // SKU pattern
  const pricePattern = /(\$|R)?\s?(\d+\.?\d*)/; // Price pattern with optional currency symbol
  const quantityPattern = /qty:?\s*(\d+)|(\d+)\s*pcs/i; // Quantity pattern
  
  // Very basic extraction logic - will vary based on quote formats
  const products = [];
  
  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip very short lines or header-like lines
    if (line.length < 5 || line.toUpperCase() === line && line.length < 15) {
      continue;
    }
    
    // Look for patterns that might indicate product entries
    const skuMatch = line.match(skuPattern);
    const priceMatch = line.match(pricePattern);
    
    if (skuMatch && priceMatch) {
      // Try to find a quantity
      const quantityMatch = line.match(quantityPattern) || 
                           (i+1 < lines.length ? lines[i+1].match(quantityPattern) : null);
      
      // Extract description by removing SKU and price
      let description = line
        .replace(skuMatch[0], '')
        .replace(priceMatch[0], '')
        .replace(quantityMatch ? quantityMatch[0] : '', '')
        .trim();
      
      // Clean up description
      description = description.replace(/\s+/g, ' ').trim();
      
      // If description is too short, try to look at previous or next line
      if (description.length < 3 && i > 0) {
        description = lines[i-1].trim();
      }
      
      // Create product object
      products.push({
        sku: skuMatch[1],
        description: description || `Product ${products.length + 1}`,
        unitPrice: parseFloat(priceMatch[2]),
        availableQuantity: quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[2]) : 100,
        minimumOrder: 1,
        leadTime: '3-5 days' // Default value
      });
    }
  }
  
  // Fallback to more aggressive extraction if no products found
  if (products.length === 0) {
    // Try to find any price-like numbers
    const allPrices = [];
    const allDescriptions = [];
    
    for (const line of lines) {
      const priceMatch = line.match(pricePattern);
      if (priceMatch && parseFloat(priceMatch[2]) > 0) {
        allPrices.push({
          price: parseFloat(priceMatch[2]),
          line: line.replace(priceMatch[0], '').trim()
        });
      } else if (line.length > 10 && line.length < 100) {
        // This could be a product description
        allDescriptions.push(line.trim());
      }
    }
    
    // Match prices with descriptions
    for (let i = 0; i < allPrices.length; i++) {
      const price = allPrices[i];
      const description = price.line.length > 10 ? price.line : 
                         (allDescriptions[i] || `Item ${i+1}`);
      
      products.push({
        sku: `UNKNOWN-${i+1}`,
        description: description,
        unitPrice: price.price,
        availableQuantity: 50, // Default value
        minimumOrder: 1,
        leadTime: '3-5 days' // Default value
      });
    }
  }
  
  return {
    text: text, // Full extracted text
    products: products, // Structured product data
    metadata: metadata
  };
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

// Create products in Shopify from extracted quote data
router.post('/:quoteId/create-products', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    const markup = req.body.markup || 50; // Default 50% markup
    
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
    
    // Simulate creating products in Shopify
    const createdProducts = [];
    
    for (const product of quote.products) {
      // Calculate price with markup
      const markupPrice = product.unitPrice * (1 + markup / 100);
      
      // In production, use the Shopify API to create the product
      // For MVP, return mock data
      createdProducts.push({
        id: `gid://shopify/Product/${Date.now() + Math.floor(Math.random() * 1000)}`,
        title: product.description,
        sku: product.sku,
        price: markupPrice.toFixed(2),
        originalPrice: product.unitPrice,
        markup: markup
      });
    }
    
    // Update the quote in the database
    const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    if (quoteIndex !== -1) {
      db.data.quotes[quoteIndex].shopifyProductsCreated = true;
      db.data.quotes[quoteIndex].shopifyProducts = createdProducts;
      await db.write();
    }
    
    res.status(201).json({
      message: `Created ${createdProducts.length} products in Shopify`,
      products: createdProducts
    });
    
  } catch (error) {
    console.error('Error creating products:', error);
    res.status(500).json({ error: 'Failed to create products', message: error.message });
  }
});

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

export default router;
