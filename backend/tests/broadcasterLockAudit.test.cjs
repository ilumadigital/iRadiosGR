'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {summarize}=require('../scripts/auditBroadcasterLockIsolation');
const account='507f1f77bcf86cd799439011';
const ref='iradios-bstage-'+account+'-00000000-0000-4000-8000-000000000001';
const legacy=account+':B-PREM:account';
function row(patch={}){return {accountId:account,scopeType:'account',sku:'B-PREM',
  environment:'staging',status:'unknown',lockKey:legacy,
  gatewayPaymentId:'b'.repeat(32),gatewayOrderId:'IL'+'A'.repeat(24),
  requestKey:ref,...patch};}
test('read-only inventory flags mixed stage/live locks without emitting private values',()=>{
 const rows=[
  row(),
  row({status:'unknown'}),
  row({status:'canceled',lockKey:undefined}),
  row({status:'paid',lockKey:undefined}),
  row({environment:'production',status:'canceled',lockKey:'production:'+legacy})
 ];
 const report=summarize(rows);
 assert.equal(report.total,5);
 assert.equal(report.byEnvironmentStatus['staging/unknown'],2);
 assert.equal(report.byEnvironmentStatus['production/canceled'],1);
 assert.equal(report.locked.staging,2);
 assert.equal(report.locked.production,1);
 assert.equal(report.lockFormat.legacy,2);
 assert.equal(report.lockFormat.scoped,1);
 assert.equal(report.crossEnvironmentSameLogicalLock,1);
 assert.equal(report.productionSameLogicalLock,0);
 assert.equal(report.unknownWithProviderReferences,2);
 assert.equal(JSON.stringify(report).includes(account),false);
 assert.equal(JSON.stringify(report).includes(ref),false);
});
test('audit flags corrupted same-environment duplicate logical locks for manual review',()=>{
 const report=summarize([
  row({environment:'production',lockKey:legacy}),
  row({environment:'production',lockKey:'production:'+legacy})
 ]);
 assert.equal(report.productionSameLogicalLock,1);
 assert.equal(report.crossEnvironmentSameLogicalLock,0);
});
test('invalid or foreign lock formats cannot count as safe scoped locks',()=>{
 const report=summarize([
  row({environment:'production',lockKey:'staging:'+legacy}),
  row({environment:'bad',lockKey:legacy}),
  row({environment:'production',lockKey:'production:'+account+':B-PREM:bad'})
 ]);
 assert.equal(report.invalidScope,3);
 assert.equal(report.lockFormat.other,3);
});
test('audit script cannot call provider endpoints, mutate orders or create indexes',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../scripts/auditBroadcasterLockIsolation.js'),'utf8');
 assert.ok(code.includes("mode:'READ_ONLY'"));
 assert.ok(code.includes("if(count>LIMIT)"));
 assert.ok(code.includes("mongoose.set('autoIndex',false)"));
 assert.ok(!code.includes('updateOne('));
 assert.ok(!code.includes('deleteOne('));
 assert.ok(!code.includes('insertOne('));
 assert.ok(!code.includes('createIndexes('));
 assert.ok(!code.includes('gatewayCheckout'));
 assert.ok(!code.includes('broadcasterCheckout('));
});
