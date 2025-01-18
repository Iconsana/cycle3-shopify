// extensions/product-suppliers/src/index.js
import {
  extend,
  TextField,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Card,
  Text,
  Modal,
} from '@shopify/admin-ui-extensions';

console.log('Extension script loaded'); // Debug log

extend('Admin::Product::Details', async (root, { extensionPoint }) => {
  console.log('Extension point triggered', extensionPoint); // Debug log
  console.log('Product ID:', extensionPoint.productId); // Debug log

  const container = root.createComponent(BlockStack, {
    spacing: 'loose',
  });

  // Supplier Management Card
  const card = root.createComponent(Card, {
    title: 'Supplier Management TEST', // Added TEST to verify we see updates
    sectioned: true,
  });

  // Add simple text to verify rendering
  card.appendChild(
    root.createComponent(Text, {
      text: 'Supplier Management Interface Loading...',
    })
  );

  container.appendChild(card);
  console.log('Extension rendered'); // Debug log
  return container;
});
