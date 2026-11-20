#!/usr/bin/env node
'use strict';
// Inert before an explicit operator-only invocation in the production iRadios
// container. No Gateway / Nexi credentials are needed, no provider calls made.
const {requireProduction, inventory} =
  require('../services/productionBillingInventory');
function options(argv) {
  const result = {limit: 100, confirm: false};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (seen.has(flag)) throw Error('INVALID_PRODUCTION_INVENTORY_ARGUMENTS');
    seen.add(flag);
    if (flag === '--limit') result.limit = Number(argv[++i]);
    else if (flag === '--confirm-readonly-audit') result.confirm = true;
    else throw Error('INVALID_PRODUCTION_INVENTORY_ARGUMENTS');
  }
  if (!result.confirm) throw Error('PRODUCTION_READONLY_AUDIT_CONFIRMATION_REQUIRED');
  if (!Number.isSafeInteger(result.limit) || result.limit < 1 || result.limit > 500)
    throw Error('INVALID_PRODUCTION_INVENTORY_LIMIT');
  return result;
}
async function main() {
  require('dotenv').config();
  const args = options(process.argv.slice(2));
  requireProduction(); // fail BEFORE connecting to DB, even in local-only mode
  if (!process.env.MONGO_URI) throw Error('PRODUCTION_MONGO_URI_MISSING');
  const mongoose = require('mongoose');
  // Never register Mongoose models. Native collection reads do not create
  // indexes or run schema hooks, and no write API exists in this script.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  try {
    await mongoose.connect(process.env.MONGO_URI, {serverSelectionTimeoutMS: 6000});
    const summary = await inventory({
      db: mongoose.connection.db, limit: args.limit,
      onRow: row => console.log(JSON.stringify(row))
    });
    console.log(JSON.stringify({summary}));
  } finally {await mongoose.disconnect();}
}
if (require.main === module) main().catch(err => {
  const code = String(err.code || err.message || 'PRODUCTION_INVENTORY_STOP');
  console.error('STOP: ' + (/^[A-Z0-9_]{1,80}$/.test(code) ? code : 'PRODUCTION_INVENTORY_STOP'));
  process.exitCode = 1;
});
module.exports = {options, main};
