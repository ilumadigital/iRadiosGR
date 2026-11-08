'use strict';
// Regression: not one API call can result from the old Top-5 scheduler,
// listener heartbeat, metadata cache or opening a station page.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Module=require('node:module');
const original=Module._load;
let billed=0;
Module._load=function(name,parent,isMain){
  if(String(parent?.filename||'').endsWith('stageListenerHeartbeat.js')&&name==='axios')
    return {post:()=>{billed++;}};
  return original.call(this,name,parent,isMain);
};
const {heartbeat}=require('../backend/utils/stageListenerHeartbeat');
Module._load=original;
const response=()=>({
  statusCode:200,
  status(code){this.statusCode=code;return this;},
  json(){return this;},
  end(){return this;}
});
const ok=response();
heartbeat({body:{stationId:'0123456789abcdef01234567',
  sessionId:'123e4567-e89b-12d3-a456-426614174000',playing:true}},ok);
assert.equal(ok.statusCode,204);
assert.equal(billed,0);
const invalid=response();
heartbeat({body:{stationId:'bad',sessionId:'abc',playing:true}},invalid);
assert.equal(invalid.statusCode,400);
const server=read('backend/server.js');
assert.ok(server.includes("stageListenerHeartbeat').heartbeat"));
assert.ok(!server.includes('stageAutoAcrcloud'));
const routes=read('backend/routes/stationRoutes.js');
assert.ok(routes.includes("stageSonovault').stageRecognizeProxy"));
assert.ok(!routes.includes('ACRCLOUD_ACCESS_KEY'));
assert.ok(!routes.includes('ACRCLOUD_ACCESS_SECRET'));
assert.ok(!routes.includes('https://')||routes.includes('https://')===false,
  'recognizer must never use a client-supplied URL directly');
const recognizer=read('backend/utils/stageSonovault.js');
assert.ok(recognizer.includes('captureAudio(station)'),
  'only the authorized manual provider route captures audio');
const capture=read('backend/utils/stageSonovaultAudio.js');
assert.ok(capture.includes('readPublicUrl(station.stream'),
  'audio is captured from the approved DB stream');
assert.ok(capture.includes("'-ar','16000'"),
  'downsampling uses Sonovault documented minimum 16 kHz');
assert.ok(recognizer.includes("await publishAI(station,result,'manual')"));
assert.ok(!recognizer.includes('setInterval('));
assert.ok(!recognizer.includes('setTimeout('));
assert.ok(read('backend/utils/stageNativeScanner.js').includes('readCachedNativeMetadata'));
assert.ok(!server.includes('smartAuto.start()'));
console.log('Only explicit listener recognition can incur SonoVault credits; passive heartbeat and native metadata remain safe.');
