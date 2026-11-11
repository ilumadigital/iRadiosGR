'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

test('Phase F has a full page and authenticated station-scoped endpoint, not a modal',()=>{
 const page=read('frontend/src/pages/DSP.jsx');
 const routes=read('backend/routes/stationRoutes.js');
 const controller=read('backend/controllers/stationController.js');
 assert.ok(!page.includes('isModalOpen')&&!page.includes('openDSPModal'));
 for(const q of ['LISTEN LIVE','SAVE SETTINGS','Stereo expander','Tone control','Live peak monitoring','BYPASS FX'])
   assert.ok(page.includes(q),'missing DSP editor control '+q);
 assert.ok(page.includes("stations/dsp-access"));
 assert.ok(routes.includes("'/stations/dsp-access',protect,authorizeRoles('admin','broadcaster')"));
 assert.ok(controller.includes("hasStationRight(req.user,station,'broadcaster.webdsp')"));
 assert.ok(controller.includes('validateDSPUpdate(req.body)'));
 assert.ok(controller.includes('dspPreset dspSettings disableNetworkAds'),'public station must carry saved FX');
});
test('DSP settings are masked together with presets when paid rights expire',()=>{
 const rules=read('backend/services/stationBillingProjectionRules.js');
 assert.match(rules,/if\(!rights\.has\('broadcaster\.webdsp'\)\)\{/);
 assert.match(rules,/data\.dspSettings=/);
});

class Node {
 constructor(){this.connections=[];this.gain=param();this.frequency=param();this.Q=param();
   this.threshold=param();this.ratio=param();this.knee=param();
   this.attack=param();this.release=param();this.fftSize=0;}
 connect(node,out=0,input=0){this.connections.push({node,out,input});return node;}
 getFloatTimeDomainData(buffer){buffer.fill(0);buffer[0]=.5;}
}
function param(){return {value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}};}
const ctx={currentTime:0,sampleRate:48000,destination:new Node(),
 createGain:()=>new Node(),createBiquadFilter:()=>new Node(),
 createDynamicsCompressor:()=>new Node(),createChannelSplitter:()=>new Node(),
 createChannelMerger:()=>new Node(),createAnalyser:()=>new Node(),
 createWaveShaper:()=>new Node()};

test('One shared graph puts real high/low pass and master limiter in correct order',async()=>{
 const {createDSPGraph,applyDSPGraph,PEAK_CEILING_DBFS}=await import('../frontend/src/utils/dspEngine.js');
 const source=new Node(),graph=createDSPGraph(ctx,source);
 const adjacent=(from,to)=>assert.ok(from.connections.some(c=>c.node===to),'graph signal path missing');
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
 adjacent(graph.output,graph.fade);
 adjacent(graph.fade,graph.beforePeak);
 adjacent(graph.beforePeak,graph.limiter);
 adjacent(graph.limiter,graph.safety);
 adjacent(graph.safety,graph.afterPeak);
 adjacent(graph.afterPeak,ctx.destination);
 assert.equal(graph.limiter.threshold.value,PEAK_CEILING_DBFS);
 assert.equal(graph.safety.oversample,'4x');
 assert.ok(graph.safety.curve.every(v=>Math.abs(v)<=10**(-.5/20)+1e-6));
 applyDSPGraph(graph,'SOFT',{bass:3,mid:.5,treble:-2,output:-1,stereoWidth:150});
 assert.equal(graph.bass.gain.value,3);
 assert.equal(graph.mid.gain.value,.5);
 assert.equal(graph.treble.gain.value,-2);
 assert.ok(Math.abs(graph.output.gain.value-10**(-1/20))<1e-8);
 assert.equal(graph.ll.gain.value,1.25);
 assert.equal(graph.rl.gain.value,-.25);
 applyDSPGraph(graph,'OFF',{stereoWidth:0});
 assert.equal(graph.ll.gain.value,.5);
 assert.equal(graph.rl.gain.value,.5);
 assert.equal(graph.limiter.threshold.value,PEAK_CEILING_DBFS);
});
test('Sample-peak metering reads actual audio samples, not a CSS fake',async()=>{
 const {measurePeakDbfs,normalizeDSPSettings}=await import('../frontend/src/utils/dspEngine.js');
 const analyser=new Node();
 assert.ok(Math.abs(measurePeakDbfs(analyser,new Float32Array(32))-(-6.0206))<.001);
 assert.equal(normalizeDSPSettings({stereoWidth:400,output:-30}).stereoWidth,150);
 assert.equal(normalizeDSPSettings({stereoWidth:400,output:-30}).output,-12);
});
