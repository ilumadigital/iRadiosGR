'use strict';
// Read-only: reports a non-reversible HMAC proof, never the secret itself.
// Run inside the backend container so the proof matches the ACTUAL receiver.
const crypto=require('node:crypto');
const gateway=require('../services/gatewayEnvironment');
const env=gateway.mode();
if(!['staging','production'].includes(env)){
 console.error('STOP: iRadios Gateway tenant is not configured');process.exit(1);
}
// Must mirror the existing webhook verifier's key selection exactly.
const secret=gateway.credentials()?.secret ||
 (env==='staging'?process.env.ILUMA_GATEWAY_STAGING_SECRET:null);
if(!/^[a-f0-9]{64}$/.test(secret||'')){
 console.error('STOP: effective webhook HMAC key is unavailable');process.exit(1);
}
const proof=crypto.createHmac('sha256',secret)
 .update('iradios-webhook-key-alignment-v1','utf8')
 .digest('hex').slice(0,24);
console.log(env.toUpperCase()+' IRADIOS_RECEIVER_HMAC_PROOF='+proof);
console.log('READ_ONLY: compare with the SAME tenant Gateway outbox proof; no provider call.');
