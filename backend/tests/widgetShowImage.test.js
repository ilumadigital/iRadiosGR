'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LIMIT_BYTES,approvedShowImage,imageContentType}=
  require('../services/widgetShowImage');

const idImage='https://cdn.example.org/program/dj-photo.jpg?version=2';
const validSchedule=[{day:4,startTime:'20:00',title:'DJ Set',imageUrl:idImage}];
test('only exact approved schedule photos are eligible for image proxying',()=>{
  assert.equal(approvedShowImage(validSchedule,idImage),idImage);
  assert.equal(approvedShowImage(validSchedule,'https://cdn.example.org/private.jpg'),null);
  assert.equal(approvedShowImage([],idImage),null);
  assert.equal(approvedShowImage(null,idImage),null);
  assert.equal(approvedShowImage(validSchedule,42),null);
  assert.equal(approvedShowImage(validSchedule,'x'.repeat(801)),null);
});
test('SSRF hostnames and schemes are rejected even when present in schedule',()=>{
  for(const url of [
    'http://localhost/admin','http://127.0.0.1/private',
    'http://10.0.0.1/photo','http://192.168.1.3/private',
    'http://172.17.0.2/private','http://169.254.169.254/latest/meta-data',
    'ftp://cdn.example.org/photo.jpg','https://user:pass@cdn.example.org/photo.jpg',
    'http://cdn.example.org:8080/photo.jpg'
  ]){
    assert.equal(approvedShowImage([{imageUrl:url}],url),null,url);
  }
});
test('only complete, bounded raster image payloads are served',()=>{
  const jpeg=Buffer.alloc(24);
  jpeg.set([255,216,255,0,0,0],0);
  jpeg.set([255,217],22);
  assert.equal(imageContentType(jpeg),'image/jpeg');
  assert.equal(imageContentType(jpeg.subarray(0,22)),null,'truncated JPEG');
  const png=Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(8),
    Buffer.from('IEND'),Buffer.alloc(4)
  ]);
  assert.equal(imageContentType(png),'image/png');
  const webp=Buffer.alloc(30);
  webp.write('RIFF',0);webp.writeUInt32LE(22,4);webp.write('WEBP',8);
  assert.equal(imageContentType(webp),'image/webp');
  webp.writeUInt32LE(900,4);
  assert.equal(imageContentType(webp),null);
  assert.equal(imageContentType(Buffer.from('<script>alert(1)</script>')),null);
  assert.equal(imageContentType(Buffer.from('<svg onload="alert(1)"/>')),null);
  assert.equal(imageContentType(Buffer.alloc(LIMIT_BYTES)),null);
});
