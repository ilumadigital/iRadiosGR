'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LIMITS,sanitizeAdDesign}=require('../backend/services/adDesignRules');

test('every wide placement has separate strictly enforced desktop/mobile bounds',()=>{
  for(const [placement,range] of Object.entries(LIMITS)){
    const ok=sanitizeAdDesign({[placement]:{
      desktopHeight:range.desktop[0],mobileHeight:range.mobile[1],
      layout:'image-right',effect:'glow',zoom:1.3,overlay:75,
      overlayColor:'#103040',secondaryColor:'#374151',textAlign:'right',
      heightMode:'custom',imageX:80,imageY:15,visualWidth:55,titleScale:110,
      glowIntensity:35
    }});
    assert.equal(ok[placement].desktopHeight,range.desktop[0]);
    assert.throws(()=>sanitizeAdDesign({[placement]:{desktopHeight:range.desktop[1]+1}}),/Unsafe/);
    assert.throws(()=>sanitizeAdDesign({[placement]:{mobileHeight:range.mobile[0]-1}}),/Unsafe/);
  }
});
test('cannot pass CSS injection, unknown placements, exaggerated crop and large dimensions',()=>{
  for(const input of [
    {radio_feed:{desktopHeight:400}},
    {hero:{desktopHeight:10000}},
    {hero:{mobileHeight:12}},
    {hero:{zoom:20}},
    {hero:{imageX:-1}},
    {hero:{overlay:0}},
    {hero:{effect:'url(https://example.invalid/pixel)'}},
    {hero:{secondaryColor:'rgb(255,0,0)'}},
    {hero:{style:'position:fixed;inset:0'}},
    {hero:{constructor:'hijack'}},
    null,[],{hero:null}
  ])assert.throws(()=>sanitizeAdDesign(input));
});
test('design settings are scoped to one placement and do not inject grid-card styling',()=>{
  const design=sanitizeAdDesign({hero:{desktopHeight:300},station_profile:{desktopHeight:250}});
  assert.equal(design.hero.desktopHeight,300);
  assert.equal(design.station_profile.desktopHeight,250);
  assert.deepEqual(sanitizeAdDesign({}),{});
});
