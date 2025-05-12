// Create a wrapper for pdf-parse that handles the missing test file issue

// src/utils/pdf-parser.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for pdf-parse library trying to access test files
const fixPdfParse = () => {
  // Create directory structure for test data if it doesn't exist
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const testDir = path.join(__dirname, '../../node_modules/pdf-parse/test/data');
  
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

// Now import the pdf-parse library
let pdfParse;
try {
  pdfParse = (await import('pdf-parse')).default;
} catch (error) {
  console.error('Error importing pdf-parse:', error);
  // Create a fallback implementation that just returns empty text
  pdfParse = async () => ({ text: '', info: {}, numpages: 0 });
}

// Wrapper function for processing PDFs
export async function processPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    return await pdfParse(dataBuffer);
  } catch (error) {
    console.error('Error processing PDF:', error);
    // Return empty result on error
    return { text: '', info: {}, numpages: 0 };
  }
}

export default processPDF;
