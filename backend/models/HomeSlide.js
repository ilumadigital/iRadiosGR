'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  subtitle: { type: String, default: '', trim: true, maxlength: 220 },
  eyebrow: { type: String, default: 'ΠΡΟΤΕΙΝΟΥΜΕ', trim: true, maxlength: 60 },
  imageUrl: { type: String, required: true, maxlength: 2048 },
  ctaLabel: { type: String, default: 'Ανακάλυψε', trim: true, maxlength: 48 },
  targetType: { type: String, enum: ['none', 'station', 'genre', 'external'], default: 'none' },
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  genre: { type: String, default: '', maxlength: 100 },
  externalUrl: { type: String, default: '', maxlength: 2048 },
  audience: { type: String, enum: ['all', 'guest', 'member', 'premium'], default: 'all' },
  priority: { type: Number, default: 0, min: 0, max: 1000 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ status: 1, priority: -1, createdAt: -1 });
module.exports = mongoose.model('HomeSlide', schema);
