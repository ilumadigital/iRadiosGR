'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
// Pure diagnostics tests must not initialize MongoDB models or open sockets.
const Module=require('node:module');
const original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../models/Station'&&parent?.filename?.endsWith('/stageStreamProxy.js'))
  return {};
 return original.call(this,request,parent,isMain);
};
let diagnostics;
try{diagnostics=require('../services/streamDiagnostics');}
finally{Module._load=original;}
const {diagnose,titleFromText,codecFromHeaders}=diagnostics;
const fake=(url)=>{
 if(url.endsWith('/live'))return {status:200,headers:{
  'content-type':'audio/mpeg','icy-br':'128','icy-name':'Station One','icy-metaint':'5'
 },buffer:Buffer.from([1,2,3,4,5,2,...Buffer.from("StreamTitle='DJ - Track';".padEnd(32,'\0'))])};
 return {status:200,headers:{'content-type':'application/json'},
  buffer:Buffer.from(JSON.stringify({artist:'Artist',song:'Custom title'}))};
};
test('Stream and custom metadata are reported separately; custom wins',async()=>{
 const calls=[];
 const value=await diagnose({stream:'https://radio.example/live',metadata:'https://radio.example/current.json'},
  async(url,options)=>{calls.push({url,options});return fake(url);});
 assert.equal(value.stream.reachable,true);
 assert.equal(value.stream.likelyPlayable,true);
 assert.equal(value.stream.httpStatus,200);
 assert.equal(value.stream.codec,'MP3');
 assert.equal(value.stream.bitrateKbps,128);
 assert.equal(value.customMetadata.title,'Artist - Custom title');
 assert.equal(value.effectiveMetadata.source,'custom');
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.options.maxBytes<=65536));
});
test('HTTP 200 with HTML is reachable but not playable',async()=>{
 const x=await diagnose({stream:'https://radio.example/live'},async()=>({
  status:200,headers:{'content-type':'text/html'},buffer:Buffer.from('<html>nope</html>')
 }));
 assert.equal(x.stream.reachable,true);
 assert.equal(x.stream.likelyPlayable,false);
});
test('Private URL SSRF is blocked before any network request',async()=>{
 let requests=0;
 for(const stream of ['http://127.0.0.1/','http://localhost/live','file:///etc/passwd']){
  await assert.rejects(()=>diagnose({stream},async()=>{requests++;return fake('');}),{status:400});
 }
 assert.equal(requests,0);
});
test('Upstream errors have safe status but metadata is independently tested',async()=>{
 const x=await diagnose({stream:'https://radio.example/live',metadata:'https://radio.example/now'},
  async url=>{if(url.endsWith('/live'))throw Error('Upstream HTTP 503');return fake(url);});
 assert.equal(x.stream.reachable,false);
 assert.equal(x.stream.httpStatus,503);
 assert.equal(x.customMetadata.title,'Artist - Custom title');
});
test('Metadata parser supports nested Icecast JSON',()=>{
 assert.equal(titleFromText(JSON.stringify({icestats:{source:{title:'Live artist'}}})),'Live artist');
 assert.equal(codecFromHeaders({'content-type':'application/json'}),null);
});
