#!/usr/bin/env node
'use strict';
// Production is READ-ONLY by default. --apply requires both the live operator
// confirmation AND a separately approved production write flag.
const {runRepair, guardScope} = require('../services/billingRepair');
function options(argv) {
  const result = {apply: false, confirmLive: false, limit: 100};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (seen.has(token)) throw Error('INVALID_PRODUCTION_REPAIR_ARGUMENTS');
    seen.add(token);
    if (token === '--limit') result.limit = Number(argv[++i]);
    else if (token === '--apply') result.apply = true;
    else if (token === '--confirm-live') result.confirmLive = true;
    else throw Error('INVALID_PRODUCTION_REPAIR_ARGUMENTS');
  }
  if (!Number.isSafeInteger(result.limit) || result.limit < 1 || result.limit > 500)
    throw Error('INVALID_PRODUCTION_REPAIR_LIMIT');
  if (result.confirmLive !== result.apply)
    throw Error('LIVE_REPAIR_CONFIRMATION_REQUIRED');
  return result;
}
async function main() {
  require('dotenv').config();
  const args = options(process.argv.slice(2));
  const environment = require('../services/gatewayEnvironment');
  const gateway = require('../services/ilumaGatewayClient');
  // Validate BEFORE opening Mongo. Gateway configured() selects only the
  // PRODUCTION tenant key/secret and requires cutover approval.
  guardScope(environment, gateway, 'production', args.apply);
  if (!process.env.MONGO_URI) throw Error('PRODUCTION_MONGO_URI_MISSING');
  const mongoose = require('mongoose');
  const models = {
    listener: require('../models/BillingOrder'),
    broadcaster: require('../models/BroadcasterBillingOrder'),
    advertising: require('../models/AdvertisingPaymentIntent'),
    FundingLot: require('../models/AdvertisingFundingLot'),
    Quote: require('../models/AdvertisingQuote')
  };
  try {
    await mongoose.connect(process.env.MONGO_URI, {serverSelectionTimeoutMS: 6000});
    const summary = await runRepair({
      models, gateway, environment, target: 'production',
      apply: args.apply, limit: args.limit,
      onRow: row => console.log(JSON.stringify(row))
    });
    console.log(JSON.stringify({summary}));
    if (summary.errors) process.exitCode = 2;
  } finally {await mongoose.disconnect();}
}
if (require.main === module) main().catch(err => {
  const code = String(err.code || err.message || 'PRODUCTION_REPAIR_STOP');
  console.error('STOP: ' + (/^[A-Z0-9_]{1,80}$/.test(code) ? code : 'PRODUCTION_REPAIR_STOP'));
  process.exitCode = 1;
});
module.exports = {options, main};
