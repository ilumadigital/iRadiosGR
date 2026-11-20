// Advisory figures only. The signed v2 rate card and checkout remain authoritative.
const ANCHORS=Object.freeze([[7,25000],[30,80000],[90,210000],[180,390000],[365,720000]]);
export const BUDGET_LEVELS=Object.freeze([
 {id:'balanced',title:'Ισορροπημένη',numerator:100,denominator:100},
 {id:'intense',title:'Έντονη',numerator:150,denominator:100},
 {id:'maximum',title:'Μέγιστη προβολή',numerator:220,denominator:100}
]);
const localDay=date=>{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const field=key=>Number(parts.find(p=>p.type===key)?.value);
 return Date.UTC(field('year'),field('month')-1,field('day'));
};
export function calendarCampaignDays(start,end){
 const from=new Date(start),until=new Date(end);
 if(!Number.isFinite(from.getTime())||!Number.isFinite(until.getTime())||until<=from)
  return 0;
 return Math.max(1,Math.round((localDay(until)-localDay(from))/86400000));
}
export function budgetSuggestion(days,level='balanced'){
 if(!Number.isSafeInteger(days)||days<1)throw Error('Invalid campaign duration');
 const intensity=BUDGET_LEVELS.find(item=>item.id===level);
 if(!intensity)throw Error('Invalid recommendation level');
 let baseline;
 if(days<=ANCHORS[0][0])baseline=Math.round(days*ANCHORS[0][1]/ANCHORS[0][0]);
 else if(days>=ANCHORS[ANCHORS.length-1][0])
  baseline=Math.round(days*ANCHORS[ANCHORS.length-1][1]/ANCHORS[ANCHORS.length-1][0]);
 else{
  let i=1;
  while(ANCHORS[i][0]<days)i++;
  const [firstDay,firstCents]=ANCHORS[i-1];
  const [lastDay,lastCents]=ANCHORS[i];
  baseline=Math.round(firstCents+(days-firstDay)*(lastCents-firstCents)/(lastDay-firstDay));
 }
 const budgetCents=Math.min(100000000,Math.round(baseline*intensity.numerator/intensity.denominator));
 const dailyCents=Math.max(1,Math.ceil(budgetCents/days));
 return {days,level,budgetCents,dailyCents};
}
// Full reserve = 10s listen + potential CTA + potential completion.
// Nanos are exact and must not be rounded down to whole cents.
export const AUDIO_FULL_RESERVE_NANOS=Object.freeze({
 entry:1810000000,every_5_stations:1110000000,every_10_stations:1042000000,
 every_20_stations:1012000000,every_30_stations:988000000,
 twice_a_day:962000000,four_times_a_day:1138000000,
 six_times_a_day:1351000000
});
export function audioReservationPlacements(audios=[],rateCard=null){
 const pricedReserve=place=>{
  const e=rateCard?.audio?.[place];
  if(!e)return AUDIO_FULL_RESERVE_NANOS[place];
  const parts=['listen10','cta','complete'].map(key=>e[key]);
  return parts.every(n=>Number.isSafeInteger(n)&&n>0)?
   parts.reduce((sum,n)=>sum+n,0):undefined;
 };
 const seen=new Set();
 const list=[];
 for(const ad of audios){
  const places=Array.isArray(ad.frequencies)&&ad.frequencies.length?
   ad.frequencies:[ad.frequency];
  for(const place of places){
   if(!Object.hasOwn(AUDIO_FULL_RESERVE_NANOS,place)||seen.has(place))continue;
   seen.add(place);
   list.push({placement:place,reserveNanos:pricedReserve(place)});
  }
 }
 return list.sort((a,b)=>b.reserveNanos-a.reserveNanos);
}
export function maximumAudioReservationNanos(audios=[],rateCard=null){
 return audioReservationPlacements(audios,rateCard)[0]?.reserveNanos||0;
}
export function minimumAudioReservationNanos(audios=[],rateCard=null){
 const amounts=audios.flatMap(ad=>{
  const places=Array.isArray(ad.frequencies)&&ad.frequencies.length?
   ad.frequencies:[ad.frequency];
  return places.map(p=>rateCard?.audio?.[p]?
  ['listen10','cta','complete'].reduce((sum,event)=>sum+rateCard.audio[p][event],0):
  AUDIO_FULL_RESERVE_NANOS[p]).filter(Number.isSafeInteger);
 });
 return amounts.length?Math.min(...amounts):0;
}
