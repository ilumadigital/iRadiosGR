#!/usr/bin/env node
'use strict';
// READ-ONLY. Reports aggregated legacy staging/production lock collisions.
// Does not import Gateway clients, make provider calls, create indexes,
// update orders, alter entitlements, delete imported rows, or expose tokens.
const mongoose=require('mongoose');
const {lockScope}=require('../services/broadcasterCheckoutLockScope');
const LIMIT=10000;
function summarize(rows){
 const result={total:rows.length,byEnvironmentStatus:{},
  locked:{staging:0,production:0,other:0},
  lockFormat:{legacy:0,scoped:0,other:0},
  crossEnvironmentSameLogicalLock:0,
  productionSameLogicalLock:0,
  unknownWithProviderReferences:0,
  unknownWithoutProviderReferences:0,
  invalidScope:0};
 const seen=new Map();
 for(const row of rows){
  const env=['staging','production'].includes(row.environment)?row.environment:'other';
  const group=env+'/'+String(row.status||'missing');
  result.byEnvironmentStatus[group]=(result.byEnvironmentStatus[group]||0)+1;
  if(row.status==='unknown') {
   if(row.gatewayPaymentId||row.gatewayOrderId)result.unknownWithProviderReferences++;
   else result.unknownWithoutProviderReferences++;
  }
  if(typeof row.lockKey!=='string')continue;
  result.locked[env]++;
  const logical=String(row.accountId||'')+':'+String(row.sku||'')+':'+
    String(row.scopeType==='account'?'account':row.resourceId||'');
  let normalized;
  try{
   normalized=lockScope({environment:row.environment,accountId:row.accountId,
     sku:row.sku,scopeId:row.scopeType==='account'?'account':row.resourceId});
   const format=row.lockKey===normalized.legacy?'legacy':
     row.lockKey===normalized.scoped?'scoped':'other';
   result.lockFormat[format]++;
   if(format==='other'){result.invalidScope++;continue;}
  }catch{
   result.invalidScope++;result.lockFormat.other++;continue;
  }
  const previous=seen.get(logical)||new Map();
  previous.set(env,(previous.get(env)||0)+1);
  seen.set(logical,previous);
 }
 for(const map of seen.values()){
  if(map.has('staging')&&map.has('production'))result.crossEnvironmentSameLogicalLock++;
  if((map.get('production')||0)>1)result.productionSameLogicalLock++;
 }
 return result;
}
async function main(){
 require('dotenv').config();
 if(!['staging','production'].includes(process.env.APP_ENV)||
    process.env.IRADIOS_GATEWAY_ENV!==process.env.APP_ENV)
  throw Error('AUDIT_ENVIRONMENT_GUARD');
 if(!process.env.MONGO_URI)throw Error('MONGO_URI_MISSING');
 mongoose.set('autoIndex',false);
 mongoose.set('autoCreate',false);
 try{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:6000});
  const db=mongoose.connection.db;
  const col=db.collection('broadcasterbillingorders');
  const count=await col.countDocuments({});
  if(count>LIMIT)throw Error('AUDIT_EXCEEDS_MAX_ROWS');
  const rows=await col.find({},{
   projection:{_id:0,accountId:1,resourceId:1,scopeType:1,sku:1,
    environment:1,status:1,lockKey:1,gatewayPaymentId:1,gatewayOrderId:1}
  }).limit(LIMIT+1).toArray();
  if(rows.length!==count)throw Error('AUDIT_DATA_CHANGED_RETRY');
  console.log(JSON.stringify({database:db.databaseName,mode:'READ_ONLY',
   ...summarize(rows)}));
 }finally{await mongoose.disconnect();}
}
if(require.main===module)main().catch(e=>{
 const code=String(e.code||e.message||'AUDIT_UNAVAILABLE');
 console.error('STOP: '+(/^[A-Z0-9_]{1,80}$/.test(code)?code:'AUDIT_UNAVAILABLE'));
 process.exitCode=1;
});
module.exports={summarize,main};
