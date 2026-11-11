'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DSP_DEFAULTS,DSP_PRESETS,DSP_COMPRESSOR_DEFAULTS,validateDSPUpdate}=
 require('../services/dspConfig');
const full={bass:3,mid:.5,treble:-2,output:-1,stereoWidth:125};
const comp={mode:'manual',threshold:-21,ratio:2.6,attack:.04,release:.35,makeup:1.5};

test('Existing studio presets remain compatible after removing forced master limiter',()=>{
 assert.deepEqual(DSP_PRESETS,['OFF','SOFT','NORMALIZE','ULTRABAND','ULTRA','OMNIA','0DB_LEVELER']);
});
test('EQ and stereo persist alongside preset and independently adjustable Compressor',()=>{
 const parsed=validateDSPUpdate({dspPreset:'OMNIA',dspSettings:full,dspCompressor:comp});
 assert.equal(parsed.error,undefined);
 assert.deepEqual(parsed.value,{dspPreset:'OMNIA',dspSettings:full,dspCompressor:comp});
});
test('Legacy preset-only and old saved tone settings remain backward compatible',()=>{
 assert.deepEqual(validateDSPUpdate({dspPreset:'SOFT'}),{value:{dspPreset:'SOFT'}});
 assert.deepEqual(validateDSPUpdate({dspPreset:'SOFT',dspSettings:full}),
  {value:{dspPreset:'SOFT',dspSettings:full}});
});
test('Partial advanced settings cannot silently erase other faders',()=>{
 assert.match(validateDSPUpdate({dspSettings:{bass:2}}).error,/ρυθμίσεις/);
 assert.match(validateDSPUpdate({dspCompressor:{threshold:-20}}).error,/Compressor/);
});
test('Unknown fields, NaN, infinity and numeric strings cannot bypass validation',()=>{
 for(const invalid of [
  {dspPreset:'SOFT',isFeatured:true},
  {dspPreset:'FAKE'}, {dspSettings:{...full,bass:'8'}},
  {dspSettings:{...full,mid:NaN}}, {dspSettings:{...full,output:Infinity}},
  {dspSettings:{...full,stereoWidth:151}}, {dspSettings:{...full,output:3.01}},
  {dspSettings:{...full,extra:1}}, {dspSettings:null}, {},
  {dspCompressor:{...comp,mode:'unknown'}},
  {dspCompressor:{...comp,threshold:1}},
  {dspCompressor:{...comp,ratio:20}},
  {dspCompressor:{...comp,attack:0}},
  {dspCompressor:{...comp,release:-1}},
  {dspCompressor:{...comp,makeup:8}},
  {dspCompressor:{...comp,makeup:'2'}},
  {dspCompressor:{...comp,ratio:NaN}},
  {dspCompressor:{...comp,extra:true}},
  {dspCompressor:null}
 ])assert.ok(validateDSPUpdate(invalid).error,JSON.stringify(invalid));
});
test('Safe defaults contain NO forced master limiter or user-adjustable clip ceiling',()=>{
 assert.deepEqual(DSP_DEFAULTS,{bass:0,mid:0,treble:0,output:0,stereoWidth:100});
 assert.equal(DSP_COMPRESSOR_DEFAULTS.mode,'preset');
 assert.ok(validateDSPUpdate({dspPreset:'SOFT',masterCeiling:1}).error);
 assert.ok(validateDSPUpdate({dspPreset:'SOFT',limiter:true}).error);
});
test('Compressor has preset, manual and off modes without affecting stereo / EQ',()=>{
 for(const mode of ['preset','manual','off']){
  const parsed=validateDSPUpdate({dspCompressor:{...comp,mode}});
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.value.dspCompressor.mode,mode);
 }
 for(const stereoWidth of [0,100,150]){
  assert.equal(validateDSPUpdate({dspSettings:{...full,stereoWidth}}).value.dspSettings.stereoWidth,stereoWidth);
 }
});
