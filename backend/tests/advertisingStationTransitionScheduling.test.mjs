import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPaidTransitionScheduler,STATION_TRANSITION_GAP_MS,
 STATION_TRANSITION_RETRY_MS} from '../../frontend/src/utils/paidAudioStationTransitions.mjs';

const A='a'.repeat(24),B='b'.repeat(24),C='c'.repeat(24);
function harness(){
 let time=1000;
 const calls=[],failures=[];
 const scheduler=createPaidTransitionScheduler({
  now:()=>time,wait:async ms=>{assert.ok(ms>=0);time+=ms;},
  onFailure:value=>failures.push(value)
 });
 const request=async({stationId,sessionToken})=>{
  calls.push({stationId,sessionToken,at:time});
  return {ok:true,status:200,data:{stationId,sessionToken:'session-'+calls.length,
   count:calls.length,proof:'signed-'+calls.length}};
 };
 return {scheduler,request,calls,failures,now:()=>time};
}

test('two successful station transitions are spaced BEFORE each POST',async()=>{
 const t=harness();
 const first=await t.scheduler.register({stationId:A,request:t.request});
 const second=await t.scheduler.register({stationId:B,request:t.request});
 assert.equal(first.count,1);assert.equal(second.count,2);
 assert.equal(t.calls.length,2);
 assert.equal(t.calls[1].at-t.calls[0].at,STATION_TRANSITION_GAP_MS);
 assert.equal(t.calls[1].sessionToken,'session-1');
});
test('rapid zapping coalesces unstarted stale station intents',async()=>{
 const t=harness();let intent=1;
 const older=t.scheduler.register({stationId:A,isCurrent:()=>intent===1,request:t.request});
 intent=2;
 const newest=t.scheduler.register({stationId:C,isCurrent:()=>intent===2,request:t.request});
 assert.equal(await older,null);
 assert.equal((await newest).stationId,C);
 assert.deepEqual(t.calls.map(x=>x.stationId),[C]);
});
test('429 is retried with bounded cooldown, not in a request storm',async()=>{
 const t=harness();
 let attempts=0;
 const result=await t.scheduler.register({stationId:A,request:async details=>{
  attempts++;t.calls.push({at:t.now(),...details});
  return attempts===1?
   {ok:false,status:429,data:{error:'Station switch too fast'}}:
   {ok:true,status:200,data:{stationId:A,sessionToken:'approved',count:1,proof:'signed'}};
 }});
 assert.equal(result.count,1);assert.equal(attempts,2);
 assert.ok(t.calls[1].at-t.calls[0].at>=STATION_TRANSITION_RETRY_MS);
 assert.equal(t.failures.length,0);
});
test('persistent 429 stops after at most three attempts and never issues proof',async()=>{
 const t=harness();
 const result=await t.scheduler.register({stationId:A,request:async details=>{
  t.calls.push(details);
  return {ok:false,status:429,data:{error:'Station switch too fast'}};
 }});
 assert.equal(result,null);assert.equal(t.calls.length,3);
 assert.equal(t.failures.length,1);assert.equal(t.failures[0].status,429);
});
test('expired visitor sessions clear only the session token and retry once',async()=>{
 const t=harness();
 await t.scheduler.register({stationId:A,request:t.request});
 const tokens=[];
 const result=await t.scheduler.register({stationId:B,request:async details=>{
  tokens.push(details.sessionToken);
  return tokens.length===1?
   {ok:false,status:409,data:{error:'Listening session expired'}}:
   {ok:true,status:200,data:{stationId:B,sessionToken:'new',count:1,proof:'proof'}};
 }});
 assert.equal(result.count,1);
 assert.deepEqual(tokens,['session-1',null]);
});
test('network failures and long upstream rate bans fail closed',async()=>{
 const t=harness();
 assert.equal(await t.scheduler.register({stationId:A,request:async()=>{throw Error('offline')}}),null);
 assert.equal(t.failures[0].status,0);
 const blocked=await t.scheduler.register({stationId:B,request:async()=>({
  ok:false,status:429,retryAfterMs:60000,data:{error:'Too many requests'}
 })});
 assert.equal(blocked,null);assert.equal(t.failures.at(-1).status,429);
});
