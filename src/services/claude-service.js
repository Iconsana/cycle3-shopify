// src/services/claude-service.js
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// To this:
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
    const extractedProducts = JSON.parse(jsonMatch[0]);
    console.log(`Extracted ${extractedProducts.length} products from document`);
    
    return extractedProducts;
  } catch (error) {
    console.error('Error processing quote with Claude:', error);
    throw error;
  }
}
