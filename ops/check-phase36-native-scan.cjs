'use strict';
const assert=require('node:assert/strict');
const Module=require('node:module');
const oldLoad=Module._load;
const initialEnv={
  APP_ENV:process.env.APP_ENV,STAGE_ENABLE_NATIVE_SCANNER:process.env.STAGE_ENABLE_NATIVE_SCANNER
};
const stations=Array.from({length:175},(_,i)=>({
  _id:(i+1).toString(16).padStart(24,'0'),
  name:'Station '+i,stream:'https://radio.example/'+i,status:'approved'
}));
const readCalls=[],queries=[];
const Station={
  find:query=>({
    select:fields=>{
      assert.ok(fields.includes('metadata'));
      return {sort:sort=>{
        assert.equal(sort._id,1);
        return {limit:n=>({lean:async()=>{
          queries.push(query);
          return stations.filter(s=>!query._id||s._id>query._id.$gt).slice(0,n);
        }})};
      }};
    }
  })
};
let scanner;
try{
  Module._load=function(name,parent,isMain){
    if(parent?.filename?.endsWith('stageNativeScanner.js')){
      if(name==='mongoose')return {connection:{readyState:1}};
      if(name==='../models/Station')return Station;
      if(name==='./stageMetadata')return {
        readCachedNativeMetadata:async station=>{
          readCalls.push(String(station._id));return 'Artist - Track';
        }
      };
    }
    return oldLoad.call(this,name,parent,isMain);
  };
  scanner=require('../backend/utils/stageNativeScanner');
}finally{Module._load=oldLoad;}
async function run(){
  try{
    process.env.APP_ENV='staging';
    delete process.env.STAGE_ENABLE_NATIVE_SCANNER;
    assert.equal(scanner.EVERY_MS,2*60*1000,'free native scan scheduled every two minutes');
    assert.equal(scanner.CONCURRENCY,20);
    assert.equal(scanner.PER_PASS,160,'bounded egress');
    const first=await scanner.tick();
    assert.equal(first.scanned,160);
    assert.equal(new Set(readCalls).size,160);
    const second=await scanner.tick();
    assert.equal(second.scanned,15,'round-robin must reach last non-Top radio');
    assert.equal(new Set(readCalls).size,175,'all approved radios scanned across two cycles');
    const third=await scanner.tick();
    assert.equal(third.scanned,160,'catalog cursor wraps around without starvation');
    assert.equal(readCalls.length,335);
    assert.equal(queries[1]._id.$gt,stations[159]._id);
    assert.equal(queries[2]._id.$gt,stations[174]._id);
    assert.equal(queries[3]._id,undefined);
    const before=readCalls.length;
    process.env.STAGE_ENABLE_NATIVE_SCANNER='0';
    assert.equal((await scanner.tick()).skipped,true,'operator can pause scans');
    process.env.STAGE_ENABLE_NATIVE_SCANNER='1';
    process.env.APP_ENV='production';
    assert.equal((await scanner.tick()).skipped,true,'production cannot start this staging worker');
    assert.equal(readCalls.length,before);
    console.log('Phase 3.6: every-two-minute bounded native scan, full round-robin coverage and staging isolation passed.');
  }finally{
    for(const [key,value] of Object.entries(initialEnv))
      value===undefined?delete process.env[key]:process.env[key]=value;
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
