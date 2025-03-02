import express from 'express';
import { CompanyInfo } from '../models/companyInfo.js';

const router = express.Router();

// Get company information
router.get('/company-info', async (req, res) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        error: 'Missing shop parameter'
      });
    }
    
    let companyInfo = await CompanyInfo.findOne({ shopDomain: shop });
    
    // If no company info exists, return empty template
    if (!companyInfo) {
      companyInfo = {
        shopDomain: shop,
        name: 'Your Company Name',
        address: '123 Business St',
        city: 'City',
        state: 'State',
        zipCode: '12345',
        country: 'Country',
        phone: '+1 (123) 456-7890',
        email: 'contact@example.com',
        poSettings: {
          prefix: 'PO-',
          termsAndConditions: 'Standard terms and conditions apply.',
          defaultCurrency: 'USD',
          defaultPaymentTerms: '30 days'
        }
      };
    }
    
    res.json(companyInfo);
  } catch (error) {
    console.error('Error fetching company info:', error);
    res.status(500).json({
      error: 'Failed to fetch company information',
      message: error.message
    });
  }
});

// Update company information
router.post('/company-info', async (req, res) => {
  try {
    const { shop } = req.query;
    const companyData = req.body;
    
    if (!shop) {
      return res.status(400).json({
        error: 'Missing shop parameter'
      });
    }
    
    // Find and update, or create if not exists
    const companyInfo = await CompanyInfo.findOneAndUpdate(
      { shopDomain: shop },
      { ...companyData, shopDomain: shop },
      { new: true, upsert: true }
    );
    
    res.json(companyInfo);
  } catch (error) {
    console.error('Error updating company info:', error);
    res.status(500).json({
      error: 'Failed to update company information',
      message: error.message
    });
  }
});

export default router;
