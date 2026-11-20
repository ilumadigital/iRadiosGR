const mongoose = require('mongoose');

const EmailHistorySchema = new mongoose.Schema({
  to: { type: String, required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sendType: { type: String, default: 'single' }, // 'single', 'role'
  targetRole: { type: String, default: null }, // π.χ. 'premium_user'
  recipientCount: { type: Number, default: 1 }, // Προαιρετικό, αν επιλέξεις χρήστη
  bcc: { type: String },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, default: 'sent' } // 'sent' ή 'failed'
}, { timestamps: true });

module.exports = mongoose.model('EmailHistory', EmailHistorySchema);
