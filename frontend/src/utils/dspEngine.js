// One transparent WebAudio engine is used by public playback and live preview.
// No forced master compressor, limiter, saturation or WaveShaper.
// OFF and explicit BYPASS route the original stream around ALL DSP nodes.
export const DSP_PRESETS=Object.freeze({
  OFF: {label:'DSP Off',input:1,hpf:10,lpf:22000,threshold:0,ratio:1,knee:0,attack:.03,release:.3,makeup:1},
  SOFT: {label:'Soft · Acoustic / Jazz',input:.92,hpf:24,lpf:20000,threshold:-17,ratio:1.7,knee:18,attack:.07,release:.42,makeup:1.04},
  NORMALIZE: {label:'Normalize · General Radio',input:.90,hpf:24,lpf:19800,threshold:-18,ratio:2.1,knee:15,attack:.045,release:.34,makeup:1.06},
  ULTRABAND: {label:'Ultraband',input:.87,hpf:27,lpf:19000,threshold:-19,ratio:2.5,knee:14,attack:.03,release:.31,makeup:1.07},
  ULTRA: {label:'Ultra',input:.85,hpf:30,lpf:18500,threshold:-20,ratio:2.8,knee:13,attack:.022,release:.28,makeup:1.08},
  OMNIA: {label:'Omnia',input:.83,hpf:32,lpf:19000,threshold:-20,ratio:3,knee:12,attack:.018,release:.30,makeup:1.08},
  '0DB_LEVELER': {label:'0 dB Leveler',input:.86,hpf:25,lpf:19700,threshold:-18,ratio:2.3,knee:20,attack:.08,release:.48,makeup:1.06}
});
export const DSP_DEFAULTS=Object.freeze({bass:0,mid:0,treble:0,output:0,stereoWidth:100});
export const DSP_RANGES=Object.freeze({
  bass:[-12,12],mid:[-12,12],treble:[-12,12],output:[-12,3],stereoWidth:[0,150]
});
export const DSP_COMPRESSOR_DEFAULTS=Object.freeze({
  mode:'preset',threshold:-18,ratio:2.1,attack:.045,release:.34,makeup:0
});
export const DSP_COMPRESSOR_RANGES=Object.freeze({
  threshold:[-42,0],ratio:[1,8],attack:[.003,.2],release:[.08,1.2],makeup:[-6,6]
});
// Meter warning only: this is NOT a fixed processing threshold or a limiter.
export const PEAK_WARNING_DBFS=-1;
export const HEADROOM_RESERVE_DB=3;
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
export function compressorForPreset(preset){
  const p=DSP_PRESETS[preset]||DSP_PRESETS.OFF;
  return {mode:'preset',threshold:p.threshold,ratio:p.ratio,attack:p.attack,
    release:p.release,makeup:Number(gainToDb(p.makeup).toFixed(2))};
}
export function resolvedCompressor(preset,settings){
  const c=normalizeDSPCompressor(settings);
  if(c.mode==='off')return {...c,threshold:0,ratio:1,makeup:0};
  if(c.mode==='preset')return {...c,...compressorForPreset(preset)};
  return c;
}

