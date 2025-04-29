import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  leadTime: { type: Number, default: 0 },
  apiType: { type: String, enum: ['api', 'email'], default: 'email' },
  credentials: { type: mongoose.Schema.Types.Mixed },
  shop: { type: String, required: true },
  userId: { type: String },
}, { timestamps: true });

// Compound index for shop + name uniqueness
supplierSchema.index({ shop: 1, name: 1 }, { unique: true });

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
