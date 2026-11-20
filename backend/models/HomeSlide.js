'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  subtitle: { type: String, default: '', trim: true, maxlength: 220 },
  eyebrow: { type: String, default: 'ΠΡΟΤΕΙΝΟΥΜΕ', trim: true, maxlength: 60 },
  imageUrl: { type: String, required: true, maxlength: 2048 },
  ctaLabel: { type: String, default: 'Ανακάλυψε', trim: true, maxlength: 48 },
  // Editorial placement is independent of CTA destination. Legacy slides default to Home.
  placement: { type: String, enum: ['home', 'genre', 'region', 'news'], default: 'home', index: true },
  // Multiple destinations per creative. Old placement/value fields remain for legacy documents.
  placements: [{ _id: false, placement: {type:String,enum:['home','genre','region','news'],required:true}, placementValue: {type:String,default:'',maxlength:120} }],
  placementValue: { type: String, default: '', trim: true, maxlength: 120 },
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
schema.index({ placement: 1, placementValue: 1, status: 1, priority: -1, createdAt: -1 });
schema.index({ 'placements.placement':1,'placements.placementValue':1,status:1,priority:-1 });
module.exports = mongoose.model('HomeSlide', schema);
