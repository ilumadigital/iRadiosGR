// One transparent WebAudio engine is used by public playback and live preview.
// Optional, oversampled soft clipper at the master stage; no forced hard limiter.
// OFF and explicit BYPASS route the original stream around ALL DSP nodes.
// These are broadcaster MODES, not listener sound presets. Historical
// station values are interpreted as FM_MODE until the broadcaster saves.
export const DSP_MODES=Object.freeze({
  OFF:{label:'OFF',input:1,hpf:10,lpf:22000,threshold:0,ratio:1,knee:0,attack:.045,release:.34,makeup:1},
  ENHANCER:{label:'Enhancer',input:1,hpf:12,lpf:22000,threshold:0,ratio:1,knee:0,attack:.045,release:.34,makeup:1},
  FM_MODE:{label:'FM Mode',input:.91,hpf:25,lpf:19800,threshold:-18,ratio:2.1,knee:18,attack:.045,release:.34,makeup:1},
  AUTO_MODE:{label:'Auto Mode',input:1,hpf:18,lpf:21000,threshold:-17,ratio:1.7,knee:18,attack:.028,release:.36,makeup:1}
});
export const DSP_PRESETS=DSP_MODES; // Internal compatibility export; no legacy preset UI.
const OLD_PRESET_KEYS=new Set(['SOFT','NORMALIZE','ULTRABAND','ULTRA','OMNIA','0DB_LEVELER']);
export function normalizeBroadcasterMode(value){
  if(Object.hasOwn(DSP_MODES,value))return value;
  return OLD_PRESET_KEYS.has(value)?'FM_MODE':'OFF';
}
// Personal listening presets never persist on a station; these are local
// playback choices scoped to an authenticated Premium listener.
export const LISTENER_MODES=Object.freeze({
  DEFAULT:{label:'Default',description:'Ο ήχος που έχει επιλέξει ο σταθμός'},
  SONOS:{label:'SONOS',description:'Ήπια EQ, καθαρά mids και 110% stereo'},
  DOLBY_STYLE:{label:'Dolby Style',description:'Stereo-compatible virtual surround, phantom center'},
  VMAX:{label:'VMax',description:'Αυτόματη στάθμη ανά σταθμό · peak ceiling −0.2 dBFS'},
  OFF:{label:'OFF',description:'Πλήρες raw bypass, ανεξάρτητο από το WebDSP'}
});
export function normalizeListenerMode(value){
  return Object.hasOwn(LISTENER_MODES,value)?value:'DEFAULT';
}
export const DSP_DEFAULTS=Object.freeze({bass:0,mid:0,treble:0,output:0,stereoWidth:100});
export const DSP_RANGES=Object.freeze({
  bass:[-12,12],mid:[-12,12],treble:[-12,12],output:[-7,7],stereoWidth:[0,150]
});
export const DSP_COMPRESSOR_DEFAULTS=Object.freeze({
  mode:'preset',threshold:-18,ratio:2.1,attack:.045,release:.34,makeup:0
});
export const DSP_COMPRESSOR_RANGES=Object.freeze({
  threshold:[-42,0],ratio:[1,8],attack:[.003,.2],release:[.08,1.2],makeup:[-6,6]
});
// Meter warning only: this is NOT a fixed processing threshold or a limiter.
export const DSP_CLIPPER_DEFAULTS=Object.freeze({
  ENHANCER:Object.freeze({headroomEnabled:true,level:0}),
  FM_MODE:Object.freeze({headroomEnabled:true,level:0})
});
export const PEAK_WARNING_DBFS=-.4;
export const HEADROOM_CEILING_DBFS=-0.5;
export const VMAX_CEILING_DBFS=-0.2;
export const normalizeAutoBalance=value=>
  Number.isInteger(value)?Math.max(-100,Math.min(100,value)):0;
export const dbToGain=db=>10**(db/20);
const gainToDb=gain=>20*Math.log10(Math.max(1e-12,gain));

