'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const removedFiles = [
  'frontend/src/components/LiveChat.jsx',
  'frontend/src/pages/MyChat.jsx',
  'backend/models/ChatMessage.js'
];
for (const file of removedFiles) {
  assert.equal(fs.existsSync(path.join(root, file)), false,
    `Retired Live Chat file must stay deleted: ${file}`);
}

const forbidden = /Live\s*Chat|\bLiveChat\b|\bMyChat\b|\bChatMessage\b|\/my-chat\b|\/api\/(?:live-)?chat\b|\b(?:unreadListenerChat|unreadBroadcasterChat|showChat|chatStats|cleanChat)\b|clean-chat|\b(?:chat_history|receive_message|send_message|join_station|leave_station)\b|Εποπτεία\s+Live\s+Chat/iu;
const extensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json', '.md']);
const ignored = new Set(['node_modules', 'dist', 'build', '.git']);
const issues = [];

function checkTree(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      checkTree(full);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name)) &&
               entry.name !== 'package-lock.json') {
      const contents = fs.readFileSync(full, 'utf8');
      const match = forbidden.exec(contents);
      if (match) {
        const line = contents.slice(0, match.index).split('\n').length;
        issues.push(`${path.relative(root, full)}:${line}: ${match[0]}`);
      }
    }
  }
}
checkTree(path.join(root, 'frontend'));
checkTree(path.join(root, 'backend'));
for (const file of ['README.md']) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  const match = forbidden.exec(contents);
  if (match) issues.push(`${file}: ${match[0]}`);
}
assert.deepEqual(issues, [], `Legacy Live Chat references found:\n${issues.join('\n')}`);

const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'frontend/src/App.jsx'), 'utf8');
const mini = fs.readFileSync(path.join(root, 'frontend/src/components/MobileMiniPlayer.jsx'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'frontend/src/components/Footer.jsx'), 'utf8');
for (const event of ['transfer_playback', 'request_devices', 'start_listen', 'stop_listen']) {
  assert.ok(server.includes(event), `Keep working playback event: ${event}`);
}
assert.ok(app.includes('MobileMiniPlayer') && app.includes('Footer'),
  'Desktop and mobile players must remain mounted');
assert.ok(mini.includes('onTransferPlayback') && footer.includes('onTransferPlayback'),
  'Device switching must remain on both players');
assert.ok(app.includes('StationProfile') && fs.existsSync(path.join(root,
  'frontend/src/components/StationContactModal.jsx')),
  'Station profiles and the authenticated station contact flow must remain');

console.log('Retired Live Chat references absent; playback and contact flows preserved.');
