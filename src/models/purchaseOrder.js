import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  supplierId: { type: String, required: true },
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
  approvedAt: Date,
  // Add shop field for authentication
  shop: { type: String, required: true }
}, { timestamps: true });

// Create indexes for faster queries
purchaseOrderSchema.index({ poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ supplierId: 1 });
purchaseOrderSchema.index({ shop: 1 });
purchaseOrderSchema.index({ status: 1 });

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
