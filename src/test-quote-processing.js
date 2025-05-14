// src/test-quote-processing.js
import { processQuoteWithClaude } from './services/claude-service.js';
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
 * Test the quote processing functionality
 * @param {string} filePath - Path to the test file (PDF or image)
 */
async function testQuoteProcessing(filePath) {
  console.log('\n==== TESTING QUOTE PROCESSING ====\n');
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
  
  // Process the file
  console.log('\nProcessing quote...');
  try {
    console.time('Processing time');
    const extractedProducts = await processQuoteWithClaude(filePath);
    console.timeEnd('Processing time');
    
    console.log(`\nExtracted ${extractedProducts.length} products:`);
    
    if (extractedProducts.length > 0) {
      // Display a table of results
      console.log('\n| SKU | Description | Price | Quantity |');
      console.log('|-----|-------------|-------|----------|');
      
      extractedProducts.forEach(product => {
        console.log(`| ${product.sku.padEnd(5)} | ${(product.description || '').substring(0, 30).padEnd(30)} | ${product.unitPrice.toFixed(2).padStart(7)} | ${product.availableQuantity.toString().padStart(10)} |`);
      });
      
      console.log('\nFull JSON output:');
      console.log(JSON.stringify(extractedProducts, null, 2));
    } else {
      console.log('No products were extracted from the file.');
    }
    
    return extractedProducts;
  } catch (error) {
    console.error('\nERROR processing quote:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Main function to run the test
async function main() {
  // Check if API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set');
    console.log('Please set the ANTHROPIC_API_KEY in your .env file');
    process.exit(1);
  }
  
  // Check for command line argument for file path
  let filePath = process.argv[2];
  
  if (!filePath) {
    console.log('No file path provided in command line arguments');
    console.log('Looking for test files in the uploads directory...');
    
    // Try to find a test file in the uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));
      const imageFiles = files.filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'));
      
      if (pdfFiles.length > 0) {
        filePath = path.join(uploadsDir, pdfFiles[0]);
        console.log(`Found PDF file: ${filePath}`);
      } else if (imageFiles.length > 0) {
        filePath = path.join(uploadsDir, imageFiles[0]);
        console.log(`Found image file: ${filePath}`);
      } else {
        console.error('No test files found in uploads directory');
        console.log('Please provide a file path as a command line argument');
        console.log('Example: node src/test-quote-processing.js ./path/to/quote.pdf');
        process.exit(1);
      }
    } else {
      console.error('Uploads directory not found');
      console.log('Please provide a file path as a command line argument');
      console.log('Example: node src/test-quote-processing.js ./path/to/quote.pdf');
      process.exit(1);
    }
  }
  
  // Run the test
  await testQuoteProcessing(filePath);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
