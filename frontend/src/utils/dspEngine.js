// One Web Audio chain is shared by listener playback and the broadcaster's
// instantaneous preview. Order: preset -> EQ -> M/S width -> output trim ->
// monitor gain -> fixed master limiter/safety -> final sample-peak meter.
export const DSP_PRESETS = Object.freeze({
  OFF: { label:'DSP Off', input:1, hpf:10, lpf:22000, threshold:0, ratio:1, knee:0, attack:0.03, release:0.3, makeup:1 },
  SOFT: { label:'Soft · Acoustic / Jazz', input:.85, hpf:28, lpf:17800, threshold:-28, ratio:4.5, knee:22, attack:.1, release:.5, makeup:1.55 },
  NORMALIZE: { label:'Normalize · General Radio', input:.75, hpf:25, lpf:17500, threshold:-20, ratio:3.5, knee:15, attack:.05, release:.3, makeup:1.35 },
  ULTRABAND: { label:'Ultraband', input:.7, hpf:30, lpf:16500, threshold:-25, ratio:4.5, knee:10, attack:.02, release:.25, makeup:1.55 },
  ULTRA: { label:'Ultra', input:.65, hpf:35, lpf:16000, threshold:-28, ratio:5.5, knee:8, attack:.01, release:.2, makeup:1.7 },
  OMNIA: { label:'Omnia', input:.8, hpf:40, lpf:17500, threshold:-32, ratio:7, knee:7, attack:.005, release:.15, makeup:1.85 },
  '0DB_LEVELER': { label:'0 dB Leveler', input:1, hpf:30, lpf:18000, threshold:-35, ratio:6, knee:30, attack:.2, release:.8, makeup:1.8 }
});
export const DSP_DEFAULTS = Object.freeze({bass:0,mid:0,treble:0,output:0,stereoWidth:100});
export const DSP_RANGES = Object.freeze({
  bass:[-12,12],mid:[-12,12],treble:[-12,12],output:[-12,3],stereoWidth:[0,150]
});
export const PEAK_CEILING_DBFS = -0.5;
const PEAK_CEILING = 10 ** (PEAK_CEILING_DBFS / 20);

export function normalizeDSPSettings(settings){
  const result={...DSP_DEFAULTS};
  if(!settings||typeof settings!=='object')return result;
  for(const [name,[min,max]] of Object.entries(DSP_RANGES)){
    if(typeof settings[name]==='number'&&Number.isFinite(settings[name]))
      result[name]=Math.max(min,Math.min(max,settings[name]));
  }
  return result;
}
const setAudioParam=(param,value,ctx)=>{
  const at=ctx.currentTime;
  param.cancelScheduledValues(at);
  param.setTargetAtTime(value,at,0.008);
};
const filter=(ctx,type,frequency)=>{
  const node=ctx.createBiquadFilter();
  node.type=type;
  node.frequency.value=frequency;
  return node;
};

