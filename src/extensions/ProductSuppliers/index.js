import { extend } from '@shopify/admin-ui-extensions';

extend('Admin::Product::SubscriptionPlan::Add', (root) => {
  const container = root.createComponent('BlockStack', {
    spacing: 'loose'
  });

  const card = root.createComponent('Card', {
    title: 'Product Suppliers',
    sectioned: true,
  });

  const supplierTable = root.createComponent('ResourceList', {
    items: [],
    renderItem: (item) => {
      return root.createComponent('ResourceItem', {
        id: item.id,
        accessibilityLabel: `Supplier ${item.name}`,
        children: [
          root.createComponent('Text', { children: item.name }),
          root.createComponent('Text', { children: `Priority: ${item.priority}` }),
          root.createComponent('Text', { children: `Price: ${item.price}` }),
          root.createComponent('Text', { children: `Stock: ${item.stockLevel}` }),
        ],
      });
    },
  });

  const addButton = root.createComponent('Button', {
    title: 'Add Supplier',
    onPress: () => {
      // Open modal to add supplier
    },
  });

  card.appendChild(supplierTable);
  card.appendChild(addButton);
  container.appendChild(card);
  root.appendChild(container);

  return root;
});
