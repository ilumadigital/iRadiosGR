'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {listProducts,getProduct}=require('../config/billingCatalog');
const {validateComplimentaryScope,resolveComplimentaryEntitlements,isActiveGrant,compareBoostPriority}=require('../services/billingPolicy');
test('Final Excel catalog: all 21 fixed SKUs and VAT-inclusive cents',()=>{
 const all=listProducts();assert.equal(all.length,21);
 for(const p of all){assert.equal(p.currency,'EUR');assert.equal(p.vatRate,24);assert.equal(Number.isInteger(p.priceCents),true);assert.equal(p.renewalOperational,false);}
 assert.equal(getProduct('L-PREM').priceCents,399);
 assert.equal(getProduct('B-PREM').priceCents,11900);
 assert.equal(getProduct('AG-NEWS').priceCents,14900);
 assert.equal(getProduct('BOOST-G-YEAR').priceCents,848900);
});
test('Broadcaster add-ons are station-scoped with unconfirmed billing cycle',()=>{
 for(const sku of ['ADD-DSP','ADD-AN','ADD-ADS']) {
  assert.equal(getProduct(sku).scopeType,'station');
  assert.equal(getProduct(sku).cycle,null);
  assert.equal(validateComplimentaryScope(sku,'account',null), 'Λανθασμένο scope για το προϊόν.');
  assert.equal(validateComplimentaryScope(sku,'station','station-1'),null);
 }
});
test('Complimentary grants are not payments and are active only within their date window',()=>{
 const grant={sku:'L-PREM',scopeType:'account',resourceId:null,source:'admin_complimentary',startsAt:'2026-11-10T00:00:00Z',expiresAt:'2026-12-10T00:00:00Z'};
 assert.equal(isActiveGrant(grant,new Date('2026-11-15T00:00:00Z')),true);
 assert.equal(isActiveGrant(grant,new Date('2026-12-10T00:00:00Z')),false);
 assert.deepEqual(resolveComplimentaryEntitlements([grant],{now:new Date('2026-11-15T00:00:00Z')}),['listener.premium']);
 assert.deepEqual(resolveComplimentaryEntitlements([{...grant,revokedAt:'2026-11-13T00:00:00Z'}],{now:new Date('2026-11-15T00:00:00Z')}),[]);
});
test('Station grant never leaks to another station',()=>{
 const g={sku:'ADD-DSP',scopeType:'station',resourceId:'s1',source:'admin_complimentary',startsAt:'2026-11-10T00:00:00Z'};
 assert.deepEqual(resolveComplimentaryEntitlements([g],{stationId:'s1',now:new Date('2026-11-15T00:00:00Z')}),['broadcaster.webdsp']);
 assert.deepEqual(resolveComplimentaryEntitlements([g],{stationId:'s2',now:new Date('2026-11-15T00:00:00Z')}),[]);
 assert.deepEqual(resolveComplimentaryEntitlements([g],{now:new Date('2026-11-15T00:00:00Z')}),[]);
});
test('Broadcaster Premium grants included features and unlimited stations',()=>{
 const g={sku:'B-PREM',scopeType:'account',source:'admin_complimentary',startsAt:'2026-11-10T00:00:00Z'};
 const rights=resolveComplimentaryEntitlements([g],{now:new Date('2026-11-15T00:00:00Z')});
 for(const e of ['broadcaster.unlimited_stations','broadcaster.webdsp','broadcaster.analytics','broadcaster.ad_control','broadcaster.premium_boost'])assert.ok(rights.includes(e));
});
test('A purchased Boost always outranks an included Premium Boost',()=>{
 assert.ok(compareBoostPriority('purchased','premium')<0);
 assert.ok(compareBoostPriority('purchased','organic')<0);
});
test('Only true subscription products can be gifted as subscriptions',()=>{
 assert.notEqual(validateComplimentaryScope('BOOST-G-DAY','station','s1'),null);
 assert.notEqual(validateComplimentaryScope('NOPE','account',null),null);
 assert.equal(validateComplimentaryScope('AG-NEWS','campaign','campaign-1'),null);
});
