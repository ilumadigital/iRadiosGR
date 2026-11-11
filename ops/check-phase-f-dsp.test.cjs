'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Node{
 constructor(){this.connections=[];this.gain=param();this.frequency=param();this.Q=param();
   this.threshold=param();this.ratio=param();this.knee=param();
   this.attack=param();this.release=param();this.fftSize=0;this.reduction=0;
   this.curve=null;this.oversample='none';}
 connect(node,out=0,input=0){this.connections.push({node,out,input});return node;}
 getFloatTimeDomainData(buf){buf.fill(0);buf[0]=.5;}
}
function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}};}
function context(){return {currentTime:0,sampleRate:48000,destination:new Node(),
 createGain:()=>new Node(),createBiquadFilter:()=>new Node(),
 createDynamicsCompressor:()=>new Node(),createChannelSplitter:()=>new Node(),
 createChannelMerger:()=>new Node(),createAnalyser:()=>new Node(),
 createWaveShaper:()=>new Node()};
 // Optional soft clipping is isolated behind a true level-0 bypass.
}
const adjacent=(from,to)=>assert.ok(from.connections.some(c=>c.node===to),'signal path not connected');
const engine=()=>import('../frontend/src/utils/dspEngine.js');
test('Broadcaster editor exposes only three modes with compressor ABOVE EQ and no controls in OFF',()=>{
 const ui=read('frontend/src/pages/DSP.jsx');
 const back=read('backend/services/dspConfig.js');
 assert.match(back,/'OFF','ENHANCER','FM_MODE'/);
 assert.match(ui,/Object.entries\(DSP_MODES\)/);
 assert.match(ui,/draft\.dspPreset==='FM_MODE'/);
 assert.match(ui,/draft\.dspPreset!=='OFF'/);
 assert.ok(ui.indexOf('Compressor Settings')<ui.indexOf('02 \/ EQUALIZER'));
 assert.ok(ui.indexOf('02 \/ EQUALIZER')<ui.indexOf('03 \/ SPATIAL FIELD'));
 assert.ok(ui.includes('Live sound preview'));
 assert.ok(ui.includes('BYPASS / RAW STREAM'));
 assert.ok(ui.includes('SAVE SETTINGS'));
 assert.ok(!ui.includes('DSP_PRESETS'));
 const routes=read('backend/routes/stationRoutes.js');
 assert.match(routes,/stations\/dsp-access/);
 const station=read('backend/controllers/stationController.js');
 assert.match(station,/hasStationRight\(req\.user,station,'broadcaster\.webdsp'\)/);
});
test('WebAudio has fully separated raw, Broadcaster and Premium listener signal paths',async()=>{
 const {createDSPGraph,applyDSPGraph,applyListenerMode,DSP_DEFAULTS}=await engine();
 const source=new Node(),ctx=context(),g=createDSPGraph(ctx,source);
 adjacent(source,g.dry);adjacent(g.dry,g.mix);
 adjacent(source,g.input);adjacent(g.input,g.highpass);
 adjacent(g.highpass,g.lowpass);
 adjacent(g.lowpass,g.compressorDry);
 adjacent(g.lowpass,g.compressor);
 adjacent(g.compressorDry,g.compressorMix);
 adjacent(g.compressor,g.makeup);
 adjacent(g.makeup,g.compressorWet);
 adjacent(g.compressorWet,g.compressorMix);
 adjacent(g.compressorMix,g.bass);
 adjacent(g.bass,g.mid);adjacent(g.mid,g.treble);
 adjacent(g.treble,g.upmix);adjacent(g.upmix,g.split);
 adjacent(g.merge,g.output);
 adjacent(g.output,g.beforePeak);
 adjacent(g.beforePeak,g.headroom);
 adjacent(g.headroom,g.clipperDry);adjacent(g.clipperDry,g.clipperMix);
 adjacent(g.headroom,g.clipperDrive);adjacent(g.clipperDrive,g.clipper);
 adjacent(g.clipper,g.clipperWet);
 adjacent(g.clipperWet,g.clipperMix);
 adjacent(g.clipperMix,g.postPeak);adjacent(g.postPeak,g.wet);adjacent(g.wet,g.mix);
 adjacent(source,g.listenerRaw);adjacent(g.listenerRaw,g.listenerMix);
 adjacent(g.mix,g.listenerDefault);adjacent(g.listenerDefault,g.listenerMix);
 adjacent(g.mix,g.listenerBass);
 adjacent(g.listenerBass,g.listenerMid);
 adjacent(g.listenerMid,g.listenerTreble);
 adjacent(g.listenerTreble,g.listenerComp);
 adjacent(g.listenerComp,g.listenerMakeup);
 adjacent(g.listenerMakeup,g.listenerUpmix);
 adjacent(g.listenerUpmix,g.listenerSplit);
 assert.equal(g.listenerUpmix.channelCount,2);
 adjacent(g.listenerMerge,g.listenerHeadroom);
 adjacent(g.listenerHeadroom,g.listenerWet);
 adjacent(g.listenerWet,g.listenerMix);
 adjacent(g.listenerMix,g.fade);adjacent(g.fade,g.afterPeak);
 adjacent(g.afterPeak,ctx.destination);
 assert.equal(g.limiter,undefined);
 assert.equal(g.safety,undefined);
 assert.equal(g.clipper.oversample,'4x');
 applyDSPGraph(g,'OFF',DSP_DEFAULTS);
 assert.equal(g.dry.gain.value,1);
 assert.equal(g.wet.gain.value,0);
 assert.equal(g.clipperDry.gain.value,1);
 assert.equal(g.clipperWet.gain.value,0);
 applyDSPGraph(g,'ENHANCER',{...DSP_DEFAULTS,bass:4,stereoWidth:125});
 assert.equal(g.dry.gain.value,0);
 assert.equal(g.wet.gain.value,1);
 assert.equal(g.compressorDry.gain.value,1,'Enhancer must physically bypass compressor');
 assert.equal(g.compressorWet.gain.value,0);
 assert.equal(g.bass.gain.value,4);
 assert.equal(g.ll.gain.value,1.125);
 applyDSPGraph(g,'FM_MODE',DSP_DEFAULTS,{mode:'manual',threshold:-19,ratio:2.6,attack:.04,release:.3,makeup:1});
 assert.equal(g.compressorDry.gain.value,0);
 assert.equal(g.compressorWet.gain.value,1);
 assert.equal(g.compressor.ratio.value,2.6);
 applyDSPGraph(g,'FM_MODE',DSP_DEFAULTS,{mode:'off'});
 assert.equal(g.compressorDry.gain.value,1);
 assert.equal(g.compressorWet.gain.value,0);
 applyDSPGraph(g,'FM_MODE',DSP_DEFAULTS,{mode:'preset'});
 applyListenerMode(g,'DEFAULT');
 assert.equal(g.listenerDefault.gain.value,1);
 assert.equal(g.listenerWet.gain.value,0);
 applyListenerMode(g,'OFF');
 assert.equal(g.listenerRaw.gain.value,1,'Premium OFF must bypass broadcaster too');
 assert.equal(g.listenerDefault.gain.value,0);
 assert.equal(g.listenerWet.gain.value,0);
 assert.equal(g.dry.gain.value,0,'Broadcaster mode is preserved for other listeners');
});
test('SONOS 110%, virtual Dolby stereo and VMax are distinct listener-only FX',async()=>{
 const {createDSPGraph,applyDSPGraph,applyListenerMode,normalizeListenerMode,
  normalizeBroadcasterMode,calculateHeadroomDb,DSP_DEFAULTS,DSP_MODES,LISTENER_MODES}=await engine();
 const g=createDSPGraph(context(),new Node());
 assert.deepEqual(Object.keys(DSP_MODES),['OFF','ENHANCER','FM_MODE']);
 assert.deepEqual(Object.keys(LISTENER_MODES),['DEFAULT','SONOS','DOLBY_STYLE','VMAX','OFF']);
 assert.equal(normalizeBroadcasterMode('ULTRA'),'FM_MODE');
 assert.equal(normalizeListenerMode('HomeTheater'),'DEFAULT');
 applyDSPGraph(g,'FM_MODE',DSP_DEFAULTS);
 applyListenerMode(g,'SONOS');
 assert.equal(g.listenerWet.gain.value,1);
 assert.equal(g.userLL.gain.value,1.05,'SONOS must use exactly 110% stereo');
 assert.equal(g.listenerComp.ratio.value,1,'SONOS has no additional compression');
 applyListenerMode(g,'DOLBY_STYLE');
 assert.equal(g.userLL.gain.value,1.08);
 assert.ok(g.listenerMid.gain.value>0,'phantom center requires voice-presence correction');
 assert.equal(g.listenerComp.ratio.value,1);
 applyListenerMode(g,'VMAX');
 assert.ok(g.listenerComp.ratio.value>1);
 assert.ok(g.listenerHeadroom.gain.value<1);
 assert.ok(g.listenerHeadroomDb<0);
 const vmaxNetDb=g.listenerHeadroomDb+
  .3+.4+20*Math.log10(1.03)+2.4;
 assert.ok(vmaxNetDb<=2.1,'VMAX consumes at most a safe part of station reserve');
 applyDSPGraph(g,'OFF',DSP_DEFAULTS);
 applyListenerMode(g,'VMAX');
 assert.ok(g.listenerHeadroomDb<-4,'do not boost potentially clipped raw streams');
 assert.ok(calculateHeadroomDb('FM_MODE',{...DSP_DEFAULTS,bass:12,stereoWidth:150})< -15);
});
test('Listener presets are Premium-only, local to an account and bypass ads',()=>{
 const hook=read('frontend/src/hooks/useAudioDSP.js');
 assert.match(hook,/currentUser\?\.isPremium===true/);
 assert.match(hook,/applyDSPGraph\(graph,preset,settings,compressor,false,clipper\)/);
 assert.match(hook,/applyListenerMode\(graph,personalMode\)/);
 assert.match(hook,/if\(isPlayingAd\)/);
 const app=read('frontend/src/App.jsx');
 assert.match(app,/iluma_listener_dsp_v2:/);
 assert.doesNotMatch(app,/iluma_user_dsp_overrides/);
 const widget=read('frontend/src/components/PremiumSoundModes.jsx');
 assert.ok(widget.includes('Object.entries(LISTENER_MODES)'));
 assert.ok(widget.includes('Premium · Προσωπικός ήχος'));
 const engineSource=read('frontend/src/utils/dspEngine.js');
 for(const name of ['SONOS','DOLBY_STYLE','VMAX','OFF','DEFAULT'])
  assert.ok(engineSource.includes(name),'missing personal preset '+name);
 for(const p of ['frontend/src/pages/StationProfile.jsx','frontend/src/components/Footer.jsx']){
  const ui=read(p);
  assert.ok(ui.includes('PremiumSoundModes'));
  assert.ok(!ui.includes('HomeTheater'));
  assert.ok(!ui.includes('Immersive3D'));
 }
});
test('Optional soft clipper and live peaks preserve raw bypass and sample warning',async()=>{
 const {measurePeakDbfs,PEAK_WARNING_DBFS}=await engine();
 assert.ok(Math.abs(measurePeakDbfs(new Node(),new Float32Array(32))+6.0206)<.001);
 assert.equal(PEAK_WARNING_DBFS,-1);
 const source=read('frontend/src/utils/dspEngine.js');
 assert.match(source,/createWaveShaper\(/);
 assert.doesNotMatch(source,/limiter\.threshold|safety\.curve/);
 const ui=read('frontend/src/pages/DSP.jsx');
 assert.match(ui,/Clipper level/);
 assert.match(ui,/beforeWaveRef/);
 assert.match(ui,/afterWaveRef/);
 assert.match(ui,/min={-7} max={7}/);
});

test('Headroom switches, clipper curve and independent broadcaster modes',async()=>{
 const {createDSPGraph,applyDSPGraph,calculateHeadroomDb,
   DSP_DEFAULTS,createSoftClipCurve,normalizeDSPClipper}=await engine();
 const graph=createDSPGraph(context(),new Node());
 const config={ENHANCER:{headroomEnabled:false,level:4},
   FM_MODE:{headroomEnabled:true,level:8}};
 assert.deepEqual(normalizeDSPClipper(),{
   ENHANCER:{headroomEnabled:true,level:0},
   FM_MODE:{headroomEnabled:true,level:0}});
 assert.equal(calculateHeadroomDb('ENHANCER',DSP_DEFAULTS,undefined,config),0);
 assert.equal(calculateHeadroomDb('FM_MODE',DSP_DEFAULTS,undefined,config)<0,true);
 applyDSPGraph(graph,'ENHANCER',DSP_DEFAULTS,undefined,false,config);
 assert.equal(graph.headroomDb,0);
 assert.equal(graph.clipperLevel,4);
 assert.ok(graph.clipperDrive.gain.value>1);
 assert.equal(graph.clipperDry.gain.value,0);
 assert.equal(graph.clipperWet.gain.value,1);
 assert.equal(graph.clipper.curve instanceof Float32Array,true);
 assert.ok(graph.clipper.curve.length>=2048);
 const curve=createSoftClipCurve(8);
 assert.ok(Math.abs(curve[0])<1);
 assert.ok(Math.abs(curve[curve.length-1])<1);
 assert.equal(createSoftClipCurve(0),null);
 applyDSPGraph(graph,'FM_MODE',DSP_DEFAULTS,undefined,false,config);
 assert.equal(graph.clipperLevel,8);
 assert.ok(graph.headroomDb<0);
 applyDSPGraph(graph,'OFF',DSP_DEFAULTS,undefined,false,config);
 assert.equal(graph.clipperLevel,0);
 assert.equal(graph.clipperDry.gain.value,1);
 assert.equal(graph.clipperWet.gain.value,0);
 assert.equal(graph.clipperDrive.gain.value,1);
 assert.equal(graph.dry.gain.value,1);
});
