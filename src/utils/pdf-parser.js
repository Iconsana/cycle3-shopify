// src/utils/pdf-parser.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for pdf-parse library trying to access test files
const fixPdfParse = () => {
  // Create directory structure for test data if it doesn't exist
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // IMPORTANT: The pdf-parse library is looking for this file relative to its own directory
  // not our application directory
  const pdfParseDir = path.join(__dirname, '../../node_modules/pdf-parse');
  const testDir = path.join(pdfParseDir, 'test/data');
  
  try {
    // Create directory structure if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create empty test file that pdf-parse looks for
    const testFile = path.join(testDir, '05-versions-space.pdf');
    if (!fs.existsSync(testFile)) {
      // Create an empty PDF file (just the header)
      fs.writeFileSync(testFile, '%PDF-1.3\n%¥±ë\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[]/Count 0>>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000015 00000 n \n0000000060 00000 n \ntrailer\n<</Size 3/Root 1 0 R>>\nstartxref\n110\n%%EOF\n');
    }
    
    console.log('Fixed pdf-parse test file issue');
    return true;
  } catch (error) {
    console.error('Error fixing pdf-parse test file:', error);
    return false;
  }
};

// Run the fix
fixPdfParse();

// Enhanced PDF processing with better error handling
async function processPDF(filePath) {
  console.log(`Starting PDF processing for: ${filePath}`);
  
  try {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found at path: ${filePath}`);
    }
    
    // Read file
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`Read ${dataBuffer.length} bytes from PDF file`);
    
    // Import pdf-parse dynamically
    const pdfParse = (await import('pdf-parse')).default;
    
    // Enhanced options for better text extraction
    const options = {
      // Additional options to improve extraction quality
      // No page handling (process all pages)
      // No custom rendering
    };
    
    // Parse PDF
    console.log('Starting PDF parsing...');
    const result = await pdfParse(dataBuffer, options);
    console.log(`PDF parsed successfully. Extracted ${result.text.length} characters of text`);
    
    // Debug logging - moved inside the function where result is defined
    console.log(`Raw extracted text (first 500 chars):\n${result.text.substring(0, 500)}`);
    
    // Return the extracted data
    return {
      text: result.text,
      info: result.info || {},
      numpages: result.numpages || 0,
      metadata: result.metadata || {}
    };
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    
    // Check for common errors
    if (error.message.includes('file not found')) {
      throw new Error(`PDF file not found: ${filePath}`);
    }
    
    if (error.message.includes('Invalid PDF structure')) {
      throw new Error('The PDF file appears to be corrupted or invalid');
    }
    
    if (error.message.includes('not a PDF file')) {
      throw new Error('The file does not appear to be a valid PDF');
    }
    
    // Return minimal data on error to allow processing to continue
    return { 
      text: 'Error extracting PDF content. ' + error.message,
      info: {},
      numpages: 0,
      error: error.message
    };
  }
}

export default processPDF;
