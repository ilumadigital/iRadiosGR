'use strict';
const crypto=require('node:crypto');
// Stable canonical fingerprint for admin complimentary grant attempts.
// A reused Idempotency-Key with changed terms MUST be rejected, not replayed.
function fingerprintGrant({accountId,sku,resourceId=null,expiresAt=null,reason}){
 const expire=expiresAt?new Date(expiresAt).toISOString():'';
 const canonical=[String(accountId),String(sku),String(resourceId||''),expire,
   String(reason||'').trim()].join('\n');
 return crypto.createHash('sha256').update(canonical,'utf8').digest('hex');
}
module.exports={fingerprintGrant};