export function normalizeDSPSettings(settings){
  const result={...DSP_DEFAULTS};
  if(!settings||typeof settings!=='object')return result;
  for(const [key,[min,max]] of Object.entries(DSP_RANGES)){
    if(typeof settings[key]==='number'&&Number.isFinite(settings[key]))
      result[key]=Math.max(min,Math.min(max,settings[key]));
  }
  return result;
}
export function normalizeDSPCompressor(settings){
  const result={...DSP_COMPRESSOR_DEFAULTS};
  if(!settings||typeof settings!=='object')return result;
  if(['preset','manual','off'].includes(settings.mode))result.mode=settings.mode;
  for(const [key,[min,max]] of Object.entries(DSP_COMPRESSOR_RANGES)){
    if(typeof settings[key]==='number'&&Number.isFinite(settings[key]))
      result[key]=Math.max(min,Math.min(max,settings[key]));
  }
  return result;
}
export function normalizeDSPClipper(value){
  const modes={ENHANCER:{...DSP_CLIPPER_DEFAULTS.ENHANCER},
    FM_MODE:{...DSP_CLIPPER_DEFAULTS.FM_MODE}};
  if(!value||typeof value!=='object')return modes;
  for(const mode of ['ENHANCER','FM_MODE']){
    const config=value[mode];
    if(!config||typeof config!=='object')continue;
    // Legacy station documents can contain headroomEnabled:false.
    // Keep the persisted shape for API compatibility, but never allow OFF.
    modes[mode].headroomEnabled=true;
    if(Number.isInteger(config.level)&&config.level>=0&&config.level<=8)
      modes[mode].level=config.level;
  }
  return modes;
}

// An optional soft knee at a -0.5 dBFS nominal sample ceiling, with
// a progressively earlier knee from 1 to 8. 0 is a true audio bypass.
// This is not a true-peak limiter and cannot repair clipped source audio.
export function createSoftClipCurve(level){
  if(!Number.isInteger(level)||level<1||level>8)return null;
  const ceiling=dbToGain(-.5),knee=.94-level*.0375;
  const travel=ceiling-knee;
  const samples=8192,curve=new Float32Array(samples);
  for(let i=0;i<samples;i++){
    const x=2*i/(samples-1)-1,amp=Math.abs(x);
    const compressed=amp<=knee?amp:knee+travel*Math.tanh((amp-knee)/travel);
    curve[i]=Math.sign(x)*compressed;
  }
  return curve;
}
export function compressorForPreset(preset){
  const p=DSP_MODES[normalizeBroadcasterMode(preset)];
  return {mode:'preset',threshold:p.threshold,ratio:p.ratio,attack:p.attack,
    release:p.release,makeup:Number(gainToDb(p.makeup).toFixed(2))};
}
export function resolvedCompressor(preset,settings){
  const c=normalizeDSPCompressor(settings);
  if(c.mode==='off')return {...c,threshold:0,ratio:1,makeup:0};
  if(c.mode==='preset')return {...c,...compressorForPreset(preset)};
  return c;
}

// Headroom is a mandatory PEAK CEILING for Enhancer and FM Mode, not a gain cut.
// Never read the historic headroomEnabled boolean as a bypass command. Modes
// OFF and explicit full-preview BYPASS still preserve the original raw stream.
// Normal-level samples pass at unity gain; only near-full-scale peaks are shaped.
export function calculateHeadroomDb(preset,_settings,_compressor,_legacyClipperSettings){
  return normalizeBroadcasterMode(preset)==='OFF'?0:HEADROOM_CEILING_DBFS;
}
export function createPeakCeilingCurve(targetDbfs=HEADROOM_CEILING_DBFS){
  const ceiling=dbToGain(targetDbfs);
  // Normal levels remain at unity; a smooth knee softens only high peaks.
  const knee=Math.min(.9,ceiling-.064),travel=ceiling-knee,curve=new Float32Array(8192);
  for(let i=0;i<curve.length;i++){
    const x=2*i/(curve.length-1)-1,amplitude=Math.abs(x);
    const shaped=amplitude<=knee?amplitude:
      knee+travel*Math.tanh((amplitude-knee)/travel);
    curve[i]=Math.sign(x)*Math.min(shaped,ceiling);
  }
  return curve;
}
// A silence gate and a capped gain range prevent runaway automatic boosting.
export function calculateAdaptiveGainDb(peakDb,targetDb=-1.1,maxBoostDb=14){
  if(!Number.isFinite(peakDb)||peakDb< -52)return null;
  return Math.max(-16,Math.min(maxBoostDb,targetDb-peakDb));
}
export function autoStereoWidth(balance){
  return 100+(normalizeAutoBalance(balance)+100)*.125; // 100..125%
}
const setAudioParam=(param,value,ctx)=>{
  const at=ctx.currentTime;
  param.cancelScheduledValues(at);
  param.setTargetAtTime(value,at,.012);
};
const filter=(ctx,type,frequency)=>{
  const node=ctx.createBiquadFilter();node.type=type;node.frequency.value=frequency;return node;
};

