// src/services/product-service.js
import shopify from '../../config/shopify.js';

export async function fetchAllProducts() {
  try {
    const client = new shopify.clients.Rest({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    // Initial request
    let response = await client.get({
      path: 'products',
      query: { limit: 50 }
    });
    
    let products = response.body.products;
    
    // Handle pagination if there are more products
    while (response.pageInfo?.nextPage?.query) {
      response = await client.get({
        path: 'products',
        query: response.pageInfo.nextPage.query
      });
      
      products = [...products, ...response.body.products];
    }
    
    console.log(`Fetched ${products.length} products from shop`);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

export async function syncProducts(app) {
  try {
    const products = await fetchAllProducts();
    
    // Store products in memory for the MVP
    app.locals.products = products.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      variants: product.variants.map(v => ({
        id: v.id,
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        inventory_quantity: v.inventory_quantity
      }))
    }));
    
    return app.locals.products;
  } catch (error) {
    console.error('Product sync failed:', error);
    throw error;
  }
}