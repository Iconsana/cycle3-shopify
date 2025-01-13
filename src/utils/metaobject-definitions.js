export const supplierDefinition = {
  type: "supplier",
  fields: [
    {
      key: "name",
      type: "single_line_text",
      required: true
    },
    {
      key: "email",
      type: "email",
      required: true
    },
    {
      key: "lead_time",
      type: "number",
      required: true
    },
    {
      key: "status",
      type: "single_line_text",
      required: true
    }
  ]
};

export const productSupplierDefinition = {
  type: "product_supplier",
  fields: [
    {
      key: "product_id",
      type: "single_line_text",
      required: true
    },
    {
      key: "supplier_id",
      type: "single_line_text",
      required: true
    },
    {
      key: "priority",
      type: "number",
      required: true
    },
    {
      key: "price",
      type: "decimal",
      required: true
    },
    {
      key: "stock_level",
      type: "number",
      required: true
    }
  ]
};
