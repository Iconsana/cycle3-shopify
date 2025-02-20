import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION, AuthScopes } from '@shopify/shopify-api';
import { restResources } from '@shopify/shopify-api/rest/admin/2024-01';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: [
    AuthScopes.ReadProducts,
    AuthScopes.WriteProducts,
    AuthScopes.ReadOrders,
    AuthScopes.WriteOrders,
    'read_files',
    'write_files'
  ],
  hostName: process.env.APP_URL.replace(/https:\/\//, ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  restResources,
});

export default shopify;
