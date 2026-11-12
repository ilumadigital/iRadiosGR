'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {publicWidgetNativeSnapshot}=require('../services/widgetNativeNow');
const now=Date.parse('2026-11-12T11:00:00Z');
const doc={
  nativeNow:{raw:'Native Artist - Native Track',
    confirmedAt:new Date(now-1000),changedAt:new Date(now-3000)},
  nativeShow:{raw:'Live DJ Show',confirmedAt:new Date(now-2000)},
  currentAI:{kind:'manual',raw:'PRIVATE ARTIST - PRIVATE SONG',
    recognizedAt:new Date(now-1000),expiresAt:new Date(now+120000)}
};
test('station widget displays native RDS but never exposes Premium ACR data',()=>{
  const data=publicWidgetNativeSnapshot(doc,now);
  assert.equal(data.title,'Native Artist - Native Track');
  assert.equal(data.source,'station');
  assert.equal(data.foundWithAI,false);
  assert.equal(data.broadcastHint,'Live DJ Show');
  assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
});
test('unconfirmed and expired station tracks do not leak stale songs',()=>{
  const data=publicWidgetNativeSnapshot({...doc,nativeNow:{
    ...doc.nativeNow,confirmedAt:new Date(now-9*60000)
  }},now);
  assert.equal(data.title,'');
  assert.equal(data.source,'none');
});
test('AI-only snapshot never exposes AI metadata',()=>{
  assert.deepEqual(publicWidgetNativeSnapshot({currentAI:doc.currentAI},now),
    {title:'',source:'none',foundWithAI:false});
});
