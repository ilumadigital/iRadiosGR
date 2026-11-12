import {stationMatchesRegion} from './stationRegions.js';

// Curated primary-category affinities. Never cross-promote editorial music into
// news, sports, religious or traditional categories.
export const RELATED_CATEGORIES=Object.freeze({
  'Διεθνή Mainstream':['Dance','Εναλλακτικά'],
  'Dance':['Ηλεκτρονική','Διεθνή Mainstream'],
  'Ηλεκτρονική':['Dance','Εναλλακτικά'],
  'Ροκ':['Εναλλακτικά'],
  'Εναλλακτικά':['Ροκ','Ηλεκτρονική','Διεθνή Mainstream'],
  'Ελληνικά Επιτυχίες':['Έντεχνα'],
  'Ελληνικά Λαϊκά':['Ελληνικά Επιτυχίες'],
  'Έντεχνα':['Ελληνικά Επιτυχίες'],
  'Παραδοσιακά':[],
  'Ειδησεογραφικά':[],
  'Αθλητικά':[],
  'Θρησκευτικά':[]
});
const id=station=>String(station?._id||'');
const isAvailable=station=>id(station)&&
  (station.status==='approved'||!station.status)&&station.isOffline!==true;
const actualCategories=station=>[station?.genre,station?.secondaryGenre].filter(Boolean);
export function relatedToCategory(station,category){
  if(!category)return true;
  if(actualCategories(station).includes(category))return true;
  return (RELATED_CATEGORIES[station?.genre]||[]).includes(category);
}
export function eligibleSponsoredStation(station,{scope,value,regionFilter='',categoryFilter='',transmissionFilter=''},now=Date.now()){
  if(!isAvailable(station))return false;
  const boost=station.commercialBoost;
  // Paid, server-verified entitlements only; legacy boostStatus or old orders
  // never authorize a sponsored placement.
  if(boost?.tier!=='purchased'||!Number.isFinite(Date.parse(boost.endsAt))||
     Date.parse(boost.endsAt)<=now)return false;
  const global=boost.placement==='global';
  const targeted=boost.placement==='targeted';
  if(!global&&!targeted)return false;
  if(transmissionFilter&&transmissionFilter!=='all'&&
     (station.transmissionType||'Web Radio')!==transmissionFilter)return false;
  if(scope==='genre'){
    if(!relatedToCategory(station,value))return false;
    if(targeted&&!actualCategories(station).includes(value))return false;
    if(targeted&&regionFilter&&regionFilter!=='all'&&station.region!==regionFilter)return false;
    return true;
  }
  if(scope==='region'){
    if(targeted&&!stationMatchesRegion(station,value))return false;
    if(categoryFilter&&categoryFilter!=='all'){
      // A filtered region must not show an unrelated global sponsor.
      if(!relatedToCategory(station,categoryFilter))return false;
      if(targeted&&!actualCategories(station).includes(categoryFilter))return false;
    }
    return true;
  }
  if(scope==='home'){
    // Category Boost is NOT a global homepage placement: it needs its own
    // category and its own region filters. Global Boost may be shown in All.
    if(targeted&&(!categoryFilter||!regionFilter||
      !actualCategories(station).includes(categoryFilter)||
      !stationMatchesRegion(station,regionFilter)))return false;
    if(global&&categoryFilter&&!relatedToCategory(station,categoryFilter))return false;
    return true;
  }
  return false;
}
export function sponsoredGridColumns(width){
  if(width>=1536)return 6;
  if(width>=1280)return 5;
  if(width>=1024)return 4;
  if(width>=640)return 3;
  return 2;
}
function stableHash(value){
  let h=2166136261;
  for(const char of value)h=Math.imul(h^char.charCodeAt(0),16777619);
  return h>>>0;
}
// In each three-row block there is at most one clearly marked sponsored
// result. Chosen stations leave the organic grid to prevent double display;
// unchosen stations keep their regular organic place.
export function buildSponsoredCatalog({organic=[],allStations=[],scope,value='',mode='grid',
  columns=2,regionFilter='',categoryFilter='',transmissionFilter='',now=Date.now()}){
  const base=[...organic];
  const every=mode==='list'?3:Math.max(2,columns)*3;
  const candidates=allStations.filter(station=>eligibleSponsoredStation(station,{
    scope,value,regionFilter,categoryFilter,transmissionFilter
  },now)).sort((a,b)=>id(a).localeCompare(id(b)));
  if(!candidates.length)return base.map(station=>({station,sponsored:false}));
  const slots=Math.max(1,Math.ceil(base.length/every));
  const offset=stableHash(scope+':'+value+':'+Math.floor(now/3600000))%candidates.length;
  const rotation=[...candidates.slice(offset),...candidates.slice(0,offset)];
  const selected=rotation.slice(0,slots);
  const chosen=new Set(selected.map(id));
  const remaining=base.filter(station=>!chosen.has(id(station)));
  const result=[];
  let organicIndex=0,adIndex=0;
  while(organicIndex<remaining.length||adIndex<selected.length){
    const blockEnd=(adIndex+1)*every-1;
    while(organicIndex<remaining.length&&result.length<blockEnd){
      result.push({station:remaining[organicIndex++],sponsored:false});
    }
    if(adIndex<selected.length){
      result.push({station:selected[adIndex++],sponsored:true});
    }else break;
  }
  while(organicIndex<remaining.length)result.push({station:remaining[organicIndex++],sponsored:false});
  return result;
}
