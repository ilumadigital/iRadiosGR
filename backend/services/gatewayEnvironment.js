'use strict';
// The application is deployed at stage.iradios.gr regardless of the selected
// payment provider tenant. Do not couple APP_ENV to Nexi's environment.
const KEY=/^ilg_[a-f0-9]{48}$/;
const SECRET=/^[a-f0-9]{64}$/;
function mode(){
 const selected=process.env.IRADIOS_GATEWAY_ENV||'staging';
 return selected==='staging'||selected==='production'?selected:null;
}
function credentials(){
 const environment=mode();
 if(process.env.APP_ENV!=='staging'||!environment)return null;
 const enabled=process.env.IRADIOS_BILLING_ENABLED==='1' ||
   (environment==='staging'&&process.env.IRADIOS_BILLING_SANDBOX_ENABLED==='1');
 if(!enabled)return null;
 const prefix=environment==='production'?'ILUMA_GATEWAY_PROD':'ILUMA_GATEWAY_STAGING';
 const key=process.env[prefix+'_KEY'],secret=process.env[prefix+'_SECRET'];
 if(!KEY.test(key||'')||!SECRET.test(secret||''))return null;
 return {environment,key,secret};
}
function configured(){return credentials()!==null;}
module.exports={mode,credentials,configured};
