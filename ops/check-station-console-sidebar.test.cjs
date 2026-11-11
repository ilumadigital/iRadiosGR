'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'frontend/src/pages/Backoffice.jsx'),'utf8');

test('Station Console v6 uses original iRadios PNG assets and a small identity card',()=>{
  assert.match(source,/src="\/iradios-logo\.png"/);
  assert.match(source,/src="\/noicon-iradios-app-logo\.png"/);
  assert.match(source,/Station Console <span className="text-\[#caff00\]">v6<\/span>/);
  assert.match(source,/iRadiosGR Station Console v6 \| Backoffice/);
  assert.match(source,/Private workspace/);
  for(const asset of ['iradios-logo.png','noicon-iradios-app-logo.png'])
    assert.ok(fs.existsSync(path.join(root,'frontend/public',asset)),asset+' must exist in public assets');
});

test('WebDSP Preview is a prominent eligible-only feature directly above navigation',()=>{
  const start=source.indexOf('<aside aria-label="Station Console πλοήγηση"');
  const end=source.indexOf('</aside>',start);
  assert.ok(start>=0&&end>start,'sidebar should exist');
  const sidebar=source.slice(start,end);
  const hero=sidebar.indexOf('<NavLink to="/backoffice/audio-preview"');
  const nav=sidebar.indexOf('<nav aria-label="Εργαλεία Station Console"');
  assert.ok(hero>=0&&nav>hero,'WebDSP hero must precede regular navigation/Home');
  assert.match(sidebar,/data\.user\.role==='broadcaster'&&previewStations\.length>0/);
  assert.match(sidebar,/WebDSP Preview/);
  assert.match(sidebar,/ΔΟΚΙΜΑΣΕ ΤΟΝ ΗΧΟ/);
  assert.match(sidebar,/previewStations\[0\]\.name/);
  assert.doesNotMatch(source,/\{to:'\/backoffice\/audio-preview',label:'WebDSP Preview'/,
    'preview must not be buried inside the PRO tools menu');
});

test('Sidebar remains compact with short-viewport accordion and accessible overflow fallback',()=>{
  assert.match(source,/window\.innerHeight<810/);
  assert.match(source,/const accordionSidebar=shortSidebar\|\|admin/);
  assert.match(source,/setExpandedSection/);
  assert.match(source,/aria-expanded=\{open\}/);
  assert.match(source,/min-h-0 flex-1 space-y-2 overflow-y-auto/);
  assert.match(source,/lg:overflow-hidden/);
  assert.match(source,/min-h-\[35px\]/);
  assert.match(source,/grid-cols-2 gap-1\.5 border-t/);
  assert.match(source,/locked=\{Boolean\(item\.entitlement\)/,
    'entitlement controls must stay intact');
});
