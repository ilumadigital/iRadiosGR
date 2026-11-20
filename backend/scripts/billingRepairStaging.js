#!/usr/bin/env node
'use strict';
const {runRepair, stagingOnly} = require('../services/stagingBillingRepair');
function options(argv) {
  const result = {apply: false, limit: 100};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--apply' && !result.apply) result.apply = true;
    else if (token === '--limit' && !result.limitSpecified) {
      result.limit = Number(argv[++i]); result.limitSpecified = true;
    } else throw Error('INVALID_BILLING_REPAIR_ARGUMENTS');
  }
  delete result.limitSpecified;
  if (!Number.isSafeInteger(result.limit) || result.limit < 1 || result.limit > 500)
    throw Error('INVALID_BILLING_REPAIR_LIMIT');
  return result;
}
async function main() {
  require('dotenv').config();
  const environment = require('../services/gatewayEnvironment');
  const gateway = require('../services/ilumaGatewayClient');
  stagingOnly(environment, gateway);
  const args = options(process.argv.slice(2));
  if (!process.env.MONGO_URI) throw Error('STAGING_MONGO_URI_MISSING');
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
    const summary = await runRepair({...args, models, gateway, environment,
      onRow: row => console.log(JSON.stringify(row))});
    console.log(JSON.stringify({summary}));
    if (summary.errors) process.exitCode = 2;
  } finally {await mongoose.disconnect();}
}
if (require.main === module) {
  main().catch(err => {
    const code = String(err.code || err.message || 'BILLING_REPAIR_STOP');
    console.error('STOP: ' + (/^[A-Z0-9_]{1,80}$/.test(code) ? code : 'BILLING_REPAIR_STOP'));
    process.exitCode = 1;
  });
}
module.exports = {options, main};
