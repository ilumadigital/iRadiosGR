const mongoose = require('mongoose');

const stationAnalyticsSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  totalListenTime: { type: Number, default: 0 }, // Σε δευτερόλεπτα
  totalSessions: { type: Number, default: 0 },
  locations: { type: Object, default: {} } // π.χ. { "Αθήνα_GR": 150, "Λονδίνο_UK": 20 }
});

module.exports = mongoose.model('StationAnalytics', stationAnalyticsSchema);
