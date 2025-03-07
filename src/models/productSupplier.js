import mongoose from 'mongoose';

const productSupplierSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  priority: { type: Number, default: 0 },
  price: { type: Number, required: true },
  stockLevel: { type: Number, default: 0 },
  minimumOrder: { type: Number, default: 1 },
  lastSync: { type: Date, default: Date.now }
}, { timestamps: true });

export const ProductSupplier = mongoose.models.ProductSupplier || mongoose.model('ProductSupplier', productSupplierSchema);
