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
test('Broadcaster editor supports Auto Mode, sticky prelisten and OFF bypass',()=>{
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
 assert.match(ui,/Sticky Live Preview/);
 assert.match(ui,/Auto Mode ένταση ή stereo/);
 assert.ok(ui.indexOf('Sticky Live Preview')<ui.indexOf('00 \/ AUDIO MODES'));
 assert.match(back,/AUTO_MODE/);
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
 adjacent(g.output,g.autoProbe);adjacent(g.autoProbe,g.autoGain);
 adjacent(g.autoGain,g.beforePeak);
 adjacent(g.output,g.beforePeak);
 adjacent(g.beforePeak,g.headroom);
 adjacent(g.headroom,g.clipperDry);adjacent(g.clipperDry,g.clipperMix);
 adjacent(g.headroom,g.clipperDrive);adjacent(g.clipperDrive,g.clipper);
 adjacent(g.clipper,g.clipperWet);
 adjacent(g.clipperWet,g.clipperMix);
 adjacent(g.clipperMix,g.peakCeilingDry);
 adjacent(g.peakCeilingDry,g.peakCeilingMix);
 adjacent(g.clipperMix,g.peakCeiling);
 adjacent(g.peakCeiling,g.peakCeilingWet);
 adjacent(g.peakCeilingWet,g.peakCeilingMix);
 adjacent(g.peakCeilingMix,g.postPeak);adjacent(g.postPeak,g.wet);adjacent(g.wet,g.mix);
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
 adjacent(g.listenerHeadroom,g.listenerProbe);
 adjacent(g.listenerProbe,g.listenerAutoGain);
 adjacent(g.listenerAutoGain,g.listenerVmaxCeiling);
 adjacent(g.listenerVmaxCeiling,g.listenerVmaxWet);
 adjacent(g.listenerVmaxWet,g.listenerVmaxMix);
 adjacent(g.listenerAutoGain,g.listenerVmaxDry);
 adjacent(g.listenerVmaxDry,g.listenerVmaxMix);
 adjacent(g.listenerVmaxMix,g.listenerWet);
 adjacent(g.listenerHeadroom,g.listenerWet);
 adjacent(g.listenerWet,g.listenerMix);
 adjacent(g.listenerMix,g.fade);adjacent(g.fade,g.afterPeak);
 adjacent(g.afterPeak,ctx.destination);
 assert.equal(g.limiter,undefined);
 assert.equal(g.safety,undefined);
 assert.equal(g.clipper.oversample,'4x');
 assert.equal(g.peakCeiling.oversample,'4x');
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
 assert.deepEqual(Object.keys(DSP_MODES),['OFF','ENHANCER','FM_MODE','AUTO_MODE']);
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
 assert.equal(g.listenerHeadroom.gain.value,1,'VMax has no permanent attenuation');
 assert.equal(g.listenerHeadroomDb,0);
 assert.equal(g.listenerVmaxDry.gain.value,0);
 assert.equal(g.listenerVmaxWet.gain.value,1);
 assert.equal(g.listenerVmaxCeiling.oversample,'4x');
 applyDSPGraph(g,'OFF',DSP_DEFAULTS);
 applyListenerMode(g,'VMAX');
 assert.equal(g.listenerHeadroomDb,0,'adaptive VMax uses its own peak ceiling');
 assert.equal(calculateHeadroomDb('FM_MODE',{...DSP_DEFAULTS,bass:12,stereoWidth:150}),-.5,
  'boosted EQ must not cause huge static headroom attenuation');
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
 assert.equal(PEAK_WARNING_DBFS,-.4);
 const source=read('frontend/src/utils/dspEngine.js');
 assert.match(source,/createWaveShaper\(/);
 assert.doesNotMatch(source,/limiter\.threshold|safety\.curve/);
 const ui=read('frontend/src/pages/DSP.jsx');
 assert.match(ui,/Booster level/);
 assert.match(ui,/Booster &amp; Headroom/);
 assert.doesNotMatch(ui,/role="switch"|updateMaster\('headroomEnabled'/);
 assert.match(ui,/ALWAYS ON/);
 assert.match(ui,/beforeWaveRef/);
 assert.match(ui,/afterWaveRef/);
 assert.ok(ui.includes('min={-7} max={7}'));
});

test('Headroom cannot be switched OFF; Booster processing remains mode-specific',async()=>{
 const {createDSPGraph,applyDSPGraph,calculateHeadroomDb,
   DSP_DEFAULTS,createSoftClipCurve,normalizeDSPClipper}=await engine();
 const graph=createDSPGraph(context(),new Node());
 const config={ENHANCER:{headroomEnabled:false,level:4},
   FM_MODE:{headroomEnabled:true,level:8}};
 assert.deepEqual(normalizeDSPClipper(),{
   ENHANCER:{headroomEnabled:true,level:0},
   FM_MODE:{headroomEnabled:true,level:0}});
 assert.deepEqual(normalizeDSPClipper(config).ENHANCER,{headroomEnabled:true,level:4});
 assert.equal(calculateHeadroomDb('ENHANCER',DSP_DEFAULTS,undefined,config),-.5);
 assert.equal(calculateHeadroomDb('FM_MODE',DSP_DEFAULTS,undefined,config)<0,true);
 applyDSPGraph(graph,'ENHANCER',DSP_DEFAULTS,undefined,false,config);
 assert.equal(graph.headroomDb,-.5);
 assert.equal(graph.peakCeilingDry.gain.value,0);
 assert.equal(graph.peakCeilingWet.gain.value,1);
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
 assert.equal(graph.headroomDb,-.5);
 assert.equal(graph.headroom.gain.value,1,'peak ceiling must not reduce the whole stream');
 assert.equal(graph.peakCeilingDry.gain.value,0);
 assert.equal(graph.peakCeilingWet.gain.value,1);
 applyDSPGraph(graph,'OFF',DSP_DEFAULTS,undefined,false,config);
 assert.equal(graph.clipperLevel,0);
 assert.equal(graph.clipperDry.gain.value,1);
 assert.equal(graph.clipperWet.gain.value,0);
 assert.equal(graph.clipperDrive.gain.value,1);
 assert.equal(graph.peakCeilingDry.gain.value,1);
 assert.equal(graph.peakCeilingWet.gain.value,0);
 assert.equal(graph.dry.gain.value,1);
});

test('Always-on Headroom guards peaks at -0.5 dBFS without lowering normal loudness',async()=>{
 const {createPeakCeilingCurve,HEADROOM_CEILING_DBFS,createDSPGraph,applyDSPGraph,
   calculateHeadroomDb,DSP_DEFAULTS}=await engine();
 assert.equal(HEADROOM_CEILING_DBFS,-.5);
 const curve=createPeakCeilingCurve(),ceiling=10**(-.5/20);
 assert.equal(curve.length,8192);
 const sampleAt=x=>curve[Math.round((x+1)/2*(curve.length-1))];
 assert.ok(Math.abs(sampleAt(.4)-.4)<.001,'quiet audio must have unity transfer');
 assert.ok(Math.abs(sampleAt(-.4)+.4)<.001);
 assert.ok(sampleAt(1)<=ceiling+.00001,'highest input sample must stay below ceiling');
 assert.ok(sampleAt(1)>.9,'0 dBFS should remain loud near the ceiling');
 assert.ok(Math.abs(sampleAt(1)+sampleAt(-1))<1e-6);
 assert.equal(calculateHeadroomDb('OFF',DSP_DEFAULTS),0);
 assert.equal(calculateHeadroomDb('FM_MODE',{...DSP_DEFAULTS,output:7}),-.5);
 const g=createDSPGraph(context(),new Node());
 applyDSPGraph(g,'ENHANCER',{...DSP_DEFAULTS,bass:12,output:7});
 assert.equal(g.headroom.gain.value,1,'positive EQ must never trigger static attenuation');
 assert.equal(g.peakCeilingWet.gain.value,1);
 assert.equal(g.peakCeilingDry.gain.value,0);
 applyDSPGraph(g,'ENHANCER',DSP_DEFAULTS,undefined,true);
 assert.equal(g.dry.gain.value,1,'manual bypass stays raw');
 assert.equal(g.peakCeilingWet.gain.value,0);
});

test('Legacy Headroom OFF is ignored even with Booster 0, across every active mode',async()=>{
 const {createDSPGraph,applyDSPGraph,calculateHeadroomDb,DSP_DEFAULTS}=await engine();
 const config={ENHANCER:{headroomEnabled:false,level:0},
   FM_MODE:{headroomEnabled:false,level:8}};
 const g=createDSPGraph(context(),new Node());
 for(const mode of ['ENHANCER','FM_MODE']){
   assert.equal(calculateHeadroomDb(mode,DSP_DEFAULTS,undefined,config),-.5);
   applyDSPGraph(g,mode,DSP_DEFAULTS,undefined,false,config);
   assert.equal(g.headroomDb,-.5);
   assert.equal(g.peakCeilingDry.gain.value,0);
   assert.equal(g.peakCeilingWet.gain.value,1);
 }
 assert.equal(g.clipperLevel,8);
 applyDSPGraph(g,'OFF',DSP_DEFAULTS,undefined,false,config);
 assert.equal(g.dry.gain.value,1,'OFF stays completely raw');
 assert.equal(g.peakCeilingWet.gain.value,0);
});

test('Auto Mode uses a single balance and adapts quiet/loud input without old manual EQ',async()=>{
 const {createDSPGraph,applyDSPGraph,updateAdaptiveDSP,autoStereoWidth,calculateAdaptiveGainDb,DSP_DEFAULTS}=await engine();
 const g=createDSPGraph(context(),new Node());
 assert.equal(autoStereoWidth(-100),100);
 assert.equal(autoStereoWidth(0),112.5);
 assert.equal(autoStereoWidth(100),125);
 assert.equal(calculateAdaptiveGainDb(-70),null,'do not amplify silence');
 assert.ok(calculateAdaptiveGainDb(-25)>10);
 assert.ok(calculateAdaptiveGainDb(-.1)<0);
 applyDSPGraph(g,'AUTO_MODE',{...DSP_DEFAULTS,bass:12,output:7},{mode:'off'},false,undefined,-100);
 assert.equal(g.compressorWet.gain.value,1);
 assert.equal(g.bass.gain.value,.6,'Auto must not inherit manual EQ');
 assert.equal(g.output.gain.value,1);
 assert.equal(g.ll.gain.value,1);
 assert.equal(g.clipperLevel,0,'Auto does not inherit manual Booster');
 assert.equal(g.peakCeilingWet.gain.value,1);
 updateAdaptiveDSP(g);
 assert.ok(Number.isFinite(g.autoGainDb));
 applyDSPGraph(g,'AUTO_MODE',DSP_DEFAULTS,undefined,false,undefined,100);
 assert.equal(g.ll.gain.value,1.125);
 applyDSPGraph(g,'OFF',DSP_DEFAULTS);
 assert.equal(g.dry.gain.value,1);
 assert.equal(g.autoGain.gain.value,1);
});

test('Premium VMax adapts independently at the -0.2 dBFS personal ceiling',async()=>{
 const {createDSPGraph,applyDSPGraph,applyListenerMode,updateAdaptiveDSP,
   createPeakCeilingCurve,VMAX_CEILING_DBFS,DSP_DEFAULTS}=await engine();
 assert.equal(VMAX_CEILING_DBFS,-.2);
 const curve=createPeakCeilingCurve(-.2);
 assert.ok(curve[8191] <= 10**(-.2/20)+.00001);
 const g=createDSPGraph(context(),new Node());
 applyDSPGraph(g,'ENHANCER',DSP_DEFAULTS);
 applyListenerMode(g,'VMAX');
 assert.equal(g.listenerVmaxWet.gain.value,1);
 updateAdaptiveDSP(g);
 assert.ok(Number.isFinite(g.listenerGainDb));
 applyListenerMode(g,'SONOS');
 assert.equal(g.listenerVmaxWet.gain.value,0);
 applyListenerMode(g,'OFF');
 assert.equal(g.listenerRaw.gain.value,1);
});
