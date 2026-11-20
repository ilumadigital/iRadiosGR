'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fundingReadScope,matchesFundingEnvironment}=require('../services/advertisingFundingEnvironment');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('production never recognizes cloned stage funding or unscoped historical funding',()=>{
 assert.deepEqual(fundingReadScope('production'),{environment:'production'});
 assert.equal(matchesFundingEnvironment({environment:'staging'},'production'),false);
 assert.equal(matchesFundingEnvironment({},'production'),false);
 assert.equal(matchesFundingEnvironment({environment:'production'},'production'),true);
 assert.equal(matchesFundingEnvironment(null,'production'),false);
 assert.deepEqual(fundingReadScope('untrusted'),{environment:'__disabled__'});
});

test('staging historical funding remains readable only on staging',()=>{
 assert.deepEqual(fundingReadScope('staging'),{$or:[
  {environment:'staging'},{environment:{$exists:false}}
 ]});
 assert.equal(matchesFundingEnvironment({},'staging'),true);
 assert.equal(matchesFundingEnvironment({environment:'staging'},'staging'),true);
 assert.equal(matchesFundingEnvironment({environment:'production'},'staging'),false);
});

test('signed financial credits pin immutable tenant and reject replay from another tenant',()=>{
 const model=read('models/AdvertisingFundingLot.js');
 const events=read('services/advertisingPaymentEvents.js');
 assert.match(model,/environment:\{type:String,enum:\['staging','production'\]/);
 assert.match(model,/immutable:true/);
 assert.match(events,/environment:gatewayEnvironment\.mode\(\),source:'nexi_verified'/);
 assert.match(events,/!matchesFundingEnvironment\(lot\)/);
 assert.equal((events.match(/if\(lot&&matchesFundingEnvironment\(lot\)/g)||[]).length,2);
});
