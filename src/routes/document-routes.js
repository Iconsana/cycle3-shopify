// document-routes.js
const express = require('express');
const multer = require('multer');
const DocumentProcessingService = require('./document-processing-service');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const documentService = new DocumentProcessingService();

// Route for document analysis
router.post('/analyze', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }
    
    const result = await documentService.processDocument(req.file, {
      prompt: req.body.prompt || 'Please analyze this document',
      useNativePdfSupport: req.body.useNativePdfSupport === 'true'
    });
    
    res.json({ 
      success: true, 
      analysis: result.content[0].text 
    });
  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during document analysis' 
    });
  }
});

module.exports = router;
