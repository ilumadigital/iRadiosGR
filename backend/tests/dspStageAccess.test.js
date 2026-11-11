'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(String(parent?.filename||'').endsWith('/backend/utils/stagePublicAccess.js')){
  if(name==='./authMiddleware')return {protect:(req,res,next)=>{
   if(!req.testRole)return res.status(401).json({error:'auth required'});
   req.user={role:req.testRole};return next();
  }};
  if(name==='./roleMiddleware')return {authorizeRoles:(...roles)=>(req,res,next)=>
   roles.includes(req.user?.role)?next():res.status(403).json({error:'not allowed'})};
  if(name==='../models/User')return {exists:async()=>false};
  if(name==='../models/BroadcasterInvitation')return {findOne:()=>({select:async()=>null})};
 }
 return original.call(this,name,parent,isMain);
};
let stage;
try{stage=require('../utils/stagePublicAccess');}finally{Module._load=original;}
function request(method,pathname,testRole){
 const req={method,baseUrl:'/api',path:pathname,testRole};
 const response={statusCode:200,body:null,
  status(n){this.statusCode=n;return this;},
  json(body){this.body=body;return this;}};
 let reached=false;
 stage.stagePublicAccess(req,response,()=>{reached=true;});
 return {status:response.statusCode,reached};
}
const id='507f1f77bcf86cd799439011';
test('Staging lets only Admin and Broadcaster through to the authenticated DSP list',()=>{
 for(const role of ['admin','broadcaster']){
  const result=request('GET','/stations/dsp-access',role);
  assert.equal(result.reached,true);
 }
 assert.equal(request('GET','/stations/dsp-access',null).status,401);
 assert.equal(request('GET','/stations/dsp-access','producer').status,403);
 assert.equal(request('GET','/stations/dsp-access','user').status,403);
});
test('Staging authorizes the DSP save route shape, not arbitrary station writes',()=>{
 for(const role of ['admin','broadcaster'])
  assert.equal(request('PUT','/stations/'+id+'/dsp',role).reached,true);
 assert.equal(request('PUT','/stations/'+id+'/dsp',null).status,401);
 assert.equal(request('PUT','/stations/'+id+'/dsp','producer').status,403);
 assert.equal(request('PUT','/stations/'+id+'/offline','broadcaster').status,403);
 assert.equal(request('PUT','/stations/invalid/dsp','broadcaster').status,403);
});
test('Actual DSP controllers still enforce station-scoped Billing Engine rights',()=>{
 const controller=fs.readFileSync(path.join(__dirname,'../controllers/stationController.js'),'utf8');
 const routes=fs.readFileSync(path.join(__dirname,'../routes/stationRoutes.js'),'utf8');
 assert.match(controller,/hasStationRight\(req\.user,station,'broadcaster\.webdsp'\)/);
 assert.match(routes,/router\.get\('\/stations\/dsp-access',protect,authorizeRoles\('admin','broadcaster'\)/);
 assert.match(routes,/router\.put\('\/stations\/:id\/dsp',protect,authorizeRoles\('admin','broadcaster'\)/);
});
