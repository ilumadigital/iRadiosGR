'use strict';
// Operational diagnostic: HMAC GET only; never initiates/retries checkout.
// The Gateway authentication layer records a nonce/last-used timestamp.
const env=require('../services/gatewayEnvironment');
const gateway=require('../services/ilumaGatewayClient');
(async()=>{
 if(process.env.APP_ENV!=='staging'||env.mode()!=='production'||!env.configured())
  throw Object.assign(new Error('configuration'),{code:'GATEWAY_UNAVAILABLE'});
 const result=await gateway.signedRequest('GET','/api/v1/billing/readiness');
 if(result?.environment!=='production'||typeof result.ready!=='boolean'||
    !result.checks||typeof result.checks!=='object')
  throw Object.assign(new Error('response'),{code:'GATEWAY_BAD_RESPONSE'});
 console.log('AUTHENTICATED_GATEWAY: OK');
 console.log('PRODUCTION_READINESS:',result.ready?'READY':'NOT_READY');
 const known=new Set(['production_route','stage_webhook','provider_endpoint',
  'production_database','runtime_dml','provider_credential',
  ...['payments','saved_card_agreements','recurring_mandates','recurring_cycles',
   'winback_claims','broadcaster_mandates','broadcaster_cycles',
   'broadcaster_boost_scopes','advertising_budget_scopes'].map(x=>'schema:'+x),
  ...['L-PREM','L-WINBACK-199','B-PREM','ADD-DSP','ADD-ADS','ADD-AN',
   'BOOST-T-DAY','BOOST-T-WEEK','BOOST-T-2W','BOOST-T-MONTH','BOOST-T-YEAR',
   'BOOST-G-DAY','BOOST-G-WEEK','BOOST-G-2W','BOOST-G-MONTH','BOOST-G-YEAR',
   'ADV-BUDGET'].map(x=>'catalog:'+x)]);
 for(const [key,value] of Object.entries(result.checks))
  if(known.has(key)&&typeof value==='boolean')console.log(key+': '+(value?'OK':'NOT_READY'));
 console.log('NO CHECKOUT OR PROVIDER REQUEST SENT');
 process.exitCode=result.ready?0:2;
})().catch(error=>{
 const code=/^GATEWAY_[A-Z0-9_]+$/.test(error?.code||'')?error.code:'GATEWAY_DIAGNOSTIC_FAILED';
 console.error(code);
 process.exitCode=1;
});
