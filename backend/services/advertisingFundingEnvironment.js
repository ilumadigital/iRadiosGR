'use strict';
// A copied staging funding lot (even if Nexi-paid) is NOT a production wallet.
// Production requires an explicit environment marker created by its own signed
// Gateway payment event, or a separately reviewed auditable migration.
function fundingReadScope(environment=process.env.APP_ENV){
 if(environment==='production')return {environment:'production'};
 if(environment==='staging')return {$or:[
  {environment:'staging'},{environment:{$exists:false}}
 ]};
 return {environment:'__disabled__'};
}
function matchesFundingEnvironment(lot,environment=process.env.APP_ENV){
 if(!lot)return false;
 if(environment==='production')return lot.environment==='production';
 if(environment==='staging')return lot.environment===undefined||
  lot.environment==='staging';
 return false;
}
module.exports={fundingReadScope,matchesFundingEnvironment};
