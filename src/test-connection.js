import dotenv from 'dotenv';
import shopify from '@shopify/shopify-api';

dotenv.config();

async function testAdminAPI() {
  try {
    const client = new shopify.clients.Graphql({
      session: {
        shop: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const response = await client.query({
      data: {
        query: `{
          shop {
            name
            primaryDomain {
              url
            }
          }
        }`
      }
    });

    console.log('✅ Admin API Connection Successful!');
    console.log('Shop Name:', response.body.data.shop.name);
    console.log('Domain:', response.body.data.shop.primaryDomain.url);
    return true;
  } catch (error) {
    console.error('❌ Admin API Connection Failed:', error.message);
    return false;
  }
}

async function testStorefrontAPI() {
  try {
    const response = await fetch(
      `https://${process.env.SHOPIFY_SHOP_NAME}/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
        },
        body: JSON.stringify({
          query: `{
            shop {
              name
              products(first: 1) {
                edges {
                  node {
                    title
                  }
                }
              }
            }
          }`
        })
      }
    );

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    console.log('✅ Storefront API Connection Successful!');
    console.log('Shop Name:', data.data.shop.name);
    console.log('First Product:', data.data.shop.products.edges[0]?.node.title || 'No products found');
    return true;
  } catch (error) {
    console.error('❌ Storefront API Connection Failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('Testing API Connections...\n');
  
  const adminSuccess = await testAdminAPI();
  console.log('\n-------------------\n');
  const storefrontSuccess = await testStorefrontAPI();
  
  if (adminSuccess && storefrontSuccess) {
    console.log('\n✨ All connections successful!');
  } else {
    console.log('\n⚠️ Some connections failed. Please check your credentials.');
  }
}

main().catch(console.error);
