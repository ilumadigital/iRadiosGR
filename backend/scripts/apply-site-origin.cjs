#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const origin = process.env.IRADIOS_SITE_ORIGIN;
if (!origin || !/^https:\/\/[a-z0-9.-]+$/.test(origin)) {
  console.error('IRADIOS_SITE_ORIGIN must be HTTPS origin (without trailing slash)');
  process.exit(2);
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(absolute); continue; }
    if (!/\.(?:jsx?|tsx?|html|json|css|txt|xml|md)$/.test(entry.name)) continue;
    const s = fs.readFileSync(absolute, 'utf8');
    if (s.includes('__IRADIOS_SITE_ORIGIN__')) {
      fs.writeFileSync(absolute, s.replaceAll('__IRADIOS_SITE_ORIGIN__', origin));
    }
  }
}
for (const dir of ['src','public','controllers','routes','utils','services']) walk(dir);
for (const file of ['server.js','seo.js','index.html']) {
  if (fs.existsSync(file)) {
    const s=fs.readFileSync(file,'utf8');
    fs.writeFileSync(file,s.replaceAll('__IRADIOS_SITE_ORIGIN__',origin));
  }
}
console.log('Applied IRADIOS_SITE_ORIGIN='+origin+' to application copy');
