'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

test('Full-page WebDSP has secure station writes, live editor and independent Compressor',()=>{
 const page=read('frontend/src/pages/DSP.jsx');
 const routes=read('backend/routes/stationRoutes.js');
 const controller=read('backend/controllers/stationController.js');
 for(const q of ['LISTEN LIVE','SAVE SETTINGS','Stereo expander','Tone control',
   'Live peak monitoring','BYPASS FX','Compressor Settings','PRESET DYNAMICS',
   'COMP OFF','Auto headroom'])
  assert.ok(page.includes(q),'missing DSP editor control '+q);
 assert.ok(page.includes('stations/dsp-access'));
 assert.ok(routes.includes("'/stations/dsp-access',protect,authorizeRoles('admin','broadcaster')"));
 assert.ok(controller.includes("hasStationRight(req.user,station,'broadcaster.webdsp')"));
 assert.ok(controller.includes('validateDSPUpdate(req.body)'));
 assert.ok(controller.includes('dspPreset dspSettings dspCompressor disableNetworkAds'));
});
test('An expired subscription masks EQ, stereo and manual compressor while preserving originals',()=>{
 const rules=read('backend/services/stationBillingProjectionRules.js');
 assert.match(rules,/if\(!rights\.has\('broadcaster\.webdsp'\)\)\{/);
 assert.match(rules,/data\.dspSettings=/);
 assert.match(rules,/data\.dspCompressor=/);
});
class Node {
 constructor(){this.connections=[];this.gain=param();this.frequency=param();this.Q=param();
   this.threshold=param();this.ratio=param();this.knee=param();
   this.attack=param();this.release=param();this.fftSize=0;this.reduction=0;}
 connect(node,out=0,input=0){this.connections.push({node,out,input});return node;}
 getFloatTimeDomainData(buffer){buffer.fill(0);buffer[0]=.5;}
}
function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}};}
function context(){
 return {currentTime:0,sampleRate:48000,destination:new Node(),
   createGain:()=>new Node(),createBiquadFilter:()=>new Node(),
   createDynamicsCompressor:()=>new Node(),createChannelSplitter:()=>new Node(),
   createChannelMerger:()=>new Node(),createAnalyser:()=>new Node()};
 // No WaveShaper exists in the mock: any attempted hard clipping fails loudly.
}
test('Shared audio graph has true dry bypass and NO master limiter or WaveShaper',async()=>{
 const {createDSPGraph,applyDSPGraph,DSP_DEFAULTS}=await import('../frontend/src/utils/dspEngine.js');
 const ctx=context(),source=new Node(),graph=createDSPGraph(ctx,source);
 const adjacent=(from,to)=>assert.ok(from.connections.some(c=>c.node===to),'signal path not connected');
 adjacent(source,graph.dry);
 adjacent(graph.dry,graph.mix);
 adjacent(source,graph.input);
 adjacent(graph.input,graph.highpass);
 adjacent(graph.highpass,graph.lowpass);
 adjacent(graph.lowpass,graph.compressor);
 adjacent(graph.compressor,graph.makeup);
 adjacent(graph.makeup,graph.bass);
 adjacent(graph.bass,graph.mid);
 adjacent(graph.mid,graph.treble);
 adjacent(graph.treble,graph.upmix);
 adjacent(graph.upmix,graph.split);
 adjacent(graph.merge,graph.output);
 adjacent(graph.output,graph.beforePeak);
 adjacent(graph.beforePeak,graph.headroom);
 adjacent(graph.headroom,graph.wet);
 adjacent(graph.wet,graph.mix);
 adjacent(graph.mix,graph.fade);
 adjacent(graph.fade,graph.afterPeak);
 adjacent(graph.afterPeak,ctx.destination);
 assert.equal(graph.dry.gain.value,1);
 assert.equal(graph.wet.gain.value,0);
 assert.equal(graph.headroom.gain.value,1);
 assert.equal(graph.limiter,undefined);
 assert.equal(graph.safety,undefined);
 applyDSPGraph(graph,'SOFT',{...DSP_DEFAULTS,bass:5,stereoWidth:150});
 assert.equal(graph.dry.gain.value,0);
 assert.equal(graph.wet.gain.value,1);
 assert.equal(graph.bass.gain.value,5);
 assert.equal(graph.ll.gain.value,1.25);
 assert.equal(graph.rl.gain.value,-.25);
 assert.ok(graph.headroom.gain.value<1);
 applyDSPGraph(graph,'SOFT',{...DSP_DEFAULTS,bass:12,stereoWidth:150},undefined,true);
 assert.equal(graph.dry.gain.value,1,'explicit bypass must send untouched source');
 assert.equal(graph.wet.gain.value,0,'no processing path may remain audible');
 assert.equal(graph.headroom.gain.value,1);
 applyDSPGraph(graph,'OFF',{...DSP_DEFAULTS,bass:12,output:3},undefined);
 assert.equal(graph.dry.gain.value,1,'DSP OFF must be literal source path');
 assert.equal(graph.wet.gain.value,0);
});
test('Headroom compensates sum of EQ, compressor makeup, width and output boost',async()=>{
 const {DSP_DEFAULTS,calculateHeadroomDb,DSP_PRESETS,normalizeDSPCompressor,
  compressorForPreset,createDSPGraph,applyDSPGraph}=await import('../frontend/src/utils/dspEngine.js');
 const boosted={bass:12,mid:12,treble:12,output:3,stereoWidth:150};
 const comp={mode:'manual',threshold:-18,ratio:3,attack:.02,release:.25,makeup:6};
 const conservative=calculateHeadroomDb('ULTRA',boosted,comp);
 assert.ok(conservative < -35,'all positive boosts need corresponding attenuation');
 assert.ok(calculateHeadroomDb('SOFT',DSP_DEFAULTS)<0);
 assert.equal(calculateHeadroomDb('OFF',boosted,comp),0);
 assert.ok(Object.values(DSP_PRESETS).every(p=>p.makeup<=1.1),'no aggressive preset makeup');
 assert.ok(Object.values(DSP_PRESETS).every(p=>p.ratio<=3),'avoid aggressive default compression');
 const graph=createDSPGraph(context(),new Node());
 applyDSPGraph(graph,'ULTRA',boosted,comp);
 assert.ok(Math.abs(graph.headroom.gain.value-10**(conservative/20))<1e-8);
 assert.equal(graph.compressor.ratio.value,3);
 assert.equal(graph.compressor.threshold.value,-18);
 assert.ok(Math.abs(graph.makeup.gain.value-10**(6/20))<1e-8);
 applyDSPGraph(graph,'ULTRA',boosted,{...comp,mode:'off'});
 assert.equal(graph.compressor.ratio.value,1);
 assert.equal(graph.makeup.gain.value,1);
 applyDSPGraph(graph,'ULTRA',boosted,{...comp,mode:'preset'});
 assert.equal(graph.compressor.ratio.value,DSP_PRESETS.ULTRA.ratio);
 assert.equal(compressorForPreset('SOFT').mode,'preset');
 assert.equal(normalizeDSPCompressor({ratio:100}).ratio,8);
});
test('Real sample-peak metering is independent and warns before zero dBFS',async()=>{
 const {measurePeakDbfs,normalizeDSPSettings,PEAK_WARNING_DBFS}=await import('../frontend/src/utils/dspEngine.js');
 assert.ok(Math.abs(measurePeakDbfs(new Node(),new Float32Array(32))-(-6.0206))<.001);
 assert.equal(PEAK_WARNING_DBFS,-1);
 assert.equal(normalizeDSPSettings({stereoWidth:400,output:-30}).stereoWidth,150);
 assert.equal(normalizeDSPSettings({stereoWidth:400,output:-30}).output,-12);
 const source=read('frontend/src/utils/dspEngine.js');
 assert.doesNotMatch(source,/createWaveShaper\(|safety\.curve|limiter\.threshold|PEAK_CEILING_DBFS/);
 const ui=read('frontend/src/pages/DSP.jsx');
 assert.doesNotMatch(ui,/Fixed master ceiling|master limiter παραμένει ενεργός|−0\.5 dBFS/);
});
