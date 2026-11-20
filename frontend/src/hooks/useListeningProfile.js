import {useCallback,useEffect,useMemo,useRef,useState} from 'react';

const STATION_ID=/^[a-f\d]{24}$/i;
const EMPTY=()=>({stations:{},categories:{}});
const storageKey=accountId=>'iradios_listening_profile_v1:'+accountId;
const validCount=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
function sanitizeSnapshot(snapshot){
  const data=EMPTY();
  for(const [id,entry] of Object.entries(snapshot?.stations||{}).slice(0,80)){
    if(!STATION_ID.test(id))continue;
    data.stations[id]={
      seconds:Math.min(31_536_000,validCount(entry?.seconds)),
      sessions:Math.min(100_000,validCount(entry?.sessions)),
      lastPlayedAt:Math.min(Date.now(),validCount(entry?.lastPlayedAt))
    };
  }
  for(const [category,count] of Object.entries(snapshot?.categories||{}).slice(0,80)){
    if(category.length<=80)data.categories[category]=Math.min(20,validCount(count));
  }
  return data;
}
function mergeSameDevice(first,second){
  const a=sanitizeSnapshot(first),b=sanitizeSnapshot(second),result=EMPTY();
  for(const id of new Set([...Object.keys(a.stations),...Object.keys(b.stations)])){
    const left=a.stations[id]||{},right=b.stations[id]||{};
    result.stations[id]={
      seconds:Math.max(left.seconds||0,right.seconds||0),
      sessions:Math.max(left.sessions||0,right.sessions||0),
      lastPlayedAt:Math.max(left.lastPlayedAt||0,right.lastPlayedAt||0)
    };
  }
  for(const label of new Set([...Object.keys(a.categories),...Object.keys(b.categories)])){
    result.categories[label]=Math.max(a.categories[label]||0,b.categories[label]||0);
  }
  return sanitizeSnapshot(result);
}
function combineDevices(own,others){
  const result=sanitizeSnapshot(own);
  for(const remote of Object.values(others)){
    const snapshot=sanitizeSnapshot(remote.stations?remote:remote?.snapshot||{});
    for(const [id,entry] of Object.entries(snapshot.stations)){
      const current=result.stations[id]||{seconds:0,sessions:0,lastPlayedAt:0};
      result.stations[id]={
        seconds:Math.min(31_536_000,current.seconds+entry.seconds),
        sessions:Math.min(100_000,current.sessions+entry.sessions),
        lastPlayedAt:Math.max(current.lastPlayedAt,entry.lastPlayedAt)
      };
    }
    for(const [label,count] of Object.entries(snapshot.categories)){
      result.categories[label]=Math.min(100,(result.categories[label]||0)+count);
    }
  }
  return result;
}
const localRead=key=>{
  try{return sanitizeSnapshot(JSON.parse(localStorage.getItem(storageKey(key))||'{}'));}
  catch{return EMPTY();}
};
const localWrite=(key,snapshot)=>{
  try{localStorage.setItem(storageKey(key),JSON.stringify(sanitizeSnapshot(snapshot)));}catch{}
};
function getDeviceId(){
  try{
    let id=localStorage.getItem('iluma_device_id');
    if(!id||!/^dev_[a-z\d_-]{2,60}$/i.test(id)){
      id='dev_'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2));
      localStorage.setItem('iluma_device_id',id);
    }
    return id;
  }catch{return 'dev_session';}
}

