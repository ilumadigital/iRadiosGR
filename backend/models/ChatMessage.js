const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // Auto-delete in 1 hour
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
