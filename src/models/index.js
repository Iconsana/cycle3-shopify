export { Supplier } from './supplier.js';
export { ProductSupplier } from './productSupplier.js';
export { PurchaseOrder } from './purchaseOrder.js';
export { Session } from './session.js';

// New fields for user association
  shop: { type: String, required: true },
  userId: { type: String },
  // End new fields
}, { timestamps: true });

// Compound index for shop + name uniqueness
supplierSchema.index({ shop: 1, name: 1 }, { unique: true });
