'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const embed=read('frontend/src/components/StationEmbed.jsx');
const cfg=read('frontend/src/pages/StationWidgetConfigurator.jsx');
const css=read('frontend/src/styles/station-embeds.css');

const player=embed.split('function MiniPlayer(')[1]?.split('function Program(')[0];
const program=embed.split('function Program(')[1]?.split('return <main className="ir-embed flex flex-col"')[0];
assert.ok(player,'mini player source available');
assert.ok(program,'mini program source available');
assert.doesNotMatch(player,/<ArtworkBackground/, 'mini player has no full-cover background');
assert.doesNotMatch(program,/<ArtworkBackground/, 'mini program has no producer-photo background');
assert.match(player,/<MiniBackground station=\{station\}\/>/);
assert.match(program,/<MiniBackground station=\{station\}\/>/);
assert.match(player,/<ArtworkStack station=\{station\} rds=\{rds\}/,
  'song/show artwork stays in mini player tile');
assert.match(program,/<ArtworkVisual station=\{station\} src=\{active\.imageUrl\}/,
  'producer photo stays in mini program tile');
assert.match(embed,/function MiniBackground\(\{station\}\)\{\s*const brandRgb=useStationAmbient\(station\?\.logo\)/,
  'mini background uses the station-logo palette, not album artwork');
assert.match(css,/\.ir-embed__mini-background\s*\{[\s\S]*?rgb\(var\(--ir-mini-rgb\)/,
  'mini background is a color gradient');
assert.doesNotMatch(cfg,/\bsetTheme\b|name:'Light'|\?theme=light|Εμφάνιση<\/h2>/,
  'configurator must not expose a Light/Dark appearance switch');
assert.match(cfg,/<iframe key=\{previewUrl\}/, 'embeds still preview as interactive iframes');
assert.match(cfg,/const code=previewUrl\?embedSnippet/, 'embed code generation is retained');
console.log('Mini artwork tiles, branded backgrounds, and dark-only configurator: OK');
