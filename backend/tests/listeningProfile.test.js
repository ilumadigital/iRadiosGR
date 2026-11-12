'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const categories=require('../utils/stationCategories');

const src=fs.readFileSync(path.join(__dirname,'../controllers/listeningProfileController.js'),'utf8');
const calls=[];
const fakeUser={
  findById:()=>({select:()=>({lean:async()=>({_id:'a',listeningPreferences:{}})})}),
  updateOne:async(...args)=>{calls.push(args);return {modifiedCount:1};}
};
const sandbox={module:{exports:{}},console,Date,Object,Number,
  require:name=>name==='../models/User'?fakeUser:name==='../utils/stationCategories'?categories:null};
vm.runInNewContext(src,sandbox,{filename:'listeningProfileController.js'});
const {normalizeSnapshot,getProfile,putProfile,clearProfile}=sandbox.module.exports;
const id='aaaaaaaaaaaaaaaaaaaaaaaa';
const valid={deviceId:'dev_12345678',stations:{
  [id]:{seconds:1200,sessions:2,lastPlayedAt:Date.now()}
},categories:{Dance:2}};

test('bounded valid cumulative device snapshot',()=>{
  const result=normalizeSnapshot(valid);
  assert.ok(result);
  assert.equal(result.stations[id].seconds,1200);
  assert.equal(result.categories.Dance,2);
  assert.ok(result.updatedAt instanceof Date);
});
test('refuses invalid devices, categories, station ids, durations and oversized data',()=>{
  assert.equal(normalizeSnapshot({...valid,deviceId:'..$set'}),null);
  assert.equal(normalizeSnapshot({...valid,categories:{'__proto__':1,Random:1}}),null);
  assert.equal(normalizeSnapshot({...valid,stations:{'not-an-id':{seconds:1,sessions:0,lastPlayedAt:1}}}),null);
  assert.equal(normalizeSnapshot({...valid,stations:{[id]:{seconds:999999999,sessions:0,lastPlayedAt:1}}}),null);
  assert.equal(normalizeSnapshot({...valid,stations:{[id]:{seconds:1,sessions:0,lastPlayedAt:Date.now()+90000000}}}),null);
  const stations={};
  for(let i=0;i<81;i++)stations[i.toString(16).padStart(24,'0')]={seconds:0,sessions:0,lastPlayedAt:0};
  assert.equal(normalizeSnapshot({...valid,stations}),null);
});
test('PUT is scoped to authenticated user and one validated device subpath',async()=>{
  const req={user:{_id:'logged-in-user'},body:valid};
  const result={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
  await putProfile(req,result);
  assert.equal(result.statusCode,200);
  assert.equal(result.body.ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0][0]._id,'logged-in-user');
  assert.ok(calls[0][1].$set['listeningPreferences.dev_12345678']);
});
test('GET and clear operate only on the authenticated user',async()=>{
  const req={user:{_id:'logged-in-user'}};
  const res={status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
  await getProfile(req,res);assert.ok(res.body.devices);
  await clearProfile(req,res);assert.equal(res.body.ok,true);
  assert.equal(calls.at(-1)[0]._id,'logged-in-user');
});
