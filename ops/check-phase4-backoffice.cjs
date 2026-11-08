'use strict';
// Phase 4: no MongoDB, external services, uploaded media, or paid calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const originalLoad=Module._load;
const ownerId='aaaaaaaaaaaaaaaaaaaaaaaa';
const otherId='bbbbbbbbbbbbbbbbbbbbbbbb';
const songId='111111111111111111111111';
const foreignId='222222222222222222222222';
const doc=s=>{
  const value={...s};
  value.toObject=()=>Object.fromEntries(Object.entries(value).filter(([k])=>k!=='save'&&k!=='toObject'));
  value.save=async()=>value;
  value.set=edits=>Object.assign(value,edits);
  return value;
};
const all=[
  doc({_id:songId,name:'Owner FM',genre:'Pop',stream:'https://radio.example/live',
    broadcasterId:ownerId,status:'approved',logo:'/media/radioassets/logo.png',
    plays:1234,popularity:100,pendingEdits:null,schedule:[]}),
  doc({_id:foreignId,name:'Other Radio',genre:'Rock',stream:'https://radio.example/rock',
    broadcasterId:otherId,status:'approved',logo:'/media/radioassets/logo2.png',
    plays:120,popularity:50,pendingEdits:null,schedule:[]})
];
function matches(s,q={}){
  return Object.entries(q).every(([key,value])=>{
    if(key==='pendingEdits'&&value?.$ne===null)return Boolean(s.pendingEdits);
    return String(s[key])===String(value);
  });
}
const Station={
  find:q=>({select:()=>({sort:()=>({limit:()=>({lean:async()=>all.filter(s=>matches(s,q))})})})}),
  countDocuments:async q=>all.filter(s=>matches(s,q)).length,
  findOne:q=>({select:async()=>all.find(s=>matches(s,q))||null}),
  create:async fields=>{const s=doc({_id:'333333333333333333333333',schedule:[],...fields});
    all.push(s);return s;}
};
const User={countDocuments:async q=>q.role==='broadcaster'?3:12};
const router={
  handlers:[],
  use:(name,...handlers)=>router.handlers.push({type:'USE',name,handlers}),
  get:(name,...handlers)=>router.handlers.push({type:'GET',name,handlers}),
  post:(name,...handlers)=>router.handlers.push({type:'POST',name,handlers}),
  patch:(name,...handlers)=>router.handlers.push({type:'PATCH',name,handlers}),
  put:(name,...handlers)=>router.handlers.push({type:'PUT',name,handlers}),
  delete:(name,...handlers)=>router.handlers.push({type:'DELETE',name,handlers})
};
function auth(req,res,next){return req.user?next():res.status(401).json({error:'login'});}
const roles=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():
  res.status(403).json({error:'forbidden'});
const multer=()=>({single:()=>(_req,_res,next)=>next()});
multer.memoryStorage=()=>({});
Module._load=function(name,parent,isMain){
  if(parent?.filename?.endsWith('/backend/routes/backofficeRoutes.js')){
    if(name==='express')return {Router:()=>router};
    if(name==='mongoose')return {
      isValidObjectId:val=>/^[a-f0-9]{24}$/i.test(String(val)),
      Types:{ObjectId:class ObjectId {toString(){return '000000000000000000000000';}}}
    };
    if(name==='multer')return multer;
    if(name==='../models/Station')return Station;
    // XML synchronizer is validated separately and must not boot cron/network during role-contract tests.
    if(name==='../services/stationScheduleFeed')return {loadFeed:async()=>{},publicPreview:()=>({}),syncOne:async()=>({}),startCron:()=>{}};
    if(name==='../models/User')return User;
    if(name==='../utils/authMiddleware')return {protect:auth};
    if(name==='../utils/roleMiddleware')return {authorizeRoles:roles};
    if(name==='../utils/broadcasterTerms')return {
      hasAcceptedCurrentBroadcasterTerms:user=>user.termsOk!==false
    };
  }
  return originalLoad.call(this,name,parent,isMain);
};
try{require('../backend/routes/backofficeRoutes');}
finally{Module._load=originalLoad;}
const admin={_id:'cccccccccccccccccccccccc',role:'admin',email:'admin@example.test',fname:'Admin'};
const owner={_id:ownerId,role:'broadcaster',email:'owner@example.test',
  fname:'Station Owner',termsOk:true,broadcasterProfile:{maxStations:3}};
const producer={_id:'dddddddddddddddddddddddd',role:'producer',assignedStation:songId,
  email:'producer@example.test'};
