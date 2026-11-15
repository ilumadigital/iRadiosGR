'use strict';

// Broadcaster prices approved 2026-11-15. All amounts include VAT 24%.
// VAT 24% is INCLUDED in all integer-cent amounts.
// Subscription cycle is monthly; execution/entitlements remain Gateway-controlled.
const rows = [
  ['L-FREE','Listener Free',0,'account','free',null],
  ['L-PREM','Listener Premium',399,'account','subscription','month'],
  ['B-FREE','Broadcaster Free',0,'account','free',null],
  ['B-PREM','Broadcaster Premium',9900,'account','subscription','month'],
  ['ADD-DSP','WebDSP Audio Engine',2790,'station','subscription','month'],
  ['ADD-AN','Audience Radar',690,'station','subscription','month'],
  ['ADD-ADS','iRadios Ad Control',890,'station','subscription','month'],
  ['BOOST-T-DAY','Station Boost — Category / Region',490,'station','boost','day'],
  ['BOOST-T-WEEK','Station Boost — Category / Region',2990,'station','boost','week'],
  ['BOOST-T-2W','Station Boost — Category / Region',5490,'station','boost','two_weeks'],
  ['BOOST-T-MONTH','Station Boost — Category / Region',9900,'station','boost','month'],
  ['BOOST-T-YEAR','Station Boost — Category / Region',89000,'station','boost','year'],
  ['BOOST-G-DAY','Station Boost — Global',2900,'station','boost','day'],
  ['BOOST-G-WEEK','Station Boost — Global',17900,'station','boost','week'],
  ['BOOST-G-2W','Station Boost — Global',34900,'station','boost','two_weeks'],
  ['BOOST-G-MONTH','Station Boost — Global',79900,'station','boost','month'],
  ['BOOST-G-YEAR','Station Boost — Global',848900,'station','boost','year'],
  ['AG-AUDIO','Agency Audio Ad',7900,'campaign','subscription','month'],
  ['AG-RADIO','Agency Radio Grid',2900,'campaign','subscription','month'],
  ['AG-HERO','Agency Home Page Hero',28900,'campaign','subscription','month'],
  ['AG-NEWS','Agency News Grid',14900,'campaign','subscription','month']
];

const PRODUCTS = Object.freeze(Object.fromEntries(rows.map(([sku,title,priceCents,scopeType,kind,cycle]) =>
  [sku,Object.freeze({
    sku,title,priceCents,currency:'EUR',vatRate:24,scopeType,kind,cycle,
    recurringRequested:kind==='subscription',
    renewalOperational:false,
    complimentaryEligible:kind==='subscription'
  })]
)));
const getProduct = sku => PRODUCTS[sku] || null;
const listProducts = () => Object.values(PRODUCTS);
module.exports = { PRODUCTS,getProduct,listProducts };
