import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetSnapshot,widgetOnAirPresentation} from './widgetRdsPresentation.js';

const native={title:'Native Artist - Native Song',source:'station',
  broadcastHint:'Live DJ Show'};
const premium={title:'AI Artist - Recognized Song',source:'acrcloud',
  foundWithAI:true,expiresAt:new Date(Date.now()+60000).toISOString()};
test('guest widgets use native public RDS, without authenticated AI',()=>{
  assert.deepEqual(widgetSnapshot(native,null),{
    title:native.title,source:'station',foundWithAI:false,broadcastHint:native.broadcastHint
  });
});
test('authenticated listener receives App snapshot only when entitled',()=>{
  const result=widgetSnapshot(native,premium);
  assert.equal(result.title,premium.title);
  assert.equal(result.source,'acrcloud');
  assert.equal(result.foundWithAI,true);
});
test('Premium teaser and expired AI cannot leak into public embed',()=>{
  const teaser={...premium,premiumOnly:true};
  assert.equal(widgetSnapshot(native,teaser).title,native.title);
  assert.equal(widgetSnapshot(native,{...premium,
    expiresAt:new Date(Date.now()-10000).toISOString()}).title,native.title);
  assert.equal(widgetSnapshot(null,teaser).title,'');
});
test('RDS switches between verified track and producer and never invents a track',()=>{
  const station={name:'Deseo Radio',slogan:'To Soundtrack της ζωής σου!'};
  const song={artist:'Gentle Nights',title:'Bring Me Back Again'};
  const broadcast={recognizedShow:true,title:'Deseo Selections',
    artist:'Panagiotis Meligdis',imageUrl:'https://example.com/dj.jpg'};
  assert.equal(widgetOnAirPresentation({song,broadcast,showProducer:false,station}).kind,'song');
  const show=widgetOnAirPresentation({song,broadcast,showProducer:true,station});
  assert.equal(show.kind,'show');
  assert.equal(show.image,broadcast.imageUrl);
  assert.equal(show.title,'Deseo Selections');
  assert.equal(widgetOnAirPresentation({station,broadcast:{show:{title:'Live Show',host:'DJ Test'}}}).title,
    'Live Show');
  const idle=widgetOnAirPresentation({station});
  assert.equal(idle.kind,'station');
  assert.equal(idle.title,station.slogan);
});
