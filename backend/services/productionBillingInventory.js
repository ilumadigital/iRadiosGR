'use strict';
// Pure READ-ONLY inventory. No Gateway import, no checkout and no local writes.
// Intentionally unable to call inspectOne(apply=true) or conclude a provider
// charge was absent from a Mongo record alone.
const OPEN = ['creating', 'pending', 'redirect', 'unknown'];
function requireProduction() {
  if (process.env.APP_ENV !== 'production' ||
      process.env.IRADIOS_GATEWAY_ENV !== 'production')
    throw Error('PRODUCTION_INVENTORY_SCOPE_REQUIRED');
}
function classify(row, family, now = new Date()) {
  const lock = family === 'advertising' ? row.activeLockKey : row.lockKey;
  const refs = Boolean(row.gatewayPaymentId || row.gatewayOrderId);
  const events = Boolean((row.eventIds || []).length || (row.eventLog || []).length);
  const paid = row.paidAt != null || row.periodStartsAt != null ||
    row.periodEndsAt != null || row.graceEndsAt != null;
  const age = +now - +new Date(row.createdAt);
  let state = 'REVIEW', reason = 'UNKNOWN_LOCAL_STATE';
  if (family === 'advertising') {
    // AdvertisingPaymentIntent has NO immutable environment column.
    // Never infer production funding safety from a legacy request-key prefix.
    reason = 'ADVERTISING_SCOPE_REQUIRES_SEPARATE_AUDIT';
  } else if (row.environment !== 'production') {
    reason = 'NON_PRODUCTION_ORDER';
  } else if (!lock && !OPEN.includes(row.status)) {
    state = 'CLEAN'; reason = 'TERMINAL_UNLOCKED';
  } else if (events || paid || row.status === 'paid' || row.providerStatus === 'paid') {
    reason = 'PAYMENT_OR_WEBHOOK_EVIDENCE_PRESENT';
  } else if (row.billingOrigin && row.billingOrigin !== 'checkout') {
    reason = 'NOT_A_CHECKOUT';
  } else if (!Number.isFinite(age) || age < 180000) {
    state = 'DEFERRED'; reason = 'RECENT_CHECKOUT';
  } else if (['failed', 'canceled'].includes(row.status) && lock) {
    state = 'CANDIDATE'; reason = 'TERMINAL_LOCK_REQUIRES_RECONCILIATION';
  } else if (OPEN.includes(row.status)) {
    state = 'CANDIDATE'; reason = refs ?
      'PROVIDER_REFERENCES_REQUIRE_SIGNED_CHECK' :
      'GATEWAY_REQUEST_KEY_CHECK_REQUIRED';
  }
  return {family, id: String(row._id), sku: row.sku || 'ADV-BUDGET',
    localStatus: row.status || 'unknown', state, reason, hasProviderReference: refs,
    locked: typeof lock === 'string'};
}
async function inventory({db, limit = 100, now = new Date(), onRow = null} = {}) {
  requireProduction();
  if (!db || typeof db.collection !== 'function' ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 500)
    throw Error('INVALID_PRODUCTION_INVENTORY_OPTIONS');
  const families = [
    {family: 'listener', collection: 'billingorders', lock: 'lockKey'},
    {family: 'broadcaster', collection: 'broadcasterbillingorders', lock: 'lockKey'},
    {family: 'advertising', collection: 'advertisingpaymentintents', lock: 'activeLockKey'}
  ];
  const totals = {environment: 'production', mode: 'READ_ONLY_LOCAL_INVENTORY',
    inspected: 0, candidate: 0, review: 0, deferred: 0, clean: 0};
  for (const entry of families) {
    const filter = {$or: [
      {status: {$in: OPEN}},
      {[entry.lock]: {$type: 'string'}}
    ]};
    if (entry.family !== 'advertising') filter.environment = 'production';
    const projection = {_id: 1, sku: 1, environment: 1, status: 1, providerStatus: 1,
      createdAt: 1, billingOrigin: 1, gatewayPaymentId: 1, gatewayOrderId: 1,
      paidAt: 1, periodStartsAt: 1, periodEndsAt: 1, graceEndsAt: 1,
      eventIds: 1, eventLog: 1, [entry.lock]: 1};
    const rows = await db.collection(entry.collection).find(filter, {projection})
      .sort({createdAt: 1, _id: 1}).limit(limit).toArray();
    for (const row of rows) {
      const outcome = classify(row, entry.family, now);
      totals.inspected++;
      totals[outcome.state.toLowerCase()]++;
      if (onRow) onRow(outcome);
    }
  }
  return totals;
}
module.exports = {requireProduction, classify, inventory};
