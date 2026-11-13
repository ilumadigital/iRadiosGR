'use strict';
// Deterministic, server-side shadow pacing proposals. Financial affordability
// is ALWAYS checked independently against historical funding lots.
const crypto=require('node:crypto');
const ID=/^[0-9a-f]{24}$/;
function hourlyQuota(remainingNanos,costNanos,endsAt,now=Date.now()){
 if(!Number.isSafeInteger(remainingNanos)||remainingNanos<0||
    !Number.isSafeInteger(costNanos)||costNanos<=0)
  throw Error('Invalid financial pacing inputs');
 const end=new Date(endsAt).getTime();
 if(!Number.isFinite(end)||end<=now||remainingNanos<costNanos)return 0;
 const hours=Math.max(1,Math.ceil((end-now)/3600000));
 // Soft ticket overbooking tolerates discarded/unviewable tickets.
 // This is a candidate-ticket quota, NOT authorization to spend money.
 return Math.min(2500,Math.max(1,Math.ceil(
  Math.floor(remainingNanos/costNanos)/hours*1.25)));
}
const hourBucket=now=>new Date(now).toISOString().slice(0,13);
const tenMinuteBucket=now=>Math.floor(now/600000);
const fiveMinuteBucket=now=>Math.floor(now/300000);
function fairOrder(candidates,visitor,now=Date.now()){
 if(!Array.isArray(candidates)||typeof visitor!=='string')throw Error('Invalid pacing selection');
 const list=candidates.map(item=>{
  if(!ID.test(String(item.campaignId))||
     !Number.isInteger(item.used)||item.used<0||
     !Number.isInteger(item.quota)||item.quota<0)
   throw Error('Invalid pacing candidate');
  const tie=crypto.createHash('sha256').update(
   visitor+'|'+hourBucket(now)+'|'+item.campaignId).digest().readUInt32BE(0)/0xffffffff;
  return {...item,score:item.quota===0?Infinity:item.used/item.quota+
   (tie/1000)};
 }).filter(c=>c.used<c.quota);
 return list.sort((a,b)=>a.score-b.score||
  String(a.campaignId).localeCompare(String(b.campaignId)));
}
module.exports={hourlyQuota,hourBucket,tenMinuteBucket,fiveMinuteBucket,fairOrder};
