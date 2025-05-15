import express from 'express';
import fs from 'fs';
import path from 'path';
import { getDB } from '../services/database.js';
import { processQuoteWithClaude } from '../services/claude-service.js';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get detailed quote information for debugging
router.get('/quotes/:quoteId/debug', async (req, res) => {
  try {
    const { quoteId } = req.params;
    
    // Get the DB
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes collection in database' });
    }
    
    // Find the quote
    const quote = db.data.quotes.find(q => q.id === quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Check if file exists
    let fileExists = false;
    if (quote.filePath) {
      fileExists = fs.existsSync(quote.filePath);
    }
    
    // Calculate processing time if applicable
    let processingTimeInfo = null;
    if (quote.uploadedAt) {
      const uploadTime = new Date(quote.uploadedAt).getTime();
      const currentTime = new Date().getTime();
      
      if (quote.processedAt) {
        const processTime = new Date(quote.processedAt).getTime();
        processingTimeInfo = {
          processingTimeSeconds: Math.floor((processTime - uploadTime) / 1000),
          processingTimeMinutes: Math.floor((processTime - uploadTime) / 60000)
        };
      } else if (quote.status === 'processing') {
        processingTimeInfo = {
          currentProcessingTimeSeconds: Math.floor((currentTime - uploadTime) / 1000),
          currentProcessingTimeMinutes: Math.floor((currentTime - uploadTime) / 60000)
        };
      }
    }
    
    // Return enhanced debug info
    res.json({
      quote: {
        id: quote.id,
        supplierName: quote.supplierName,
        status: quote.status,
        uploadedAt: quote.uploadedAt,
        processedAt: quote.processedAt,
        error: quote.error || null,
        productsCount: quote.products?.length || 0,
        fileInfo: {
          originalName: quote.originalName,
          path: quote.filePath,
          exists: fileExists,
          type: quote.fileInfo?.type,
          size: quote.fileInfo?.size
        }
      },
      processingTimeInfo,
      databaseInfo: {
        totalQuotes: db.data.quotes.length,
        quotesWithProducts: db.data.quotes.filter(q => q.products && q.products.length > 0).length,
        processingQuotes: db.data.quotes.filter(q => q.status === 'processing').length
      },
      serverInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ error: 'Error getting debug info', message: error.message });
  }
});

// Force reprocess a quote with Claude
router.post('/quotes/:quoteId/reprocess', async (req, res) => {
  try {
    const { quoteId } = req.params;
    
    // Get the DB
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes collection in database' });
    }
    
    // Find the quote
    const quoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
    if (quoteIndex === -1) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const quote = db.data.quotes[quoteIndex];
    
    // Check if the file exists
    if (!quote.filePath || !fs.existsSync(quote.filePath)) {
      return res.status(400).json({ error: 'Quote file not found' });
    }
    
    // Update status to processing
    db.data.quotes[quoteIndex].status = 'processing';
    db.data.quotes[quoteIndex].processedAt = null;
    db.data.quotes[quoteIndex].error = null;
    await db.write();
    
    // Return immediate response
    res.status(202).json({
      message: 'Quote reprocessing started',
      quote: {
        id: quote.id,
        status: 'processing'
      }
    });
    
    // Process in background
    setTimeout(async () => {
      try {
        console.log(`Reprocessing quote ${quoteId} with Claude...`);
        
        // Process with Claude
        const extractedProducts = await processQuoteWithClaude(quote.filePath);
        
        // Update the database with results
        await db.read(); // Reload in case it changed
        
        const updatedQuoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
        if (updatedQuoteIndex !== -1) {
          db.data.quotes[updatedQuoteIndex].status = 'processed';
          db.data.quotes[updatedQuoteIndex].processedAt = new Date().toISOString();
          db.data.quotes[updatedQuoteIndex].products = extractedProducts;
          
          await db.write();
          console.log(`Quote ${quoteId} reprocessing completed - found ${extractedProducts.length} products`);
        }
      } catch (error) {
        console.error(`Error reprocessing quote ${quoteId}:`, error);
        
        // Update with error
        try {
          await db.read();
          const errorQuoteIndex = db.data.quotes.findIndex(q => q.id === quoteId);
          if (errorQuoteIndex !== -1) {
            db.data.quotes[errorQuoteIndex].status = 'error';
            db.data.quotes[errorQuoteIndex].error = error.message;
            await db.write();
          }
        } catch (dbError) {
          console.error('Error updating quote with error status:', dbError);
        }
      }
    }, 500); // Small delay to ensure response is sent first
    
  } catch (error) {
    console.error('Reprocess route error:', error);
    res.status(500).json({ error: 'Error starting reprocessing', message: error.message });
  }
});

