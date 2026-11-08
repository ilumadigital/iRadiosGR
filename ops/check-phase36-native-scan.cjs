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
    assert.equal(scanner.EVERY_MS,60*1000,'free native scan scheduled every minute');
    assert.equal(scanner.CONCURRENCY,20);
    assert.equal(scanner.PER_PASS,256,'bounded one-minute station batch');
    const first=await scanner.tick();
    assert.equal(first.scanned,175);
    assert.equal(new Set(readCalls).size,175,'all 175 approved radios scanned in the first minute');
    const second=await scanner.tick();
    assert.equal(second.scanned,175,'every station scanned again the following minute');
    const third=await scanner.tick();
    assert.equal(third.scanned,175,'catalog cursor wraps without starvation');
    assert.equal(readCalls.length,525);
    assert.equal(queries[1]._id.$gt,stations[174]._id);
    assert.equal(queries[2]._id,undefined);
    assert.equal(queries[3]._id.$gt,stations[174]._id);
    assert.equal(queries[4]._id,undefined);
    const before=readCalls.length;
    process.env.STAGE_ENABLE_NATIVE_SCANNER='0';
    assert.equal((await scanner.tick()).skipped,true,'operator can pause scans');
    process.env.STAGE_ENABLE_NATIVE_SCANNER='1';
    process.env.APP_ENV='production';
    assert.equal((await scanner.tick()).skipped,true,'production cannot start this staging worker');
    assert.equal(readCalls.length,before);
    console.log('Phase 3.6: one-minute bounded native scan, 175-station coverage and staging isolation passed.');
  }finally{
    for(const [key,value] of Object.entries(initialEnv))
      value===undefined?delete process.env[key]:process.env[key]=value;
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
