'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const player=fs.readFileSync(path.join(root,'frontend/src/components/DesktopFullPlayer.jsx'),'utf8');
const styles=fs.readFileSync(path.join(root,'frontend/src/styles/design-system.css'),'utf8');
const footer=fs.readFileSync(path.join(root,'frontend/src/components/Footer.jsx'),'utf8');

// The overlay itself must never create a viewport-sized vertical scroll.
assert.match(player,/ir-desktop-player fixed inset-0[^"]*h-\[100dvh\][^"]*overflow-hidden/);
assert.doesNotMatch(player,/ir-desktop-player fixed inset-0[^"]*overflow-y-auto/);
assert.match(player,/ir-desktop-player-layout[^"]*h-full min-h-0[^"]*overflow-hidden/);
assert.doesNotMatch(player,/min-h-screen/);
assert.match(player,/ir-desktop-player-main[^"]*min-h-0 flex-1/);
assert.match(player,/ir-desktop-player-header[^"]*shrink-0/);
assert.match(player,/ir-desktop-player-footer[^"]*shrink-0 flex-nowrap/);
assert.match(player,/ir-desktop-player-art[^"]*aspect-square/);
assert.match(styles,/\.ir-desktop-player\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/s);
assert.match(styles,/\.ir-desktop-player-art\s*\{[^}]*width:\s*min\([^}]*100dvh/s);
assert.match(styles,/@media \(min-width: 1024px\) and \(max-height: 720px\)/);
assert.match(styles,/@media \(min-width: 1024px\) and \(max-height: 580px\)/);
assert.match(styles,/\.ir-desktop-player-title\s*\{[^}]*-webkit-line-clamp:\s*3;/s);
assert.ok(footer.includes('<DesktopFullPlayer'),'desktop footer expands the responsive dialog');
assert.ok(player.includes('globalCoverArt'),'live cover-art remains linked');
assert.ok(player.includes('onClick={togglePlayPause}'),'do not break playback controls');
assert.ok(player.includes('<StationPlaylistPanel'),'drawer retains its independently scrollable playlist');
assert.doesNotMatch(player,/<audio\s+[^>]*ref=/i,'the parent App owns the audio node');
console.log('Desktop full-screen viewport fitting contracts passed.');
