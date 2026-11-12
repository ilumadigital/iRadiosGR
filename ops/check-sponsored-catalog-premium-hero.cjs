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
  const manual={...global,_id:'manual',commercialBoost:{
    tier:'manual',placement:'global',endsAt:'2026-11-13T22:00:00Z'
  }};
  assert.equal(eligibleSponsoredStation(manual,catalog,now),true,
    'Time-limited Admin Boost is a separate valid sponsored source');
  assert.equal(eligibleSponsoredStation({...manual,commercialBoost:{
    ...manual.commercialBoost,endsAt:'2026-11-11T22:00:00Z'
  }},catalog,now),false,'Expired manual Boost cannot appear');
  assert.equal(eligibleSponsoredStation(global,{
    scope:'home',value:'for-you',relevantCategories:['Dance']
  },now),true,'For You can show relevant Global Boost');
  assert.equal(eligibleSponsoredStation(global,{
    scope:'home',value:'for-you',relevantCategories:['Παραδοσιακά']
  },now),false,'For You must never inject unrelated sponsored music');
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
  const sponsorOptions={organic:organic.slice(0,3),
    allStations:[global,targeted,manual,boosted('fourth','global')],
    ...catalog,mode:'list'};
  const rotated=new Set();
  for(let i=0;i<4;i++){
    const current=buildSponsoredCatalog({...sponsorOptions,now:now+i*300000});
    rotated.add(current.find(entry=>entry.sponsored)?.station._id);
  }
  assert.equal(rotated.size,4,
    'Round robin must give every active booster a slot within four intervals');
  const promoted=buildSponsoredCatalog({organic:organic.slice(0,9),
    allStations:[global],...catalog,columns:2,now});
  assert.equal(promoted.filter(item=>item.sponsored&&item.station._id==='global').length,1,
    'A station separately displayed as Promoted must retain its purchased slot');
  const backendProjection=read('backend/services/stationBillingProjection.js');
  assert.match(backendProjection,/\.select\('accountId resourceId sku scopeType status environment periodStartsAt periodEndsAt'\)/,
    'Public station projection must hydrate order scopeType for paid Boosts');
  const home=read('frontend/src/components/HomeHeroSlider.jsx');
  assert.ok(home.includes("slide.audience==='premium'")&&
    home.includes('iradios_premium_last_')&&
    home.includes('currentStation?._id')&&
    home.includes('listeningProfile?.stations'),
    'Premium uses personal current/last station across synced account devices');
  const promotedCard=read('frontend/src/components/PromotedStationCard.jsx');
  assert.ok(promotedCard.includes('useStationAmbient(station?.logo)'));
  assert.ok(!promotedCard.includes('station.cover')&&!promotedCard.includes('src={artwork}'),
    'Promoted station does not use cover images as backgrounds');
  for(const page of ['Genre','Region']){
    const source=read('frontend/src/pages/'+page+'.jsx');
    assert.ok(source.includes('buildSponsoredCatalog')&&source.includes('sponsored={sponsored}'),
      page+' must inject and label scoped paid placements');
    assert.ok(source.includes('allStations:stations,'),
      page+' must not exclude Promoted stations from paid Sponsored inventory');
  }
  const admin=read('frontend/src/pages/Boost.jsx');
  const adminApi=read('backend/routes/backofficeRoutes.js');
  const publicApi=read('backend/controllers/stationController.js');
  const source=read('backend/services/stationBillingProjectionRules.js');
  assert.ok(admin.includes('commercialBoost')&&admin.includes('Paid ')&&
    admin.includes('Admin Manual')&&admin.includes('premiumIncluded'),
    'Admin clearly labels the purchased/manual/Premium sources');
  assert.ok(adminApi.includes('projectPublicStations(items)')&&
    adminApi.includes('commercialBoost:station.commercialBoost'),
    'Admin ranking must use same effective entitlement calculation as public feed');
  assert.ok(adminApi.includes('PromotedStation.find({enabled:true})')&&
    adminApi.includes('promotedPlacements:')&&admin.includes('station.promotedPlacements'),
    'Admin must display paid and Promoted placements independently for the same radio');
  assert.ok(publicApi.includes('broadcasterId boostStatus boostExpiresAt'),
    'Public API must project Admin manual expiration safely');
  assert.ok(source.includes('effectiveStationBoost('),
    'Manual projection must not be taken from unverified client values');
  const homeExplore=read('frontend/src/components/HomeExplore.jsx');
  assert.ok(homeExplore.includes('buildListeningInterests')&&
    homeExplore.includes('relevantCategories:tab'),
    'For You sponsored candidates must match real listener preferences');
  console.log('Admin/manual/paid Boost, Promoted coexistence, fair rotation, relevant For You and expiry checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
