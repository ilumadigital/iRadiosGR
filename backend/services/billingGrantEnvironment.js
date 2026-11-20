'use strict';
// A snapshot of staging gifts is NOT a production administrative approval.
function grantReadScope(environment=process.env.APP_ENV){
 if(environment==='production')return {environment:'production'};
 if(environment==='staging')return {environment:{$in:['staging',null]}};
 return {environment:'__disabled__'};
}
module.exports={grantReadScope};
