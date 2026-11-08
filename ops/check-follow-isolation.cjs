'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { followKey: backendKey } = require('../backend/utils/programFollows');

(async () => {
  const {programFollowKey, findProgramFollow, normalizeFollowLabel} =
    await import(pathToFileURL(path.resolve(__dirname,'../frontend/src/utils/programFollowKeys.mjs')).href);

  const stationId='507f1f77bcf86cd799439011';
  const otherStation='507f191e810c19729de860ea';
  const names=['Release Radar','Εγίρος F','Greg Lef','ANDØR',
    'Έντεχνα Ακούσματα','Morning Show','Νυχτερινές Διαδρομές'];

  const keys=names.map(name=>programFollowKey('show',stationId,name));
  assert.equal(new Set(keys).size,names.length, 'different shows must have different keys');
  for(const name of names){
    const frontend=programFollowKey('show',stationId,name);
    const backend=backendKey('show',stationId,name);
    assert.equal(frontend,backend,'same canonical keys in frontend and backend for '+name);
    assert.ok(normalizeFollowLabel(name),'every show must retain letters');
    assert.notEqual(frontend,programFollowKey('show',otherStation,name),
      'show follows must remain station-specific');
  }

  const rows=names.slice(0,4);
  for(let selected=0;selected<rows.length;selected++){
    const follows=[{
      id:'follow'+selected,kind:'show',stationId,
      label:rows[selected],key:programFollowKey('show',stationId,rows[selected])
    }];
    const states=rows.map(row=>Boolean(findProgramFollow(follows,'show',stationId,row)));
    assert.deepEqual(states, rows.map((_,index)=>index===selected),
      'clicking one show must never select any other show: '+rows[selected]);
    assert.equal(findProgramFollow(follows,'show',otherStation,rows[selected]),undefined);
  }

  const sameDJ=programFollowKey('dj',stationId,'DJ Γιώργος');
  assert.equal(sameDJ,programFollowKey('dj',otherStation,'dj γιωργοσ'),
    'DJ follows intentionally span stations');
  assert.notEqual(sameDJ,programFollowKey('dj',stationId,'DJ Αλέξης'));

  const source=require('node:fs').readFileSync(
    path.resolve(__dirname,'../frontend/src/components/StationScheduleTimeline.jsx'),'utf8');
  assert.match(source,/findProgramFollow\(follows,kind,station\._id,label\)/);
  assert.match(source,/programFollowKey\(kind,station\._id,label\)/);
  assert.doesNotMatch(source,/const normalize=value=>/, 'broken duplicate regex must be removed');
  assert.match(source,/setFollows\(payload\.follows\|\|\[\]\)/,
    'follow UI must be server-synchronized after each mutation');
  console.log('Follow isolation: individual station shows, Greek/Latin titles and DJ identity passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