// Get detailed system status information
router.get('/system-status', async (req, res) => {
  try {
    // Get DB information
    const db = await getDB();
    await db.read();
    
    // Basic system info
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      date: new Date().toISOString()
    };
    
    // Database info
    const dbInfo = {
      suppliers: db.data.suppliers?.length || 0,
      productSuppliers: db.data.productSuppliers?.length || 0,
      products: db.data.products?.length || 0,
      quotes: db.data.quotes?.length || 0,
      purchaseOrders: db.data.purchaseOrders?.length || 0
    };
    
    // Quote processing stats
    const quoteStats = {
      total: db.data.quotes?.length || 0,
      byStatus: {
        processing: db.data.quotes?.filter(q => q.status === 'processing').length || 0,
        processed: db.data.quotes?.filter(q => q.status === 'processed').length || 0,
        error: db.data.quotes?.filter(q => q.status === 'error').length || 0,
        uploaded: db.data.quotes?.filter(q => q.status === 'uploaded').length || 0
      },
      withProducts: db.data.quotes?.filter(q => q.products && q.products.length > 0).length || 0,
      totalProductsExtracted: db.data.quotes?.reduce((sum, q) => sum + (q.products?.length || 0), 0) || 0
    };
    
    // Environment variables (sanitized)
    const envInfo = {
      port: process.env.PORT,
      appUrl: process.env.APP_URL,
      shopName: process.env.SHOPIFY_SHOP_NAME,
      hasAnthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
      nodeEnv: process.env.NODE_ENV
    };
    
    // Storage info
    const uploadsDir = path.join(__dirname, '../../uploads');
    let storageInfo = { 
      uploadsDir,
      dirExists: false,
      files: 0,
      fileTypes: {}
    };
    
    if (fs.existsSync(uploadsDir)) {
      storageInfo.dirExists = true;
      try {
        const files = fs.readdirSync(uploadsDir);
        storageInfo.files = files.length;
        
        // Count file types
        files.forEach(file => {
          const ext = path.extname(file).toLowerCase();
          storageInfo.fileTypes[ext] = (storageInfo.fileTypes[ext] || 0) + 1;
        });
      } catch (err) {
        storageInfo.error = err.message;
      }
    }
    
    // Response
    res.json({
      systemInfo,
      database: dbInfo,
      quotes: quoteStats,
      environment: envInfo,
      storage: storageInfo
    });
  } catch (error) {
    console.error('System status route error:', error);
    res.status(500).json({ error: 'Error getting system status', message: error.message });
  }
});

// Test Claude directly with an existing file
router.post('/test-claude/:quoteId', async (req, res) => {
  try {
    const { quoteId } = req.params;
    
    // Get the DB
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      return res.status(404).json({ error: 'No quotes collection in database' });
    }
    
    // Find the quote
    const quote = db.data.quotes.find(q => q.id === quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Check if the file exists
    if (!quote.filePath || !fs.existsSync(quote.filePath)) {
      return res.status(400).json({ error: 'Quote file not found' });
    }
    
    // Process with Claude
    console.log(`Testing Claude processing for quote ${quoteId}...`);
    const startTime = Date.now();
    
    const extractedProducts = await processQuoteWithClaude(quote.filePath);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Return results
    res.json({
      success: true,
      quoteId,
      fileName: quote.originalName,
      processingTimeMs: processingTime,
      processingTimeSec: processingTime / 1000,
      productsCount: extractedProducts.length,
      products: extractedProducts
    });
    
  } catch (error) {
    console.error('Test Claude route error:', error);
    res.status(500).json({ 
      error: 'Error processing with Claude', 
      message: error.message,
      stack: error.stack 
    });
  }
});

export default router;
