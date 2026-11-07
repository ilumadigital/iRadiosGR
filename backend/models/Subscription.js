const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, unique: true, required: true },
  expirationTime: Number,
  keys: { p256dh: String, auth: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
