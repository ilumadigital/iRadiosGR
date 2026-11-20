'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {safeDescriptor}=require('../services/playDevices');
test('device metadata is bounded and cannot supply an arbitrary type',()=>{
 const d=safeDescriptor({deviceType:'hacker',clientType:'native',brand:'a'.repeat(100),
 displayName:' Hi\u0000\nthere ',model:'m'.repeat(200)});
 assert.equal(d.deviceType,'unknown');assert.equal(d.clientType,'browser');
 assert.equal(d.brand.length,48);assert.equal(d.model.length,90);
 assert.equal(d.displayName,' Hithere '.trim());
});
test('PWA marker is accepted only as app and names have safe defaults',()=>{
 assert.equal(safeDescriptor({clientType:'app'}).clientType,'app');
 assert.equal(safeDescriptor({}).displayName,'Άγνωστη συσκευή');
});
