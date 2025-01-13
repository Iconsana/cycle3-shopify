import { extend } from '@shopify/admin-ui-extensions';

extend('Admin::Product::SubscriptionPlan::Add', (root) => {
  const container = root.createComponent('BlockStack', {
    spacing: 'loose'
  });

  const card = root.createComponent('Card', {
    title: 'Suppliers',
    sectioned: true,
  });

  // Supplier List section
  const supplierList = root.createComponent('ResourceList', {
    resourceName: { singular: 'supplier', plural: 'suppliers' },
    loading: false,
    renderItem: (item) => {
      const { name, priority, price, stockLevel } = item;
      
      return root.createComponent('ResourceItem', {
        id: item.id,
        accessibilityLabel: `Supplier ${name}`,
        children: [
          root.createComponent('BlockStack', {
            spacing: 'tight',
            children: [
              root.createComponent('TextBlock', {
                text: `Name: ${name}`,
                subdued: false,
              }),
              root.createComponent('TextBlock', {
                text: `Priority: ${priority}`,
                subdued: true,
              }),
              root.createComponent('TextBlock', {
                text: `Price: ${price}`,
                subdued: true,
              }),
              root.createComponent('TextBlock', {
                text: `Stock Level: ${stockLevel}`,
                subdued: true,
              }),
            ],
          }),
        ],
      });
    },
  });

  // Add Supplier Button
  const addButton = root.createComponent('Button', {
    title: 'Add Supplier',
    primary: true,
    onPress: () => {
      // Show add supplier modal
      console.log('Add supplier clicked');
    },
  });

  // Add components to card
  card.appendChild(supplierList);
  card.appendChild(addButton);
  
  // Add card to container
  container.appendChild(card);
  
  // Return the extension
  return root;
});
