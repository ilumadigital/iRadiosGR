'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const Module=require('node:module');
const target=path.resolve(__dirname,'../services/broadcasterPremiumUpgrade.js');
const service=require(target);
const ACCOUNT='507f1f77bcf86cd799438001';
const STATION='507f1f77bcf86cd799439011';
const OTHER='507f191e810c19729de860ea';
const ID='507f1f77bcf86cd799438002';
async function withDeps(overrides,fn){
 const native=Module._load;
 Module._load=function(request,parent,isMain){
  if(parent?.filename===target&&Object.prototype.hasOwnProperty.call(overrides,request))
   return overrides[request];
  return native.apply(this,arguments);
 };
 try{return await fn();}finally{Module._load=native;}
}
function row(sku='ADD-DSP',stationId=STATION,status='paid'){
 return {sku,resourceId:stationId,status,autoRenewRequested:true};
}
const paid={_id:ID,accountId:ACCOUNT,sku:'B-PREM',status:'paid',
 environment:'staging',scopeType:'account',resourceId:null};

test('paid addon and in-flight checkout targets are de-duplicated; unrelated orders ignored',()=>{
 const rows=[
  row(),row(),row('ADD-AN',OTHER,'unknown'),
  row('ADD-ADS',STATION,'redirect'),
  row('ADD-ADS',OTHER,'failed'),
  {...row('ADD-DSP',OTHER),autoRenewRequested:false},
  row('B-PREM',STATION,'paid'),
  row('ADD-DSP','wrong','paid')
 ];
 const result=service.targetsFromOrders(rows);
 assert.deepEqual(result.map(x=>x.sku+':'+x.stationId),[
  'ADD-DSP:'+STATION,'ADD-AN:'+OTHER,'ADD-ADS:'+STATION
 ]);
 assert.ok(result.every(x=>x.state==='pending'));
});

test('only a confirmed Premium payment can create a durable cancellation job',async()=>{
 let jobs=0;
 await withDeps({'./gatewayEnvironment':{mode:()=> 'staging'}},async()=>{
  for(const changed of [
   {...paid,status:'redirect'},
   {...paid,environment:'production'},
   {...paid,sku:'ADD-ADS'},
   {...paid,scopeType:'station'}
  ])await assert.rejects(service.ensurePaidUpgrade(changed));
 });
 assert.equal(jobs,0);
});

test('webhook retry persists a single job linked to the first paid Premium',async()=>{
 let job=null,creates=0;
 const originals=[row('ADD-DSP'),row('ADD-AN',OTHER,'unknown')];
 const Order={
  find:()=>({select(){return this;},limit(){return this;},lean:async()=>originals})
 };
 const Job={
  findOneAndUpdate:(_q,update)=>({
   lean:async()=>{
    if(!job){creates++;job={...update.$setOnInsert,items:update.$setOnInsert.items.map(x=>({...x}))};}
    return {...job};
   }
  })
 };
 const deps={'./gatewayEnvironment':{mode:()=> 'staging'},
  '../models/BroadcasterBillingOrder':Order,
  '../models/BroadcasterPremiumUpgrade':Job};
 await withDeps(deps,async()=>{
  const first=await service.ensurePaidUpgrade(paid);
  const again=await service.ensurePaidUpgrade(paid);
  assert.deepEqual(again.items,first.items);
  assert.equal(first.status,'pending');
  assert.equal(first.items.length,2);
 });
 assert.equal(creates,1);
});

test('addon cancellation is never a payment or provider MIT request',async()=>{
 let status='active',calls=0,open=false;
 const gateway={
  broadcasterRecurringStatus:async()=>({state:status}),
  cancelBroadcasterRecurring:async()=>{calls++;return {state:'cancelled'};},
  broadcasterCheckout:()=>{throw Error('No checkout allowed');}
 };
 const Order={exists:async()=>open};
 const item={sku:'ADD-DSP',stationId:STATION};
 const user={_id:ACCOUNT,role:'broadcaster'};
 assert.equal(await service.cancelTarget(item,user,'staging',{gateway,Order}),true);
 assert.equal(calls,1);
 status='cancelled';
 assert.equal(await service.cancelTarget(item,user,'staging',{gateway,Order}),true);
 assert.equal(calls,1);
 status='none';open=true;
 assert.equal(await service.cancelTarget(item,user,'staging',{gateway,Order}),false);
 open=false;
 assert.equal(await service.cancelTarget(item,user,'staging',{gateway,Order}),true);
 status='unavailable';
 await assert.rejects(service.cancelTarget(item,user,'staging',{gateway,Order}),/Mandate state unavailable/);
 assert.equal(calls,1);
});

test('pending cancellation is retried after Gateway outage and completes only on acknowledgement',async()=>{
 const now=new Date('2026-11-20T18:00:00Z');
 const job={_id:'507f1f77bcf86cd799438003',premiumOrderId:ID,
  accountId:ACCOUNT,environment:'staging',status:'pending',
  leaseUntil:new Date('2026-11-20T18:05:00Z'),
  items:[{sku:'ADD-DSP',stationId:STATION,state:'pending',checkedAt:null},
   {sku:'ADD-ADS',stationId:OTHER,state:'pending',checkedAt:null}]};
 const fakeJob={
  async updateOne(_filter,changes){
   const set=changes.$set;
   for(const [key,value] of Object.entries(set)){
    if(key.startsWith('items.')){
     const [,i,field]=key.split('.');
     job.items[Number(i)][field]=value;
    }else job[key]=value;
   }
   return {modifiedCount:1};
  },
  async exists(){return job.items.some(i=>i.state==='pending');}
 };
 const fakeOrder={
  findOne:()=>({select(){return this;},lean:async()=>paid}),
  exists:async()=>false
 };
 const fakeUser={
  findOne:()=>({select(){return this;},lean:async()=>({_id:ACCOUNT,role:'broadcaster'})})
 };
 let unavailable=true,calls=0;
 const fakeGateway={
  broadcasterRecurringStatus:async()=>unavailable
   ?{state:'unavailable'}:{state:'active'},
  cancelBroadcasterRecurring:async()=>{calls++;return {state:'cancelled'};}
 };
 const deps={
  './gatewayEnvironment':{mode:()=> 'staging'},
  '../models/BroadcasterBillingOrder':fakeOrder,
  '../models/BroadcasterPremiumUpgrade':fakeJob,
  '../models/User':fakeUser,
  './ilumaGatewayClient':fakeGateway
 };
 await withDeps(deps,async()=>{
  assert.equal(await service.processJob(job,now),0);
  assert.equal(job.status,'pending');
  assert.equal(calls,0);
  unavailable=false;
  assert.equal(await service.processJob(job,new Date(+now+61000)),2);
  assert.equal(job.status,'complete');
  assert.equal(calls,2);
  assert.equal(await service.processJob(job,new Date(+now+120000)),0);
  assert.equal(calls,2);
 });
});

test('production cancellation never uses staging contract identity',async()=>{
 const item={sku:'ADD-AN',stationId:STATION};
 let called=false;
 const gateway={broadcasterRecurringStatus:async()=>{called=true;return {state:'cancelled'};}};
 assert.equal(await service.cancelTarget(item,{_id:ACCOUNT},'production',
  {gateway,Order:{exists:async()=>false}}),true);
 assert.equal(called,true);
 const deps={'./gatewayEnvironment':{mode:()=> 'staging'}};
 await withDeps(deps,async()=>{
  await assert.rejects(service.ensurePaidUpgrade({...paid,environment:'production'}),
   /verified paid account Premium/);
 });
});
