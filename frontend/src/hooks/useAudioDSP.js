import {useCallback,useEffect,useRef,useState} from 'react';
import {createDSPGraph,applyDSPGraph,applyListenerMode,updateAdaptiveDSP,resetAdaptiveDSP,normalizeListenerMode,DSP_DEFAULTS,DSP_COMPRESSOR_DEFAULTS} from '../utils/dspEngine';

// Listener and broadcaster audition use the same processing rules. The audio
// element is attached only once; station changes reconfigure the existing graph.
export default function useAudioDSP(
  audioRef,currentStation,currentAdInfo,isPlayingAd,isMobile,currentUser,
  userOverrides={}
){
  const graphRef=useRef(null);
  const audioCtxRef=useRef(null);
  const analyserRef=useRef(null);
  const lastStationScopeRef=useRef('');
  const [isDspReady,setIsDspReady]=useState(false);

  const unsupportedDevice=(()=>{
    if(typeof navigator==='undefined')return true;
    const ua=navigator.userAgent;
    const ios=/iPad|iPhone|iPod/.test(ua)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    return ios||/Xbox|SMART-TV|Tizen|Web0S|WebOS|TV/.test(ua);
  })();

  const initDSP=useCallback(()=>{
    if(unsupportedDevice||graphRef.current)return;
    const audio=audioRef.current;
    if(!audio)return;
    try{
      // Existing /api/proxy-stream is same-origin and preserves the original
      // playback path; never fetch a third-party stream through the DSP UI.
      audio.crossOrigin='anonymous';
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      const ctx=new Ctx({latencyHint:'playback'});
      audioCtxRef.current=ctx;
      const source=ctx.createMediaElementSource(audio);
      graphRef.current=createDSPGraph(ctx,source);
      analyserRef.current=graphRef.current.afterPeak;
      setIsDspReady(true);
    }catch(error){
      console.error('[DSP] Audio graph unavailable',error);
    }
  },[audioRef,unsupportedDevice]);

  useEffect(()=>{
    const unlock=()=>{initDSP();};
    window.addEventListener('touchstart',unlock,{once:true});
    window.addEventListener('click',unlock,{once:true});
    return ()=>{
      window.removeEventListener('touchstart',unlock);
      window.removeEventListener('click',unlock);
    };
  },[initDSP]);

  const resumeDSP=useCallback(()=>{
    initDSP();
    const ctx=audioCtxRef.current;
    if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});
  },[initDSP]);

  useEffect(()=>{
    const graph=graphRef.current;
    if(!graph||!isDspReady)return;
    const nextScope=(currentStation?._id||'none')+':'+Boolean(isPlayingAd);
    if(lastStationScopeRef.current!==nextScope){
      resetAdaptiveDSP(graph);
      lastStationScopeRef.current=nextScope;
    }
    let preset='OFF',settings=DSP_DEFAULTS,compressor=DSP_COMPRESSOR_DEFAULTS,clipper,autoBalance=0;
    let personalMode='DEFAULT';
    if(isPlayingAd){
      // Never apply personal DSP to advertisements, regardless of Premium.
      preset=currentAdInfo?.dspPreset||'OFF';
    }else if(currentStation){
      preset=currentStation.dspPreset||'OFF';
      settings=currentStation.dspSettings||DSP_DEFAULTS;
      compressor=currentStation.dspCompressor||DSP_COMPRESSOR_DEFAULTS;
      clipper=currentStation.dspClipper;
      autoBalance=currentStation.dspAutoBalance||0;
      // Premium listener presets only touch this local WebAudio instance.
      // They neither write to Mongo nor alter what other listeners hear.
      if(currentUser?.isPremium===true){
        personalMode=normalizeListenerMode(userOverrides[String(currentStation._id)]);
      }
    }
    applyDSPGraph(graph,preset,settings,compressor,false,clipper,autoBalance);
    applyListenerMode(graph,personalMode);
  },[currentStation,isPlayingAd,currentAdInfo,currentUser,userOverrides,isDspReady]);

  // Adaptation is local to this player's AudioContext and never alters the
  // broadcaster's stored settings. Silence and paused streams are ignored.
  useEffect(()=>{
    if(!isDspReady)return;
    const interval=setInterval(()=>{
      const audio=audioRef.current,graph=graphRef.current;
      if(!audio||!graph||audio.paused||audio.ended||isPlayingAd)return;
      updateAdaptiveDSP(graph);
    },120);
    return()=>clearInterval(interval);
  },[audioRef,isDspReady,isPlayingAd]);

  const fadeAudio=useCallback((targetVolume,duration=1)=>{
    const graph=graphRef.current;
    if(!graph)return;
    const gain=graph.fade.gain;
    const now=graph.ctx.currentTime;
    const volume=Number.isFinite(Number(targetVolume))?
      Math.max(0,Math.min(1,Number(targetVolume))):1;
    try{
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value,now);
      gain.linearRampToValueAtTime(volume,now+Math.max(.001,duration));
    }catch{
      gain.value=volume;
    }
  },[]);
  const resetVolumeToZero=useCallback(()=>{
    const graph=graphRef.current;
    if(graph)graph.fade.gain.value=0;
  },[]);
  const setVolumeToOne=useCallback(()=>{
    const graph=graphRef.current;
    if(graph)graph.fade.gain.value=1;
  },[]);
  return {analyserRef,fadeAudio,resetVolumeToZero,setVolumeToOne,resumeDSP};
}
