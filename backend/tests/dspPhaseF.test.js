'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DSP_DEFAULTS,DSP_PRESETS,PEAK_CEILING_DBFS,validateDSPUpdate}=require('../services/dspConfig');
const full={bass:3,mid:.5,treble:-2,output:-1,stereoWidth:125};

test('Phase F supports all existing studio presets',()=>{
 assert.deepEqual(DSP_PRESETS,['OFF','SOFT','NORMALIZE','ULTRABAND','ULTRA','OMNIA','0DB_LEVELER']);
});
test('Independent EQ and stereo settings persist alongside a preset',()=>{
 const parsed=validateDSPUpdate({dspPreset:'OMNIA',dspSettings:full});
 assert.equal(parsed.error,undefined);
 assert.deepEqual(parsed.value,{dspPreset:'OMNIA',dspSettings:full});
});
test('Legacy preset-only updates stay backwards compatible',()=>{
 assert.deepEqual(validateDSPUpdate({dspPreset:'SOFT'}),{value:{dspPreset:'SOFT'}});
});
test('Partial advanced settings cannot erase other faders',()=>{
 assert.match(validateDSPUpdate({dspSettings:{bass:2}}).error,/ρυθμίσεις/);
});
test('Unknown fields, NaN, infinity and numeric strings cannot bypass validation',()=>{
 for(const invalid of [
   {dspPreset:'SOFT',isFeatured:true},
   {dspPreset:'FAKE'},
   {dspSettings:{...full,bass:'8'}},
   {dspSettings:{...full,mid:NaN}},
   {dspSettings:{...full,output:Infinity}},
   {dspSettings:{...full,stereoWidth:151}},
   {dspSettings:{...full,output:3.01}},
   {dspSettings:{...full,extra:1}},
   {dspSettings:null},
   {}
 ])assert.ok(validateDSPUpdate(invalid).error,JSON.stringify(invalid));
});
test('Safe defaults and fixed master ceiling do not admit a bypass',()=>{
 assert.deepEqual(DSP_DEFAULTS,{bass:0,mid:0,treble:0,output:0,stereoWidth:100});
 assert.equal(PEAK_CEILING_DBFS,-0.5);
 assert.ok(validateDSPUpdate({...full,masterCeiling:1}).error);
});
test('End points accept 0% mono and 150% stereo width',()=>{
 for(const stereoWidth of [0,100,150]){
  const parsed=validateDSPUpdate({dspSettings:{...full,stereoWidth}});
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.value.dspSettings.stereoWidth,stereoWidth);
 }
});
