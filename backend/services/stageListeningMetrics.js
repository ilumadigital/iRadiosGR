'use strict';

// Anonymous, browser-reported playback sessions. This does not inspect streams,
// send identity or geo data, or call any paid metadata/recognition provider.
// Only confirmed playback heartbeats count. They are estimates, not verified
// Icecast listener statistics. Storage is bounded, and duplicate/replayed
// heartbeats cannot increment sessions or duration twice in this process.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID=/^[0-9a-f]{24}$/i;
const IDLE_MS=90_000;
const MAX_SESSIONS=20_000;
const CLOSED_MS=10*60_000;

function utcDay(time){ return new Date(time).toISOString().slice(0,10); }

function createStageListenerTracker({Station,StationAnalytics,clock=Date.now}){
  const sessions=new Map();
  const closed=new Map();
  function prune(now=clock()){
    for(const [id,session] of sessions){
      if(now-session.lastSeen>IDLE_MS && !session.busy){
        sessions.delete(id);
        closed.set(id,now+CLOSED_MS);
      }
    }
    for(const [id,expiresAt] of closed)if(expiresAt<=now)closed.delete(id);
    // Prevent the closed-session cache from growing without bound on abuse.
    while(closed.size>MAX_SESSIONS)closed.delete(closed.keys().next().value);
  }
  function liveCount(stationIds){
    prune();
    const allowed=stationIds?new Set(stationIds.map(String)):null;
    let count=0;
    for(const session of sessions.values()){
      if(session.ready&&(!allowed||allowed.has(session.stationId)))count++;
    }
    return count;
  }
  async function report({stationId,sessionId,playing}={}){
    if(typeof stationId!=='string'||!OBJECT_ID.test(stationId)||
       typeof sessionId!=='string'||!UUID.test(sessionId)||
       typeof playing!=='boolean')return 400;
    const now=clock();
    prune(now);
    const sid=stationId.toLowerCase();
    const key=sessionId.toLowerCase();
    const session=sessions.get(key);
    if(session&&session.stationId!==sid)return 409;
    if(closed.has(key))return 204;

    if(!session){
      if(!playing)return 204;
      if(sessions.size>=MAX_SESSIONS)return 429;
      // Reserve the session BEFORE the first await. Two concurrent requests
      // with the same UUID may otherwise both increment totalSessions.
      const pending={stationId:sid,lastSeen:now,busy:true,ready:false};
      sessions.set(key,pending);
      try{
        const station=await Station.exists({_id:sid,status:'approved',isOffline:{$ne:true}});
        if(!station){sessions.delete(key);return 404;}
        await StationAnalytics.findOneAndUpdate({stationId:sid},
          {$inc:{totalSessions:1,['daily.'+utcDay(now)+'.sessions']:1}},
          {upsert:true,setDefaultsOnInsert:true});
      }catch(error){
        sessions.delete(key);
        throw error;
      }
      pending.ready=true;
      pending.busy=false;
      // Legacy station plays are a secondary presentation counter. A failure
      // must not retry the already committed listening session increment.
      try{
        await Station.updateOne({_id:sid},{$inc:{plays:1}});
      }catch(error){console.error('[LISTENING] Station plays increment failed',error);}
      return 204;
    }

    // Concurrent or rapid duplicate heartbeat requests cannot bill seconds twice.
    if(session.busy)return 204;
    const elapsed=now-session.lastSeen;
    if(playing&&elapsed<1000)return 204;
    session.busy=true;
    try{
      // A stopped/hidden browser may not have played all the time since its
      // last heartbeat. Never extrapolate across a missed heartbeat window.
      const seconds=elapsed>=0&&elapsed<=IDLE_MS?Math.floor(elapsed/1000):0;
      if(seconds>0){
        await StationAnalytics.findOneAndUpdate({stationId:sid},
          {$inc:{totalListenTime:seconds,
            ['daily.'+utcDay(now)+'.listenSeconds']:seconds}},
          {upsert:true,setDefaultsOnInsert:true});
      }
      session.lastSeen=now;
      if(!playing){
        sessions.delete(key);
        closed.set(key,now+CLOSED_MS);
      }
      return 204;
    }finally{
      session.busy=false;
    }
  }
  return {report,liveCount,prune};
}

module.exports={createStageListenerTracker,utcDay};
