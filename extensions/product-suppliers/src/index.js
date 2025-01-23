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

extend('Admin::Product::PrimaryButton', async (root, { extensionPoint }) => {
  console.log('Extension point triggered', extensionPoint); // Debug log

  const container = root.createComponent(BlockStack, {
    spacing: 'loose',
  });

  // State for new supplier form
  let showNewSupplierForm = false;
  let suppliersList = [];

  // Supplier Management Card
  const card = root.createComponent(Card, {
    title: 'Supplier Management',
    sectioned: true,
  });

  // Supplier Dropdown
  const supplierSelect = root.createComponent(Select, {
    label: 'Select Supplier',
    options: [
      { label: 'Add New Supplier', value: 'new' },
      // Dynamic options will be populated here
    ],
    onChange: async (value) => {
      if (value === 'new') {
        showNewSupplierForm = true;
        root.rerender();
      }
    },
  });

  // Priority Field
  const priorityField = root.createComponent(TextField, {
    label: 'Priority',
    type: 'number',
    min: 1,
    helpText: 'Lower number = higher priority',
  });

  // Price Field
  const priceField = root.createComponent(TextField, {
    label: 'Price',
    type: 'number',
    step: '0.01',
    prefix: 'R',
  });

  // Stock Level Field
  const stockField = root.createComponent(TextField, {
    label: 'Stock Level',
    type: 'number',
    min: 0,
  });

  // Save Button
  const saveButton = root.createComponent(Button, {
    title: 'Save Supplier',
    primary: true,
    onPress: async () => {
      // Save supplier logic here
      const data = {
        priority: parseInt(priorityField.value),
        price: parseFloat(priceField.value),
        stockLevel: parseInt(stockField.value),
        supplierId: supplierSelect.value
      };

      try {
        const response = await fetch(`/api/products/${extensionPoint.productId}/suppliers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        
        if (response.ok) {
          // Clear form and refresh list
          priorityField.value = '';
          priceField.value = '';
          stockField.value = '';
          await loadSuppliers();
        }
      } catch (error) {
        console.error('Error saving supplier:', error);
      }
    },
  });

  // Add components to card
  card.appendChild(
    root.createComponent(BlockStack, {
      spacing: 'tight',
      children: [
        supplierSelect,
        priorityField,
        priceField,
        stockField,
        root.createComponent(InlineStack, {
          spacing: 'tight',
          alignment: 'end',
          children: [saveButton],
        }),
      ],
    })
  );

  // New Supplier Form Modal
  if (showNewSupplierForm) {
    container.appendChild(
      root.createComponent(Modal, {
        title: 'Add New Supplier',
        onClose: () => {
          showNewSupplierForm = false;
          root.rerender();
        },
        children: [
          root.createComponent(BlockStack, {
            spacing: 'tight',
            children: [
              root.createComponent(TextField, {
                label: 'Supplier Name',
                required: true,
              }),
              root.createComponent(TextField, {
                label: 'Email',
                type: 'email',
                required: true,
              }),
              root.createComponent(TextField, {
                label: 'Lead Time (days)',
                type: 'number',
                min: 0,
                required: true,
              }),
              root.createComponent(Button, {
                title: 'Add Supplier',
                primary: true,
                onPress: async () => {
                  showNewSupplierForm = false;
                  root.rerender();
                },
              }),
            ],
          }),
        ],
      })
    );
  }

  // Load suppliers function
  async function loadSuppliers() {
    try {
      const response = await fetch(`/api/products/${extensionPoint.productId}/suppliers`);
      if (response.ok) {
        const suppliers = await response.json();
        suppliersList = suppliers;
        updateSuppliersList();
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }

  // Update suppliers list display
  function updateSuppliersList() {
    const list = root.createComponent(BlockStack, {
      spacing: 'tight',
    });

    suppliersList.forEach(supplier => {
      list.appendChild(
        root.createComponent(InlineStack, {
          spacing: 'loose',
          alignment: 'center',
          children: [
            root.createComponent(Text, { text: supplier.name }),
            root.createComponent(Text, { text: `Priority: ${supplier.priority}` }),
            root.createComponent(Text, { text: `R${supplier.price.toFixed(2)}` }),
            root.createComponent(Text, { text: `Stock: ${supplier.stockLevel}` }),
          ],
        })
      );
    });

    card.children = [list];
  }

  // Initial load
  loadSuppliers();

  // Add card to container
  container.appendChild(card);
  return container;
});
