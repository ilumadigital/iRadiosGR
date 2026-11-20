'use strict';
// This scheduler NEVER starts merely because APP_ENV=production.
// Two distinct, explicit environment gates are required.
const {runRepair, guardScope} = require('../services/billingRepair');
let started = false, running = false, cursors = {};
function enabled() {
  return process.env.APP_ENV === 'production' &&
    process.env.IRADIOS_GATEWAY_ENV === 'production' &&
    process.env.IRADIOS_PRODUCTION_CUTOVER_APPROVED === '1' &&
    process.env.IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED === '1' &&
    process.env.IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED === '1';
}
async function runOnce() {
  if (!enabled() || running) return null;
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return null;
  const gateway = require('../services/ilumaGatewayClient');
  const environment = require('../services/gatewayEnvironment');
  guardScope(environment, gateway, 'production', true);
  running = true;
  try {
    const models = {
      listener: require('../models/BillingOrder'),
      broadcaster: require('../models/BroadcasterBillingOrder'),
      advertising: require('../models/AdvertisingPaymentIntent'),
      FundingLot: require('../models/AdvertisingFundingLot'),
      Quote: require('../models/AdvertisingQuote')
    };
    const summary = await runRepair({
      models, gateway, environment, target: 'production',
      apply: true, limit: 25, after: cursors,
      onRow: row => {
        if (['REPAIRED', 'REVIEW', 'ERROR'].includes(row.state))
          console.log('[PRODUCTION BILLING REPAIR]', JSON.stringify(row));
      }
    });
    cursors = summary.cursors;
    return summary;
  } finally {running = false;}
}
function start() {
  if (started || !enabled()) return false;
  const gateway = require('../services/ilumaGatewayClient');
  const environment = require('../services/gatewayEnvironment');
  guardScope(environment, gateway, 'production', true);
  started = true;
  require('node-cron').schedule('*/3 * * * *', () => runOnce().catch(err =>
    console.warn('[PRODUCTION BILLING REPAIR] scan deferred',
      /^[A-Z0-9_]{1,80}$/.test(err.message || '') ? err.message : 'UNAVAILABLE')));
  return true;
}
module.exports = {start, runOnce, enabled};
