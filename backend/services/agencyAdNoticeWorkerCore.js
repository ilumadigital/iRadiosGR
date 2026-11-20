'use strict';
// Pure at-least-once SMTP worker policy; all state changes are durable CAS.
// The transport may ACK and crash before commit: duplicates are then possible.
function retryAfter(attempts){
 if(!Number.isInteger(attempts)||attempts<1)throw Error('Invalid delivery attempts');
 return Math.min(3600000,30000*2**Math.min(7,attempts-1));
}
async function deliverOne({claim,send,markSent,markFailed,markSuperseded,
 isSuperseded,now=()=>Date.now()}){
 if([claim,send,markSent,markFailed,markSuperseded,isSuperseded].some(x=>typeof x!=='function'))
  throw Error('Invalid Agency notice adapter');
 const row=await claim();
 if(!row)return {status:'idle'};
 if(await isSuperseded(row)){
  const changed=await markSuperseded(row);
  return {status:changed?'superseded':'lease_lost'};
 }
 try{
  const result=await send(row);
  if(!result||result.success!==true)throw Error(result?.error||'Mail transport rejected notice');
  const changed=await markSent(row,result.messageId||'');
  return {status:changed?'sent':'lease_lost',eventKey:row.eventKey};
 }catch(error){
  const retryAt=new Date(now()+retryAfter(row.attempts));
  const changed=await markFailed(row,String(error.message||error).slice(0,250),retryAt);
  return {status:changed?'retry_pending':'lease_lost',
   retryAt,eventKey:row.eventKey};
 }
}
module.exports={retryAfter,deliverOne};
