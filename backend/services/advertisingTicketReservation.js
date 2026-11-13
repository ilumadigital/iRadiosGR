'use strict';
// Best-effort compensation for non-financial ticket reservations. Each counter
// mutation is atomic; a process crash can only over-reserve (fail closed), not
// grant a paid impression. No claim of multi-document transactional atomicity.
async function reserveTicketQuotas(quotas,adapter,createTicket){
 if(!Array.isArray(quotas)||!quotas.length||
    !adapter||typeof adapter.reserve!=='function'||
    typeof adapter.release!=='function'||typeof createTicket!=='function')
  throw Error('Invalid shadow reservation request');
 const acquired=[];
 async function undo(){
  // Rollback only reservations THIS attempt actually won. Never delete
  // counters entirely; other concurrent reservations may exist.
  const results=await Promise.allSettled(acquired.reverse().map(q=>
   adapter.release(q.key)));
  if(results.some(r=>r.status==='rejected'))
   throw Error('Shadow counter release failed; manual QA review required');
 }
 try{
  for(const quota of quotas){
   if(typeof quota.key!=='string'||quota.key.length<1||
      !Number.isSafeInteger(quota.max)||quota.max<1||
      !Number.isSafeInteger(quota.expiry))
    throw Error('Invalid shadow ticket quota');
   if(!await adapter.reserve(quota.key,quota.max,quota.expiry)){
    await undo();
    return {status:'blocked',key:quota.key};
   }
   acquired.push(quota);
  }
  const created=await createTicket();
  if(!created){
   await undo();
   return {status:'unavailable'};
  }
  return {status:'issued',value:created};
 }catch(error){
  try{await undo();}catch(cleanupError){error.cleanupError=cleanupError.message;}
  throw error;
 }
}
module.exports={reserveTicketQuotas};
