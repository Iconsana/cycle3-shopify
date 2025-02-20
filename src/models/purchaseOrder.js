import mongoose from 'mongoose';

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

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