// Conservative, deterministic automatic gain staging. This is a plain GainNode,
// not a threshold-triggered limiter: the EQ shape, stereo image and compression
// remain unchanged. Reserve space for boosts before samples reach the DAC.
// No gain is ever added by the safety calculation.
export function calculateHeadroomDb(preset,settings,compressor){
  if(preset==='OFF'||!Object.hasOwn(DSP_PRESETS,preset))return 0;
  const p=DSP_PRESETS[preset],s=normalizeDSPSettings(settings);
  const c=resolvedCompressor(preset,compressor);
  const compressorMakeup=c.mode==='off'?0:c.makeup;
  const eqBoost=Math.max(0,s.bass)+Math.max(0,s.mid)+Math.max(0,s.treble);
  const widthBoost=s.stereoWidth>100?20*Math.log10(s.stereoWidth/100):0;
  const baseGain=gainToDb(p.input)+s.output+compressorMakeup;
  const possibleBoost=Math.max(0,baseGain+eqBoost+widthBoost);
  return -(HEADROOM_RESERVE_DB+possibleBoost);
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
  const makeup=ctx.createGain();
  const bass=filter(ctx,'lowshelf',180);
  const mid=filter(ctx,'peaking',1300);mid.Q.value=.8;
  const treble=filter(ctx,'highshelf',4300);
  const upmix=ctx.createGain();upmix.channelCount=2;upmix.channelCountMode='explicit';
  const split=ctx.createChannelSplitter(2);
  const ll=ctx.createGain(),rl=ctx.createGain(),lr=ctx.createGain(),rr=ctx.createGain();
  const merge=ctx.createChannelMerger(2);
  const output=ctx.createGain(),beforePeak=ctx.createAnalyser();
  const headroom=ctx.createGain(),fade=ctx.createGain();
  const afterPeak=ctx.createAnalyser();
  beforePeak.fftSize=2048;beforePeak.smoothingTimeConstant=0;
  afterPeak.fftSize=2048;afterPeak.smoothingTimeConstant=0;

  source.connect(dry);
  dry.connect(mix);
  source.connect(input);
  input.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(upmix);
  upmix.connect(split);
  split.connect(ll,0);split.connect(lr,0);
  split.connect(rl,1);split.connect(rr,1);
  ll.connect(merge,0,0);rl.connect(merge,0,0);
  lr.connect(merge,0,1);rr.connect(merge,0,1);
  merge.connect(output);
  output.connect(beforePeak);
  beforePeak.connect(headroom);
  headroom.connect(wet);
  wet.connect(mix);
  mix.connect(fade);
  fade.connect(afterPeak);
  afterPeak.connect(ctx.destination);

  const graph={ctx,source,dry,wet,mix,input,highpass,lowpass,compressor,
    makeup,bass,mid,treble,upmix,split,ll,rl,lr,rr,merge,output,
    beforePeak,headroom,fade,afterPeak,setting:{...DSP_DEFAULTS},
    compressorSettings:{...DSP_COMPRESSOR_DEFAULTS},preset:'OFF',headroomDb:0};
  dry.gain.value=1;wet.gain.value=0;headroom.gain.value=1;
  applyDSPGraph(graph,'OFF',DSP_DEFAULTS);
  return graph;
}

// All controls update the same graph instantly, preserving the user's manual
// Compressor settings while changing the EQ, width or preset.
export function applyDSPGraph(graph,preset,settings,compressorSettings,bypass=false){
  if(!graph)return;
  const ctx=graph.ctx;
  const key=Object.hasOwn(DSP_PRESETS,preset)?preset:'OFF';
  const p=DSP_PRESETS[key],s=normalizeDSPSettings(settings);
  const c=normalizeDSPCompressor(compressorSettings),resolved=resolvedCompressor(key,c);
  graph.preset=key;graph.setting=s;graph.compressorSettings=c;
  const isDry=bypass||key==='OFF';
  setAudioParam(graph.dry.gain,isDry?1:0,ctx);
  setAudioParam(graph.wet.gain,isDry?0:1,ctx);
  setAudioParam(graph.input.gain,p.input,ctx);
  setAudioParam(graph.highpass.frequency,p.hpf,ctx);
  setAudioParam(graph.lowpass.frequency,Math.min(p.lpf,ctx.sampleRate*.48),ctx);
  setAudioParam(graph.compressor.threshold,resolved.threshold,ctx);
  setAudioParam(graph.compressor.ratio,resolved.ratio,ctx);
  setAudioParam(graph.compressor.knee,c.mode==='off'?0:p.knee,ctx);
  setAudioParam(graph.compressor.attack,resolved.attack,ctx);
  setAudioParam(graph.compressor.release,resolved.release,ctx);
  setAudioParam(graph.makeup.gain,dbToGain(resolved.makeup),ctx);
  setAudioParam(graph.bass.gain,s.bass,ctx);
  setAudioParam(graph.mid.gain,s.mid,ctx);
  setAudioParam(graph.treble.gain,s.treble,ctx);
  setAudioParam(graph.output.gain,dbToGain(s.output),ctx);
  const width=s.stereoWidth/100;
  setAudioParam(graph.ll.gain,(1+width)/2,ctx);
  setAudioParam(graph.rr.gain,(1+width)/2,ctx);
  setAudioParam(graph.rl.gain,(1-width)/2,ctx);
  setAudioParam(graph.lr.gain,(1-width)/2,ctx);
  graph.headroomDb=isDry?0:calculateHeadroomDb(key,s,c);
  setAudioParam(graph.headroom.gain,dbToGain(graph.headroomDb),ctx);
}

export function measurePeakDbfs(analyser,buffer){
  if(!analyser||!buffer)return -120;
  analyser.getFloatTimeDomainData(buffer);
  let peak=0;
  for(let i=0;i<buffer.length;i++)peak=Math.max(peak,Math.abs(buffer[i]));
  return peak?Math.max(-120,20*Math.log10(peak)):-120;
}