// Separate dry path means even filters with a non-unity response do not touch
// OFF/BYPASS audio. A short fade prevents clicks when switching paths.
export function createDSPGraph(ctx,source){
  const dry=ctx.createGain(),wet=ctx.createGain(),mix=ctx.createGain();
  const input=ctx.createGain(),highpass=filter(ctx,'highpass',10);
  const lowpass=filter(ctx,'lowpass',22000);
  const compressor=ctx.createDynamicsCompressor();
  const compressorDry=ctx.createGain(),compressorWet=ctx.createGain();
  const compressorMix=ctx.createGain();
  const makeup=ctx.createGain();
  const bass=filter(ctx,'lowshelf',180);
  const mid=filter(ctx,'peaking',1300);mid.Q.value=.8;
  const treble=filter(ctx,'highshelf',4300);
  const upmix=ctx.createGain();upmix.channelCount=2;upmix.channelCountMode='explicit';
  const split=ctx.createChannelSplitter(2);
  const ll=ctx.createGain(),rl=ctx.createGain(),lr=ctx.createGain(),rr=ctx.createGain();
  const merge=ctx.createChannelMerger(2);
  const output=ctx.createGain(),autoProbe=ctx.createAnalyser();
  const autoGain=ctx.createGain(),beforePeak=ctx.createAnalyser();
  const headroom=ctx.createGain(),fade=ctx.createGain();
  const clipper=ctx.createWaveShaper(),clipperDrive=ctx.createGain(),clipperDry=ctx.createGain();
  const clipperWet=ctx.createGain(),clipperMix=ctx.createGain();
  const postPeak=ctx.createAnalyser();
  const peakCeiling=ctx.createWaveShaper(),peakCeilingDry=ctx.createGain();
  const peakCeilingWet=ctx.createGain(),peakCeilingMix=ctx.createGain();
  clipper.oversample='4x';
  peakCeiling.oversample='4x';
  peakCeiling.curve=createPeakCeilingCurve();
  // Second, listener-only stage: Default passes Broadcaster audio unchanged;
  // OFF selects the original source before Broadcaster processing.
  const listenerRaw=ctx.createGain(),listenerDefault=ctx.createGain();
  const listenerWet=ctx.createGain(),listenerMix=ctx.createGain();
  const listenerBass=filter(ctx,'lowshelf',150);
  const listenerMid=filter(ctx,'peaking',1600);listenerMid.Q.value=.85;
  const listenerTreble=filter(ctx,'highshelf',4700);
  const listenerComp=ctx.createDynamicsCompressor();
  const listenerMakeup=ctx.createGain(),listenerHeadroom=ctx.createGain();
  const listenerProbe=ctx.createAnalyser(),listenerAutoGain=ctx.createGain();
  const listenerVmaxCeiling=ctx.createWaveShaper(),listenerVmaxDry=ctx.createGain();
  const listenerVmaxWet=ctx.createGain(),listenerVmaxMix=ctx.createGain();
  listenerVmaxCeiling.oversample='4x';
  listenerVmaxCeiling.curve=createPeakCeilingCurve(VMAX_CEILING_DBFS);
  const listenerUpmix=ctx.createGain();
  listenerUpmix.channelCount=2;listenerUpmix.channelCountMode='explicit';
  const listenerSplit=ctx.createChannelSplitter(2);
  const userLL=ctx.createGain(),userLR=ctx.createGain(),userRL=ctx.createGain(),userRR=ctx.createGain();
  const listenerMerge=ctx.createChannelMerger(2);
  const afterPeak=ctx.createAnalyser();
  autoProbe.fftSize=4096;autoProbe.smoothingTimeConstant=0;
  listenerProbe.fftSize=4096;listenerProbe.smoothingTimeConstant=0;
  beforePeak.fftSize=2048;beforePeak.smoothingTimeConstant=0;
  postPeak.fftSize=2048;postPeak.smoothingTimeConstant=0;
  afterPeak.fftSize=2048;afterPeak.smoothingTimeConstant=0;

  source.connect(dry);
  dry.connect(mix);
  source.connect(input);
  input.connect(highpass);
  highpass.connect(lowpass);
  // Enhancer must be an actual compressor bypass, not just ratio=1.
  lowpass.connect(compressorDry);
  compressorDry.connect(compressorMix);
  lowpass.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(compressorWet);
  compressorWet.connect(compressorMix);
  compressorMix.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(upmix);
  upmix.connect(split);
  split.connect(ll,0);split.connect(lr,0);
  split.connect(rl,1);split.connect(rr,1);
  ll.connect(merge,0,0);rl.connect(merge,0,0);
  lr.connect(merge,0,1);rr.connect(merge,0,1);
  merge.connect(output);
  output.connect(autoProbe);
  autoProbe.connect(autoGain);
  autoGain.connect(beforePeak);
  beforePeak.connect(headroom);
  headroom.connect(clipperDry);clipperDry.connect(clipperMix);
  headroom.connect(clipperDrive);clipperDrive.connect(clipper);
  clipper.connect(clipperWet);
  clipperWet.connect(clipperMix);
  // Keep the peak ceiling LAST in the station master chain, after the Clipper.
  // An off switch truly bypasses this stage; it never applies forced reduction.
  clipperMix.connect(peakCeilingDry);peakCeilingDry.connect(peakCeilingMix);
  clipperMix.connect(peakCeiling);peakCeiling.connect(peakCeilingWet);
  peakCeilingWet.connect(peakCeilingMix);
  peakCeilingMix.connect(postPeak);postPeak.connect(wet);
  wet.connect(mix);
  source.connect(listenerRaw);listenerRaw.connect(listenerMix);
  mix.connect(listenerDefault);listenerDefault.connect(listenerMix);
  mix.connect(listenerBass);
  listenerBass.connect(listenerMid);
  listenerMid.connect(listenerTreble);
  listenerTreble.connect(listenerComp);
  listenerComp.connect(listenerMakeup);
  listenerMakeup.connect(listenerUpmix);
  listenerUpmix.connect(listenerSplit);
  listenerSplit.connect(userLL,0);listenerSplit.connect(userLR,0);
  listenerSplit.connect(userRL,1);listenerSplit.connect(userRR,1);
  userLL.connect(listenerMerge,0,0);userRL.connect(listenerMerge,0,0);
  userLR.connect(listenerMerge,0,1);userRR.connect(listenerMerge,0,1);
  listenerMerge.connect(listenerHeadroom);
  listenerHeadroom.connect(listenerProbe);listenerProbe.connect(listenerAutoGain);
  listenerAutoGain.connect(listenerVmaxDry);listenerVmaxDry.connect(listenerVmaxMix);
  listenerAutoGain.connect(listenerVmaxCeiling);
  listenerVmaxCeiling.connect(listenerVmaxWet);listenerVmaxWet.connect(listenerVmaxMix);
  listenerVmaxMix.connect(listenerWet);listenerWet.connect(listenerMix);
  listenerMix.connect(fade);
  fade.connect(afterPeak);
  afterPeak.connect(ctx.destination);

  const graph={ctx,source,dry,wet,mix,input,highpass,lowpass,compressor,
    compressorDry,compressorWet,compressorMix,
    makeup,bass,mid,treble,upmix,split,ll,rl,lr,rr,merge,output,autoProbe,autoGain,
    beforePeak,headroom,clipperDrive,clipper,clipperDry,clipperWet,clipperMix,
    peakCeiling,peakCeilingDry,peakCeilingWet,peakCeilingMix,postPeak,
    fade,afterPeak,setting:{...DSP_DEFAULTS},
    listenerRaw,listenerDefault,listenerWet,listenerMix,listenerBass,
    listenerMid,listenerTreble,listenerComp,listenerMakeup,listenerUpmix,listenerSplit,
    userLL,userLR,userRL,userRR,listenerMerge,listenerHeadroom,
    listenerProbe,listenerAutoGain,listenerVmaxCeiling,listenerVmaxDry,listenerVmaxWet,listenerVmaxMix,
    compressorSettings:{...DSP_COMPRESSOR_DEFAULTS},
    clipperSettings:normalizeDSPClipper(),clipperLevel:0,preset:'OFF',headroomDb:0,
    autoBalance:0,autoGainDb:0,autoPeakDb:-120,listenerGainDb:0,listenerPeakDb:-120,
    listenerMode:'DEFAULT'};
  dry.gain.value=1;wet.gain.value=0;headroom.gain.value=1;
  clipperDry.gain.value=1;clipperWet.gain.value=0;clipperDrive.gain.value=1;
  peakCeilingDry.gain.value=1;peakCeilingWet.gain.value=0;
  autoGain.gain.value=1;listenerAutoGain.gain.value=1;
  listenerVmaxDry.gain.value=1;listenerVmaxWet.gain.value=0;
  listenerRaw.gain.value=0;listenerDefault.gain.value=1;
  listenerWet.gain.value=0;listenerHeadroom.gain.value=1;
  applyDSPGraph(graph,'OFF',DSP_DEFAULTS);
  applyListenerMode(graph,'DEFAULT');
  return graph;
}

