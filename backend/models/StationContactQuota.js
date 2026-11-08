'use strict';
const mongoose = require('mongoose');
// Atomic daily quotas with automatic expiration; no contact message is stored.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
  lastAttemptAt: Date
}, { timestamps: true });
schema.index({ userId: 1, stationId: 1, day: 1 }, { unique: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });
module.exports = mongoose.model('StationContactQuota', schema);
