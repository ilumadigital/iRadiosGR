'use strict';
// Read-only hint for Campaign Manager, computed from the SAME immutable worst-
// case reservation costs used in ledger.reserve. A candidate is NOT a promise
// of impression: listener geo, station, fraud caps and ticket CAS still apply.
const policy=require('./advertisingV2Policy');
function placementOptions({audios=[],banners=[]}={}){
 const seen=new Map();
 for(const ad of audios){
  if(!ad||ad.status!=='active'||ad.isStageCreative!==true||
    ad.mediaReady!==true)continue;
  const placements=Array.isArray(ad.frequencies)&&ad.frequencies.length?
   ad.frequencies:[ad.frequency];
  for(const placement of placements){
   if(!Object.hasOwn(policy.AUDIO_RATE_CARD,placement))continue;
   const key='audio:'+placement;
   seen.set(key,{kind:'audio',placement,
    requiredNanos:policy.eventReserveNanos('audio',placement)});
  }
 }
 for(const ad of banners){
  if(!ad||ad.status!=='active'||ad.isStageCreative!==true||
    ad.isActive!==true||!ad.imageUrl)continue;
  for(const placement of Array.isArray(ad.placement)?ad.placement:[]){
   if(!Object.hasOwn(policy.VISUAL_IMPRESSION_NANOS,placement))continue;
   const key='visual:'+placement;
   seen.set(key,{kind:'visual',placement,
    requiredNanos:policy.eventReserveNanos('visual',placement)});
  }
 }
 return [...seen.values()].sort((a,b)=>a.requiredNanos-b.requiredNanos);
}
function analyzeAvailability({audios=[],banners=[],eligibleLots=[],dayAvailableNanos=0}={}){
 const slots=placementOptions({audios,banners}).map(slot=>{
  const options=eligibleLots.filter(l=>policy.matchesRateCardSnapshot(l.rateCardSnapshot))
   .map(lot=>({lot,cost:policy.eventReserveNanos(
    slot.kind,slot.placement,lot.rateCardSnapshot)}));
  const requiredNanos=options.length?Math.min(...options.map(x=>x.cost)):slot.requiredNanos;
  const walletReady=options.some(({lot,cost})=>Number.isSafeInteger(lot.remainingNanos)&&
   Number.isSafeInteger(lot.reservedNanos||0)&&
   lot.remainingNanos-(lot.reservedNanos||0)>=cost);
  const dayReady=Number.isSafeInteger(dayAvailableNanos)&&
   options.some(({cost})=>dayAvailableNanos>=cost);
  const ready=options.some(({lot,cost})=>
   lot.remainingNanos-(lot.reservedNanos||0)>=cost&&dayAvailableNanos>=cost);
  return {...slot,requiredNanos,dayReady,walletReady,ready};
 }).sort((a,b)=>a.requiredNanos-b.requiredNanos);
 const cheapest=slots[0]?.requiredNanos||0;
 return {slots,hasEligibleCreative:slots.length>0,
  minimumReservationNanos:cheapest,nextTicketAffordable:slots.some(x=>x.ready),
  dayCapable:slots.some(x=>x.dayReady),walletCapable:slots.some(x=>x.walletReady),
  dayShortfallNanos:cheapest?Math.max(0,cheapest-dayAvailableNanos):0};
}
module.exports={placementOptions,analyzeAvailability};
