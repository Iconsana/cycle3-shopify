import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  shop: { type: String, required: true },
  state: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  scope: { type: String },
  accessToken: { type: String },
  expires: { type: Date },
  userId: { type: String }
}, { 
  timestamps: true
});

// Add indexes for faster queries
sessionSchema.index({ shop: 1 });
sessionSchema.index({ accessToken: 1 });
sessionSchema.index({ expires: 1 });

// Compound index for shop and userId
sessionSchema.index({ shop: 1, userId: 1 });

// Add method to check if session is valid
sessionSchema.methods.isValid = function() {
  return this.accessToken && 
         this.expires && 
         new Date() < this.expires;
};

// Add method to check if session needs refresh
sessionSchema.methods.needsRefresh = function() {
  if (!this.expires) return true;
  
  // Check if session expires in less than 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  return (this.expires.getTime() - new Date().getTime()) < fiveMinutes;
};

// Statics for finding valid sessions
sessionSchema.statics.findValidSession = async function(shop) {
  return this.findOne({
    shop,
    accessToken: { $exists: true },
    expires: { $gt: new Date() }
  });
};

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
