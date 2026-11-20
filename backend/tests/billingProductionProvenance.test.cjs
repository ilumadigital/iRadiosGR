'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {grantReadScope}=require('../services/billingGrantEnvironment');
const {listenerCompatibilityRights}=require('../services/billingEntitlementRules');
test('production refuses old listener Premium flag and imported stage grants',()=>{
 assert.deepEqual(listenerCompatibilityRights({role:'user',isPremium:true},'production'),[]);
 assert.deepEqual(listenerCompatibilityRights({role:'user',isPremium:true},'staging'),['listener.premium']);
 assert.deepEqual(grantReadScope('production'),{environment:'production'});
 assert.deepEqual(grantReadScope('staging'),{environment:{$in:['staging',null]}});
 assert.deepEqual(grantReadScope('unsafe'),{environment:'__disabled__'});
});
