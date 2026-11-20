'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../frontend/src/pages/Backoffice.jsx'),'utf8');
for(const [route,right] of [
  ['/backoffice/radar','broadcaster.analytics'],
  ['/backoffice/audio','broadcaster.webdsp'],
  ['/backoffice/ad-control','broadcaster.ad_control']
]){
  assert.ok(source.includes("'"+route+"':'"+right+"'"),'sidebar mapping: '+right);
  assert.ok(source.includes('entitlement="'+right+'" rights={addonRights} status={addonStatus}'),
    'direct navigation gate: '+right);
}
assert.ok(source.includes("'/api/billing/me/entitlements'")&&
  source.includes("'/api/billing/me/station-entitlements'"),
  'both account Premium and per-station purchases/complimentary grants are checked');
assert.ok(source.includes('for(const values of Object.values(stations.byStation||{}))'),
  'station-scoped purchase entitlements participate');
assert.ok(source.includes("cache:'no-store'"),'fresh server response');
assert.ok(source.includes("status:'error',rights:new Set()"),'failed lookups fail closed');
assert.ok(source.includes('aria-disabled="true"')&&source.includes('<LockKeyhole')&&
  source.includes('cursor-not-allowed'),'unpaid tools are disabled with a lock');
assert.ok(source.includes("locked={Boolean(item.entitlement)&&addonStatus==='ready'&&!addonRights.has(item.entitlement)}"),
  'only the unpaid add-on tools become locked');
assert.ok(source.includes("to:'/backoffice/pro-features',label:'Pro Features & Premium'"),
  'upgrade link remains active');
console.log('Locked Broadcaster addon navigation and entitlement checks passed.');
