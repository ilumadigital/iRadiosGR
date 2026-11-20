'use strict';
const mongoose = require('mongoose');

// Invitation is deliberately independent of Station.broadcasterId. Receiving an
// email or signing up never grants access before the claim is verified.
const broadcasterInvitationSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ['pending', 'accepted', 'revoked', 'expired'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acceptedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  lastSentAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Only one active link for each unclaimed station; keep prior attempts for audit.
broadcasterInvitationSchema.index(
  { stationId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('BroadcasterInvitation', broadcasterInvitationSchema);
