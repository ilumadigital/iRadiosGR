'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const player=read('frontend/src/components/StationEmbed.jsx');
const panels=read('frontend/src/components/WidgetEmbedPanels.jsx');
const hook=read('frontend/src/hooks/useStationWidgetRds.js');
const endpoint=read('backend/controllers/widgetShowImageController.js');
const routes=read('backend/routes/catalogNowPlayingRoutes.js');
const stage=read('backend/utils/stagePublicAccess.js');
assert.match(hook,/imageUrl:validShowImage\(show\.imageUrl\)\?show\.imageUrl:null/,
  'the App schedule remains the only producer photo source');
assert.match(player,/function ArtworkVisual\(\{station,src,className='',alt='',showArtwork=false\}\)/);
assert.match(player,/stage==='direct'&&proxy\?'proxy':'logo'/,
  'producer photo retries through trusted proxy before station logo');
assert.match(player,/const proxy=showArtwork\?widgetShowImageProxy\(station,src\):null/,
  'album/other non-show images are not proxied');
assert.match(player,/src=\{showSrc\} showArtwork/,
  'square and mini/hero show artwork remains photo-first');
assert.match(player,/<ArtworkBackground station=\{station\} src=\{active\.imageUrl\} showArtwork\/>/,
  'program square background retries producer photos');
assert.match(player,/src=\{active\.imageUrl\} showArtwork/,
  'mini program producer tile retries photo');
assert.match(panels,/function ProgramPhoto\(/,
  'program list uses the same safe artwork retry');
assert.match(routes,/router\.get\('\/catalog\/widget-show-image\/:stationId'/);
assert.match(stage,/widget-show-image\\\/\[a-f0-9\]\{24\}/,
  'stage public allowlist permits exact 24-hex station route');
assert.match(endpoint,/Station\.findOne\(\{_id:id,status:'approved'\}\)/,
  'producer photo endpoint is approved-only');
assert.match(endpoint,/approvedShowImage\(station\.schedule,candidate\)/,
  'never proxy arbitrary URLs outside the approved schedule');
assert.match(endpoint,/readPublicUrl|cachedImage\(/,
  'bounded DNS-pinned network fetch');
console.log('Producer photo parity across preview, embedded Square/Mini/Hero and Program list: OK');
