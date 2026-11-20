'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isDSPPreviewCandidate,eligibleDSPPreviewStations}=require('../services/dspPreviewPolicy');
const root=path.resolve(__dirname,'../..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');

test('preview rejects guests, admins, producers and unowned/unapproved stations',()=>{
  const broadcaster={_id:'alice',role:'broadcaster'};
  const own={_id:'a',broadcasterId:'alice',status:'approved'};
  assert.equal(isDSPPreviewCandidate(broadcaster,own),true);
  for(const user of [null,{}, {_id:'alice',role:'admin'}, {_id:'alice',role:'producer'},
    {_id:'bob',role:'broadcaster'}])
    assert.equal(isDSPPreviewCandidate(user,own),false);
  for(const status of ['pending','rejected',null])
    assert.equal(isDSPPreviewCandidate(broadcaster,{...own,status}),false);
  assert.equal(isDSPPreviewCandidate(broadcaster,{...own,broadcasterId:null}),false);
});

test('preview only returns approved owned stations without current paid/grant WebDSP rights',async()=>{
  const user={_id:'alice',role:'broadcaster'};
  const stations=[
    {_id:'one',name:'A',status:'approved',broadcasterId:'alice'},
    {_id:'two',name:'B',status:'approved',broadcasterId:'alice'},
    {_id:'three',name:'C',status:'pending',broadcasterId:'alice'},
    {_id:'four',name:'D',status:'approved',broadcasterId:'bob'}
  ];
  const checked=[];
  const visible=await eligibleDSPPreviewStations(user,stations,async(_user,station,right)=>{
    checked.push(station._id);
    assert.equal(right,'broadcaster.webdsp');
    return station._id==='two';
  });
  assert.deepEqual(visible.map(s=>s._id),['one']);
  assert.deepEqual(checked,['one','two']);
  assert.deepEqual(await eligibleDSPPreviewStations({_id:'bob',role:'guest'},stations,async()=>false),[]);
});

test('preview API requires signed Broadcaster on the staging security boundary',()=>{
  const access=source('backend/utils/stagePublicAccess.js');
  const routes=source('backend/routes/stationRoutes.js');
  const controller=source('backend/controllers/stationController.js');
  assert.match(access,/path==='\/api\/stations\/dsp-preview-access'/);
  assert.match(access,/authorizeRoles\('broadcaster'\)\(req,res,next\)/);
  assert.match(routes,/stations\/dsp-preview-access',protect,authorizeRoles\('broadcaster'\)/);
  assert.match(controller,/eligibleDSPPreviewStations\(req\.user,stations,hasStationRight\)/);
  assert.match(controller,/status:'approved'/);
  assert.match(controller,/\.select\('_id name logo stream isOffline/);
});

test('new registrations use Auto Mode without changing the expired public DSP bypass',()=>{
  const model=source('backend/models/Station.js');
  const projection=source('backend/services/stationBillingProjectionRules.js');
  assert.match(model,/dspPreset:\s*\{\s*type:\s*String,\s*default:\s*'AUTO_MODE'/);
  assert.match(projection,/if\(!rights\.has\('broadcaster\.webdsp'\)\)/);
  assert.match(projection,/data\.dspPreset='OFF'/);
});

test('web preview contains playback only and routes sales CTA through real billing',()=>{
  const view=source('frontend/src/pages/BroadcasterWebDSPPreview.jsx');
  const backoffice=source('frontend/src/pages/Backoffice.jsx');
  const commerce=source('frontend/src/pages/BroadcasterCommerce.jsx');
  assert.match(view,/createDSPGraph\(ctx,ctx\.createMediaElementSource\(audio\)\)/);
  assert.match(view,/applyDSPGraph\(graph,/);
  assert.match(view,/updateAdaptiveDSP\(graph\)/);
  assert.match(view,/toggleBypass/);
  assert.match(view,/\/proxy-stream\?url=/);
  assert.match(view,/getFloatTimeDomainData/);
  assert.match(view,/HEADLINES\[/);
  assert.match(view,/sessionStorage\.setItem\(HEADLINE_KEY/);
  assert.match(view,/sku='?\+\(premium\?'B-PREM':'ADD-DSP'\)/);
  assert.doesNotMatch(view,/method:\s*'PUT'|\/stations\/.*\/dsp'/);
  assert.match(backoffice,/data\.user\.role==='broadcaster'&&previewStations\.length>0/);
  assert.match(backoffice,/<NavLink to="\/backoffice\/audio-preview"/);
  assert.match(backoffice,/previewStations\.length\?<BroadcasterWebDSPPreview/);
  assert.match(commerce,/new URLSearchParams\(window\.location\.search\)\.get\('station'\)/);
});
