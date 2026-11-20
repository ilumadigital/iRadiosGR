'use strict';
// Staging-only. Signed Gateway GETs never initiate a charge, cancel a contract,
// grant an entitlement, or prove absence from Nexi when a Gateway ID exists.
const OPEN = Object.freeze(['creating', 'pending', 'redirect', 'unknown']);
const TERMINAL = Object.freeze(['paid', 'failed', 'canceled']);
const MIN_AGE_MS = 180000;
const ID = /^[a-f0-9]{32}$/i;
const ORDER = /^IL[A-F0-9]{24}$/;
const BKEY = /^iradios-bstage-[a-f0-9]{24}-[a-f0-9-]{36}$/i;
const LKEY = /^iradios-stage-[a-f0-9]{24}-[a-f0-9-]{36}$/i;

function stagingOnly(environment, gateway) {
  if (process.env.APP_ENV !== 'staging' ||
      process.env.IRADIOS_GATEWAY_ENV !== 'staging' ||
      environment.mode() !== 'staging' || !environment.configured() ||
      !gateway.configured()) throw Error('STAGING_BILLING_REPAIR_GUARD');
}
function hasEvents(row) { return (row.eventIds || []).length > 0 || (row.eventLog || []).length > 0; }
function financialEvidence(row) {
  return row.paidAt != null || row.periodStartsAt != null ||
    row.periodEndsAt != null || row.graceEndsAt != null;
}
function lockField(family) { return family === 'advertising' ? 'activeLockKey' : 'lockKey'; }
function safeRef(row) { return String(row._id); }
function filterFor(row, family) {
  const field = lockField(family);
  const filter = { _id: row._id, status: row.status, requestKey: row.requestKey };
  if (family !== 'advertising') filter.environment = 'staging';
  if (row.updatedAt) filter.updatedAt = row.updatedAt;
  filter[field] = row[field] == null ? null : row[field];
  return filter;
}
function validScope(row, family) {
  const key = family === 'broadcaster' ? BKEY : LKEY;
  if (!key.test(row.requestKey || '') || !OPEN.includes(row.status) && !TERMINAL.includes(row.status)) return false;
  if (family !== 'advertising' && row.environment !== 'staging') return false;
  if (row.gatewayPaymentId != null && !ID.test(row.gatewayPaymentId)) return false;
  if (row.gatewayOrderId != null && !ORDER.test(row.gatewayOrderId)) return false;
  if (family === 'advertising') return row.amountCents >= 100 && Number.isSafeInteger(row.amountCents) &&
      row.currency === 'EUR' && row.quoteId != null && row.campaignId != null;
  return row.currency === 'EUR' && Number.isSafeInteger(row.amountCents) &&
    (family === 'listener' ? [199, 399].includes(row.amountCents) : row.amountCents > 0) &&
    row.billingOrigin === 'checkout';
}
function result(family, row, state, reason, applied = false) {
  return { family, id: safeRef(row), sku: row.sku || 'ADV-BUDGET', state, reason, applied };
}
function missingGateway(error) { return error && error.code === 'GATEWAY_HTTP_404'; }
async function providerByKey(row, family, gateway) {
  if (family === 'broadcaster') return gateway.broadcasterPaymentByRequestKey(row.requestKey, row.sku);
  if (family === 'listener') return gateway.paymentByRequestKey(row.requestKey, row.amountCents);
  return gateway.advertisingPaymentByRequestKey(row.requestKey, row.amountCents);
}
async function existingFundingLot(row, FundingLot) {
  if (!FundingLot) throw Error('FUNDING_AUDIT_UNAVAILABLE');
  return Boolean(await FundingLot.exists({$or: [
    {quoteId: row.quoteId}, ...(row.gatewayPaymentId ? [{gatewayPaymentId: row.gatewayPaymentId}] : [])
  ]}));
}
async function maybeCancelQuote(row, Quote) {
  if (!Quote) throw Error('QUOTE_AUDIT_UNAVAILABLE');
  // Mark consumed quote unusable, but never alter a paid quote or refund money.
  await Quote.updateOne({_id: row.quoteId, agencyId: row.agencyId,
    campaignId: row.campaignId, status: {$in: ['quoted', 'checkout']}},
    {$set: {status: 'canceled'}});
}
/** Repair exactly one row; all mutations are conditional compare-and-set. */
async function inspectOne(family, row, {models, gateway, environment, apply = false,
  now = new Date(), minAgeMs = MIN_AGE_MS} = {}) {
  stagingOnly(environment, gateway);
  if (!['listener', 'broadcaster', 'advertising'].includes(family)) throw Error('UNKNOWN_BILLING_FAMILY');
  if (!validScope(row, family)) return result(family, row, 'REVIEW', 'INVALID_SCOPE_OR_REFERENCES');
  const Model = models[family], lock = lockField(family), locked = typeof row[lock] === 'string';
  const isOpen = OPEN.includes(row.status);
  if (!isOpen) {
    if (!locked) return result(family, row, 'CLEAN', 'TERMINAL_WITHOUT_LOCK');
    if (family === 'advertising' && row.status === 'paid')
      return result(family, row, 'REVIEW', 'PAID_ADVERTISING_FUNDING_AUDIT_REQUIRED');
    if (row.status !== 'paid' && financialEvidence(row))
      return result(family, row, 'REVIEW', 'TERMINAL_HAS_FINANCIAL_EVIDENCE');
    if (family === 'advertising' && await existingFundingLot(row, models.FundingLot))
      return result(family, row, 'REVIEW', 'FUNDING_LOT_EXISTS');
    if (!apply) return result(family, row, 'READY', 'TERMINAL_LOCK_LEFTOVER');
    const changed = await Model.updateOne(filterFor(row, family), {$unset: {[lock]: ''}});
    if (changed.modifiedCount !== 1) return result(family, row, 'DEFERRED', 'CONCURRENT_CHANGE');
    if (family === 'advertising') await maybeCancelQuote(row, models.Quote);
    return result(family, row, 'REPAIRED', 'TERMINAL_LOCK_LEFTOVER', true);
  }
  const age = +now - +new Date(row.createdAt);
  if (!Number.isFinite(age) || age < minAgeMs) return result(family, row, 'DEFERRED', 'CHECKOUT_STILL_RECENT');
  // Never allow another HPP if an original checkout has any paid evidence.
  if (financialEvidence(row) || hasEvents(row) || row.providerStatus === 'paid')
    return result(family, row, 'REVIEW', 'PAYMENT_EVIDENCE_OR_EVENT_PRESENT');
  if (row.billingOrigin === 'automatic_renewal')
    return result(family, row, 'REVIEW', 'AUTOMATIC_RENEWAL_NOT_CHECKOUT');
  if (family === 'advertising' && await existingFundingLot(row, models.FundingLot))
    return result(family, row, 'REVIEW', 'FUNDING_LOT_EXISTS');
  let provider;
  try { provider = await providerByKey(row, family, gateway); }
  catch (error) {
    if (!missingGateway(error)) return result(family, row, 'DEFERRED', 'GATEWAY_LOOKUP_UNAVAILABLE');
    // A missing Gateway row is conclusive ONLY if no Gateway/Nexi references
    // were ever returned. A stored order ID + 404 requires provider review.
    if (row.gatewayPaymentId || row.gatewayOrderId)
      return result(family, row, 'REVIEW', 'GATEWAY_MISSING_WITH_STORED_PROVIDER_REFERENCE');
    if (!apply) return result(family, row, 'READY', 'UNCREATED_GATEWAY_PAYMENT_CONFIRMED');
    const filter = {...filterFor(row, family), paidAt: null,
      gatewayPaymentId: null, gatewayOrderId: null, 'eventIds.0': {$exists: false}};
    if (family !== 'advertising') filter['eventLog.0'] = {$exists: false};
    const change = {$set: {status: 'failed', ...(family === 'advertising'
      ? {lastError: 'STAGING_GATEWAY_ORDER_NOT_CREATED'}
      : {lastErrorCode: 'STAGING_GATEWAY_ORDER_NOT_CREATED'})},
      $unset: {[lock]: ''}};
    const updated = await Model.updateOne(filter, change);
    if (updated.modifiedCount !== 1) return result(family, row, 'DEFERRED', 'CONCURRENT_CHANGE');
    if (family === 'advertising') await maybeCancelQuote(row, models.Quote);
    return result(family, row, 'REPAIRED', 'UNCREATED_GATEWAY_PAYMENT_CONFIRMED', true);
  }
  if (!provider || !ID.test(provider.payment_id || '') || !ORDER.test(provider.order_id || '') ||
      (row.gatewayPaymentId && row.gatewayPaymentId !== provider.payment_id) ||
      (row.gatewayOrderId && row.gatewayOrderId !== provider.order_id))
    return result(family, row, 'REVIEW', 'GATEWAY_REFERENCE_MISMATCH');
  if (!['paid', 'failed', 'canceled', 'creating', 'pending', 'redirect', 'unknown'].includes(provider.status))
    return result(family, row, 'REVIEW', 'UNEXPECTED_GATEWAY_STATUS');
  if (provider.status === 'paid') return result(family, row, 'REVIEW', 'PAID_WEBHOOK_RECONCILIATION_REQUIRED');
  if (!['failed', 'canceled'].includes(provider.status))
    return result(family, row, 'DEFERRED', 'GATEWAY_PAYMENT_NOT_TERMINAL');
  if (!apply) return result(family, row, 'READY', 'GATEWAY_TERMINAL_' + provider.status.toUpperCase());
  const filter = {...filterFor(row, family), paidAt: null, 'eventIds.0': {$exists: false}};
  if (family !== 'advertising') filter['eventLog.0'] = {$exists: false};
  const change = {$set: {status: provider.status,
    gatewayPaymentId: provider.payment_id, gatewayOrderId: provider.order_id,
    ...(family === 'advertising' ? {lastError: 'STAGING_GATEWAY_TERMINAL_CONFIRMED'} :
      {providerStatus: provider.status, lastErrorCode: 'STAGING_GATEWAY_TERMINAL_CONFIRMED'})},
    $unset: {[lock]: ''}};
  const updated = await Model.updateOne(filter, change);
  if (updated.modifiedCount !== 1) return result(family, row, 'DEFERRED', 'CONCURRENT_CHANGE');
  if (family === 'advertising') await maybeCancelQuote(row, models.Quote);
  return result(family, row, 'REPAIRED', 'GATEWAY_TERMINAL_' + provider.status.toUpperCase(), true);
}
async function runRepair({models, gateway, environment, apply = false, limit = 100,
  minAgeMs = MIN_AGE_MS, now = new Date(), onRow = null, after = {}} = {}) {
  stagingOnly(environment, gateway); // Fail before opening a Mongo cursor.
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 ||
      !Number.isInteger(minAgeMs) || minAgeMs < MIN_AGE_MS || minAgeMs > 86400000)
    throw Error('INVALID_BILLING_REPAIR_OPTIONS');
  const summary = {environment: 'staging', mode: apply ? 'APPLY' : 'DRY_RUN',
    inspected: 0, ready: 0, repaired: 0, review: 0, deferred: 0, clean: 0, errors: 0, cursors: {}};
  for (const family of ['listener', 'broadcaster', 'advertising']) {
    const field = lockField(family);
    const query = family === 'advertising'
      ? {requestKey: /^iradios-stage-/, $or: [{status: {$in: OPEN}}, {[field]: {$exists: true}}]}
      : {environment: 'staging', $or: [{status: {$in: OPEN}}, {[field]: {$exists: true}}]};
    // Cursor rotation prevents old REVIEW cases from starving later records.
    const cursor = after[family];
    if (cursor && Number.isFinite(Date.parse(cursor.createdAt)) && /^[a-f0-9]{24}$/i.test(cursor.id || '')) {
      const date = new Date(cursor.createdAt);
      query.$and = [{$or: [{createdAt: {$gt: date}},
        {createdAt: date, _id: {$gt: cursor.id}}]}];
    }
    // Bounded batch; do not log account, email, payment tokens or request keys.
    const rows = await models[family].find(query).sort({createdAt: 1, _id: 1}).limit(limit).lean();
    const last = rows[rows.length - 1];
    summary.cursors[family] = last && Number.isFinite(+new Date(last.createdAt)) ?
      {createdAt: new Date(last.createdAt).toISOString(), id: String(last._id)} : null;
    for (const row of rows) {
      let outcome;
      try {outcome = await inspectOne(family, row, {models, gateway, environment, apply, now, minAgeMs});}
      catch {outcome = result(family, row, 'ERROR', 'SAFE_REPAIR_DEFERRED');}
      summary.inspected++;
      const counter = {READY: 'ready', REPAIRED: 'repaired', REVIEW: 'review',
        DEFERRED: 'deferred', CLEAN: 'clean', ERROR: 'errors'}[outcome.state];
      if (counter) summary[counter]++;
      if (onRow) onRow(outcome);
    }
  }
  return summary;
}
module.exports = {OPEN, MIN_AGE_MS, inspectOne, runRepair, stagingOnly};
