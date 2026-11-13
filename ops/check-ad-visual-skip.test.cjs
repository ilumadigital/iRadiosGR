'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('one audio skip policy and timer controls every player variant',()=>{
  const app=read('frontend/src/App.jsx');
  assert.match(app,/sampleAdListenClock\(adListenClockRef\.current/);
  assert.match(app,/canSkipAd\(adListenClockRef\.current,audio\.duration\)/);
  assert.match(app,/adQueue\.current=\[\];/);
  assert.match(app,/onWaiting=\{\(\) => \{/);
  assert.match(app,/onSeeking=\{\(\)\s*=>/);
  assert.match(app,/logAdOutcome\('completed',ad\)/);
  assert.match(app,/logAdOutcome\('skipped',ad\)/);
  assert.match(app,/onSkipAd=\{skipCurrentAd\}/);
  for(const p of ['Footer','MobileMiniPlayer','DesktopFullPlayer','CarMode']){
    const component=read('frontend/src/components/'+p+'.jsx');
    assert.match(component,/AdSkipControl/);
    assert.match(component,/adSkipCountdown/);
    assert.match(component,/onSkipAd/);
  }
});
test('skips and completions follow campaign eligibility and cannot count an editor preview',()=>{
  const routes=read('backend/routes/adRoutes.js');
  const controller=read('backend/controllers/adController.js');
  const access=read('backend/utils/stagePublicAccess.js');
  const model=read('backend/models/Ad.js');
  for(const type of ['completed','skipped']){
    assert.ok(routes.includes("'/ads/:id/"+type+"'"));
    assert.ok(access.includes('completed|skipped'));
  }
  // Legacy outcome metrics must reject unfunded/unqualified paid v2 creatives.
  assert.match(controller,/if\(!live\(ad\)\|\|ad\.campaignId\)/);
  assert.match(controller,/permitMetric\(req,'audio-'/);
  for(const field of ['skips','completions'])assert.ok(model.includes(field+':'));
  assert.doesNotMatch(read('frontend/src/components/ProtectedAudioPreview.jsx'),/fetch\(.*\/(completed|skipped)/);
});
test('Visual Studio is a full-page editor with per-placement save and a device preview',()=>{
  const editor=read('frontend/src/pages/CampaignEditor.jsx');
  const studio=read('frontend/src/components/VisualAdStudioControls.jsx');
  const dynamic=read('frontend/src/components/DynamicAdCreative.jsx');
  const css=read('frontend/src/styles/dynamic-ad-creative.css');
  assert.match(editor,/VisualAdStudioControls/);
  assert.match(editor,/designConfig:\{\.\.\.\(old\.designConfig/);
  assert.match(editor,/previewMobile=\{previewDevice==='mobile'\}/);
  for(const field of ['desktopHeight','mobileHeight','zoom','imageX','imageY',
    'overlay','glowIntensity','visualWidth','titleScale','effect','layout']){
    assert.ok(studio.includes(field),'missing '+field);
  }
  assert.match(dynamic,/adDesignFor\(banner,variant\)/);
  assert.match(css,/ir-dynamic-ad--layout-image-right/);
  assert.match(css,/ir-dynamic-ad--simulate-mobile/);
  assert.match(css,/ir-dynamic-ad--effect-glass/);
  assert.ok(!read('frontend/src/pages/Home.jsx').includes('listener-v6-ads.css'));
});
test('backend prevents unbounded creative sizes and gives Agency the same limits',()=>{
  assert.match(read('backend/models/BannerAd.js'),/designConfig/);
  assert.match(read('backend/controllers/bannerController.js'),/sanitizeAdDesign\(patch\.designConfig\)/);
  assert.match(read('backend/routes/agencyRoutes.js'),/sanitizeAdDesign\(patch\.designConfig\)/);
});
