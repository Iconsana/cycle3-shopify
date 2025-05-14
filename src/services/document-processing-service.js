// document-processing-service.js
const { ClaudeService, CLAUDE_MODELS } = require('./claude-service');
const PdfConverter = require('./pdf-converter');

class DocumentProcessingService {
  constructor() {
    this.claudeService = new ClaudeService();
    this.pdfConverter = new PdfConverter();
  }
  
  async processDocument(file, options = {}) {
    const { buffer, mimetype, originalname } = file;
    
    try {
      // Handle document based on mimetype
      if (mimetype === 'application/pdf') {
        // For PDFs, use native PDF support if available
        if (options.useNativePdfSupport) {
          return this.processPdfNatively(buffer, options.prompt);
        } else {
          // Otherwise, convert to images
          return this.processPdfAsImages(buffer, options.prompt);
        }
      } else if (mimetype.startsWith('image/')) {
        // For images, process directly
        return this.processImage(buffer, mimetype, options.prompt);
      } else {
        // Unsupported file type
        throw new Error(`Unsupported file type: ${mimetype}`);
      }
    } catch (error) {
      console.error(`Error processing document ${originalname}:`, error);
      throw error;
    }
  }
  
  async processPdfNatively(pdfBuffer, prompt = 'Please analyze this document') {
    // Use Claude's native PDF support
    const base64Pdf = pdfBuffer.toString('base64');
    
    const response = await this.claudeService.client.messages.create({
      model: CLAUDE_MODELS.DEFAULT,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      anthropic_version: '2023-06-01',
      headers: {
        'anthropic-beta': 'pdfs-2024-09-25'
      }
    });
    
    return response;
  }
  
  async processPdfAsImages(pdfBuffer, prompt = 'Please analyze these document images') {
    // Convert PDF to images first
    const imageBuffers = await this.pdfConverter.convertToImages(pdfBuffer);
    
    // Create content array with text and images
    const content = [{ type: 'text', text: prompt }];
    
    for (const imageBuffer of imageBuffers) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: imageBuffer.toString('base64')
        }
      });
    }
    
    // Process with Claude
    const response = await this.claudeService.client.messages.create({
      model: CLAUDE_MODELS.DEFAULT,
      max_tokens: 4096,
      messages: [{ role: 'user', content }]
    });
    
    return response;
  }
  
  async processImage(imageBuffer, mimeType, prompt = 'Please analyze this image') {
    // Process image directly
    const base64Image = imageBuffer.toString('base64');
    
    const response = await this.claudeService.client.messages.create({
      model: CLAUDE_MODELS.DEFAULT,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    }); 
    
    return response;
  }
}

module.exports = DocumentProcessingService;