// Only live radio playback counts, never a loading/buffering stream or an ad.
// Anonymous profiles stay local. Signed-in accounts sync bounded cumulative
// per-device snapshots (idempotent retries; no personal data in station metrics).
export default function useListeningProfile({
  API_URL,currentUser,currentStation,isPlaying,isBuffering,isPlayingAd,audioRef
}){
  const userId=String(currentUser?._id||currentUser?.id||'');
  const accountId=userId||'guest';
  const deviceId=useMemo(getDeviceId,[]);
  const own=useRef(EMPTY());
  const otherDevices=useRef({});
  const revision=useRef(0);
  const dirty=useRef(false);
  const accountRef=useRef('');
  const bufferingRef=useRef(isBuffering);
  bufferingRef.current=isBuffering;
  const [profile,setProfile]=useState(EMPTY);
  const publish=useCallback(()=>setProfile(combineDevices(own.current,otherDevices.current)),[]);
  const persist=useCallback(()=>{
    localWrite(accountId,own.current);
    revision.current++;
    dirty.current=true;
  },[accountId]);

  useEffect(()=>{
    let cancelled=false;
    accountRef.current=accountId;
    otherDevices.current={};
    own.current=localRead(accountId);
    dirty.current=false;
    publish();
    if(!userId)return()=>{cancelled=true;};
    const token=localStorage.getItem('iluma_token');
    if(!token)return()=>{cancelled=true;};
    fetch(API_URL+'/users/me/listening-profile',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      .then(res=>res.ok?res.json():null)
      .then(data=>{
        if(cancelled||accountRef.current!==accountId||!data?.devices)return;
        const devices=data.devices;
        own.current=mergeSameDevice(own.current,devices[deviceId]);
        localWrite(accountId,own.current);
        const others={...devices};
        delete others[deviceId];
        otherDevices.current=others;
        publish();
      }).catch(()=>{/* Local recommendations remain available offline. */});
    return()=>{cancelled=true;};
  },[userId,accountId,deviceId,API_URL,publish]);

  const sync=useCallback(()=>{
    if(!userId||!dirty.current||accountRef.current!==accountId)return;
    const token=localStorage.getItem('iluma_token');
    if(!token)return;
    const currentRevision=revision.current;
    const body=JSON.stringify({deviceId,...sanitizeSnapshot(own.current)});
    dirty.current=false;
    fetch(API_URL+'/users/me/listening-profile',{
      method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body,keepalive:true
    }).then(res=>{
      if(!res.ok||revision.current!==currentRevision)dirty.current=true;
    }).catch(()=>{dirty.current=true;});
  },[API_URL,userId,accountId,deviceId]);

  useEffect(()=>{
    const timer=setInterval(sync,30000);
    const onLeave=()=>sync();
    window.addEventListener('pagehide',onLeave);
    return()=>{clearInterval(timer);window.removeEventListener('pagehide',onLeave);sync();};
  },[sync]);

  const stationId=String(currentStation?._id||'');
  useEffect(()=>{
    if(!STATION_ID.test(stationId)||!isPlaying||isPlayingAd)return;
    let listened=0,countedSession=false,lastTick=Date.now(),ticks=0;
    const timer=setInterval(()=>{
      const now=Date.now();
      const elapsed=Math.min(6,Math.floor((now-lastTick)/1000));
      lastTick=now;
      const audio=audioRef.current;
      if(!elapsed||bufferingRef.current||!audio||audio.paused||audio.readyState<2)return;
      listened+=elapsed;
      const next=sanitizeSnapshot(own.current);
      const previous=next.stations[stationId]||{seconds:0,sessions:0,lastPlayedAt:0};
      previous.seconds=Math.min(31_536_000,previous.seconds+elapsed);
      if(listened>=30&&!countedSession){countedSession=true;previous.sessions++;}
      previous.lastPlayedAt=now;
      next.stations[stationId]=previous;
      // Retain the most recently listened 80 stations, bounded in storage.
      const newest=Object.entries(next.stations).sort((a,b)=>b[1].lastPlayedAt-a[1].lastPlayedAt).slice(0,80);
      own.current={...next,stations:Object.fromEntries(newest)};
      persist();
      ticks++;
      if(ticks%3===0||countedSession&&listened<35)publish();
    },5000);
    return()=>{clearInterval(timer);publish();};
  },[stationId,isPlaying,isPlayingAd,accountId,audioRef,persist,publish]);

  const recordCategorySelection=useCallback(label=>{
    if(!label||typeof label!=='string'||label.length>80)return;
    const next=sanitizeSnapshot(own.current);
    next.categories[label]=Math.min(20,(next.categories[label]||0)+1);
    own.current=next;
    persist();
    publish();
  },[persist,publish]);
  return {listeningProfile:profile,recordCategorySelection};
}
