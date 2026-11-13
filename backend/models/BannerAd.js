const mongoose = require('mongoose');

const bannerAdSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true }, 
  squareImageUrl: { type: String },
  logoUrl: { type: String, default: '' },
  ctaLabel: { type: String, default: 'Μάθε περισσότερα', maxlength: 45 },
  brandColor: { type: String, default: '#a855f7', match: /^#[0-9A-Fa-f]{6}$/ },
  focalX: { type: Number, min: 0, max: 100, default: 50 },
  focalY: { type: Number, min: 0, max: 100, default: 50 },
  designConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  targetCountry: { type: String, default: 'All' },
  targetRegion: { type: String, default: 'All' }, 
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
  campaignId: {type: mongoose.Schema.Types.ObjectId, ref: 'AdvertisingCampaign', default: null, index:true},
  // Set in the same creative write as its approved Agency revision changes.
  lastApprovedRevisionId: {type: mongoose.Schema.Types.ObjectId, ref: 'AgencyAdRevision', default:null},
  status: { type: String, enum: ['pending', 'active', 'expired', 'rejected'], default: 'active' }, // Default active για τον Admin, αλλά στα Agencies μπαίνει pending
  duration: { type: String, enum: ['day', 'month', 'year'] },
  expiresAt: { type: Date, default: null },

  isActive: { type: Boolean, default: true }, // Legacy
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  isStageCreative: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BannerAd', bannerAdSchema);
