import mongoose from 'mongoose';

const companyInfoSchema = new mongoose.Schema({
  shopDomain: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String },
  fax: { type: String },
  email: { type: String, required: true },
  website: { type: String },
  vatNumber: { type: String },
  registrationNumber: { type: String },
  logo: { type: String }, // URL to logo
  bankDetails: {
    accountName: { type: String },
    accountNumber: { type: String },
    bankName: { type: String },
    swiftCode: { type: String },
    iban: { type: String }
  },
  poSettings: {
    prefix: { type: String, default: 'PO-' },
    termsAndConditions: { type: String, default: 'Standard terms and conditions apply.' },
    defaultCurrency: { type: String, default: 'USD' },
    defaultPaymentTerms: { type: String, default: '30 days' }
  }
}, { timestamps: true });

export const CompanyInfo = mongoose.models.CompanyInfo || mongoose.model('CompanyInfo', companyInfoSchema);
