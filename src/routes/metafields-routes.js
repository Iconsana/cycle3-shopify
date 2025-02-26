import express from 'express';
import { getProductSuppliers, updateProductSuppliers } from '../services/metafields.js';

const router = express.Router();

// Get suppliers from product metafields
router.get('/products/:productId/metafields', async (req, res) => {
  try {
    const { productId } = req.params;
    const { accessToken, shop } = req.query;
    
    if (!accessToken || !shop) {
      return res.status(400).json({
        error: 'Missing required parameters: accessToken and shop'
      });
    }
    
    const supplierData = await getProductSuppliers(productId, accessToken, shop);
    res.json(supplierData);
  } catch (error) {
    console.error('Error fetching product metafields:', error);
    res.status(500).json({
      error: 'Failed to fetch product metafields',
      message: error.message
    });
  }
});

// Update suppliers for a product via metafields
router.post('/products/:productId/metafields', async (req, res) => {
  try {
    const { productId } = req.params;
    const { suppliers, primarySupplierId, accessToken, shop } = req.body;
    
    if (!accessToken || !shop) {
      return res.status(400).json({
        error: 'Missing required parameters: accessToken and shop'
      });
    }
    
    if (!suppliers || !Array.isArray(suppliers)) {
      return res.status(400).json({
        error: 'Invalid suppliers data'
      });
    }
    
    const result = await updateProductSuppliers(
      productId, 
      suppliers, 
      primarySupplierId || suppliers[0]?.id, 
      accessToken, 
      shop
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error updating product metafields:', error);
    res.status(500).json({
      error: 'Failed to update product metafields',
      message: error.message
    });
  }
});

export default router;
