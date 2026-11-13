'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
const {resolveAdAudioPath,localAudioFile}=require('../backend/services/adAudioDelivery');
const origin='https://stage.iradios.gr';
const url=origin+'/media/audio/user123/spot.mp3';

test('only safe same-host audio upload URLs can resolve into uploads/audio',()=>{
  const options={siteOrigin:origin,uploadRoot:'/tmp/safeuploads'};
  assert.equal(resolveAdAudioPath(url,options),
    path.resolve('/tmp/safeuploads/audio/user123/spot.mp3'));
  for(const attempted of [
    'https://play.iradios.gr/media/audio/user123/spot.mp3',
    'https://evil.invalid/media/audio/user123/spot.mp3',
    'file:///etc/passwd','/media/audio/../secrets.mp3',
    '/media/audio/user123/../../secret.mp3',
    '/media/audio/user123/spot.mp3?secret=1',
    '/media/audio/user123/spot.mp3#fragment',
    '/media/audio/user123/spot.txt',
    '/media/visuals/user123/image.png',
    'https://stage.iradios.gr.evil.invalid/media/audio/user123/spot.mp3',
  ])assert.equal(resolveAdAudioPath(attempted,options),null,attempted);
});
test('missing files and filesystem symlinks never become public audio',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ad-audio-test-'));
  const options={siteOrigin:origin,uploadRoot:temp};
  try{
    const dir=path.join(temp,'audio','user123');
    fs.mkdirSync(dir,{recursive:true});
    assert.equal(await localAudioFile(url,options),null);
    fs.writeFileSync(path.join(dir,'spot.mp3'),Buffer.alloc(1024,1));
    assert.equal(await localAudioFile(url,options),path.join(dir,'spot.mp3'));
    fs.unlinkSync(path.join(dir,'spot.mp3'));
    const outside=path.join(temp,'outside.mp3');
    fs.writeFileSync(outside,Buffer.alloc(1024,1));
    fs.symlinkSync(outside,path.join(dir,'spot.mp3'));
    assert.equal(await localAudioFile(url,options),null);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('staging Nginx blocks private file paths; Express authorizes only active ads',()=>{
  const nginx=read('ops/nginx-stage.conf');
  assert.match(nginx,/location \^~ \/media\/ \{ return 403; \}/);
  assert.doesNotMatch(nginx,/location \^~ \/media\/audio\//);
  const publicAccess=read('backend/utils/stagePublicAccess.js');
  assert.match(publicAccess,/\/api\\\/ads\\\/\[a-f0-9\]\{24\}\\\/media/);
  const controller=read('backend/controllers/adController.js');
  assert.match(controller,/if\(!live\(ad\)\)/);
  assert.match(controller,/sendAdAudio\(res,ad\.audioUrl\)/);
  assert.match(controller,/localAudioFile\(ad\.audioUrl\)/);
  assert.match(controller,/audioUrl:'\/api\/ads\/'/);
  const routes=read('backend/routes/adRoutes.js');
  assert.match(routes,/router\.get\('\/ads\/:id\/media',adController\.streamPublicAudio\)/);
  assert.match(routes,/\/admin\/ads\/:id\/preview-audio'.*\.\.\.admin/);
});
test('previews authenticate owners, validate stored audio codec and skip all metrics',()=>{
  const agency=read('backend/routes/agencyRoutes.js');
  const upload=read('backend/routes/uploadRoutes.js');
  const preview=read('frontend/src/components/ProtectedAudioPreview.jsx');
  assert.match(agency,/router\.get\('\/audio-ads\/:id\/preview-audio',stageOnly/);
  assert.match(agency,/agencyId:req\.user\._id/);
  assert.match(upload,/execFileAsync\('ffprobe'/);
  assert.match(upload,/validatePlayableAdAudio\(req\.file\)/);
  assert.match(preview,/Authorization:'Bearer '/);
  assert.doesNotMatch(preview,/impression|\/click/);
  for(const file of ['frontend/src/pages/CampaignEditor.jsx','frontend/src/pages/AdminAds.jsx',
    'frontend/src/pages/AgencyDashboard.jsx'])
    assert.match(read(file),/ProtectedAudioPreview/);
});
test('original Home and catalog colors are preserved, brand color belongs to sponsored cards',()=>{
  for(const p of ['frontend/src/pages/Home.jsx','frontend/src/pages/Genre.jsx',
    'frontend/src/pages/Region.jsx']){
    assert.doesNotMatch(read(p),/listener-v6-ads\.css/);
  }
  assert.equal(fs.existsSync(path.join(__dirname,'../frontend/src/styles/listener-v6-ads.css')),false);
  const dynamic=read('frontend/src/components/DynamicAdCreative.jsx');
  assert.match(dynamic,/--ir-ad-accent/);
  assert.match(read('frontend/src/styles/dynamic-ad-creative.css'),/var\(--ir-ad-accent/);
  for(const file of ['frontend/src/pages/Genre.jsx','frontend/src/pages/Region.jsx',
    'frontend/src/components/HomeExplore.jsx']){
    const text=read(file);
    assert.match(text,/sparseAdMap/);
    assert.doesNotMatch(text,/index\s*%\s*5\s*===\s*0/);
  }
});
