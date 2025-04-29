import mongoose from 'mongoose';

const productSupplierSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  supplierId: { type: String, required: true },
  priority: { type: Number, default: 0 },
  price: { type: Number, required: true },
  stockLevel: { type: Number, default: 0 },
  minimumOrder: { type: Number, default: 1 },
  lastSync: { type: Date, default: Date.now },
  // Add shop field for authentication
  shop: { type: String, required: true }
}, { timestamps: true });

// Create indexes for faster queries
productSupplierSchema.index({ productId: 1 });
productSupplierSchema.index({ supplierId: 1 });
productSupplierSchema.index({ shop: 1 });
productSupplierSchema.index({ productId: 1, supplierId: 1 }, { unique: true });

export const ProductSupplier = mongoose.models.ProductSupplier || mongoose.model('ProductSupplier', productSupplierSchema);
