'use strict';
// Pure, offline regression checks: no MongoDB and no staging requests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

async function main(){
  const {eligibleSponsoredStation,relatedToCategory,sponsoredGridColumns,
    buildSponsoredCatalog}=await import(pathToFileURL(
      path.join(root,'frontend/src/utils/sponsoredCatalog.js')).href);
  const now=Date.parse('2026-11-12T22:00:00Z');
  const boosted=(id,placement,genre='Dance',region='Αττική')=>({
    _id:id,name:id,genre,region,city:'Αθήνα',status:'approved',
    commercialBoost:{tier:'purchased',placement,endsAt:'2026-11-19T22:00:00Z'}
  });
  const global=boosted('global','global');
  const targeted=boosted('targeted','targeted');
  const catalog={scope:'genre',value:'Dance'};
  assert.equal(relatedToCategory(global,'Ηλεκτρονική'),true);
  assert.equal(relatedToCategory(global,'House'),true,
    'Dance global must cover related secondary House');
  assert.equal(relatedToCategory(global,'Ειδησεογραφικά'),false);
  assert.equal(relatedToCategory(global,'Παραδοσιακά'),false);
  assert.equal(eligibleSponsoredStation(global,{scope:'genre',value:'Ηλεκτρονική'},now),true);
  assert.equal(eligibleSponsoredStation(global,{scope:'genre',value:'Ειδησεογραφικά'},now),false);
  assert.equal(eligibleSponsoredStation(targeted,{scope:'genre',value:'Ηλεκτρονική'},now),false,
    'Category purchases never cover related genres');
  assert.equal(eligibleSponsoredStation(targeted,catalog,now),true);
  assert.equal(eligibleSponsoredStation(targeted,{...catalog,regionFilter:'Κρήτη'},now),false);
  assert.equal(eligibleSponsoredStation(global,{...catalog,regionFilter:'Κρήτη'},now),true,
    'Global covers any region filter');
  assert.equal(eligibleSponsoredStation(targeted,{scope:'region',value:'Αττική'},now),true);
  assert.equal(eligibleSponsoredStation(targeted,{scope:'region',value:'Κρήτη'},now),false);
  assert.equal(eligibleSponsoredStation(global,{scope:'region',value:'Κρήτη'},now),true);
  assert.equal(eligibleSponsoredStation(targeted,{scope:'home',value:'all'},now),false);
  assert.equal(eligibleSponsoredStation(targeted,{scope:'home',value:'all',
    categoryFilter:'Dance',regionFilter:'Αττική'},now),true);
  assert.equal(eligibleSponsoredStation(global,{scope:'home',value:'all',
    categoryFilter:'Ειδησεογραφικά'},now),false);
  assert.equal(eligibleSponsoredStation({...global,isOffline:true},catalog,now),false);
  assert.equal(eligibleSponsoredStation({...global,commercialBoost:{
    ...global.commercialBoost,endsAt:'2026-11-11T00:00:00Z'}},catalog,now),false);
  assert.equal(eligibleSponsoredStation({...global,commercialBoost:{
    tier:'organic',placement:'global',endsAt:null}},catalog,now),false);
  assert.equal(eligibleSponsoredStation({...global,commercialBoost:undefined,
    boostStatus:true},catalog,now),false,'Legacy booleans cannot buy placements');
  assert.deepEqual([639,640,1023,1024,1280,1536].map(sponsoredGridColumns),
    [2,3,3,4,5,6]);
  const organic=Array.from({length:18},(_,i)=>({_id:'s'+i,name:'S'+i,genre:'Dance',
    region:'Αττική',status:'approved'}));
  const entries=buildSponsoredCatalog({organic,allStations:[global,targeted],
    ...catalog,columns:2,now});
  const sponsored=entries.filter(e=>e.sponsored);
  assert.equal(sponsored.length,2);
  assert.equal(entries.filter(e=>!e.sponsored).length,18);
  assert.equal(new Set(entries.map(e=>e.station._id)).size,entries.length,
    'An inserted station must never reappear organically');
  assert.equal(entries[5].sponsored,true,'One sponsor within three mobile grid rows');
  assert.equal(entries[11].sponsored,true);
  const inBase=buildSponsoredCatalog({organic:[global,...organic],allStations:[global],
    ...catalog,mode:'list',now});
  assert.equal(inBase.filter(e=>e.station._id==='global').length,1,
    'Paid station appears once, not at top AND in an injected slot');
  assert.equal(inBase[2].sponsored,true,'List inserts every third row');
  const backendProjection=read('backend/services/stationBillingProjection.js');
  assert.match(backendProjection,/\.select\('accountId resourceId sku scopeType status environment periodStartsAt periodEndsAt'\)/,
    'Public station projection must hydrate order scopeType for paid Boosts');
  const home=read('frontend/src/components/HomeHeroSlider.jsx');
  assert.ok(home.includes("slide.audience==='premium'")&&
    home.includes('iradios_premium_last_')&&
    home.includes('currentStation?._id'),'Premium uses personal current/last station');
  const promoted=read('frontend/src/components/PromotedStationCard.jsx');
  assert.ok(promoted.includes('useStationAmbient(station?.logo)'));
  assert.ok(!promoted.includes('station.cover')&&!promoted.includes('src={artwork}'),
    'Promoted station does not use cover images as backgrounds');
  for(const page of ['Genre','Region']){
    const source=read('frontend/src/pages/'+page+'.jsx');
    assert.ok(source.includes('buildSponsoredCatalog')&&source.includes('sponsored={sponsored}'),
      page+' must inject and label scoped paid placements');
  }
  console.log('Sponsored catalog, category affinity, no duplicate, Premium hero and branded promoted card checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
