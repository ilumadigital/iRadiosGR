#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

(async()=>{
  const {isDesktopDSPDevice}=await import('../frontend/src/utils/dspDevice.js');
  const cases=[
    [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32'},true],
    [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',platform:'MacIntel',maxTouchPoints:0},true],
    [{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},false],
    [{userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile'},false],
    [{userAgent:'Mozilla/5.0 (Linux; Android 14; Tablet)'},false],
    [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:5},false],
    [{userAgent:'Mozilla/5.0 (Windows NT 10.0)',userAgentData:{mobile:true}},false],
    [{userAgent:'Mozilla/5.0 (Xbox)'},false]
  ];
  for(const [nav,expected] of cases)assert.equal(isDesktopDSPDevice(nav),expected,nav.userAgent);
  assert.equal(isDesktopDSPDevice(null),false);
  const hook=read('frontend/src/hooks/useAudioDSP.js');
  const app=read('frontend/src/App.jsx');
  const footer=read('frontend/src/components/Footer.jsx');
  const station=read('frontend/src/pages/StationProfile.jsx');
  const mobile=read('frontend/src/components/MobileMiniPlayer.jsx');
  assert.match(hook,/if\(!desktopDSPDevice\|\|graphRef\.current\)return;/,'Mobile devices must never attach a WebAudio graph');
  assert.match(hook,/personalMode=normalizeListenerMode\(listenerDspMode\)/,'Premium mode must not be station-scoped');
  assert.doesNotMatch(hook,/userOverrides\[String\(currentStation\._id\)\]/);
  assert.match(hook,/createMediaElementSource\(audio\)/,'Audio graph source must be reused on station change');
  assert.match(app,/iluma_listener_dsp_v3:/,'One mode stored per Premium account');
  assert.match(app,/const disableDSP = !isDesktopDSPDevice\(\)/,'No mobile DSP activation during playback');
  assert.match(footer,/currentUser\?\.isPremium === true && isDesktopDSPDevice\(\)/);
  assert.match(station,/currentUser\?\.isPremium === true && isDesktopDSPDevice\(\)/);
  assert.doesNotMatch(mobile,/PremiumSoundModes/);
  console.log('OK: Premium DSP is desktop-only and persists across station switches');
})().catch(err=>{console.error(err);process.exitCode=1;});