// The second channel is explicitly upmixed before splitting so mono station
// streams remain centered at 100% stereo width.
export function createDSPGraph(ctx,source){
  const input=ctx.createGain();
  const highpass=filter(ctx,'highpass',10);
  const lowpass=filter(ctx,'lowpass',22000);
  const compressor=ctx.createDynamicsCompressor();
  const makeup=ctx.createGain();
  const bass=filter(ctx,'lowshelf',180);
  const mid=filter(ctx,'peaking',1300);
  mid.Q.value=.8;
  const treble=filter(ctx,'highshelf',4300);
  const upmix=ctx.createGain();
  upmix.channelCount=2;
  upmix.channelCountMode='explicit';
  const split=ctx.createChannelSplitter(2);
  const ll=ctx.createGain(),rl=ctx.createGain(),lr=ctx.createGain(),rr=ctx.createGain();
  const merge=ctx.createChannelMerger(2);
  const output=ctx.createGain(),fade=ctx.createGain();
  const beforePeak=ctx.createAnalyser();
  const limiter=ctx.createDynamicsCompressor();
  const safety=ctx.createWaveShaper();
  const afterPeak=ctx.createAnalyser();

  beforePeak.fftSize=2048;
  beforePeak.smoothingTimeConstant=0;
  afterPeak.fftSize=2048;
  afterPeak.smoothingTimeConstant=0;
  // A sample-peak safety ceiling, after *all* other gains and processing.
  // The compressor minimizes saturation; this final curve enforces the
  // ceiling for WebAudio samples, not a certified inter-sample true peak.
  const curve=new Float32Array(65536);
  for(let i=0;i<curve.length;i++){
    const sample=4*(i/(curve.length-1)) - 2;
    curve[i]=Math.max(-PEAK_CEILING,Math.min(PEAK_CEILING,sample));
  }
  safety.curve=curve;
  safety.oversample='4x';
  limiter.threshold.value=PEAK_CEILING_DBFS;
  limiter.knee.value=0;
  limiter.ratio.value=20;
  limiter.attack.value=.002;
  limiter.release.value=.1;

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
  split.connect(ll,0);
  split.connect(lr,0);
  split.connect(rl,1);
  split.connect(rr,1);
  ll.connect(merge,0,0);
  rl.connect(merge,0,0);
  lr.connect(merge,0,1);
  rr.connect(merge,0,1);
  merge.connect(output);
  output.connect(fade);
  fade.connect(beforePeak);
  beforePeak.connect(limiter);
  limiter.connect(safety);
  safety.connect(afterPeak);
  afterPeak.connect(ctx.destination);

  const graph={ctx,source,input,highpass,lowpass,compressor,makeup,bass,mid,
    treble,upmix,split,ll,rl,lr,rr,merge,output,fade,beforePeak,limiter,
    safety,afterPeak,setting:{...DSP_DEFAULTS},preset:'OFF'};
  applyDSPGraph(graph,'OFF',DSP_DEFAULTS);
  return graph;
}

export function applyDSPGraph(graph,preset,settings){
  if(!graph)return;
  const ctx=graph.ctx;
  const p=DSP_PRESETS[preset]||DSP_PRESETS.OFF;
  const s=normalizeDSPSettings(settings);
  graph.preset=Object.hasOwn(DSP_PRESETS,preset)?preset:'OFF';
  graph.setting=s;
  setAudioParam(graph.input.gain,p.input,ctx);
  setAudioParam(graph.highpass.frequency,p.hpf,ctx);
  setAudioParam(graph.lowpass.frequency,Math.min(p.lpf,ctx.sampleRate*.48),ctx);
  setAudioParam(graph.compressor.threshold,p.threshold,ctx);
  setAudioParam(graph.compressor.ratio,p.ratio,ctx);
  setAudioParam(graph.compressor.knee,p.knee,ctx);
  setAudioParam(graph.compressor.attack,p.attack,ctx);
  setAudioParam(graph.compressor.release,p.release,ctx);
  setAudioParam(graph.makeup.gain,p.makeup,ctx);
  setAudioParam(graph.bass.gain,s.bass,ctx);
  setAudioParam(graph.mid.gain,s.mid,ctx);
  setAudioParam(graph.treble.gain,s.treble,ctx);
  // The 3-band EQ and preset remain independent; trim is post-stereo.
  setAudioParam(graph.output.gain,10**(s.output/20),ctx);
  const width=s.stereoWidth/100;
  setAudioParam(graph.ll.gain,(1+width)/2,ctx);
  setAudioParam(graph.rr.gain,(1+width)/2,ctx);
  setAudioParam(graph.rl.gain,(1-width)/2,ctx);
  setAudioParam(graph.lr.gain,(1-width)/2,ctx);
}
export function measurePeakDbfs(analyser,buffer){
  if(!analyser||!buffer)return -120;
  analyser.getFloatTimeDomainData(buffer);
  let peak=0;
  for(let i=0;i<buffer.length;i++)peak=Math.max(peak,Math.abs(buffer[i]));
  return peak ? Math.max(-120,20*Math.log10(peak)) : -120;
}