// All controls update the same graph instantly, preserving the user's manual
// Compressor settings while changing the EQ, width or preset.
export function applyDSPGraph(graph,preset,settings,compressorSettings,bypass=false,clipperSettings,autoBalance=0){

  if(!graph)return;
  const ctx=graph.ctx;
  const key=normalizeBroadcasterMode(preset);
  const p=DSP_MODES[key],automatic=key==='AUTO_MODE';
  const s=automatic?{...DSP_DEFAULTS,bass:.6,treble:.5}:normalizeDSPSettings(settings);
  const c=normalizeDSPCompressor(compressorSettings);
  const resolved=automatic?
    {threshold:p.threshold,ratio:p.ratio,knee:p.knee,attack:p.attack,release:p.release,makeup:0}:
    resolvedCompressor(key,c);
  const useDynamics=automatic||(key==='FM_MODE'&&c.mode!=='off');
  const nextBalance=normalizeAutoBalance(autoBalance);
  if(graph.preset!==key||graph.autoBalance!==nextBalance||bypass){
    graph.autoGainDb=0;graph.autoPeakDb=-120;
    setAudioParam(graph.autoGain.gain,1,ctx);
  }
  graph.autoBalance=nextBalance;
  graph.preset=key;graph.setting=s;graph.compressorSettings=c;
  graph.clipperSettings=normalizeDSPClipper(clipperSettings);
  const isDry=bypass||key==='OFF';
  setAudioParam(graph.dry.gain,isDry?1:0,ctx);
  setAudioParam(graph.wet.gain,isDry?0:1,ctx);
  setAudioParam(graph.input.gain,p.input,ctx);
  setAudioParam(graph.highpass.frequency,p.hpf,ctx);
  setAudioParam(graph.lowpass.frequency,Math.min(p.lpf,ctx.sampleRate*.48),ctx);
  setAudioParam(graph.compressorDry.gain,useDynamics?0:1,ctx);
  setAudioParam(graph.compressorWet.gain,useDynamics?1:0,ctx);
  setAudioParam(graph.compressor.threshold,useDynamics?resolved.threshold:0,ctx);
  setAudioParam(graph.compressor.ratio,useDynamics?resolved.ratio:1,ctx);
  setAudioParam(graph.compressor.knee,useDynamics?p.knee:0,ctx);
  setAudioParam(graph.compressor.attack,resolved.attack,ctx);
  setAudioParam(graph.compressor.release,resolved.release,ctx);
  setAudioParam(graph.makeup.gain,useDynamics?dbToGain(resolved.makeup):1,ctx);
  setAudioParam(graph.bass.gain,s.bass,ctx);
  setAudioParam(graph.mid.gain,s.mid,ctx);
  setAudioParam(graph.treble.gain,s.treble,ctx);
  setAudioParam(graph.output.gain,dbToGain(s.output),ctx);
  const width=(automatic?autoStereoWidth(graph.autoBalance):s.stereoWidth)/100;
  setAudioParam(graph.ll.gain,(1+width)/2,ctx);
  setAudioParam(graph.rr.gain,(1+width)/2,ctx);
  setAudioParam(graph.rl.gain,(1-width)/2,ctx);
  setAudioParam(graph.lr.gain,(1-width)/2,ctx);
  // headroomDb is the ceiling displayed to the broadcaster, not attenuation.
  graph.headroomDb=isDry?0:calculateHeadroomDb(key,s,c,graph.clipperSettings);
  setAudioParam(graph.headroom.gain,1,ctx);
  // Never switch off peak protection for either active broadcaster DSP mode.
  const ceilingOn=!isDry;
  setAudioParam(graph.peakCeilingDry.gain,ceilingOn?0:1,ctx);
  setAudioParam(graph.peakCeilingWet.gain,ceilingOn?1:0,ctx);
  const level=isDry||automatic?0:(graph.clipperSettings[key]?.level||0);
  if(level>0&&graph.clipperLevel!==level)graph.clipper.curve=createSoftClipCurve(level);
  graph.clipperLevel=level;
  setAudioParam(graph.clipperDrive.gain,dbToGain(level),ctx);
  setAudioParam(graph.clipperDry.gain,level>0?0:1,ctx);
  setAudioParam(graph.clipperWet.gain,level>0?1:0,ctx);
  if(!automatic||isDry){
    graph.autoGainDb=0;graph.autoPeakDb=-120;
    setAudioParam(graph.autoGain.gain,1,ctx);
  }
}


