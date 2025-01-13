import { shopifyApi } from '@shopify/shopify-api';

export async function getProductSuppliers(productId) {
  const client = new shopifyApi.clients.Graphql({
    session: {
      shop: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    }
  });

  try {
    const response = await client.query({
      data: {
        query: `
          query GetProductSuppliers($productId: ID!) {
            product(id: $productId) {
              metaobjects(type: "product_supplier", first: 10) {
                edges {
                  node {
                    id
                    fields {
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        `,
        variables: {
          productId: `gid://shopify/Product/${productId}`
        }
      }
    });

    return response.body.data.product.metaobjects.edges.map(edge => {
      const fields = edge.node.fields.reduce((acc, field) => {
        acc[field.key] = field.value;
        return acc;
      }, {});

      return {
        id: edge.node.id,
        ...fields
      };
    });
  } catch (error) {
    console.error('Error fetching product suppliers:', error);
    throw error;
  }
}

export async function addProductSupplier(productId, supplierData) {
  const client = new shopifyApi.clients.Graphql({
    session: {
      shop: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    }
  });

  try {
    const response = await client.query({
      data: {
        query: `
          mutation CreateProductSupplier($input: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $input) {
              metaobject {
                id
                fields {
                  key
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            type: "product_supplier",
            fields: [
              { key: "product_id", value: productId },
              { key: "supplier_id", value: supplierData.supplierId },
              { key: "priority", value: supplierData.priority.toString() },
              { key: "price", value: supplierData.price.toString() },
              { key: "stock_level", value: supplierData.stockLevel.toString() }
            ]
          }
        }
      }
    });

    if (response.body.data.metaobjectCreate.userErrors.length > 0) {
      throw new Error(response.body.data.metaobjectCreate.userErrors[0].message);
    }

    return response.body.data.metaobjectCreate.metaobject;
  } catch (error) {
    console.error('Error adding product supplier:', error);
    throw error;
  }
}

export async function updateProductSupplier(metaobjectId, supplierData) {
  const client = new shopifyApi.clients.Graphql({
    session: {
      shop: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    }
  });

  try {
    const response = await client.query({
      data: {
        query: `
          mutation UpdateProductSupplier($id: ID!, $fields: [MetaobjectFieldInput!]!) {
            metaobjectUpdate(id: $id, fields: $fields) {
              metaobject {
                id
                fields {
                  key
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          id: metaobjectId,
          fields: [
            { key: "priority", value: supplierData.priority.toString() },
            { key: "price", value: supplierData.price.toString() },
            { key: "stock_level", value: supplierData.stockLevel.toString() }
          ]
        }
      }
    });

    if (response.body.data.metaobjectUpdate.userErrors.length > 0) {
      throw new Error(response.body.data.metaobjectUpdate.userErrors[0].message);
    }

    return response.body.data.metaobjectUpdate.metaobject;
  } catch (error) {
    console.error('Error updating product supplier:', error);
    throw error;
  }
}
