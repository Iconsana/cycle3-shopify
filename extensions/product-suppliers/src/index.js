import {
  extend,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Card,
  DataTable,
  Form,
  useState,
  useEffect,
} from '@shopify/admin-ui-extensions';

extend('product-suppliers', (root) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const productId = root.productId;

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${productId}/suppliers`);
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${productId}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to add supplier');
      }
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
          <Form onSubmit={handleSubmit}>
            <BlockStack gap="300">
              <TextField label="Name" name="name" required />
              <TextField label="Priority" name="priority" type="number" required />
              <TextField label="Price" name="price" type="number" step="0.01" required />
              <TextField label="Stock Level" name="stockLevel" type="number" required />
              <Button submit disabled={loading}>
                {loading ? 'Adding...' : 'Add Supplier'}
              </Button>
            </BlockStack>
          </Form>

          {suppliers.length > 0 && (
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
        </BlockStack>
      </Card>
    </BlockStack>
  );
});
