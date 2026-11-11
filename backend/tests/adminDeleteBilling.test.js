'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');

const target=path.resolve(__dirname,'../controllers/adminController.js');
const userId='a'.repeat(24);
const adminId='b'.repeat(24);

function controllerFor({role='broadcaster',gatewayFails=false,found=true}={}){
 const events=[];
 const user=found?{_id:userId,username:'testuser',role}:null;
 const objects={
  '../models/User':{
   findById:async()=>user,
   findByIdAndDelete:async()=>{events.push('user:delete');}
  },
  '../models/Station':{deleteMany:async()=>{events.push('stations:delete');}},
  '../models/Ad':{deleteMany:async()=>{events.push('ads:delete');}},
  '../models/BannerAd':{deleteMany:async()=>{events.push('banners:delete');}},
  '../models/Transaction':{},
  '../models/EmailHistory':{},
  'bcryptjs':{},
  'fs':{promises:{rm:async()=>{events.push('files:delete');}}},
  '../utils/myMailer':{},
  '../utils/mailTemp':{},
  '../services/ilumaGatewayClient':{
   cancelAllOnAccountDeletion:async(account)=>{
    events.push('gateway:cancel');
    assert.equal(account._id,userId);
    if(gatewayFails)throw Object.assign(new Error('gateway unreachable'),{code:'GATEWAY_HTTP_503'});
    return {state:'cancelled',billing_blocked:true,
     listener_cancelled:1,broadcaster_cancelled:3,subscriptions_cancelled:0};
   }
  }
 };
 const original=Module._load;
 Module._load=function(request,parent,isMain){
  if(parent?.filename===target&&Object.hasOwn(objects,request))return objects[request];
  return original.call(this,request,parent,isMain);
 };
 let controller;
 try{delete require.cache[target];controller=require(target);}
 finally{Module._load=original;delete require.cache[target];}
 return {controller,events};
}
function response(){
 return {code:200,body:null,
  status(code){this.code=code;return this;},
  json(body){this.body=body;return this;}};
}
function request(id=userId){return {headers:{'admin-id':adminId},params:{id},
 user:{_id:adminId}};}

test('Failed Gateway shutdown blocks account deletion and all filesystem/database cleanup',async()=>{
 const {controller,events}=controllerFor({gatewayFails:true});
 const res=response();
 await controller.deleteUser(request(),res);
 assert.equal(res.code,503);
 assert.equal(res.body.code,'GATEWAY_SUBSCRIPTIONS_NOT_CANCELLED');
 assert.deepEqual(events,['gateway:cancel']);
});

test('Broadcaster delete cancels every Gateway mandate before destructive cleanup',async()=>{
 const {controller,events}=controllerFor();
 const res=response();
 await controller.deleteUser(request(),res);
 assert.equal(res.code,200);
 assert.equal(res.body.billing.broadcasterCancelled,3);
 assert.equal(res.body.billing.listenerCancelled,1);
 assert.equal(events[0],'gateway:cancel');
 assert.equal(events.at(-1),'user:delete');
 assert.ok(events.indexOf('gateway:cancel')<events.indexOf('stations:delete'));
 assert.equal(events.filter(event=>event==='files:delete').length,2);
});

test('Free user is deleted only after Gateway confirms no future billing',async()=>{
 const {controller,events}=controllerFor({role:'user'});
 const res=response();
 await controller.deleteUser(request(),res);
 assert.equal(res.code,200);
 assert.equal(events[0],'gateway:cancel');
 assert.equal(events.at(-1),'user:delete');
});

test('Admin cannot delete their own account or delete an absent user',async()=>{
 const own=controllerFor({role:'admin'});
 const ownResult=response();
 await own.controller.deleteUser(request(adminId),ownResult);
 assert.equal(ownResult.code,403);
 assert.deepEqual(own.events,[]);
 const missing=controllerFor({found:false});
 const missingResult=response();
 await missing.controller.deleteUser(request(),missingResult);
 assert.equal(missingResult.code,404);
 assert.deepEqual(missing.events,[]);
});
