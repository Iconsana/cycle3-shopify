// src/services/claude-service.js
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
// src/services/claude-service.js
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Create the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Processes a quote document using Claude Vision
 * @param {string} filePath - Path to the PDF or image file
 * @returns {Promise<Array>} - Array of extracted products
 */
export async function processQuoteWithClaude(filePath) {
  try {
    // Read the file and convert to base64
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    
    // Determine media type based on file extension
    const fileExt = path.extname(filePath).toLowerCase();
    let mediaType = 'application/pdf';
    if (fileExt === '.jpg' || fileExt === '.jpeg') {
      mediaType = 'image/jpeg';
    } else if (fileExt === '.png') {
      mediaType = 'image/png';
    }
    
    console.log(`Processing ${filePath} as ${mediaType}`);
    
    // Call Claude API with a more detailed prompt that handles various quote formats
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please extract all product information from this supplier quote. 

I need you to identify:
1. SKU/Product codes
2. Product descriptions
3. Quantities (if present)
4. Unit prices
5. Total prices (if available)

The document might be structured as a table, list, or in various formats. Please be thorough and extract all products you can identify.

Format your response as a valid JSON array where each product is an object with the following fields:
[
  {
    "sku": "The product SKU or code",
    "description": "The product description",
    "quantity": 1, (use 1 if not specified)
    "unitPrice": 0.00, (the price per unit as a number)
    "availableQuantity": 10 (use 10 if stock level is not specified)
  },
  ... more products
]

If no products are found, return an empty array: []

Pay special attention to pricing information and ensure it's correctly associated with the right product. Common formats include "R100", "$100", "100 ZAR", etc.

Do not include headers, explanations, or notes - ONLY return the JSON array.`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Content
              }
            }
          ]
        }
      ]
    });
    
    // Parse the response to extract the JSON
    const textResponse = response.content[0].text;
    console.log("Claude raw response:", textResponse.substring(0, 500) + "...");
    
    // Find the JSON array in the response - handle both regular and indented JSON
    const jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.log("No valid JSON found in response");
      return [];
    }
    
    // Parse the JSON array
    try {
      const extractedText = jsonMatch[0].trim();
      console.log("Extracted JSON text:", extractedText.substring(0, 200) + "...");
      
      const extractedProducts = JSON.parse(extractedText);
      console.log(`Extracted ${extractedProducts.length} products from document`);
      
      // Validate and clean up the data
      const validatedProducts = extractedProducts.map(product => ({
        sku: product.sku || "Unknown SKU",
        description: product.description || `Product ${product.sku || "Unknown"}`,
        quantity: parseInt(product.quantity) || 1,
        unitPrice: parseFloat(product.unitPrice) || 0,
        availableQuantity: parseInt(product.availableQuantity) || 10
      }));
      
      return validatedProducts;
    } catch (jsonError) {
      console.error('Error parsing JSON from Claude response:', jsonError);
      console.log('Raw matched text:', jsonMatch[0].substring(0, 200) + "...");
      return [];
    }
  } catch (error) {
    console.error('Error processing quote with Claude:', error);
    console.error('Error details:', error.stack);
    return [];
  }
}
// Check if API key is set and log status (not the actual key)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY environment variable is not set. Claude functionality will not work.');
} else {
  console.log('Anthropic API key is configured and available');
}

// Create the Anthropic client with better error handling
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
}) : null;

/**
 * Processes a quote document using Claude Vision
 * @param {string} filePath - Path to the PDF or image file
 * @returns {Promise<Array>} - Array of extracted products
 */
export async function processQuoteWithClaude(filePath) {
  try {
    // Check if Anthropic client is available
    if (!anthropic) {
      throw new Error('Anthropic API key not configured. Please set the ANTHROPIC_API_KEY environment variable.');
    }

    // Read the file and convert to base64
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    
    // Determine media type based on file extension
    const fileExt = path.extname(filePath).toLowerCase();
    let mediaType = 'application/pdf';
    if (fileExt === '.jpg' || fileExt === '.jpeg') {
      mediaType = 'image/jpeg';
    } else if (fileExt === '.png') {
      mediaType = 'image/png';
    }
    
    console.log(`Processing ${filePath} as ${mediaType}`);
    
    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229", // or claude-3-haiku for faster processing
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all product information from this supplier quote including SKU, description, quantity, unit price, and total price. 
                    Look for tabular data with product listings.
                    Return the data as a JSON array with this format: 
                    [{"sku": "SKU123", "description": "Product description", "quantity": 10, "unitPrice": 99.99, "totalPrice": 999.90}]
                    Be sure to correctly identify and extract all products from the document. If no products are found, return an empty array.`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Content
              }
            }
          ]
        }
      ]
    });
    
    // Parse the response to extract the JSON
    const textResponse = response.content[0].text;
    
    // Find the JSON array in the response
    const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("No valid JSON found in response:", textResponse);
      return [];
    }
    
    // Parse the JSON array
    try {
      const extractedProducts = JSON.parse(jsonMatch[0]);
      console.log(`Extracted ${extractedProducts.length} products from document`);
      
      return extractedProducts;
    } catch (jsonError) {
      console.error('Error parsing JSON from Claude response:', jsonError);
      console.log('Raw response text:', textResponse);
      return [];
    }
  } catch (error) {
    console.error('Error processing quote with Claude:', error);
    // Return empty array instead of throwing to allow the application to continue
    return [];
  }
}
