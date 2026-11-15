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
 const slots=placementOptions({audios,banners}).map(x=>{
  const walletReady=eligibleLots.some(lot=>
   Number.isSafeInteger(lot.remainingNanos)&&
   Number.isSafeInteger(lot.reservedNanos||0)&&
   lot.remainingNanos-(lot.reservedNanos||0)>=x.requiredNanos);
  const dayReady=Number.isSafeInteger(dayAvailableNanos)&&
   dayAvailableNanos>=x.requiredNanos;
  return {...x,dayReady,walletReady,ready:dayReady&&walletReady};
 });
 const cheapest=slots[0]?.requiredNanos||0;
 const payable=slots.some(slot=>slot.ready);
 const walletCapable=slots.some(slot=>slot.walletReady);
 const dayCapable=slots.some(slot=>slot.dayReady);
 return {
  slots,hasEligibleCreative:slots.length>0,
  minimumReservationNanos:cheapest,
  nextTicketAffordable:payable,
  dayCapable,walletCapable,
  dayShortfallNanos:cheapest?Math.max(0,cheapest-dayAvailableNanos):0
 };
}
module.exports={placementOptions,analyzeAvailability};
