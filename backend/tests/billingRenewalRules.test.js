'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DAY_MS,paidRenewalState,paidRenewalPeriod}=require('../services/billingRenewalRules');
const {safeOrderStatus,nextMonthlyPeriod}=require('../services/gatewayBillingProtocol');
const periodEnd='2026-12-10T15:14:00.000Z';
const paid={_id:'a'.repeat(24),sku:'L-PREM',status:'paid',
 amountCents:399,currency:'EUR',periodStartsAt:new Date('2026-11-10T15:14:00.000Z'),
 periodEndsAt:new Date(periodEnd),graceEndsAt:new Date(periodEnd)};

test('No paid cycle or more than 24h to end never triggers a popup',()=>{
 assert.equal(paidRenewalState(null),null);
 assert.equal(paidRenewalState({...paid,status:'pending'},new Date(periodEnd)),null);
 assert.equal(paidRenewalState(paid,new Date('2026-12-09T15:13:59.999Z')),null);
});
test('24-hour boundary creates manual renewal notice, not an automatic charge',()=>{
 const now=new Date('2026-12-09T15:14:00Z');
 const n=paidRenewalState(paid,now);
 assert.equal(n.kind,'soon');assert.equal(n.priceCents,399);assert.equal(n.cycleId,paid._id);
 assert.equal(n.periodEndsAt,periodEnd);assert.equal(DAY_MS,86400000);
});
test('Expiry is instantaneous without configured grace',()=>{
 const n=paidRenewalState(paid,new Date(periodEnd));
 assert.equal(n.kind,'expired');
 assert.equal(safeOrderStatus(paid,new Date(periodEnd)).status,'expired');
});
test('Grace retains entitlement until its own deadline but can remind renewal',()=>{
 const item={...paid,graceEndsAt:new Date('2026-12-13T15:14:00Z')};
 const inGrace=new Date('2026-12-11T15:14:00Z');
 assert.equal(paidRenewalState(item,inGrace).kind,'grace');
 assert.equal(safeOrderStatus(item,inGrace).status,'grace');
 assert.equal(paidRenewalState(item,new Date(item.graceEndsAt)).kind,'expired');
});
test('Early paid renewal starts at old expiry and adds a full calendar month',()=>{
 const confirmation=new Date('2026-12-09T16:14:00Z');
 const starts=paidRenewalPeriod(confirmation,periodEnd);
 assert.equal(starts.toISOString(),periodEnd);
 assert.equal(nextMonthlyPeriod(starts).toISOString(),'2027-01-10T15:14:00.000Z');
 assert.equal(paidRenewalPeriod('2026-12-11T12:00:00Z',periodEnd).toISOString(),
  '2026-12-11T12:00:00.000Z','Late renewal begins when actually paid');
});
test('Paid future renewal is scheduled, never a currently active period',()=>{
 const item={...paid,periodStartsAt:new Date('2026-12-10T15:14:00Z'),
  periodEndsAt:new Date('2027-01-10T15:14:00Z'),graceEndsAt:new Date('2027-01-10T15:14:00Z')};
 assert.equal(safeOrderStatus(item,new Date('2026-12-09T16:14:00Z')).status,'scheduled');
 assert.equal(safeOrderStatus(item,new Date('2026-12-10T15:14:00Z')).status,'active');
});
