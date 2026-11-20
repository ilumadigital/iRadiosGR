const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Existing historical MongoDB documents remain intact; new payments use BillingOrder.
  externalPaymentId: { type: String },
  externalOrderId: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'eur' },
  planName: { type: String, required: true }, // π.χ. "Broadcaster Monthly"
  planType: { type: String }, // 'broadcaster', 'agency', 'ad'
  billingInfo: {
    companyName: { type: String },
    vatNumber: { type: String },
    address: { type: String },
    city: { type: String }
  },
  invoiceSent: { type: Boolean, default: false }, // Το check για τον admin
  status: { type: String, default: 'completed' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
