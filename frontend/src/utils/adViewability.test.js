import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startVisualViewabilityTracking} from './adViewability.js';

function setup(minimumMs=1000){
 let ms=0,nextId=1,observer=null,qualifications=0;
 const jobs=new Map(),listeners=new Map();
 const target={isConnected:true};
 const visibility={
  hidden:false,visibilityState:'visible',
  addEventListener:(name,fn)=>listeners.set(name,fn),
  removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}
 };
 class Observer{
  constructor(callback,config){this.callback=callback;this.config=config;this.disconnected=false;observer=this;}
  observe(node){this.node=node;}
  disconnect(){this.disconnected=true;}
  emit(ratio){this.callback([{
   target,intersectionRatio:ratio,isIntersecting:ratio>0
  }]);}
 }
 const cancel=id=>jobs.delete(id);
 const schedule=(fn,delay)=>{const id=nextId++;jobs.set(id,{at:ms+delay,fn});return id;};
 const stop=startVisualViewabilityTracking(target,{minimumMs,
  onQualified:()=>{qualifications++;},Observer,visibility,
  now:()=>ms,schedule,cancel});
 function advance(delta){
  const until=ms+delta;
  for(let i=0;i<30;i++){
   const due=[...jobs].filter(([,job])=>job.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;
   const [id,job]=due;
   jobs.delete(id);ms=job.at;job.fn();
  }
  ms=until;
 }
 function setVisible(visible){
  visibility.hidden=!visible;
  visibility.visibilityState=visible?'visible':'hidden';
  listeners.get('visibilitychange')?.();
 }
 return {stop,target,observer:()=>observer,advance,setVisible,
  jobs,visibility,listeners,qualified:()=>qualifications};
}
test('a 50% continuous foreground second qualifies exactly once',()=>{
 const x=setup();
 assert.deepEqual(x.observer().config.threshold,[0,.5,1]);
 x.observer().emit(.5);
 x.advance(999);
 assert.equal(x.qualified(),0);
 x.advance(1);
 assert.equal(x.qualified(),1);
 assert.equal(x.observer().disconnected,true);
 x.observer().emit(1);
 x.advance(4000);
 assert.equal(x.qualified(),1);
 assert.equal(x.jobs.size,0);
});
test('hero takes two seconds of uninterrupted 50% visibility',()=>{
 const x=setup(2000);
 x.observer().emit(.8);
 x.advance(1800);
 assert.equal(x.qualified(),0);
 x.advance(200);
 assert.equal(x.qualified(),1);
});
test('49% visibility, background and re-entry reset the continuous clock',()=>{
 const x=setup();
 x.observer().emit(.7);
 x.advance(800);
 x.observer().emit(.49);
 x.advance(300);
 assert.equal(x.qualified(),0);
 x.observer().emit(.8);
 x.advance(500);
 x.setVisible(false);
 x.advance(1500);
 x.setVisible(true);
 x.advance(999);
 assert.equal(x.qualified(),0);
 x.advance(1);
 assert.equal(x.qualified(),1);
});
test('disconnected cards and cleanup cannot create delayed impressions',()=>{
 const x=setup();
 x.observer().emit(.8);
 x.target.isConnected=false;
 x.advance(2000);
 assert.equal(x.qualified(),0);
 x.stop();
 assert.equal(x.jobs.size,0);
 assert.equal(x.listeners.size,0);
 const y=setup();
 y.observer().emit(1);
 y.stop();
 y.advance(1500);
 assert.equal(y.qualified(),0);
});
test('missing observer APIs fail closed instead of treating loading as a view',()=>{
 const target={isConnected:true};
 let count=0;
 const stop=startVisualViewabilityTracking(target,{Observer:null,visibility:null,
  onQualified:()=>count++});
 stop();
 assert.equal(count,0);
});
test('listener banner metric integration remains legacy-only and uses tracker',()=>{
 const src=fs.readFileSync(new URL('../components/AdPlacementLink.jsx',import.meta.url),'utf8');
 assert.match(src,/startVisualViewabilityTracking\(node\.current/);
 assert.match(src,/minimumMs:\(placement\|\|banner\.placement\?\.\[0\]\)==='hero'\?2000:1000/);
 assert.doesNotMatch(src,/typeof IntersectionObserver==='undefined'\)\{track\(\)/);
 const controller=fs.readFileSync(new URL('../../../backend/controllers/bannerController.js',import.meta.url),'utf8');
 assert.match(controller,/if\(!live\(banner\)\|\|banner\.campaignId\)/);
 assert.match(controller,/activeCampaignQuery\(\),campaignId:null/);
});
