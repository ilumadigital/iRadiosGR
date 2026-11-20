import test from 'node:test';
import assert from 'node:assert/strict';
import {heroColor,heroAudioBands,heroWavePoints} from './heroAudioWaves.js';

test('Hero palette accepts sampled station RGB and rejects invalid values',()=>{
  assert.deepEqual(heroColor('190 70 24'),[190,70,24]);
  assert.deepEqual(heroColor('0 180 255'),[0,180,255]);
  assert.deepEqual(heroColor('999 20 2'),[134,165,56]);
  assert.deepEqual(heroColor(''),[134,165,56]);
  assert.deepEqual(heroColor('rgb(10,2,3)'),[134,165,56]);
});
test('real FFT bins respond to bass and do not fabricate audio energy at silence',()=>{
  const silence=new Uint8Array(1024);
  assert.deepEqual(heroAudioBands(silence),{bass:0,mid:0,high:0,energy:0});
  const low=new Uint8Array(1024);
  for(let i=1;i<8;i++)low[i]=220;
  const sampled=heroAudioBands(low);
  assert.ok(sampled.bass>.4,'bass bins drive reaction');
  assert.equal(sampled.mid,0);
  assert.equal(sampled.high,0);
  assert.ok(sampled.energy>0);
  assert.deepEqual(heroAudioBands(null),{bass:0,mid:0,high:0,energy:0});
});
test('wave remains responsive in landscape and portrait; loud bass changes geometry',()=>{
  for(const [w,h] of [[390,720],[1366,768],[800,360],[2560,1440]]){
    const still=heroWavePoints(w,h,0,0,0,0,0);
    const beat=heroWavePoints(w,h,1,.5,.2,0,0);
    assert.equal(still.length,81);
    assert.deepEqual(still.map(p=>p[0]),beat.map(p=>p[0]));
    assert.notDeepEqual(still,beat,'actual bass moves the wave');
    for(const point of beat){
      assert.ok(point.every(Number.isFinite));
      assert.ok(point[0]>=0&&point[0]<=w);
    }
  }
});
