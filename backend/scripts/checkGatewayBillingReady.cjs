'use strict';
// Offline read-only billing readiness report. Does not print secrets or contact Nexi.
// Unlike check-prod-env.py, this verifies that checkout is ENABLED right now.
const gw=require('../services/gatewayEnvironment');
const expected=process.env.APP_ENV;
const actual=gw.mode();
const creds=gw.credentials();
const checks={
 APP_TENANT_MATCH:actual!==null&&actual===expected,
 GATEWAY_KEYS_CONFIGURED:!!creds&&creds.environment===expected,
 BILLING_ENABLED:process.env.IRADIOS_BILLING_ENABLED==='1'||
  (expected==='staging'&&process.env.IRADIOS_BILLING_SANDBOX_ENABLED==='1'),
 PRODUCTION_CUTOVER:expected!=='production'||
  process.env.IRADIOS_PRODUCTION_CUTOVER_APPROVED==='1'
};
for(const [name,pass] of Object.entries(checks))
 console.log(name+': '+(pass?'PASS':'NOT_READY'));
console.log('FINANCIAL_CALLS=0; DB_WRITES=0; SECRETS_PRINTED=0');
if(Object.values(checks).some(ok=>!ok))process.exitCode=1;