// Personal presets are applied exclusively AFTER the station's audio engine.
// The WebAudio output is stereo-compatible with both 2.1 and 5.1 playback
// systems; Dolby Style does not encode/decode Dolby Digital or create a genuine
// discrete 5.1 signal. Width is deliberately gentle to preserve mono playback.
const LISTENER_CURVES=Object.freeze({
  SONOS:{bass:.8,mid:-.7,treble:.5,width:110,threshold:0,ratio:1,knee:0,attack:.04,release:.3,makeup:0,trim:-3.2},
  DOLBY_STYLE:{bass:.6,mid:1.1,treble:.5,width:116,threshold:0,ratio:1,knee:0,attack:.04,release:.3,makeup:0,trim:-4.0},
  VMAX:{bass:.3,mid:0,treble:.4,width:103,threshold:-17,ratio:2.4,knee:16,attack:.026,release:.34,makeup:0,trim:0}
});
export function applyListenerMode(graph,choice='DEFAULT'){
  if(!graph)return;
  const mode=normalizeListenerMode(choice),ctx=graph.ctx;
  if(graph.listenerMode!==mode){
    graph.listenerGainDb=0;graph.listenerPeakDb=-120;
    setAudioParam(graph.listenerAutoGain.gain,1,ctx);
  }
  graph.listenerMode=mode;
  const raw=mode==='OFF',direct=mode==='DEFAULT';
  setAudioParam(graph.listenerRaw.gain,raw?1:0,ctx);
  setAudioParam(graph.listenerDefault.gain,direct?1:0,ctx);
  setAudioParam(graph.listenerWet.gain,raw||direct?0:1,ctx);
  setAudioParam(graph.listenerVmaxDry.gain,mode==='VMAX'?0:1,ctx);
  setAudioParam(graph.listenerVmaxWet.gain,mode==='VMAX'?1:0,ctx);
  if(mode!=='VMAX'){
    graph.listenerGainDb=0;graph.listenerPeakDb=-120;
    setAudioParam(graph.listenerAutoGain.gain,1,ctx);
  }
  const config=LISTENER_CURVES[mode]||LISTENER_CURVES.SONOS;
  setAudioParam(graph.listenerBass.gain,config.bass,ctx);
  setAudioParam(graph.listenerMid.gain,config.mid,ctx);
  setAudioParam(graph.listenerTreble.gain,config.treble,ctx);
  setAudioParam(graph.listenerComp.threshold,config.threshold,ctx);
  setAudioParam(graph.listenerComp.ratio,config.ratio,ctx);
  setAudioParam(graph.listenerComp.knee,config.knee,ctx);
  setAudioParam(graph.listenerComp.attack,config.attack,ctx);
  setAudioParam(graph.listenerComp.release,config.release,ctx);
  setAudioParam(graph.listenerMakeup.gain,dbToGain(config.makeup),ctx);
  const w=config.width/100;
  setAudioParam(graph.userLL.gain,(1+w)/2,ctx);
  setAudioParam(graph.userRR.gain,(1+w)/2,ctx);
  setAudioParam(graph.userRL.gain,(1-w)/2,ctx);
  setAudioParam(graph.userLR.gain,(1-w)/2,ctx);
  // Worst-case positive EQ and widening boost are budgeted before output.
  // VMax aims for a lively, near-full-scale perceived level; no hard clipper,
  // gain above 0 dBFS, codec-dependent true-peak guarantee or forced limiter.
  const peaks=Math.max(0,config.bass)+Math.max(0,config.mid)+
    Math.max(0,config.treble)+Math.max(0,20*Math.log10(w))+
    Math.max(0,config.makeup);
  // VMax uses post-EQ stream measurements, not a static -4 dB trim.
  // An independent -0.2 dBFS waveshaper is after adaptive gain.
  const net=mode==='VMAX'?peaks:Math.min(-.8,config.trim+peaks);
  graph.listenerHeadroomDb=net-peaks;
  setAudioParam(graph.listenerHeadroom.gain,dbToGain(graph.listenerHeadroomDb),ctx);
}

