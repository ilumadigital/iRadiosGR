const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: { type: String, required: true },
  client: { type: String, required: true },
  audioUrl: { type: String, required: true },
  logoUrl: { type: String },
  linkUrl: { type: String, default: '' },
  frequency: { 
    type: String, 
    required: true, 
    enum: [
      // Zapping (Event-based)
      'entry', 'every_2_stations', 'every_4_stations', 'every_5_stations', 'every_10_stations', 'every_15_stations', 'every_20_stations', 'every_30_stations', 
      // Time-based
      'every_1_hour', 'every_2_hours', 'every_6_hours', 'once_a_day', 'twice_a_day', 'four_times_a_day', 'once_a_week'
    ] 
  },
  dspPreset: { type: String, default: 'OFF' },
  targetCountry: { type: String, default: 'All' },
  targetRegion: { type: String, default: 'All' },

  // 🟢 ΝΕΟ: Στόχευση Περιοχής
  targetLocations: { 
    type: [String], 
    default: ['All'] 
  },
  
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  campaignId: {type: mongoose.Schema.Types.ObjectId, ref: 'AdvertisingCampaign', default: null, index:true},
  // Immutable-style applied-revision marker written atomically WITH the patch;
  // needed to recover a crash before the revision decision is finalized.
  lastApprovedRevisionId: {type: mongoose.Schema.Types.ObjectId, ref: 'AgencyAdRevision', default:null},
  status: { type: String, enum: ['pending', 'active', 'expired', 'rejected'], default: 'active' },
  duration: { type: String, enum: ['day', 'month', 'year'] },
  expiresAt: { type: Date, default: null },
  
  // 🟢 METRICS (Tracking)
  clicks: { type: Number, default: 0 }, 
  plays: { type: Number, default: 0 }, // Προστέθηκαν τα plays
  completions: { type: Number, default: 0 },
  skips: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 }, // Legacy (κρατιέται για συμβατότητα)
  
  createdAt: { type: Date, default: Date.now },
  broadcasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  isGlobal: { type: Boolean, default: true },
  // Isolated staging inventory only; imported production campaigns remain hidden.
  isStageCreative: { type: Boolean, default: false }
},{timestamps:{createdAt:false,updatedAt:true}});

module.exports = mongoose.model('Ad', adSchema);
