// src/debug-quote-processing.js - Enhanced debugging for quote processing flow
import { processQuoteWithClaude } from './services/claude-service.js';
import { getDB } from './services/database.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced debugging for quote processing flow
 * @param {string} filePath - Path to the test file (PDF or image)
 * @param {string} quoteId - Optional quote ID to check status
 */
async function debugQuoteProcessing(filePath, quoteId) {
  console.log('\n==== ENHANCED QUOTE PROCESSING DEBUG TOOL ====\n');
  
  // Step 1: If quote ID is provided, check its status in the database
  if (quoteId) {
    await checkQuoteStatus(quoteId);
    return;
  }
  
  // Step 2: If file path is provided, debug file processing
  if (filePath) {
    console.log(`Testing file: ${filePath}`);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: File not found at ${filePath}`);
      console.log('Please provide a valid file path to test');
      return;
    }
    
    // Get file info
    const stats = fs.statSync(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    let mediaType = 'application/pdf';
    
    if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
      mediaType = 'image/jpeg';
    } else if (fileExtension === '.png') {
      mediaType = 'image/png';
    }
    
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`File type: ${mediaType}`);
    
    // Process the file with Claude
    console.log('\n[1] Processing quote with Claude...');
    try {
      console.time('Claude processing time');
      const extractedProducts = await processQuoteWithClaude(filePath);
      console.timeEnd('Claude processing time');
      
      console.log(`\n[2] Claude extraction complete - returned ${extractedProducts.length} products`);
      
      if (extractedProducts.length > 0) {
        console.log('\nSample of extracted products:');
        console.log(JSON.stringify(extractedProducts.slice(0, 2), null, 2));
        
        // Save to debug file
        const outputPath = path.join(__dirname, '../debug-claude-output.json');
        fs.writeFileSync(outputPath, JSON.stringify(extractedProducts, null, 2));
        console.log(`\nFull results saved to: ${outputPath}`);
      } else {
        console.log('\nWARNING: No products were extracted from the file.');
      }
      
      return extractedProducts;
    } catch (error) {
      console.error('\nERROR processing quote with Claude:', error);
      console.error('Stack trace:', error.stack);
      return null;
    }
  }
  
  console.log('No file path or quote ID provided. Please specify one or the other.');
}

/**
 * Check the status of a quote in the database
 * @param {string} quoteId - The ID of the quote to check
 */
async function checkQuoteStatus(quoteId) {
  console.log(`\n[1] Checking status for quote ID: ${quoteId}`);
  
  try {
    // Get the database
    const db = await getDB();
    await db.read();
    
    if (!db.data.quotes) {
      console.error('ERROR: No quotes collection found in database!');
      return;
    }
    
    const quote = db.data.quotes.find(q => q.id === quoteId);
    
    if (!quote) {
      console.error(`ERROR: Quote with ID ${quoteId} not found in database!`);
      return;
    }
    
    console.log('\n[2] Quote found in database:');
    console.log('   - Status:', quote.status);
    console.log('   - Supplier:', quote.supplierName);
    console.log('   - Uploaded at:', new Date(quote.uploadedAt).toLocaleString());
    console.log('   - File path:', quote.filePath);
    console.log('   - File exists:', fs.existsSync(quote.filePath) ? 'Yes' : 'No');
    
    if (quote.processedAt) {
      console.log('   - Processed at:', new Date(quote.processedAt).toLocaleString());
    }
    
    if (quote.error) {
      console.log('   - Error:', quote.error);
    }
    
    console.log(`   - Products count: ${quote.products?.length || 0}`);
    
    if (quote.status === 'processed' && (!quote.products || quote.products.length === 0)) {
      console.error('\nCRITICAL ERROR: Quote status is "processed" but no products found!');
      console.log('This explains why the frontend is not showing any products.');
    }
    
    if (quote.status === 'processing') {
      console.log('\nQuote is still being processed. This might explain why the frontend is not showing products yet.');
      
      // Check how long it's been processing
      const processingTime = new Date() - new Date(quote.uploadedAt);
      const minutesProcessing = Math.floor(processingTime / 60000);
      
      console.log(`This quote has been processing for ${minutesProcessing} minutes.`);
      
      if (minutesProcessing > 5) {
        console.log('ALERT: Processing time is unusually long. There might be an issue with the Claude API or background processing.');
      }
    }
    
    // Check for other issues
    if (quote.status === 'error') {
      console.error('\nQuote processing ended with an error:');
      console.error(quote.error || 'No error message saved');
    }
    
    if (quote.products && quote.products.length > 0) {
      console.log('\n[3] Sample of extracted products:');
      console.log(JSON.stringify(quote.products.slice(0, 2), null, 2));
    }
    
    return quote;
  } catch (error) {
    console.error('Error checking quote status:', error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Quickly test quote retrieval via API
 * @param {string} quoteId - The ID of the quote to test
 */
async function testQuoteAPI(quoteId) {
  console.log(`\n[1] Testing API endpoint for quote ID: ${quoteId}`);
  
  try {
    const apiUrl = `http://localhost:${process.env.PORT || 10000}/api/quotes/${quoteId}`;
    console.log(`Making request to: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`ERROR: API returned status ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }
    
    const data = await response.json();
    console.log('\n[2] API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error testing quote API:', error);
  }
}

// Main function to run the selected debug operation
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node src/debug-quote-processing.js file <filepath> - Debug Claude processing for a file');
    console.log('  node src/debug-quote-processing.js quote <quote_id> - Check status of quote in database');
    console.log('  node src/debug-quote-processing.js api <quote_id> - Test the API endpoint for a quote');
    process.exit(1);
  }
  
  const mode = args[0];
  
  if (mode === 'file') {
    const filePath = args[1];
    if (!filePath) {
      console.error('ERROR: File path is required');
      process.exit(1);
    }
    await debugQuoteProcessing(filePath);
  } else if (mode === 'quote') {
    const quoteId = args[1];
    if (!quoteId) {
      console.error('ERROR: Quote ID is required');
      process.exit(1);
    }
    await checkQuoteStatus(quoteId);
  } else if (mode === 'api') {
    const quoteId = args[1];
    if (!quoteId) {
      console.error('ERROR: Quote ID is required');
      process.exit(1);
    }
    await testQuoteAPI(quoteId);
  } else {
    console.error(`ERROR: Unknown mode "${mode}"`);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { debugQuoteProcessing, checkQuoteStatus, testQuoteAPI };
