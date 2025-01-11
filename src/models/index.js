import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  leadTime: { type: Number, default: 0 },
  apiType: { type: String, enum: ['api', 'email'], default: 'email' },
  credentials: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const productSupplierSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  priority: { type: Number, default: 0 },
  price: { type: Number, required: true },
  stockLevel: { type: Number, default: 0 },
  minimumOrder: { type: Number, default: 1 },
  lastSync: { type: Date, default: Date.now }
}, { timestamps: true });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  orderReference: { type: String, required: true },
  status: { type: String, enum: ['pending_approval', 'approved', 'sent', 'completed'], default: 'pending_approval' },
  items: [{
    sku: String,
    quantity: Number,
    title: String,
    variant_id: String,
    supplierPrice: Number,
    leadTime: Number
  }],
  shippingAddress: { type: mongoose.Schema.Types.Mixed },
  approvalRequired: { type: Boolean, default: true },
  approvedBy: String,
  approvedAt: Date
}, { timestamps: true });

export const Supplier = mongoose.model('Supplier', supplierSchema);
export const ProductSupplier = mongoose.model('ProductSupplier', productSupplierSchema);
export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
