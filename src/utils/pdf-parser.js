// src/utils/pdf-parser.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for pdf-parse library trying to access test files
const fixPdfParse = () => {
  // Create directory structure for test data in multiple potential locations
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // List of possible locations where pdf-parse might look for test files
  const possiblePaths = [
    path.join(__dirname, '../../node_modules/pdf-parse/test/data'),
    path.join(process.cwd(), 'test/data'),
    path.join(process.cwd(), 'node_modules/pdf-parse/test/data')
  ];
  
  try {
    // Create empty test PDF content
    const testPdfContent = '%PDF-1.3\n%¥±ë\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[]/Count 0>>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000015 00000 n \n0000000060 00000 n \ntrailer\n<</Size 3/Root 1 0 R>>\nstartxref\n110\n%%EOF\n';
    
    // Create directories and test file in all possible locations
    for (const dirPath of possiblePaths) {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const testFile = path.join(dirPath, '05-versions-space.pdf');
      if (!fs.existsSync(testFile)) {
        fs.writeFileSync(testFile, testPdfContent);
      }
    }
    
    console.log('Fixed pdf-parse test file issue in both module and working directories');
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
    
    try {
      // Import pdf-parse dynamically
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = pdfParseModule.default;
      
      // Parse PDF
      console.log('Starting PDF parsing...');
      const result = await pdfParse(dataBuffer);
      console.log(`PDF parsed successfully. Extracted ${result.text.length} characters of text`);
      
      // Debug logging
      if (result.text && result.text.length > 0) {
        console.log(`Raw extracted text (first 500 chars):\n${result.text.substring(0, 500)}`);
      }
      
      // Return the extracted data
      return {
        text: result.text,
        info: result.info || {},
        numpages: result.numpages || 0,
        metadata: result.metadata || {}
      };
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      
      // Try a fallback approach - extract text as best we can
      // For now, return the error so we can at least see what's happening
      return { 
        text: 'Error extracting PDF content. ' + pdfError.message,
        info: {},
        numpages: 0,
        error: pdfError.message
      };
    }
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    
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
