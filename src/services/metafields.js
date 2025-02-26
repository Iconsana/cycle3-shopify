import shopify from '../../config/shopify.js';

// Metafield namespace and keys
const NAMESPACE = 'cycle3_supplier';
const KEYS = {
  SUPPLIERS: 'suppliers',
  PRIMARY_SUPPLIER: 'primary_supplier'
};

/**
 * Gets supplier metafields for a product
 * @param {string} productId - Shopify product ID
 * @returns {Promise<Object>} - Product supplier data
 */
export const getProductSuppliers = async (productId, accessToken, shop) => {
  try {
    const client = new shopify.clients.Rest({
      session: {
        shop,
        accessToken
      }
    });

    const response = await client.get({
      path: `products/${productId}/metafields`,
      query: {
        namespace: NAMESPACE
      }
    });

    // Process the metafields
    const metafields = response.body.metafields || [];
    let supplierData = {
      suppliers: [],
      primarySupplierId: null
    };

    metafields.forEach(metafield => {
      if (metafield.key === KEYS.SUPPLIERS) {
        try {
          supplierData.suppliers = JSON.parse(metafield.value);
        } catch (e) {
          console.error('Error parsing suppliers metafield', e);
        }
      } else if (metafield.key === KEYS.PRIMARY_SUPPLIER) {
        supplierData.primarySupplierId = metafield.value;
      }
    });

    return supplierData;
  } catch (error) {
    console.error('Error getting product metafields:', error);
    throw error;
  }
};

/**
 * Updates supplier metafields for a product
 * @param {string} productId - Shopify product ID
 * @param {Array} suppliers - Array of supplier objects
 * @param {string} primarySupplierId - ID of primary supplier
 * @returns {Promise<Object>} - Updated metafield data
 */
export const updateProductSuppliers = async (productId, suppliers, primarySupplierId, accessToken, shop) => {
  try {
    const client = new shopify.clients.Rest({
      session: {
        shop,
        accessToken
      }
    });

    // Update suppliers metafield
    const suppliersMetafield = await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: NAMESPACE,
          key: KEYS.SUPPLIERS,
          value: JSON.stringify(suppliers),
          type: 'json'
        }
      }
    });

    // Update primary supplier metafield
    const primarySupplierMetafield = await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: NAMESPACE,
          key: KEYS.PRIMARY_SUPPLIER,
          value: primarySupplierId,
          type: 'string'
        }
      }
    });

    return {
      suppliers: suppliersMetafield.body.metafield,
      primarySupplier: primarySupplierMetafield.body.metafield
    };
  } catch (error) {
    console.error('Error updating product metafields:', error);
    throw error;
  }
};
