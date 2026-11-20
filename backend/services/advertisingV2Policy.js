'use strict';
// iRadios Advertising v2: immutable public rate card. All amounts are
// integer nano-EUR; never calculate money using binary floating point.
const NANOS_PER_CENT=10_000_000;
const AUDIO_RATE_CARD=Object.freeze({
 entry:{listen10:360_000_000,cta:1_360_000_000,complete:90_000_000},
 every_5_stations:{listen10:190_000_000,cta:850_000_000,complete:70_000_000},
 every_10_stations:{listen10:122_000_000,cta:850_000_000,complete:70_000_000},
 every_20_stations:{listen10:92_000_000,cta:850_000_000,complete:70_000_000},
 every_30_stations:{listen10:68_000_000,cta:850_000_000,complete:70_000_000},
 twice_a_day:{listen10:42_000_000,cta:850_000_000,complete:70_000_000},
 four_times_a_day:{listen10:218_000_000,cta:850_000_000,complete:70_000_000},
 six_times_a_day:{listen10:431_000_000,cta:850_000_000,complete:70_000_000}
});
const VISUAL_CPM_NANOS=Object.freeze({
 hero:8_000_000_000,home:4_000_000_000,radio_feed:4_000_000_000,
 news_feed:4_000_000_000,station_profile:4_000_000_000
});
const VISUAL_IMPRESSION_NANOS=Object.freeze(Object.fromEntries(
 Object.entries(VISUAL_CPM_NANOS).map(([key,value])=>[key,value/1000])));
const DEFAULT_RATE_CARD=Object.freeze({audio:AUDIO_RATE_CARD,visual:VISUAL_IMPRESSION_NANOS});
const defaultRateCard=()=>JSON.parse(JSON.stringify(DEFAULT_RATE_CARD));
const rateCardForPricing=pricing=>pricing?.rateCard||defaultRateCard();
const MAX_BREAK_SPOTS=3;
const MAX_AUDIO_DURATION_SECONDS=46;
const MIN_AUDIO_BILLABLE_SECONDS=10;
const MIN_VISUAL_VIEW_MS=300;
const NON_SKIPPABLE_DAILY_CENTS=4500;
const skipAtSeconds=count=>count>=3?55:count===2?40:15;
const isNonSkippable=dailyBudgetCents=>Number.isSafeInteger(dailyBudgetCents)&&
 dailyBudgetCents>NON_SKIPPABLE_DAILY_CENTS;
const validDailyBudget=(daily,total)=>Number.isSafeInteger(daily)&&
 Number.isSafeInteger(total)&&total>0&&daily>0&&daily<=total;
// A prepaid funding lot authorizes event billing ONLY at the exact immutable
// rate card accepted on checkout. Never reprice historical legacy CPM funds.
function validateRateCard(card){
 const same=(x,t)=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).length===Object.keys(t).length&&Object.keys(t).every(k=>Object.hasOwn(x,k));
 if(!card||!same(card.audio,AUDIO_RATE_CARD)||!same(card.visual,VISUAL_IMPRESSION_NANOS))
  throw Error('Incomplete v2 rate card');
 for(const place of Object.keys(AUDIO_RATE_CARD)){
  if(!same(card.audio[place],AUDIO_RATE_CARD[place]))throw Error('Invalid audio events');
  for(const event of Object.keys(AUDIO_RATE_CARD[place])){
   const n=card.audio[place][event];
   if(!Number.isSafeInteger(n)||n<1||n>100_000_000_000)
    throw Error('Audio event price must be positive integer nano-EUR');
  }
 }
 for(const place of Object.keys(VISUAL_IMPRESSION_NANOS)){
  const n=card.visual[place];
  if(!Number.isSafeInteger(n)||n<1||n>100_000_000_000)
   throw Error('Visual impression price must be positive integer nano-EUR');
 }
 return true;
}
const matchesRateCardSnapshot=snapshot=>{
 try{return validateRateCard(snapshot);}catch{return false;}
};
const feeNanos=(kind,placement,event,card=DEFAULT_RATE_CARD)=>{
 if(!matchesRateCardSnapshot(card))throw Error('Invalid rate card');
 if(kind==='audio'){
  const rate=card.audio[placement];
  if(!rate||!['listen10','cta','complete'].includes(event))
   throw Error('Invalid audio placement/event');
  return rate[event];
 }
 if(kind==='visual'&&event==='impression'&&Object.hasOwn(card.visual,placement))
  return card.visual[placement];
 throw Error('Invalid billable event');
};
const eventReserveNanos=(kind,placement,card=DEFAULT_RATE_CARD)=>kind==='audio'?
 ['listen10','cta','complete'].reduce((sum,event)=>sum+feeNanos(kind,placement,event,card),0):
 feeNanos('visual',placement,'impression',card);
function athensDay(at=Date.now()){
 const date=new Date(at);
 if(!Number.isFinite(date.getTime()))throw Error('Invalid time');
 const fields=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=type=>fields.find(part=>part.type===type)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
module.exports={NANOS_PER_CENT,AUDIO_RATE_CARD,VISUAL_CPM_NANOS,
 VISUAL_IMPRESSION_NANOS,DEFAULT_RATE_CARD,defaultRateCard,rateCardForPricing,
 validateRateCard,MAX_BREAK_SPOTS,MAX_AUDIO_DURATION_SECONDS,
 MIN_AUDIO_BILLABLE_SECONDS,MIN_VISUAL_VIEW_MS,NON_SKIPPABLE_DAILY_CENTS,
 skipAtSeconds,isNonSkippable,validDailyBudget,matchesRateCardSnapshot,
 feeNanos,eventReserveNanos,athensDay};
