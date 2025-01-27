// extensions/product-suppliers/src/index.js
import {
  extend,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Card,
  DataTable,
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
    setLoading(true);
    const response = await fetch(`/api/products/${productId}/suppliers`);
    const data = await response.json();
    setSuppliers(data);
    setLoading(false);
  };

  root.render(
    <BlockStack gap="400">
      <Card title="Supplier Management">
        <BlockStack gap="400">
          <TextField label="Name" name="name" />
          <TextField label="Priority" type="number" name="priority" />
          <TextField label="Price" type="number" name="price" />
          <TextField label="Stock" type="number" name="stockLevel" />
          <Button onPress={() => fetchSuppliers()}>Add Supplier</Button>

          {suppliers.length > 0 && (
            <DataTable
              headings={['Name', 'Priority', 'Price', 'Stock']}
              rows={suppliers.map(s => [
                s.name,
                s.priority,
                `R${s.price}`,
                s.stockLevel
              ])}
            />
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
});
