// extensions/product-supplier-management/src/index.js
import {
  extend,
  Button,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Card,
  DataTable,
  Form,
  useEffect,
  useState,
} from '@shopify/admin-ui-extensions';

extend('product-supplier-management', async (root) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const productId = root.productId;
  const apiUrl = `https://cycle3-shopify.onrender.com/api/products/${productId}/suppliers`;

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl);
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSupplier = async (formData) => {
    try {
      setLoading(true);
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      await fetchSuppliers();
    } catch (error) {
      console.error('Error adding supplier:', error);
    } finally {
      setLoading(false);
    }
  };

  root.render(
    <BlockStack gap="400">
      <Card title="Supplier Management">
        <BlockStack gap="400">
          <Form onSubmit={addSupplier}>
            <BlockStack gap="300">
              <TextField 
                label="Name" 
                name="name" 
                required 
                disabled={loading}
              />
              <TextField 
                label="Priority" 
                name="priority" 
                type="number" 
                required 
                disabled={loading}
              />
              <TextField 
                label="Price" 
                name="price" 
                type="number" 
                step="0.01" 
                required 
                disabled={loading}
              />
              <TextField 
                label="Stock Level" 
                name="stockLevel" 
                type="number" 
                required 
                disabled={loading}
              />
              <Button submit disabled={loading}>
                {loading ? 'Adding...' : 'Add Supplier'}
              </Button>
            </BlockStack>
          </Form>

          {loading && <Text>Loading...</Text>}

          {!loading && suppliers.length > 0 && (
            <DataTable
              headings={['Name', 'Priority', 'Price', 'Stock']}
              rows={suppliers.map(s => [
                s.name,
                s.priority.toString(),
                `R${s.price.toFixed(2)}`,
                s.stockLevel.toString()
              ])}
            />
          )}

          {!loading && suppliers.length === 0 && (
            <Text>No suppliers added yet</Text>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
});
