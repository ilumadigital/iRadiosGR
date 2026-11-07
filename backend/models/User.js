const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  fname: { type: String, required: true, default: 'iR' }, 
  lname: { type: String, required: true, default: 'User' },
  birthdate: { type: Date, required: true, default: new Date('2000-01-01') }, 
  phone: { type: String, default: "" },
  
  role: { type: String, enum: ['admin', 'broadcaster', 'user', 'producer', 'agency'], default: 'user' },
  
  assignedStation: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  agencyProfile: {
    businessType: { type: String, enum: ['individual', 'company'], default: 'company' },
    vatNumber: { type: String, default: '' },
    companyName: { type: String, default: '' },
    countryCode: { type: String, default: 'EL' }
  },

  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Station' }],
  isPremium: { type: Boolean, default: false },
  stripeCustomerId: { type: String, default: null },

  // Παλιά πεδία (κρατούνται για ιστορικότητα, πλέον δουλεύουμε με το activeSubscriptions)
  stripeSubscriptionId: { type: String, default: null },
  subscriptionStatus: { type: String, default: null },
  currentPeriodEnd: { type: Date, default: null },

  // 🟢 ΝΕΟ: Array με ΟΛΕΣ τις συνδρομές
  activeSubscriptions: [{
    planId: { type: String },
    stripeSubscriptionId: { type: String },
    status: { type: String, default: 'active' }, // 'active', 'canceled'
    currentPeriodEnd: { type: Date }
  }],
  
  broadcasterProfile: {
    tier: { type: String, enum: ['free', 'premium'], default: 'free' },
    maxStations: { type: Number, default: 3 },
    features: {
      adControl: { type: Boolean, default: false },
      dspEngine: { type: Boolean, default: false },
      betaAccess: { type: Boolean, default: false },
      liveChat: { type: Boolean, default: false },  
      analytics: { type: Boolean, default: false }
    }
  },

  pushNotifications: { type: Boolean, default: true },
  businessType: { type: String, enum: ['individual', 'company'], default: 'individual' },
  vatNumber: { type: String, default: '' },
  companyName: { type: String, default: '' },

  isVerified: { type: Boolean, default: false },
  verificationOtp: { type: String, default: null },
  otpExpires: { type: Date, default: null },

  hasAcceptedTerms: { type: Boolean, default: false },
  termsAcceptedAt: { type: Date, default: null },

  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
