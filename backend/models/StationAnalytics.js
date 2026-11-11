const mongoose = require('mongoose');

const stationAnalyticsSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  totalListenTime: { type: Number, default: 0 }, // Σε δευτερόλεπτα
  totalSessions: { type: Number, default: 0 },
  locations: { type: Object, default: {} }, // legacy lifetime-only geo
  // UTC daily counters from Phase D onwards; historical rows are not backfilled.
  daily: { type: Map, of: new mongoose.Schema({
    sessions: { type: Number, default: 0 },
    listenSeconds: { type: Number, default: 0 }
  }, { _id: false }), default: {} }
});

module.exports = mongoose.model('StationAnalytics', stationAnalyticsSchema);
