#!/usr/bin/env node
'use strict';
// Operator-only command; dry-run by default. Never call Nexi or any checkout POST.
require('dotenv').config();
const mongoose=require('mongoose');
const {reviewOrphan}=require('../services/stagingBroadcasterOrphanRecovery');

function options(argv){
 const accepted=new Set(['--order-id','--gateway-order-id','--sandbox-404-for',
  '--confirm-staging-origin','--apply']);
 const out={};
 for(let i=0;i<argv.length;i++){
  const key=argv[i];
  if(!accepted.has(key)||Object.hasOwn(out,key))throw Error('INVALID_OPTIONS');
  if(key==='--apply'||key==='--confirm-staging-origin')out[key]=true;
  else {
   const value=argv[++i];
   if(!value||value.startsWith('--'))throw Error('MISSING_OPTION_VALUE');
   out[key]=value;
  }
 }
 return out;
}
async function main(){
 // Fail closed before opening any connection or importing the billing model.
 if(process.env.APP_ENV!=='staging'||process.env.IRADIOS_GATEWAY_ENV!=='staging')
  throw Error('STAGING_ENVIRONMENT_NOT_VERIFIED');
 const parsed=options(process.argv.slice(2));
 if(!process.env.MONGO_URI)throw Error('STAGING_MONGO_URI_MISSING');
 const environment=require('../services/gatewayEnvironment');
 if(environment.mode()!=='staging'||!environment.configured())
  throw Error('STAGING_GATEWAY_CREDENTIALS_NOT_VERIFIED');
 const input={
  orderId:parsed['--order-id'],
  expectedGatewayOrderId:parsed['--gateway-order-id'],
  sandbox404For:parsed['--sandbox-404-for'],
  confirmStagingOrigin:parsed['--confirm-staging-origin']===true,
  apply:parsed['--apply']===true
 };
 try{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:6000});
  const result=await reviewOrphan(input,{
   Model:require('../models/BroadcasterBillingOrder'),
   gateway:require('../services/ilumaGatewayClient'),
   environment
  });
  // No email, tokens, customer ID, DSN or request-key appears in output.
  console.log(JSON.stringify(result));
 }finally{
  await mongoose.disconnect();
 }
}
if(require.main===module){
 main().catch(error=>{
  const code=String(error?.code||error?.message||'RECOVERY_NOT_COMPLETED');
  const safe=/^[A-Z0-9_]{1,80}$/.test(code)?code:'RECOVERY_NOT_COMPLETED';
  console.error('STOP: '+safe);
  process.exitCode=1;
 });
}
module.exports={options,main};
