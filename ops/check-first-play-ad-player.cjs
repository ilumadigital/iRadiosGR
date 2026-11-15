'use strict';
// First Play player regression: isolated, no MongoDB, network or browser.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../frontend/src',name),'utf8');
const footer=read('components/Footer.jsx');
const mobile=read('components/MobileMiniPlayer.jsx');
const adOnly=read('components/AdOnlyPlayback.jsx');
const app=read('App.jsx');

test('desktop shows ad identity instead of Select Station for First Play without history',()=>{
 assert.match(footer,/isPlayingAd && currentAdInfo \? \(\s*<AdOnlyDesktopIdentity/);
 assert.match(footer,/\(currentStation \|\| isPlayingAd\) &&/);
 assert.match(footer,/isMaximized && !currentStation && isPlayingAd && currentAdInfo && \(/);
 assert.match(footer,/<AdOnlyFullscreen ad=\{currentAdInfo\}/);
 assert.match(footer,/onAdClick=\{handleLogoTitleClick\}/);
 assert.match(footer,/Επιλέξτε Σταθμό/,'empty state is kept only for no station and no active ad');
});

test('mobile renders ad mini and expands fullscreen when no station exists',()=>{
 const guard=mobile.indexOf('if (!currentStation) return isPlayingAd && currentAdInfo');
 const click=mobile.indexOf('const handleAdClick =');
 assert.ok(guard>0,'explicit first-play branch is present');
 assert.ok(click>=0&&click<guard,'ad CTA handler is available before the station-only branch');
 assert.match(mobile,/<AdOnlyMobilePlayer ad=\{currentAdInfo\}/);
 assert.match(mobile,/onAdClick=\{handleAdClick\}/);
 assert.match(mobile,/\) : null;/,'when idle with no station the mobile player stays absent');
});

test('standalone ad is presentation-only, complete, skip-safe and CTA-aware',()=>{
 for(const name of ['AdOnlyDesktopIdentity','AdOnlyFullscreen','AdOnlyMobilePlayer']){
  assert.ok(adOnly.includes('export function '+name+'('),name+' exists');
 }
 assert.ok(!/<audio\b|new Audio\s*\(/.test(adOnly),'no second audio engine');
 assert.ok(!/station\s*:\s*\{/.test(adOnly),'does not manufacture a fake station');
 assert.match(adOnly,/ad\.client\|\|'Διαφήμιση'/);
 assert.match(adOnly,/ad\.title\|\|'Διαφημιστικό διάλειμμα'/);
 assert.match(adOnly,/ad\.logoUrl/);
 assert.match(adOnly,/Sponsored/);
 assert.match(adOnly,/ad\.linkUrl&&<button/,'CTA appears only with a destination');
 assert.match(adOnly,/onClick=\{onAdClick\}/,'CTA invokes existing tracking handler');
 assert.match(adOnly,/AdSkipControl isPlayingAd secondsUntilSkip=\{adSkipCountdown\} onSkip=\{onSkipAd\}/);
 assert.match(adOnly,/data-ad-only="mobile-mini"/);
 assert.match(adOnly,/aria-modal="true"/);
 assert.match(adOnly,/onCloseRef\.current\?\.\(\)/,'Escape closes without repeated focus resets');
});

test('paid/legacy CTA accounting and streaming stay with the existing App player',()=>{
 assert.match(footer,/currentAdInfo\.ticketCapability\?'\/api\/advertising\/v2\/click'/);
 assert.match(mobile,/currentAdInfo\.ticketCapability\?'\/api\/advertising\/v2\/click'/);
 assert.match(footer,/\/api\/ads\/\$\{currentAdInfo\._id\}\/click/);
 assert.match(mobile,/\/api\/ads\/\$\{currentAdInfo\._id\}\/click/);
 assert.match(app,/adSkipCountdown=\{adSkipCountdown\} onSkipAd=\{skipCurrentAd\}/);
 assert.match(app,/currentStation=\{currentStation\} isPlayingAd=\{isPlayingAd\} currentAdInfo=\{currentAdInfo\}/);
});
