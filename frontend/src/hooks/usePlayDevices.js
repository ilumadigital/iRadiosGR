import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import io from 'socket.io-client';

// Each installed PWA and browser profile has its own opaque, persistent ID.
// No hardware fingerprint and no link to push subscription identifiers.
const uuid=()=>crypto.randomUUID();
export function localConnectId(){
  const app=window.matchMedia?.('(display-mode: standalone)')?.matches||
    window.navigator.standalone===true;
  const key=app?'iradios_connect_app_v1':'iradios_connect_browser_v1';
  let id=localStorage.getItem(key);
  if(!/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(id||'')){
    id=uuid();localStorage.setItem(key,id);
  }
  return id;
}
const nameFrom=(brand,model,os)=>[brand,model].filter(Boolean).join(' ').trim()||os||'Συσκευή';
function detectDevice(){
  const ua=navigator.userAgent||'';
  const app=window.matchMedia?.('(display-mode: standalone)')?.matches||
    navigator.standalone===true;
  const clientType=app?'app':'browser';
  let deviceType='desktop',brand='',model='',os='Windows PC',browser='Browser';
  if(/SamsungBrowser/i.test(ua))browser='Samsung Internet';
  else if(/Edg\//i.test(ua))browser='Edge';
  else if(/Firefox|FxiOS/i.test(ua))browser='Firefox';
  else if(/OPR\/|Opera/i.test(ua))browser='Opera';
  else if(/CriOS|Chrome/i.test(ua))browser='Chrome';
  else if(/Safari/i.test(ua))browser='Safari';
  if(/iPhone/i.test(ua)){deviceType='mobile';brand='Apple';model='iPhone';os='iOS';}
  else if(/iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){
    deviceType='tablet';brand='Apple';model='iPad';os='iPadOS';
  }else if(/Tizen|SMART-TV|SmartTV|Web0S|WebOS|VIDAA|HbbTV|BRAVIA|NetCast|Android TV|GoogleTV/i.test(ua)){
    deviceType='tv';os='Smart TV';
    if(/Tizen|Samsung/i.test(ua))brand='Samsung';
    else if(/Web0S|WebOS|NetCast|LG Electronics/i.test(ua))brand='LG';
    else if(/VIDAA|Hisense/i.test(ua))brand='Hisense';
    else if(/BRAVIA|Sony/i.test(ua))brand='Sony';
    model='Smart TV';
  }else if(/PlayStation|Nintendo|Xbox/i.test(ua)){
    deviceType='console';brand=/PlayStation/i.test(ua)?'Sony':/Nintendo/i.test(ua)?'Nintendo':'Microsoft';
    model=/PlayStation 5/i.test(ua)?'PlayStation 5':/PlayStation 4/i.test(ua)?'PlayStation 4':/Nintendo/i.test(ua)?'Switch':'Xbox';os='Console';
  }else if(/Android/i.test(ua)){
    deviceType=/Mobile/i.test(ua)?'mobile':'tablet';os='Android';
    // Android model hints are often suppressed. Never invent an OEM.
    const build=ua.match(/;\s*([^;()]{2,60})\s+Build\//i);
    const candidate=build?.[1]?.trim()||'';
    if(/^(SM-|SAMSUNG|GT-|Galaxy)/i.test(candidate))brand='Samsung';
    else if(/^(Pixel)/i.test(candidate))brand='Google';
    else if(/^(Redmi|POCO|Mi |Xiaomi)/i.test(candidate))brand='Xiaomi';
    else if(/^(HUAWEI|HONOR)/i.test(candidate))brand=/^HONOR/i.test(candidate)?'Honor':'Huawei';
    else if(/^(OnePlus)/i.test(candidate))brand='OnePlus';
    if(brand)model=candidate;
  }else if(/Macintosh|Mac OS X/i.test(ua)){os='macOS';brand='Apple';model='Mac';}
  else if(/Windows/i.test(ua)){os='Windows PC';}
  else if(/Linux/i.test(ua)){os='Linux PC';}
  else{os='Computer';}
  const displayName=nameFrom(brand,model,os).slice(0,120);
  return {deviceType,brand,model,os,browser,clientType,displayName};
}
const errorNames={
  DEVICE_OFFLINE:'Η συσκευή είναι offline.',STATION_UNAVAILABLE:'Ο σταθμός δεν είναι διαθέσιμος.',
  NOT_REGISTERED:'Δεν έχει ολοκληρωθεί η σύνδεση της συσκευής.',
  LEASE_REVOKED:'Η αναπαραγωγή έχει μεταφερθεί σε άλλη συσκευή.',
  DEVICE_REVOKED:'Η συσκευή έχει αφαιρεθεί από τον λογαριασμό.',
  CONNECT_UNAVAILABLE:'Η σύνδεση iRadios Connect δεν είναι διαθέσιμη.',
  TIMEOUT:'Η σύνδεση με τις συσκευές καθυστέρησε. Δοκίμασε ξανά.',
  NO_ACTIVE_PLAYBACK:'Δεν υπάρχει συνδεδεμένη συσκευή αναπαραγωγής.',
  PLAYBACK_CHANGED:'Η αναπαραγωγή άλλαξε. Δοκίμασε ξανά.',
  CONTROL_FAILED:'Δεν ολοκληρώθηκε ο απομακρυσμένος χειρισμός.',
  PREMIUM_REQUIRED:'Ο συγχρονισμένος χειρισμός απαιτεί Listener Premium.'
};
export const connectError=error=>errorNames[error]||'Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.';
export default function usePlayDevices({currentUser,onRemotePlay,onRemoteStop,
  onRemotePause,onRemoteResume,onRemoteStation}){
  const localDeviceId=useMemo(localConnectId,[]);
  const [availableDevices,setAvailableDevices]=useState([]);
  const [connected,setConnected]=useState(false);
  const socketRef=useRef(null);
  const leaseRef=useRef(null); // {token,stationId,issuedAt}
  const transferRef=useRef(null);
  const callbacksRef=useRef({onRemotePlay,onRemoteStop,onRemotePause,onRemoteResume,onRemoteStation});
  callbacksRef.current={onRemotePlay,onRemoteStop,onRemotePause,onRemoteResume,onRemoteStation};
  const premiumRef=useRef(false);
  premiumRef.current=currentUser?.role==='user'&&currentUser?.isPremium===true;
  const ack=useCallback((event,payload={})=>new Promise(resolve=>{
    const socket=socketRef.current;
    if(!socket?.connected)return resolve({ok:false,error:'CONNECT_UNAVAILABLE'});
    socket.timeout(7500).emit(event,payload,(err,response)=>{
      if(err)return resolve({ok:false,error:'TIMEOUT'});
      resolve(response||{ok:false,error:'UNKNOWN'});
    });
  }),[]);
  const requestDevices=useCallback(async()=>{
    const result=await ack('connect:list');
    if(result.ok&&Array.isArray(result.devices))setAvailableDevices(result.devices);
    return result;
  },[ack]);
  useEffect(()=>{
    if(!currentUser?._id&&!currentUser?.id){
      socketRef.current?.disconnect();
      socketRef.current=null;setConnected(false);setAvailableDevices([]);
      leaseRef.current=null;transferRef.current=null;return;
    }
    const jwt=localStorage.getItem('iluma_token');
    if(!jwt)return;
    const socket=io(window.location.origin,{path:'/api/connect.io',auth:{token:jwt},
      transports:['websocket','polling'],reconnection:true,reconnectionDelay:1000,
      reconnectionDelayMax:8000,timeout:9000});
    socketRef.current=socket;
    let live=true;
    const register=async()=>{
      const payload={deviceId:localDeviceId,...detectDevice()};
      const data=await ack('connect:register',payload);
      if(!live)return;
      if(data.error==='DEVICE_REVOKED'){
        localStorage.removeItem(payload.clientType==='app'?
          'iradios_connect_app_v1':'iradios_connect_browser_v1');
        window.location.reload();
        return;
      }
      if(data.ok){
        setConnected(true);
        void requestDevices();
        // Upgrade the model name when Chromium provides a high-entropy hint.
        try{
          if(navigator.userAgentData?.getHighEntropyValues){
            const hints=await navigator.userAgentData.getHighEntropyValues(['model']);
            if(hints.model&&payload.deviceType!=='desktop'){
              const hint=String(hints.model).slice(0,90).replace(/[<>]/g,'');
              if(hint&&hint!==payload.model){
                const next={...payload,model:hint,displayName:
                  nameFrom(payload.brand,hint,payload.os).slice(0,120)};
                if(live&&socket.connected)void ack('connect:register',next);
              }
            }
          }
        }catch{/* UA-CH is optional and privacy-gated. */}
      }
    };
    const stop=()=>{
      leaseRef.current=null;transferRef.current=null;
      callbacksRef.current.onRemoteStop?.();
    };
    const onPlay=payload=>{
      const stationId=payload?.stationId;
      if(typeof stationId!=='string')return;
      leaseRef.current=payload.token?{token:payload.token,stationId,issuedAt:Date.now(),started:false}:null;
      transferRef.current=payload.transferId||null;
      callbacksRef.current.onRemotePlay?.(stationId);
    };
    const onCommand=payload=>{
      const active=leaseRef.current;
      if(!active?.token||payload?.token!==active.token)return;
      if(payload.action==='pause'){
        callbacksRef.current.onRemotePause?.();
      }else if(payload.action==='resume'){
        callbacksRef.current.onRemoteResume?.(payload.stationId);
      }else if(payload.action==='station'&&typeof payload.stationId==='string'){
        // Preserve ownership on the receiving device when a different device
        // changes the radio station. No second local stream is created.
        leaseRef.current={...active,stationId:payload.stationId,
          issuedAt:Date.now(),started:!payload.shouldPlay};
        callbacksRef.current.onRemoteStation?.(payload.stationId,payload.shouldPlay);
      }
    };
    const onConnect=()=>{void register();};
    const onDisconnect=()=>{
      setConnected(false);
      if(premiumRef.current)stop();
    };
    socket.on('connect',onConnect);
    socket.on('connect:devices',rows=>{
      if(Array.isArray(rows)&&live)setAvailableDevices(rows);
    });
    socket.on('connect:play',onPlay);
    socket.on('connect:command',onCommand);
    socket.on('connect:stop',stop);
    socket.on('connect:forget',()=>{
      localStorage.removeItem(
        window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone
          ?'iradios_connect_app_v1':'iradios_connect_browser_v1');
      stop();socket.disconnect();setConnected(false);
      window.location.reload();
    });
    socket.on('disconnect',onDisconnect);
    const heartbeat=setInterval(()=>{
      if(!socket.connected)return;
      void ack('connect:ping');
      const lease=leaseRef.current;
      if(premiumRef.current&&lease?.token&&lease.started){
        void ack('connect:renew',{token:lease.token}).then(result=>{
          if(!result.ok && leaseRef.current?.token===lease.token)stop();
        });
      }
    },10000);
    const onFocus=()=>{if(socket.connected)void requestDevices();};
    window.addEventListener('focus',onFocus);
    return ()=>{
      live=false;clearInterval(heartbeat);
      window.removeEventListener('focus',onFocus);
      socket.disconnect();
      if(socketRef.current===socket)socketRef.current=null;
      leaseRef.current=null;transferRef.current=null;setConnected(false);
    };
  },[currentUser?._id,currentUser?.id,localDeviceId,ack,requestDevices]);
  const acquirePlayback=useCallback(async stationId=>{
    if(!premiumRef.current)return true;
    const existing=leaseRef.current;
    if(existing?.stationId===stationId &&
       (existing.started || Date.now()-existing.issuedAt<23000))
      return true; // Already authorized on the active playback-owner socket.
    if(existing?.token && existing?.started && existing.stationId!==stationId){
      // Updating a radio on its actual owner is NOT a device transfer.
      const changed=await ack('connect:control',{action:'station',stationId});
      if(!changed.ok)return false;
      leaseRef.current={...existing,stationId,issuedAt:Date.now(),started:false};
      return true;
    }
    const result=await ack('connect:acquire',{stationId});
    if(!result.ok)return false;
    leaseRef.current=result.premium&&result.token?
      {token:result.token,stationId,issuedAt:Date.now(),started:false}:null;
    transferRef.current=null;
    return true;
  },[ack]);
  const startedPlayback=useCallback(async(stationId)=>{
    const transferId=transferRef.current;
    if(transferId)transferRef.current=null;
    const token=leaseRef.current?.token;
    if(!token&&!transferId&&!stationId)return;
    const result=await ack('connect:started',token?{token,stationId}:{transferId,stationId});
    if(token&&leaseRef.current?.token===token){
      if(result.ok)leaseRef.current={...leaseRef.current,started:true};
      else if(result.error!=='STALE_PLAYBACK_EVENT'){
        leaseRef.current=null;callbacksRef.current.onRemoteStop?.();
      }
    }
  },[ack]);
  const controlPlayback=useCallback(async(action,stationId)=>{
    if(!premiumRef.current)return {ok:false,error:'PREMIUM_REQUIRED'};
    return ack('connect:control',action==='station'?{action,stationId}:{action});
  },[ack]);
  const reportPlaybackBlocked=useCallback(()=>{
    const token=leaseRef.current?.token;
    if(token)void ack('connect:blocked',{token});
  },[ack]);
  const releasePlayback=useCallback(()=>{
    const token=leaseRef.current?.token;
    leaseRef.current=null;transferRef.current=null;
    void ack('connect:release',token?{token}:{});
  },[ack]);
  const transferPlayback=useCallback(async(targetDeviceId,stationId)=>
    ack('connect:transfer',{targetDeviceId,stationId}),[ack]);
  const renameDevice=useCallback(async(deviceId,displayName)=>
    ack('connect:rename',{deviceId,displayName}),[ack]);
  const forgetDevice=useCallback(async(deviceId)=>
    ack('connect:forget',{deviceId}),[ack]);
  return {availableDevices,localDeviceId,connected,requestDevices,acquirePlayback,
    startedPlayback,releasePlayback,transferPlayback,renameDevice,forgetDevice,
    controlPlayback,reportPlaybackBlocked};
}
