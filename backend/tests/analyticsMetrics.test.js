'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {projectListening,adTotals,validPeriod}=require('../services/analyticsMetrics');
const {summarizePayments,adDashboardStats}=require('../services/dashboardMetrics');
test('Lifetime analytics aggregate only stored station records',()=>{
 const x=projectListening([
  {totalSessions:2,totalListenTime:180,locations:{Athens_GR:2}},
  {totalSessions:1,totalListenTime:90,locations:{Athens_GR:1,Patras_GR:1}}
 ]);
 assert.equal(x.totalSessions,3);
 assert.equal(x.totalListenTime,270);
 assert.equal(x.avgListenTime,'1m 30s');
 assert.equal(x.topOrigins[0].percentage,75);
 assert.equal(projectListening([]).totalSessions,0);
});
test('UTC periods use observed daily samples, not fabricated older or geo data',()=>{
 const now=new Date('2026-11-11T14:00:00Z');
 const stats=[{totalSessions:100,totalListenTime:100000,locations:{Athens_GR:25},
 daily:new Map([
  ['2026-11-01',{sessions:4,listenSeconds:400}],
  ['2026-11-05',{sessions:2,listenSeconds:100}],
  ['2026-11-11',{sessions:3,listenSeconds:180}]
 ])}];
 const seven=projectListening(stats,'7d',now);
 assert.equal(seven.totalSessions,5);assert.equal(seven.totalListenTime,280);
 assert.deepEqual(seven.topOrigins,[]);
 assert.equal(projectListening(stats,'30d',now).totalSessions,9);
 assert.equal(projectListening(stats,'all',now).totalSessions,100);
 assert.equal(validPeriod('wrong'),'all');
});
test('Audio ads report plays/clicks, not untracked impression claims',()=>{
 const ad=adTotals([
  {title:'One',plays:4,clicks:1,impressions:10000},
  {title:'Two',plays:9,clicks:3}
 ]);
 assert.equal(ad.totalPlays,13);
 assert.equal(ad.totalClicks,4);
 assert.equal(ad.topAd,'Two');
 assert.deepEqual(adDashboardStats(10,3,20,2),{
  audio:{plays:10,clicks:3,ctr:30},
  banner:{views:20,clicks:2,ctr:10}
 });
});
test('Recorded paid orders and legacy transactions dedupe by provider payment',()=>{
 const time='2026-11-11T10:00:00Z';
 const result=summarizePayments([
  {_id:'old',status:'completed',amount:10,currency:'eur',createdAt:'2026-10-01T10:00:00Z',invoiceSent:false},
  {_id:'duplicate',status:'completed',amount:3.99,currency:'EUR',externalPaymentId:'pay-one',createdAt:time},
  {_id:'pending',status:'pending',amount:50,createdAt:time}
 ],[
  {_id:'one',gatewayPaymentId:'pay-one',status:'paid',amountCents:399,currency:'EUR',paidAt:time},
  {_id:'pending-order',status:'redirect',amountCents:9999,paidAt:time}
 ],[
  {_id:'two',gatewayPaymentId:'pay-two',status:'paid',amountCents:699,currency:'EUR',paidAt:time}
 ]);
 assert.equal(result.revenue,20.98);
 assert.equal(result.payments,3);
 assert.equal(result.pendingInvoices,1);
 assert.deepEqual(result.revenueData,[{name:'10/2026',amount:10},
  {name:'11/2026',amount:10.98}]);
 assert.deepEqual(summarizePayments().revenueData,[]);
});
