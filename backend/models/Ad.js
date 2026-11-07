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
      'entry', 'every_5_stations', 'every_10_stations', 'every_15_stations', 'every_20_stations', 'every_30_stations', 
      // Time-based
      'every_1_hour', 'every_2_hours', 'every_6_hours', 'once_a_day', 'twice_a_day', 'four_times_a_day', 'once_a_week'
    ] 
  },
  dspPreset: { type: String, default: 'OFF' },

  // 🟢 ΝΕΟ: Στόχευση Περιοχής
  targetLocations: { 
    type: [String], 
    default: ['All'] 
  },
  
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['pending', 'active', 'expired', 'rejected'], default: 'active' },
  duration: { type: String, enum: ['day', 'month', 'year'] },
  expiresAt: { type: Date, default: null },
  
  // 🟢 METRICS (Tracking)
  clicks: { type: Number, default: 0 }, 
  plays: { type: Number, default: 0 }, // Προστέθηκαν τα plays
  impressions: { type: Number, default: 0 }, // Legacy (κρατιέται για συμβατότητα)
  
  createdAt: { type: Date, default: Date.now },
  broadcasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  isGlobal: { type: Boolean, default: true }
});

module.exports = mongoose.model('Ad', adSchema);