function findRoute(method,name){
  const entry=router.handlers.find(h=>h.type===method&&h.name===name);
  assert.ok(entry,'route '+method+' '+name+' registered');
  return entry;
}
async function call(method,name,user,body={},stationId=songId,file){
  const req={user,body,params:{id:stationId,kind:'logo'},file};
  const res={code:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},
    status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
  let handlers=[
    ...router.handlers.filter(h=>h.type==='USE'&&name.startsWith(h.name)).flatMap(h=>h.handlers),
    ...findRoute(method,name).handlers
  ];
  for(const fn of handlers){
    let nextCalled=false;
    await fn(req,res,()=>{nextCalled=true;});
    if(res.body!==null||!nextCalled)break;
  }
  return res;
}
async function main(){
  assert.equal((await call('GET','/backoffice/overview',null)).code,401);
  assert.equal((await call('GET','/backoffice/overview',{role:'user'})).code,403);
  assert.equal((await call('GET','/backoffice/overview',{...owner,termsOk:false})).code,409);
  const own=await call('GET','/backoffice/overview',owner);
  assert.equal(own.code,200);
  assert.equal(own.body.stations.length,1,'broadcaster reads only owned station');
  assert.equal(own.body.stations[0].broadcasterId,undefined,'owner ID is not public');
  assert.equal(own.body.counts.total,1);
  const producerRead=await call('GET','/backoffice/overview',producer);
  assert.equal(producerRead.body.stations.length,1,'producer reads assigned station only');
  assert.equal(producerRead.body.stations[0].pendingEdits,undefined);
  const adminRead=await call('GET','/backoffice/overview',admin);
  assert.equal(adminRead.body.stations.length,2);
  assert.equal(adminRead.body.counts.users,12);
  assert.equal(adminRead.headers['Cache-Control'],'private, no-store');

  const denied=await call('PATCH','/backoffice/stations/:id',owner,{name:'Hijack'},foreignId);
  assert.equal(denied.code,404,'broadcaster cannot edit a foreign station');
  const blocked=await call('PATCH','/backoffice/stations/:id',producer,{name:'Unauthorized'});
  assert.equal(blocked.code,403,'producer cannot edit the station profile');
  const changed=await call('PATCH','/backoffice/stations/:id',owner,
    {name:'New Owner FM',stream:'https://radio.example/new'});
  assert.equal(changed.code,200);
  assert.equal(all[0].name,'Owner FM','broadcaster writes pending only');
  assert.equal(all[0].pendingEdits.name,'New Owner FM');
  assert.equal((await call('POST','/backoffice/stations/:id/review',owner,
    {action:'approve'})).code,403,'only admin can approve pending edits');
  const approved=await call('POST','/backoffice/stations/:id/review',admin,{action:'approve'});
  assert.equal(approved.code,200);
  assert.equal(all[0].name,'New Owner FM');
  assert.equal(all[0].pendingEdits,null);

  const invalidUrl=await call('PATCH','/backoffice/stations/:id',owner,
    {stream:'http://127.0.0.1:27017/'});
  assert.equal(invalidUrl.code,400,'disallow localhost stream SSRF');
  const unsafeRole=await call('PATCH','/backoffice/stations/:id',admin,{role:'admin'});
  assert.equal(unsafeRole.code,400,'forbid role or owner escalation in station editor');
  const immediate=await call('PATCH','/backoffice/stations/:id',admin,{slogan:'iRadios rocks'});
  assert.equal(immediate.code,200);
  assert.equal(all[0].slogan,'iRadios rocks','admin writes publish directly');
  const overlap=await call('PUT','/backoffice/stations/:id/schedule',producer,{schedule:[
    {day:1,startTime:'09:00',endTime:'11:00',title:'AM'},
    {day:1,startTime:'10:30',endTime:'12:00',title:'Overlap'}
  ]});
  assert.equal(overlap.code,400,'overlapping programme shows rejected');
  const schedule=await call('PUT','/backoffice/stations/:id/schedule',producer,{schedule:[
    {day:1,startTime:'09:00',endTime:'11:00',title:'Breakfast',host:'DJ'}
  ]});
  assert.equal(schedule.code,200,'assigned producer manages weekly programming');
  assert.equal(all[0].schedule[0].title,'Breakfast');
  const added=await call('POST','/backoffice/stations',owner,
    {name:'New Radio',genre:'Pop',stream:'https://radio.example/other'});
  assert.equal(added.code,201);
  assert.equal(added.body.station.status,'pending');
  assert.equal(added.body.station.broadcasterId,undefined);
  assert.equal(all[2].broadcasterId,ownerId);

  const frontend=fs.readFileSync(path.join(__dirname,'../frontend/src/pages/Backoffice.jsx'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'../frontend/src/App.jsx'),'utf8');
  // A descendant <Routes> outside a parent <Route> must match absolute URLs.
  // Relative paths/index routes rendered only the shell at /backoffice/*.
  for(const route of [
    '/backoffice','/backoffice/stations','/backoffice/stations/new',
    '/backoffice/stations/:id/edit','/backoffice/schedules',
    '/backoffice/insights','/backoffice/team','/backoffice/review',
    '/backoffice/*'
  ]){
    assert.ok(frontend.includes('path="'+route+'"'),
      'Backoffice must register an absolute screen route: '+route);
  }
  assert.ok(frontend.includes("path={'/backoffice/admin/'+section}"),
    'all admin operation routes must have the /backoffice prefix');
  assert.ok(!frontend.includes('<Route index'),
    'Backoffice root must be an absolute path, not an unmatched index route');

  assert.ok(frontend.includes('Business Console'));
  assert.ok(frontend.includes('Logo')&&frontend.includes('StationEditor'));
  assert.ok(!frontend.includes('<audio'),'business console cannot contain radio player');
  assert.ok(app.includes("location.pathname.startsWith('/backoffice/')")&&
    app.includes('? <Backoffice/> : <MainApp/>'),
    'the backoffice must never mount listener MainApp or audio engine');
  const guard=fs.readFileSync(path.join(__dirname,'../backend/utils/stagePublicAccess.js'),'utf8');
  assert.ok(guard.includes("path.startsWith('/api/backoffice/')"),
    'staging authorizes backoffice under JWT / roles');
  console.log('Phase 4 role isolation, owner edits, moderation, scheduling, input safety and player-free shell passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
