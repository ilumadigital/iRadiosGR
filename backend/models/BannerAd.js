const mongoose = require('mongoose');

const bannerAdSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true }, 
  squareImageUrl: { type: String }, 
  targetUrl: { type: String, required: true },
  placement: {
    type: [String],
    enum: ['hero', 'home', 'radio_feed', 'news_feed', 'station_profile'],
    required: true,
    default: 'home'
  },

  // 🟢 ΝΕΟ: Στόχευση Περιοχής
  targetLocations: { 
    type: [String], 
    default: ['All'] 
  },
  
  // 🟢 ΝΕΑ ΠΕΔΙΑ B2B AD NETWORK
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['pending', 'active', 'expired', 'rejected'], default: 'active' }, // Default active για τον Admin, αλλά στα Agencies μπαίνει pending
  duration: { type: String, enum: ['day', 'month', 'year'] },
  expiresAt: { type: Date, default: null },

  isActive: { type: Boolean, default: true }, // Legacy
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  isStageCreative: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BannerAd', bannerAdSchema);
