// src/routes/quote-processing.js
import express from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import shopify from '../../config/shopify.js';

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
    const validUntil = req.body.validUntil; // Format: YYYY-MM-DD
    
    // Store the uploaded file info
    const fileInfo = {
      id: Date.now().toString(),
      originalName: req.file.originalname,
      filePath: filePath,
      supplierName: supplierName,
      validUntil: validUntil || null,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      extractedProducts: []
    };
    
    // Save to database (for now, just return the info)
    res.status(201).json({ 
      message: 'Quote uploaded successfully',
      quote: fileInfo,
      nextStep: `/api/quotes/${fileInfo.id}/process`
    });
  } catch (error) {
    console.error('Error uploading quote:', error);
    res.status(500).json({ error: 'Quote upload failed', message: error.message });
  }
});

// Process the quote using OCR
router.post('/:quoteId/process', async (req, res) => {
  try {
    // In a real implementation, retrieve the quote info from the database
    // For this MVP, we'll use a mock implementation
    const quoteId = req.params.quoteId;
    
    // Start OCR processing
    res.status(202).json({ 
      message: 'Quote processing started',
      quoteId: quoteId,
      status: 'processing',
      estimatedTime: '30 seconds'
    });
    
    // In a production app, this would be handled by a background job
    // For the MVP, we'll demonstrate the process flow
    
    // Simulate OCR processing and extraction (to be implemented with real OCR)
    setTimeout(() => {
      console.log(`Processing completed for quote ${quoteId}`);
      // The result would be stored in the database
    }, 5000);
    
  } catch (error) {
    console.error('Error processing quote:', error);
    res.status(500).json({ error: 'Quote processing failed', message: error.message });
  }
});

// Get extracted data from a processed quote
router.get('/:quoteId', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    
    // In production, fetch the processed quote data from the database
    // For MVP, return mock data
    const mockExtractedData = {
      quoteId: quoteId,
      supplierName: 'ACME Electronics',
      validUntil: '2025-12-31',
      status: 'processed',
      processedAt: new Date().toISOString(),
      products: [
        {
          sku: 'DF1730SL-20A',
          description: 'Power Supply 20A 12V DC',
          unitPrice: 45.99,
          minimumOrder: 5,
          availableQuantity: 100,
          leadTime: '3-5 days'
        },
        {
          sku: 'WMC55-12',
          description: 'Wireless Module Controller',
          unitPrice: 22.50,
          minimumOrder: 10,
          availableQuantity: 250,
          leadTime: '7 days'
        }
      ]
    };
    
    res.json(mockExtractedData);
    
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote data', message: error.message });
  }
});

// Create products in Shopify from extracted quote data
router.post('/:quoteId/create-products', async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    const markup = req.body.markup || 1.5; // Default 50% markup
    
    // In production, fetch the processed quote from the database
    // For MVP, use mock data
    const mockProducts = [
      {
        sku: 'DF1730SL-20A',
        description: 'Power Supply 20A 12V DC',
        unitPrice: 45.99,
        markupPrice: 45.99 * markup
      },
      {
        sku: 'WMC55-12',
        description: 'Wireless Module Controller',
        unitPrice: 22.50,
        markupPrice: 22.50 * markup
      }
    ];
    
    // Simulate creating products in Shopify
    const createdProducts = [];
    
    for (const product of mockProducts) {
      // In production, use the Shopify API to create the product
      // For MVP, return mock data
      createdProducts.push({
        id: `gid://shopify/Product/${Date.now() + Math.floor(Math.random() * 1000)}`,
        title: product.description,
        sku: product.sku,
        price: product.markupPrice.toFixed(2),
        originalPrice: product.unitPrice,
        markup: markup
      });
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

// Implement the OCR processing function with Tesseract.js
async function processQuoteWithOCR(filePath) {
  try {
    // For images, use Tesseract OCR
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    
    // Simple text parsing for the MVP
    // In a real implementation, this would be more sophisticated
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    // Very basic extraction logic - will vary based on quote formats
    const products = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for patterns that might indicate product entries
      // This is a simplified example - real implementation would be more robust
      const skuMatch = line.match(/\b([A-Z0-9]+-[A-Z0-9]+)\b/);
      const priceMatch = line.match(/\$?(\d+\.\d{2})/);
      
      if (skuMatch && priceMatch) {
        // Found a potential product
        products.push({
          sku: skuMatch[1],
          description: line.replace(skuMatch[0], '').replace(priceMatch[0], '').trim(),
          unitPrice: parseFloat(priceMatch[1]),
          // Other fields would be extracted based on the quote format
        });
      }
    }
    
    return {
      text: text, // Full extracted text
      products: products // Structured product data
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw error;
  }
}

// List all processed quotes
router.get('/', async (req, res) => {
  try {
    // In production, fetch quotes from database
    // For MVP, return mock data
    const mockQuotes = [
      {
        id: '12345',
        supplierName: 'ACME Electronics',
        uploadedAt: '2025-04-15T10:30:00Z',
        status: 'processed',
        productCount: 12
      },
      {
        id: '12346',
        supplierName: 'TechSupply Co.',
        uploadedAt: '2025-04-10T14:22:00Z',
        status: 'processed',
        productCount: 8
      }
    ];
    
    res.json(mockQuotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes', message: error.message });
  }
});

export default router;
