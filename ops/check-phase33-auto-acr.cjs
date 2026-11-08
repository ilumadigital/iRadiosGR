'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const origLoad=Module._load;
const oldDateNow=Date.now;
const oldEnv={APP_ENV:process.env.APP_ENV,STAGE_ENABLE_AUTO_ACRCLOUD:process.env.STAGE_ENABLE_AUTO_ACRCLOUD,STAGE_AUTO_ACR_DAILY_LIMIT:process.env.STAGE_AUTO_ACR_DAILY_LIMIT};
let now=Date.parse('2026-11-09T01:00:00Z'),used=0,requests=[],published=0;
const ids=Array.from({length:11},(_,i)=>(i+1).toString(16).padStart(24,'0'));
const candidates=[
  {_id:'ffffffffffffffffffffffff',name:'News FM',genre:'Ειδήσεις',stream:'https://radio.example/news',plays:20000},
  ...ids.map((id,i)=>({_id:id,name:'Music '+i,genre:'Pop',stream:'https://radio.example/'+i,plays:10000-i}))
];
const titles=new Map(ids.map(id=>[id,'Native Artist - Native Song']));
titles.set(ids[1],'');titles.set(ids[2],'LIVE SHOW');titles.set(ids[3],'');
const stations={find:query=>({select:()=>({
  lean:async()=>candidates.filter(s=>query?._id?.$in?.includes(s._id)),
  sort:()=>({limit:()=>({lean:async()=>candidates})})
})})};
const quota={updateOne:async()=>({}),findOneAndUpdate:()=>({lean:async()=>{
  if(used>=3)return null;
  used++;return {_id:'stage-auto-acr:2026-11-09',used};
}})};
Date.now=()=>now;
process.env.APP_ENV='staging';process.env.STAGE_ENABLE_AUTO_ACRCLOUD='1';
process.env.STAGE_AUTO_ACR_DAILY_LIMIT='3';
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
        statusFromNative:(raw)=>!raw?'missing':raw==='LIVE SHOW'?'invalid':'valid',
        hydrateSharedAI:async()=>null,clearAutomaticAI:async()=>{},
        publishAI:async()=>{published++;return {raw:'Artist - Hit',foundWithAI:true};}
      };
      if(name==='./stageAcrcloud')return {readyForAcr:()=>true,recognizeApprovedStation:async(s,opts)=>{
        if(!(await opts.beforeVendorCall())){const e=new Error('limit');e.code='ACR_RATE_LIMIT';throw e;}
        requests.push(s._id);
        return {status:{code:0},metadata:{music:[{artists:[{name:'Artist'}],title:'Hit'}]}};
      }};
    }
    return origLoad.call(this,name,parent,isMain);
  };
  worker=require('../backend/utils/stageAutoAcrcloud');
}finally{Module._load=origLoad;}
const res=()=>({code:200,status(n){this.code=n;return this;},end(){return this;},json(){return this;}});
async function run(){
  try{
    assert.equal(worker.isMusicStation(candidates[0]),false,'news stations cannot enter Top 10');
    assert.equal(worker.isMusicStation(candidates[1]),true);
    await worker.refreshTop();
    assert.equal(worker.currentTop().length,10,'exactly 10 music stations max');
    assert.ok(!worker.currentTop().some(x=>x.name==='News FM'));
    await worker.tick();
    assert.deepEqual(requests,[ids[2]],'invalid station metadata triggers ACR even with zero listeners');
    assert.ok(!requests.includes(ids[1]),'no metadata and no listener cannot trigger ACR');

    // One real listener reports a UUID; no accounts, credentials or stream URL used.
    const id='123e4567-e89b-12d3-a456-426614174000';
    const pong=res();
    worker.heartbeat({body:{stationId:ids[3],sessionId:id,playing:true}},pong);
    assert.equal(pong.code,204);
    assert.equal(worker.listenerPresent(ids[3]),true);
    await worker.tick();
    assert.deepEqual(requests,[ids[2],ids[3]],'absent metadata with live listener triggers one ACR');
    assert.equal(used,2);
    // Station #11 is not in Top-10. It must still be recognized when
    // someone genuinely listens and it has no usable native metadata.
    const extraId='223e4567-e89b-12d3-a456-426614174000';
    worker.heartbeat({body:{stationId:ids[10],sessionId:extraId,playing:true}},res());
    assert.equal(worker.listenerPresent(ids[10]),true);
    await worker.tick();
    assert.deepEqual(requests,[ids[2],ids[3],ids[10]],
      'a listened station outside Top-10 is eligible for AI');
    assert.equal(used,3);

    await worker.tick();
    assert.equal(requests.length,3,'one attempt per five-minute station window');
    now+=5*60*1000+1000;
    await worker.tick();
    assert.equal(requests.length,3,'persistent daily limit prevents new paid calls');
    assert.equal(published,3);
    worker.heartbeat({body:{stationId:ids[3],sessionId:id,playing:false}},res());
    assert.equal(worker.listenerPresent(ids[3]),false,'stop event removes listening presence');
    assert.equal(worker.listenerPresent(ids[3],now+160000),false,'idle presence expires');
    assert.equal(worker.heartbeat({body:{stationId:ids[3],sessionId:'bad',playing:true}},res()).code,400);
    assert.equal(requests.includes(ids[10]),true,'an actively listened station outside Top-10 is recognized');
    console.log('Top-10 music priority, extra listened stations, heartbeat, 5-minute clock and daily cost cap passed.');
  }finally{
    Date.now=oldDateNow;
    for(const [k,v] of Object.entries(oldEnv))v===undefined?delete process.env[k]:process.env[k]=v;
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
