'use strict';
// Offline contract tests: no payments, tokens, credentials, network or database.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const p=require('../services/advertisingV2Policy');

test('a historical CPM-funded balance cannot silently fund v2 event rates',()=>{
 const snapshot={audio:JSON.parse(JSON.stringify(p.AUDIO_RATE_CARD)),
  visual:JSON.parse(JSON.stringify(p.VISUAL_IMPRESSION_NANOS))};
 assert.equal(p.matchesRateCardSnapshot(snapshot),true);
 assert.equal(p.matchesRateCardSnapshot(null),false);
 assert.equal(p.matchesRateCardSnapshot({audio:snapshot.audio}),false);
 snapshot.audio.entry.listen10++;
 assert.equal(p.matchesRateCardSnapshot(snapshot),false);
 const eligibility=read('services/advertisingDeliveryEligibility.js');
 assert.match(eligibility,/matchesRateCardSnapshot\(lot\.rateCardSnapshot\)/);
 assert.match(eligibility,/settlementMode:'mongo_transaction_v2'/);
 const ledger=read('services/advertisingV2Ledger.js');
 assert.match(ledger,/matchesRateCardSnapshot\(l\.rateCardSnapshot\)/);
 assert.match(ledger,/source:'nexi_verified',settlementMode:'mongo_transaction_v2'/);
});

test('a paid ticket requires verified geo and a transaction-ready Mongo primary',()=>{
 const router=read('routes/advertisingV2Routes.js');
 const ledger=read('services/advertisingV2Ledger.js');
 const geo=read('utils/trustedAdGeo.js');
 assert.match(router,/if\(req\.adGeoTrusted!==true\)return res\.status\(503\)/);
 assert.match(router,/if\(!readiness\.acceptingTickets\)return res\.status\(503\)/);
 assert.match(geo,/authorizedToken\(secret,headers\?\.\['x-iradios-geo-auth'\]\)/);
 assert.match(ledger,/hello\.setName&&hello\.isWritablePrimary===true/);
 assert.match(ledger,/logicalSessionTimeoutMinutes/);
 assert.match(ledger,/await requireTransactions\(\);\s*await indexes\(\);/);
 assert.match(ledger,/async function withTicket\(value,key,action\)\{\s*await requireTransactions\(\);/);
 assert.match(router,/mongoReplicaSetReady:readiness\.mongoReplicaSetReady/);
 assert.match(router,/trustedGeoReady:req\.adGeoTrusted===true/);
});

test('paid campaign inventory is never offered as a free, unticketed spot',()=>{
 const ad=read('controllers/adController.js');
 assert.match(ad,/const paidReady=paidLedger\.enabled\(\)\?/);
 assert.match(ad,/req\.adGeoTrusted===true/);
 assert.match(ad,/const deliverable=paidLedger\.enabled\(\)\?/);
 assert.match(ad,/playable\.filter\(ad=>!paidCampaigns\.has\(String\(ad\.campaignId\)\)\|\|paidReady\)/);
 assert.match(ad,/paidDeliveryRequired:paidLedger\.enabled\(\)&&paidCampaigns\.has/);
 const app=fs.readFileSync(path.join(__dirname,'../../frontend/src/App.jsx'),'utf8');
 assert.match(app,/if\(nextAd\.paidDeliveryRequired\)\{/);
 assert.match(app,/fetch\('\/api\/advertising\/v2\/tickets'/);
 assert.match(app,/if\(!result\?\.capability\)/);
 assert.match(app,/fetch\('\/api\/advertising\/v2\/heartbeat'/);
});

test('staging Mongo replica-set migration requires approval, authentication and no implicit activation',()=>{
 const compose=read('../compose.stage.replicaset.yml');
 const deploy=read('../ops/deploy-stage.sh');
 const migration=read('../ops/enable-stage-mongo-replicaset.sh');
 assert.match(compose,/--replSet/);
 assert.match(compose,/--keyFile/);
 assert.match(compose,/replicaSet=rs0/);
 assert.match(deploy,/STAGE_MONGO_RS_ENABLED=1/);
 assert.match(deploy,/ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1/);
 assert.match(migration,/I_VERIFIED_STAGING_BACKUP/);
 assert.match(migration,/ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1/);
 assert.match(migration,/rs\.initiate/);
 assert.doesNotMatch(migration,/docker\s+volume\s+rm|dropDatabase\(|rm -rf/);
});

test('Agency dashboard distinguishes non-billable preview from verified event ledger',()=>{
 const route=read('routes/advertisingV2Routes.js');
 const panel=fs.readFileSync(path.join(__dirname,'../../frontend/src/components/AdvertisingV2CampaignStats.jsx'),'utf8');
 assert.match(route,/compatibleFunding:eligibleLotCount>0/);
 assert.match(route,/payable:readiness\.acceptingTickets&&req\.adGeoTrusted===true/);
 assert.match(panel,/Το real-time billing είναι απενεργοποιημένο/);
 assert.match(panel,/Το εμφανιζόμενο προπληρωμένο ποσό/);
 assert.match(panel,/setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'\)void load\(\);\},5000\)/);
});
