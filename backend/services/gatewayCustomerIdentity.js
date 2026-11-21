'use strict';
// Authenticated Gateway credential + event.environment choose the tenant.
// Historical production events may carry a "stage" user-reference prefix,
// but this opaque identifier NEVER changes the target MongoDB or Nexi tenant.
const gatewayEnvironment=require('./gatewayEnvironment');
const ID=/^[a-f0-9]{24}$/;
function accountIdFromExternal(ref){
 const env=gatewayEnvironment.mode();
 if(typeof ref!=='string'||!['staging','production'].includes(env))return null;
 const prefix=ref.startsWith('iradios-stage-')?'iradios-stage-':
  ref.startsWith('iradios-play-')?'iradios-play-':null;
 if(!prefix || (env==='staging'&&prefix!=='iradios-stage-'))return null;
 const id=ref.slice(prefix.length);
 return ID.test(id)?id:null;
}
function isAllowedExternal(ref){return accountIdFromExternal(ref)!==null;}
module.exports={accountIdFromExternal,isAllowedExternal};
