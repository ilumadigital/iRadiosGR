import test from 'node:test';
import assert from 'node:assert/strict';
import {sparseAdSlots,sparseAdMap} from './sparseAdSlots.js';

test('spots are infrequent with 12–18 organic radios between every ad',()=>{
  for(const seed of [1,2,42,8723,0x7fffffff,-3]){
    const slots=sparseAdSlots(400,{seed});
    assert.ok(slots[0]>=12&&slots[0]<=18);
    assert.ok(slots.length<=Math.floor(400/12));
    for(let i=1;i<slots.length;i++)
      assert.ok(slots[i]-slots[i-1]>=12&&slots[i]-slots[i-1]<=18);
  }
});
test('random appearance per visit but stable across player render and no first-row ad',()=>{
  const a=sparseAdSlots(300,{seed:457});
  assert.deepEqual(a,sparseAdSlots(300,{seed:457}));
  assert.notDeepEqual(a,sparseAdSlots(300,{seed:1201}));
  assert.deepEqual(sparseAdSlots(10,{seed:457}),[]);
  assert.ok(a[0]>=12);
});
test('all slots remain inside the visible station count and rotating creatives',()=>{
  const banners=[{_id:'1'},{_id:'2'},{_id:'3'}];
  const map=sparseAdMap(101,banners,14);
  assert.ok(map.size>0&&map.size<=9);
  assert.ok([...map.keys()].every(index=>index>0&&index<101));
  assert.equal(new Set([...map.values()].map(item=>item._id)).size,3);
  assert.equal(sparseAdMap(500,[],14).size,0);
});
test('maxAds bounds additional injections',()=>{
  assert.ok(sparseAdSlots(500,{seed:12,maxAds:2}).length<=2);
});
