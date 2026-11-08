'use strict';
// Offline scheduler regression: no paid vendor calls, streams or MongoDB.
const assert=require('node:assert/strict');
const Module=require('node:module');
const origLoad=Module._load;
const oldDateNow=Date.now;
const oldEnv={
  APP_ENV:process.env.APP_ENV,
  STAGE_ENABLE_AUTO_ACRCLOUD:process.env.STAGE_ENABLE_AUTO_ACRCLOUD,
  STAGE_AUTO_ACR_DAILY_LIMIT:process.env.STAGE_AUTO_ACR_DAILY_LIMIT
};
let now=Date.parse('2026-11-09T01:00:00Z'),used=0,requests=[],published=0;
const ids=Array.from({length:17},(_,i)=>(i+1).toString(16).padStart(24,'0'));
const candidates=[
  {_id:'ffffffffffffffffffffffff',name:'News FM',genre:'Pop',
    stream:'https://radio.example/news',plays:999999,popularity:999999,status:'approved'},
  {_id:'eeeeeeeeeeeeeeeeeeeeeeee',name:'Daily News',genre:'Ειδήσεις',
    stream:'https://radio.example/updates',plays:999999,popularity:999999,status:'approved'},
  ...ids.slice(0,8).map((id,i)=>({
    _id:id,name:'Pop '+(i+1),genre:'Pop',stream:'https://radio.example/pop/'+i,
    popularity:100-i,plays:1000+i,status:'approved'
  })),
  ...ids.slice(8,15).map((id,i)=>({
    _id:id,name:'Rock '+(i+1),genre:'Rock',stream:'https://radio.example/rock/'+i,
    popularity:80-i,plays:2000+i,status:'approved'
  })),
  {_id:ids[15],name:'Politics Now',genre:'Talk',
    stream:'https://radio.example/talk',plays:500,popularity:500,status:'approved'}
];
const titles=new Map(ids.map(id=>[id,'Native Artist - Native Song']));
for(const id of [ids[1],ids[2],ids[5],ids[9],ids[10],ids[13]])titles.set(id,
  [ids[2],ids[10]].includes(id)?'LIVE SHOW':'');
