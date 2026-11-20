'use strict';
const cron = require('node-cron');
const mongoose = require('mongoose');
const {runRepair, stagingOnly} = require('../services/stagingBillingRepair');
let started = false, running = false;
async function runOnce() {
  if (running || mongoose.connection.readyState !== 1) return null;
  const gateway = require('../services/ilumaGatewayClient');
  const environment = require('../services/gatewayEnvironment');
  stagingOnly(environment, gateway);
  running = true;
  try {
    const models = {
      listener: require('../models/BillingOrder'),
      broadcaster: require('../models/BroadcasterBillingOrder'),
      advertising: require('../models/AdvertisingPaymentIntent'),
      FundingLot: require('../models/AdvertisingFundingLot'),
      Quote: require('../models/AdvertisingQuote')
    };
    return await runRepair({models, gateway, environment, apply: true, limit: 25,
      onRow: result => {
        if (['REPAIRED', 'REVIEW', 'ERROR'].includes(result.state))
          console.log('[STAGING BILLING REPAIR]', JSON.stringify(result));
      }});
  } finally { running = false; }
}
function start() {
  // Do NOT register a cron on a non-staging process.
  if (started || process.env.APP_ENV !== 'staging' ||
      process.env.IRADIOS_GATEWAY_ENV !== 'staging') return;
  started = true;
  cron.schedule('*/3 * * * *', () => runOnce().catch(error =>
    console.warn('[STAGING BILLING REPAIR] scan deferred',
      /^[A-Z0-9_]{1,80}$/.test(error.message || '') ? error.message : 'UNAVAILABLE')));
}
module.exports = {start, runOnce};
