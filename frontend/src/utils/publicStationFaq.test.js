import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePublicStationFaq,faqFromJsonLd,readInitialPublicStationFaq} from './publicStationFaq.js';

const url='https://stage.iradios.gr/station/sample-fm';
const source={'@context':'https://schema.org','@graph':[
  {'@type':'WebPage',url},
  {'@type':'FAQPage',mainEntity:[
    {'@type':'Question',name:'Ποιες εκπομπές;',acceptedAnswer:{'@type':'Answer',text:'Πρωινό 09:00 Ελλάδας'}},
    {'@type':'Question',name:'Πού βλέπω την playlist;',acceptedAnswer:{'@type':'Answer',text:'Σύνδεση χρήστη'}}
  ]}
]};
test('reads exact server-authored FAQ from initial JSON-LD without creating private data',()=>{
  const doc={querySelectorAll:()=>[{textContent:'{invalid'},{textContent:JSON.stringify(source)}]};
  const items=readInitialPublicStationFaq(url,doc);
  assert.equal(items.length,2);
  assert.equal(items[0].a,'Πρωινό 09:00 Ελλάδας');
  assert.deepEqual(readInitialPublicStationFaq(url+'/wrong',doc),[]);
  assert.deepEqual(faqFromJsonLd(source,'https://other.example/station/sample-fm'),[]);
});
test('rejects duplicates, missing items and caps FAQ to five',()=>{
  const items=Array.from({length:10},(_,i)=>({q:'Ερώτηση '+i,a:'Απάντηση '+i}));
  assert.equal(normalizePublicStationFaq(items).length,5);
  assert.deepEqual(normalizePublicStationFaq([{q:'x',a:'ok'},{q:'X',a:'duplicate'},
    {q:'',a:'bad'},{q:'valid',a:'yes'}]),[{q:'x',a:'ok'},{q:'valid',a:'yes'}]);
});
