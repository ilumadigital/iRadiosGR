'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStageListenerTracker}=require('../services/stageListeningMetrics');
const A='aaaaaaaaaaaaaaaaaaaaaaaa',B='bbbbbbbbbbbbbbbbbbbbbbbb';
const S='123e4567-e89b-42d3-a456-426614174000',T='123e4567-e89b-42d3-a456-426614174001';
function fixture(){
 let now=Date.UTC(2026,10,11,14,0),plays=0;const data=new Map();
 const Station={exists:async q=>q._id===A?{_id:A}:null,updateOne:async()=>{plays++;}};
 const StationAnalytics={findOneAndUpdate:async(q,update)=>{
   const row=data.get(q.stationId)||{};
   for(const [key,value] of Object.entries(update.$inc||{})){
     const segments=key.split('.');let node=row;
     while(segments.length>1){const part=segments.shift();node=node[part]||={};}
     const field=segments[0];node[field]=(node[field]||0)+value;
   }
   data.set(q.stationId,row);
 }};
 const tracker=createStageListenerTracker({Station,StationAnalytics,clock:()=>now});
 return {tracker,data,plays:()=>plays,move:ms=>{now+=ms;}};
}
test('Rejects bad payload and unknown station before collection',async()=>{
 const f=fixture();
 assert.equal(await f.tracker.report({stationId:'invalid',sessionId:S,playing:true}),400);
 assert.equal(await f.tracker.report({stationId:B,sessionId:S,playing:true}),404);
 assert.equal(f.tracker.liveCount(),0);assert.equal(f.data.size,0);
});
test('Concurrent starts, duplicate heartbeats and repeated stops are idempotent',async()=>{
 const f=fixture();
 const report=playing=>f.tracker.report({stationId:A,sessionId:S,playing});
 assert.deepEqual(await Promise.all([report(true),report(true)]),[204,204]);
 assert.equal(f.tracker.liveCount(),1);
 assert.equal(f.data.get(A).totalSessions,1);assert.equal(f.plays(),1);
 assert.equal(await f.tracker.report({stationId:B,sessionId:S,playing:true}),409);
 f.move(60000);await report(true);await report(true);
 assert.equal(f.data.get(A).totalListenTime,60);
 f.move(15000);await report(false);
 assert.equal(f.data.get(A).totalListenTime,75);
 assert.equal(f.tracker.liveCount(),0);
 await report(false);await report(true);
 assert.equal(f.data.get(A).totalSessions,1);
});
test('Expired sessions do not invent listening seconds or cross-station counts',async()=>{
 const f=fixture();
 await f.tracker.report({stationId:A,sessionId:S,playing:true});
 f.move(91000);assert.equal(f.tracker.liveCount(),0);
 assert.equal(f.data.get(A).totalListenTime||0,0);
 await f.tracker.report({stationId:A,sessionId:S,playing:true});
 assert.equal(f.data.get(A).totalSessions,1);
 await f.tracker.report({stationId:A,sessionId:T,playing:true});
 assert.equal(f.tracker.liveCount([A]),1);
 assert.equal(f.tracker.liveCount([B]),0);
});
test('Storage failure cannot produce live session, retry can recover',async()=>{
 let failed=true;const tracker=createStageListenerTracker({
 Station:{exists:async()=>({}),updateOne:async()=>{}},
 StationAnalytics:{findOneAndUpdate:async()=>{if(failed)throw Error('offline');}}
 });
 const payload={stationId:A,sessionId:S,playing:true};
 await assert.rejects(()=>tracker.report(payload),/offline/);
 assert.equal(tracker.liveCount(),0);
 failed=false;assert.equal(await tracker.report(payload),204);
 assert.equal(tracker.liveCount(),1);
});