// Called only while audio is playing by the shared player/prelisten loops.
// The pre-gain peak is held briefly so boost does not chase its own output.
export function updateAdaptiveDSP(graph){
  if(!graph)return;
  const ctx=graph.ctx;
  const update=(probe,key,peakKey,param,target,maxBoost)=>{
    if(!graph[key+'Samples']||graph[key+'Samples'].length!==probe.fftSize)
      graph[key+'Samples']=new Float32Array(probe.fftSize);
    const instantaneous=measurePeakDbfs(probe,graph[key+'Samples']);
    if(instantaneous< -52)return; // silence gate: no runaway boosting
    graph[peakKey]=Math.max(instantaneous,
      Number.isFinite(graph[peakKey])?graph[peakKey]-.18:instantaneous);
    const desired=calculateAdaptiveGainDb(graph[peakKey],target,maxBoost);
    if(desired===null)return;
    graph[key]=desired;
    const now=ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(dbToGain(desired),now,desired<gainToDb(param.value)? .06:1.15);
  };
  if(graph.preset==='AUTO_MODE'&&graph.wet.gain.value>.5){
    const loudnessFocus=-Math.min(0,graph.autoBalance)/100;
    update(graph.autoProbe,'autoGainDb','autoPeakDb',graph.autoGain.gain,
      -1.6+loudnessFocus*.5,12+loudnessFocus*2);
  }
  if(graph.listenerMode==='VMAX'&&graph.listenerWet.gain.value>.5)
    update(graph.listenerProbe,'listenerGainDb','listenerPeakDb',
      graph.listenerAutoGain.gain,-.9,14);
}

export function measurePeakDbfs(analyser,buffer){
  if(!analyser||!buffer)return -120;
  analyser.getFloatTimeDomainData(buffer);
  let peak=0;
  for(let i=0;i<buffer.length;i++)peak=Math.max(peak,Math.abs(buffer[i]));
  return peak?Math.max(-120,20*Math.log10(peak)):-120;
}