let seenPipeline;
const stations={
  aggregate:async pipeline=>{
    seenPipeline=pipeline;
    const match=pipeline[0].$match;
    const rule=pipeline[1].$group.stations.$topN;
    assert.equal(rule.n,5,'rank five stations within each category');
    assert.deepEqual(rule.sortBy,{popularity:-1,plays:-1,_id:1},
      'match the category popularity ranking');
    const groups=new Map();
    for(const s of candidates){
      if(s.status!=='approved'||!s.stream||!s.genre||
        match.genre.$not.test(s.genre)||match.name.$not.test(s.name))continue;
      if(!groups.has(s.genre))groups.set(s.genre,[]);
      groups.get(s.genre).push(s);
    }
    return [...groups].map(([genre,list])=>({
      _id:genre,
      stations:list.sort((a,b)=>b.popularity-a.popularity||b.plays-a.plays||
        a._id.localeCompare(b._id)).slice(0,rule.n)
    }));
  },
  find:query=>({select:()=>({lean:async()=>candidates.filter(s=>
    query?._id?.$in?.includes(s._id)&&s.status==='approved')})})
};
const quota={
  updateOne:async()=>({}),
  findOneAndUpdate:()=>({lean:async()=>{
    if(used>=5)return null;
    used++;return {_id:'stage-auto-acr:2026-11-09',used};
  }})
};
Date.now=()=>now;
process.env.APP_ENV='staging';
process.env.STAGE_ENABLE_AUTO_ACRCLOUD='1';
process.env.STAGE_AUTO_ACR_DAILY_LIMIT='5';
let worker;
try{
  Module._load=function(name,parent,isMain){
    if(parent?.filename?.endsWith('stageAutoAcrcloud.js')){
      if(name==='mongoose')return {connection:{readyState:1}};
      if(name==='../models/Station')return stations;
      if(name==='../models/StageAcrDailyBudget')return quota;
      if(name==='./stageMetadata')return {readCachedNativeMetadata:async s=>titles.get(s._id)||''};
      if(name==='./stageSmartTracks')return {
        FIVE_MINUTES:300000,
        statusFromNative:raw=>!raw?'missing':raw==='LIVE SHOW'?'invalid':'valid',
        hydrateSharedAI:async()=>null,clearAutomaticAI:async()=>{},
        publishAI:async()=>{published++;return {raw:'Artist - Hit',foundWithAI:true};}
      };
      if(name==='./stageAcrcloud')return {
        readyForAcr:()=>true,
        recognizeApprovedStation:async(s,opts)=>{
          if(!(await opts.beforeVendorCall())){const e=new Error('limit');e.code='ACR_RATE_LIMIT';throw e;}
          requests.push(s._id);
          return {status:{code:0},metadata:{music:[{artists:[{name:'Artist'}],title:'Hit'}]}};
        }
      };
    }
    return origLoad.call(this,name,parent,isMain);
  };
  worker=require('../backend/utils/stageAutoAcrcloud');
}finally{Module._load=origLoad;}
const res=()=>({code:200,status(n){this.code=n;return this;},end(){return this;},json(){return this;}});
async function run(){
  try{
    assert.equal(worker.isMusicStation(candidates[0]),false,'news-branded station cannot enter a music category');
    assert.equal(worker.isMusicStation(candidates[1]),false,'news categories must be excluded');
    assert.equal(worker.isMusicStation(candidates[2]),true);
    await worker.refreshTop();
    assert.ok(seenPipeline,'MongoDB must rank per genre server-side');
    assert.equal(worker.currentTop().length,10,'two music categories x five each');
    assert.deepEqual(worker.currentTop().filter(s=>s.genre==='Pop').map(s=>s._id),ids.slice(0,5));
    assert.deepEqual(worker.currentTop().filter(s=>s.genre==='Rock').map(s=>s._id),ids.slice(8,13));
    assert.ok(!worker.currentTop().some(s=>s.name.includes('News')||s.genre==='Talk'));
    await worker.tick();
    assert.deepEqual([...requests].sort(),[ids[1],ids[2],ids[9],ids[10]].sort(),
      'missing AND invalid metadata at category Top-5 auto-recognizes with zero listeners');
    assert.equal(used,4);
    assert.equal(published,4);
    assert.ok(!requests.includes(ids[5]),'6th station waits for a listener, not a manual recognition');

    // The extra listened station outside category Top-5 still works unchanged.
    const sessionId='123e4567-e89b-12d3-a456-426614174000';
    assert.equal(worker.heartbeat({
      body:{stationId:ids[5],sessionId,playing:true}
    },res()).code,204);
    assert.equal(worker.listenerPresent(ids[5]),true);
    await worker.tick();
    assert.equal(requests.length,5,'outside-Top-5 station becomes eligible from a heartbeat');
    assert.ok(requests.includes(ids[5]));
    assert.equal(used,5);

    await worker.tick();
    assert.equal(requests.length,5,'five-minute cooldown prevents vendor duplicates');
    now+=5*60*1000+1000;
    await worker.tick();
    assert.equal(requests.length,5,'persisted daily cap stops further paid calls');
    assert.equal(published,5);
    worker.heartbeat({body:{stationId:ids[5],sessionId,playing:false}},res());
    assert.equal(worker.listenerPresent(ids[5]),false);
    assert.equal(worker.heartbeat({
      body:{stationId:ids[5],sessionId:'bad',playing:true}
    },res()).code,400);
    console.log('Phase 3.5: per-category Top-5 without listeners, news exclusion, additional listened stations, cooldown and daily billing cap passed.');
  }finally{
    Date.now=oldDateNow;
    for(const [k,v] of Object.entries(oldEnv))
      v===undefined?delete process.env[k]:process.env[k]=v;
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
