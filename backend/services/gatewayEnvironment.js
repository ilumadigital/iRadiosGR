'use strict';
// The app's deployment environment determines the Gateway tenant.
// Never send stage.iradios.gr requests to live Nexi, nor play.iradios.gr to Sandbox.
const KEY=/^ilg_[a-f0-9]{48}$/;
const SECRET=/^[a-f0-9]{64}$/;
function mode(){
 const app=process.env.APP_ENV;
 const selected=process.env.IRADIOS_GATEWAY_ENV||app;
 return (app==='staging'||app==='production')&&selected===app?app:null;
}
function credentials(){
 const environment=mode();
 if(!environment)return null;
 const enabled=process.env.IRADIOS_BILLING_ENABLED==='1' ||
  (environment==='staging'&&process.env.IRADIOS_BILLING_SANDBOX_ENABLED==='1');
 if(!enabled)return null;
 if(environment==='production'&&process.env.IRADIOS_PRODUCTION_CUTOVER_APPROVED!=='1')return null;
 const prefix=environment==='production'?'ILUMA_GATEWAY_PROD':'ILUMA_GATEWAY_STAGING';
 const key=process.env[prefix+'_KEY'],secret=process.env[prefix+'_SECRET'];
 if(!KEY.test(key||'')||!SECRET.test(secret||''))return null;
 const other=environment==='production'?'ILUMA_GATEWAY_STAGING':'ILUMA_GATEWAY_PROD';
 if(process.env[other+'_KEY']||process.env[other+'_SECRET'])return null;
 return {environment,key,secret};
}
function configured(){return credentials()!==null;}
module.exports={mode,credentials,configured};
