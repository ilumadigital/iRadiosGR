'use strict';
// Offline native metadata cache plus opt-in manual recognition safety.
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
const station={_id:'0123456789abcdef01234567',status:'approved',
  stream:'https://radio.example.com/live',
  metadata:'https://meta.example.com/now.json'};
const upstreamUrls=[];
let snapshot=null;
Module._load=function(name,parent,isMain){
  const from=String(parent?.filename||'');
  if(name==='../models/Station'&&/stage(StreamProxy|Metadata|Sonovault)\.js$/.test(from))
    return {findOne:()=>({select:()=>({lean:async()=>station})})};
  if(name==='../models/StationPlaylist'&&
    (from.endsWith('stageSmartTracks.js')||from.endsWith('stageMetadata.js')))
    return {findOne:()=>({select:()=>({lean:async()=>snapshot})}),
      updateOne:async()=>({matchedCount:1})};
  if(name==='./stageNativeNow'&&
    (from.endsWith('stageSmartTracks.js')||from.endsWith('stageMetadata.js')))
    return {
      VALID_FOR:8*60*1000,
      rememberNativeSong:async(_s,raw)=>{snapshot={nativeNow:{raw},currentAI:null};},
      clearInvalidNativeSong:async()=>{},
      snapshotSong:doc=>doc?.nativeNow?
        {title:doc.nativeNow.raw,source:'station',foundWithAI:false}:null
    };
  if(name==='./recordStationTrack'&&from.endsWith('stageMetadata.js'))
    return {recordStationTrack:async()=>true};
  if(name==='./recordStationTrack'&&from.endsWith('stageSmartTracks.js'))
    return {parseTrack:raw=>{
      const m=String(raw||'').match(/^(.+?)\s+-\s+(.+)$/);
      return m?{raw,artist:m[1],title:m[2]}:null;
    },recordStationTrack:async()=>true};
  if(name==='./stageSafeRadioFetch'&&from.endsWith('stageMetadata.js'))
    return {readPublicUrl:async url=>{
      upstreamUrls.push(url);
      return {headers:{'content-type':'application/json'},
        buffer:Buffer.from('{"artist":"Artist","title":"Track"}')};
    }};
  if(name==='./stageSafeRadioFetch'&&from.endsWith('stageSonovault.js'))
    return {readPublicUrl:async()=>{throw new Error('No paid recognition by metadata reads');}};
  if(name==='axios'&&from.endsWith('stageSonovault.js'))
    return {post:async()=>{throw new Error('No paid recognition by metadata reads');}};
  return originalLoad.call(this,name,parent,isMain);
};
const meta=require('../backend/utils/stageMetadata');
const {readPublicUrl}=require('../backend/utils/stageSafeRadioFetch');
const sono=require('../backend/utils/stageSonovault');
Module._load=originalLoad;

assert.equal(meta.cleanTitle('  Foo [Wz] - Bar  '),'Foo - Bar');
assert.equal(meta.cleanTitle('<html>Oops</html>'),'');
assert.equal(meta.titleFromText('{"songtitle":"Test Artist - Test Song"}'),'Test Artist - Test Song');
assert.equal(meta.titleFromText('{"artist":"An Artist","title":"A Track"}'),'An Artist - A Track');
assert.equal(meta.titleFromText('<!doctype html><html>blocked</html>'),'');
const icy=Buffer.alloc(130);icy[10]=3;
Buffer.from("StreamTitle='Artist - Song';").copy(icy,11);
assert.equal(meta.titleFromIcy(icy,{'icy-metaint':'10'}),'Artist - Song');
const urls=meta.metadataUrls(station);
assert.equal(urls[0],station.metadata);
assert.ok(urls.some(url=>url.endsWith('/status-json.xsl')));
const shape=sono.toExistingRecognitionShape({matched:true,results:[
  {title:'A Track',artists:[{name:'An Artist'}],confidence:0.96}
]});
assert.equal(shape.status.code,0);
assert.equal(shape.metadata.music[0].title,'A Track');
assert.equal(sono.toExistingRecognitionShape({matched:false,results:[]}).status.code,1001);

(async()=>{
  await assert.rejects(readPublicUrl('http://127.0.0.1/private'),/Non-public|Private|Invalid/);
  await assert.rejects(readPublicUrl('file:///etc/passwd'),/Unsupported|Invalid/);
  await assert.rejects(readPublicUrl('http://169.254.169.254/latest'),/Non-public|Private|Invalid/);
  // Phase C: endpoint song metadata is only visible to an authenticated user.
  // Admin test identity bypasses paid entitlement lookup; no live accounts needed.
  const req={user:{_id:'0123456789abcdef01234568',role:'admin'},
    query:{stream:station.stream,customMeta:'http://127.0.0.1/private'}};
  const res={code:200,status(n){this.code=n;return this;},
    setHeader(){},json(body){this.body=body;return this;}};
  await meta.readCachedNativeMetadata(station);
  assert.deepEqual(upstreamUrls,[station.metadata]);
  const count=upstreamUrls.length;
  await meta.stageMetadata(req,res);
  assert.equal(res.code,200);
  assert.equal(res.body.title,'Artist - Track');
  assert.equal(upstreamUrls.length,count,'metadata reads do not scan live streams again');
  const previous=process.env.STAGE_ENABLE_SONOVAULT;
  delete process.env.STAGE_ENABLE_SONOVAULT;
  const disabled={status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  await sono.stageRecognizeProxy({body:{stationId:station._id}},disabled);
  assert.equal(disabled.code,503,'paid recognition disabled by default');
  if(previous===undefined)delete process.env.STAGE_ENABLE_SONOVAULT;
  else process.env.STAGE_ENABLE_SONOVAULT=previous;
  console.log('Native metadata safety and disabled-by-default SonoVault tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
