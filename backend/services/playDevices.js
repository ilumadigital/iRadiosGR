'use strict';
// Private authenticated playback control. Intentionally separate from legacy /api/socket.io.
// This module never accepts a userId/accountId from a browser event.
const jwt=require('jsonwebtoken');
const crypto=require('node:crypto');
const User=require('../models/User');
const UserDevice=require('../models/UserDevice');
const PlaybackLease=require('../models/PlaybackLease');
const Station=require('../models/Station');
const {hasAccountRight}=require('./billingEntitlements');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID=/^[a-f0-9]{24}$/i;
const LEASE_MS=30000;
const MAX_DEVICES=100;
const clean=(input,max=80)=>typeof input==='string'?input.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
function safeDescriptor(raw){
  const types=['mobile','tablet','desktop','tv','console','unknown'];
  return {
    deviceType:types.includes(raw?.deviceType)?raw.deviceType:'unknown',
    brand:clean(raw?.brand,48),model:clean(raw?.model,90),
    os:clean(raw?.os,64),browser:clean(raw?.browser,64),
    clientType:raw?.clientType==='app'?'app':'browser',
    displayName:clean(raw?.displayName,120)||'Άγνωστη συσκευή'
  };
}
function createDeviceService(io){
  // Runtime presence is ephemeral; saved devices are *never* deleted on disconnect.
  const presence=new Map(); // accountId -> deviceId -> Set(socket IDs)
  const pendingFreeTransfers=new Map();
  const perAccountLocks=new Map();
  async function serializeGrant(account,work){
    const previous=perAccountLocks.get(account)||Promise.resolve();
    const next=previous.catch(()=>{}).then(work);
    perAccountLocks.set(account,next);
    try{return await next;}
    finally{if(perAccountLocks.get(account)===next)perAccountLocks.delete(account);}
  }
  const room=id=>'account:'+id;
  const online=(account,id)=>Boolean(presence.get(account)?.get(id)?.size);
  const sockets=(account,id)=>[...(presence.get(account)?.get(id)||[])];
  async function premiumFor(socket){
    return socket.data.account?.role==='user' &&
      await hasAccountRight(socket.data.account,'listener.premium');
  }
  async function list(account){
    const devices=await UserDevice.find({accountId:account,revokedAt:null})
      .sort({lastSeenAt:-1}).limit(MAX_DEVICES).lean();
    const now=new Date();
    const lease=await PlaybackLease.findOne({accountId:account,expiresAt:{$gt:now}}).lean();
    const owner=lease && io.sockets.sockets.get(lease.socketId)?.data?.accountId===String(account)
      ?lease:null;
    return devices.map(d=>{
      const freeStation=sockets(account,d.deviceId).map(sid=>io.sockets.sockets.get(sid))
        .find(sock=>sock?.data?.freePlayingStationId)?.data?.freePlayingStationId||null;
      return ({
      deviceId:d.deviceId,deviceType:d.deviceType,brand:d.brand,model:d.model,
      os:d.os,browser:d.browser,clientType:d.clientType,deviceName:d.displayName,
      online:online(account,d.deviceId),isPlaying:Boolean(freeStation||(owner?.state==='playing' &&
        owner?.deviceId===d.deviceId&&online(account,d.deviceId))),
      isPending:Boolean(owner?.state==='pending' && owner?.deviceId===d.deviceId),
      isPaused:Boolean(owner?.state==='paused' && owner?.deviceId===d.deviceId),
      playbackState:owner?.deviceId===d.deviceId?owner.state:null,
      stationId:owner?.deviceId===d.deviceId?String(owner.stationId):freeStation,
      firstSeenAt:d.firstSeenAt,lastSeenAt:d.lastSeenAt
    });});
  }
  async function publish(account){
    io.to(room(account)).emit('connect:devices',await list(account));
  }
  async function leaseTo(socket,deviceId,targetSocketId,stationId){
    const account=socket.data.accountId;
    return serializeGrant(account,async()=>{
    const token=crypto.randomUUID();
    const previous=await PlaybackLease.findOne({accountId:account,expiresAt:{$gt:new Date()}}).lean();
    // Unique account index + atomic single-document replacement guarantees a single
    // authoritative owner even with simultaneous acquire requests.
    const update={$set:{deviceId,socketId:targetSocketId,stationId,token,
      state:'pending',expiresAt:new Date(Date.now()+LEASE_MS)}};
    let lease;
    try{
      lease=await PlaybackLease.findOneAndUpdate({accountId:account},update,{
        upsert:true,new:true,setDefaultsOnInsert:true,runValidators:true
      });
    }catch(error){
      if(error.code!==11000)throw error;
      lease=await PlaybackLease.findOneAndUpdate({accountId:account},update,{
        new:true,runValidators:true
      });
    }
    if(!lease||lease.token!==token)throw Error('Lease conflict');
    if(previous && previous.socketId!==targetSocketId){
      io.to(previous.socketId).emit('connect:stop',{reason:'PLAYBACK_MOVED'});
    }
    await publish(account);
    return token;
    });
  }
  io.use(async(socket,next)=>{
    try{
      const raw=socket.handshake.auth?.token;
      if(typeof raw!=='string'||raw.length>4096||!process.env.JWT_SECRET)
        return next(Error('UNAUTHORIZED'));
      const payload=jwt.verify(raw,process.env.JWT_SECRET);
      const user=await User.findById(payload.id||payload._id).select('-password');
      if(!user || (user.role==='admin'&&(payload.role!=='admin'||payload.admin2fa!==true)))
        return next(Error('UNAUTHORIZED'));
      socket.data.account=user;
      socket.data.accountId=String(user._id);
      next();
    }catch{next(Error('UNAUTHORIZED'));}
  });
  io.on('connection',socket=>{
    const account=socket.data.accountId;
    socket.join(room(account));
    const answer=(ack,payload)=>{if(typeof ack==='function')ack(payload);};
    socket.on('connect:register',async(raw,ack)=>{
      try{
        const id=raw?.deviceId;
        if(typeof id!=='string'||!UUID.test(id))return answer(ack,{ok:false,error:'INVALID_DEVICE'});
        const details=safeDescriptor(raw);
        const existing=await UserDevice.findOne({accountId:account,deviceId:id}).lean();
        if(!existing){
          const count=await UserDevice.countDocuments({accountId:account,revokedAt:null});
          if(count>=MAX_DEVICES)return answer(ack,{ok:false,error:'DEVICE_LIMIT'});
        }
        // A revoked device must explicitly be re-registered via a fresh identifier.
        if(existing?.revokedAt)return answer(ack,{ok:false,error:'DEVICE_REVOKED'});
        // Keep user-renamed displayName intact across reconnects and UA-CH refreshes.
        const {displayName,...hardware}=details;
        await UserDevice.findOneAndUpdate({accountId:account,deviceId:id},{
          $set:{...hardware,lastSeenAt:new Date(),revokedAt:null},
          $setOnInsert:{accountId:account,deviceId:id,displayName,firstSeenAt:new Date()}
        },{upsert:true,runValidators:true});
        if(socket.data.deviceId){
          const set=presence.get(account)?.get(socket.data.deviceId);
          set?.delete(socket.id);
          if(set && !set.size)presence.get(account).delete(socket.data.deviceId);
        }
        socket.data.deviceId=id;
        if(!presence.has(account))presence.set(account,new Map());
        if(!presence.get(account).has(id))presence.get(account).set(id,new Set());
        presence.get(account).get(id).add(socket.id);
        answer(ack,{ok:true,deviceId:id});
        await publish(account);
      }catch(error){console.error('[CONNECT] register',error.message);answer(ack,{ok:false,error:'REGISTER_FAILED'});}
    });
    socket.on('connect:list',async(_payload,ack)=>{
      try{answer(ack,{ok:true,devices:await list(account)});}
      catch{answer(ack,{ok:false,error:'LIST_FAILED'});}
    });
    socket.on('connect:ping',async(_payload,ack)=>{
      try{
        if(!socket.data.deviceId)return answer(ack,{ok:false,error:'NOT_REGISTERED'});
        await UserDevice.updateOne({accountId:account,deviceId:socket.data.deviceId,revokedAt:null},
          {$set:{lastSeenAt:new Date()}});
        answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'PING_FAILED'});}
    });
    socket.on('connect:rename',async(raw,ack)=>{
      try{
        const id=raw?.deviceId, name=clean(raw?.displayName,120);
        if(!UUID.test(id||'')||!name)return answer(ack,{ok:false,error:'INVALID_INPUT'});
        const updated=await UserDevice.updateOne({accountId:account,deviceId:id,revokedAt:null},
          {$set:{displayName:name}});
        if(!updated.matchedCount)return answer(ack,{ok:false,error:'NOT_FOUND'});
        await publish(account);answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'RENAME_FAILED'});}
    });
    socket.on('connect:forget',async(raw,ack)=>{
      try{
        const id=raw?.deviceId;
        if(!UUID.test(id||''))return answer(ack,{ok:false,error:'INVALID_DEVICE'});
        const updated=await UserDevice.updateOne({accountId:account,deviceId:id,revokedAt:null},
          {$set:{revokedAt:new Date()}});
        if(!updated.matchedCount)return answer(ack,{ok:false,error:'NOT_FOUND'});
        await PlaybackLease.deleteOne({accountId:account,deviceId:id});
        for(const sid of sockets(account,id)){
          io.to(sid).emit('connect:forget',{});
          io.sockets.sockets.get(sid)?.disconnect(true);
        }
        await publish(account);answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'FORGET_FAILED'});}
    });
    socket.on('connect:acquire',async(raw,ack)=>{
      try{
        const id=socket.data.deviceId,stationId=raw?.stationId;
        if(!id)return answer(ack,{ok:false,error:'NOT_REGISTERED'});
        if(!OBJECT_ID.test(stationId||''))return answer(ack,{ok:false,error:'INVALID_STATION'});
        if(!await premiumFor(socket))return answer(ack,{ok:true,premium:false});
        if(!await Station.exists({_id:stationId,status:'approved',isOffline:{$ne:true}}))
          return answer(ack,{ok:false,error:'STATION_UNAVAILABLE'});
        const token=await leaseTo(socket,id,socket.id,stationId);
        answer(ack,{ok:true,premium:true,token});
      }catch{answer(ack,{ok:false,error:'ACQUIRE_FAILED'});}
    });
    socket.on('connect:transfer',async(raw,ack)=>{
      try{
        if(!socket.data.deviceId)return answer(ack,{ok:false,error:'NOT_REGISTERED'});
        const target=raw?.targetDeviceId,stationId=raw?.stationId;
        if(!UUID.test(target||'')||!OBJECT_ID.test(stationId||''))
          return answer(ack,{ok:false,error:'INVALID_INPUT'});
        // Taking playback back onto this device is a valid transfer.
        // Reject only a transfer to the device that already owns the lease.
        const currentOwner=await PlaybackLease.findOne({
          accountId:account,expiresAt:{$gt:new Date()}
        }).lean();
        if(target===currentOwner?.deviceId)
          return answer(ack,{ok:false,error:'SAME_DEVICE'});
        const registered=await UserDevice.exists({accountId:account,deviceId:target,revokedAt:null});
        const destination=sockets(account,target)[0];
        if(!registered||!destination)return answer(ack,{ok:false,error:'DEVICE_OFFLINE'});
        if(!await Station.exists({_id:stationId,status:'approved',isOffline:{$ne:true}}))
          return answer(ack,{ok:false,error:'STATION_UNAVAILABLE'});
        if(await premiumFor(socket)){
          const token=await leaseTo(socket,target,destination,stationId);
          io.to(destination).emit('connect:play',{stationId,token});
        }else{
          if(target===socket.data.deviceId)return answer(ack,{ok:false,error:'SAME_DEVICE'});
          const transferId=crypto.randomUUID();
          pendingFreeTransfers.set(transferId,{source:socket.id,target:destination,
            expiresAt:Date.now()+90000});
          io.to(destination).emit('connect:play',{stationId,transferId});
        }
        answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'TRANSFER_FAILED'});}
    });

    // Remote-control operations leave the stream on its current device.
    // Only connect:transfer may move the lease to a different socket.
    socket.on('connect:control',async(raw,ack)=>{
      try{
        if(!socket.data.deviceId)return answer(ack,{ok:false,error:'NOT_REGISTERED'});
        if(!await premiumFor(socket))return answer(ack,{ok:false,error:'PREMIUM_REQUIRED'});
        const action=raw?.action;
        if(!['pause','resume','station'].includes(action))
          return answer(ack,{ok:false,error:'INVALID_ACTION'});
        const result=await serializeGrant(account,async()=>{
          const now=new Date();
          const lease=await PlaybackLease.findOne({
            accountId:account,expiresAt:{$gt:now}
          }).lean();
          if(!lease)return {ok:false,error:'NO_ACTIVE_PLAYBACK'};
          const ownerSocket=io.sockets.sockets.get(lease.socketId);
          if(!ownerSocket?.connected || ownerSocket.data.accountId!==account ||
             ownerSocket.data.deviceId!==lease.deviceId)
            return {ok:false,error:'DEVICE_OFFLINE'};
          let nextState=lease.state,stationId=String(lease.stationId);
          if(action==='station'){
            if(!OBJECT_ID.test(raw?.stationId||''))
              return {ok:false,error:'INVALID_STATION'};
            if(!await Station.exists({_id:raw.stationId,status:'approved',isOffline:{$ne:true}}))
              return {ok:false,error:'STATION_UNAVAILABLE'};
            stationId=raw.stationId;
            nextState=lease.state==='paused'?'paused':'pending';
          }else if(action==='pause'){
            nextState='paused';
          }else if(action==='resume' && lease.state!=='playing'){
            nextState='pending';
          }
          const updated=await PlaybackLease.findOneAndUpdate({
            accountId:account,token:lease.token,socketId:lease.socketId,
            expiresAt:{$gt:new Date()}
          },{$set:{state:nextState,stationId,expiresAt:new Date(Date.now()+LEASE_MS)}},
          {new:true});
          if(!updated)return {ok:false,error:'PLAYBACK_CHANGED'};
          // Server-side metadata is authoritative; no arbitrary stream URLs.
          if(action!=='resume'||lease.state!=='playing')
            ownerSocket.emit('connect:command',{
              action,token:updated.token,stationId:String(updated.stationId),
              shouldPlay:nextState!=='paused'
            });
          await publish(account);
          return {ok:true,state:nextState,stationId:String(updated.stationId)};
        });
        answer(ack,result);
      }catch(error){console.warn('[CONNECT] control',error.message);
        answer(ack,{ok:false,error:'CONTROL_FAILED'});}
    });
    socket.on('connect:blocked',async(raw,ack)=>{
      try{
        if(!socket.data.deviceId)return answer(ack,{ok:false,error:'NOT_REGISTERED'});
        const updated=await PlaybackLease.findOneAndUpdate({
          accountId:account,deviceId:socket.data.deviceId,socketId:socket.id,
          token:raw?.token,state:'pending',expiresAt:{$gt:new Date()}
        },{$set:{state:'paused',expiresAt:new Date(Date.now()+LEASE_MS)}},{new:true});
        if(updated)await publish(account);
        answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'BLOCKED_FAILED'});}
    });
    socket.on('connect:started',async(raw,ack)=>{
      try{
        const id=socket.data.deviceId;
        if(!id)return answer(ack,{ok:false,error:'NOT_REGISTERED'});
        if(!await premiumFor(socket)){
          if(!OBJECT_ID.test(raw?.stationId||''))
            return answer(ack,{ok:false,error:'INVALID_STATION'});
          socket.data.freePlayingStationId=raw.stationId;
          if(raw?.transferId){
            const pending=pendingFreeTransfers.get(raw.transferId);
            if(pending?.target===socket.id && pending.expiresAt>Date.now()){
              pendingFreeTransfers.delete(raw.transferId);
              const source=io.sockets.sockets.get(pending.source);
              if(source)source.data.freePlayingStationId=null;
              io.to(pending.source).emit('connect:stop',{reason:'TRANSFER_COMPLETE',free:true});
            }
          }
          await publish(account);
          return answer(ack,{ok:true});
        }
        const updated=await PlaybackLease.findOneAndUpdate({
          accountId:account,deviceId:id,socketId:socket.id,token:raw?.token,
          stationId:raw?.stationId,state:{$in:['pending','playing']},
          expiresAt:{$gt:new Date()}
        },{$set:{state:'playing',expiresAt:new Date(Date.now()+LEASE_MS)}},{new:true});
        if(!updated){
          socket.emit('connect:stop',{reason:'LEASE_REVOKED'});
          return answer(ack,{ok:false,error:'LEASE_REVOKED'});
        }
        await publish(account);answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'START_FAILED'});}
    });
    socket.on('connect:renew',async(raw,ack)=>{
      try{
        if(!socket.data.deviceId || !raw?.token)return answer(ack,{ok:false,error:'NO_LEASE'});
        if(!await premiumFor(socket)){
          await PlaybackLease.deleteOne({accountId:account,socketId:socket.id});
          socket.emit('connect:stop',{reason:'PREMIUM_EXPIRED'});
          await publish(account);
          return answer(ack,{ok:false,error:'PREMIUM_EXPIRED'});
        }
        const lease=await PlaybackLease.findOneAndUpdate({
          accountId:account,deviceId:socket.data.deviceId,socketId:socket.id,
          token:raw.token,expiresAt:{$gt:new Date()},state:{$in:['playing','paused']}
        },{$set:{expiresAt:new Date(Date.now()+LEASE_MS)}},{new:true});
        if(!lease){
          socket.emit('connect:stop',{reason:'LEASE_EXPIRED'});
          return answer(ack,{ok:false,error:'LEASE_EXPIRED'});
        }
        answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'RENEW_FAILED'});}
    });
    socket.on('connect:release',async(raw,ack)=>{
      try{
        const wasFreePlaying=Boolean(socket.data.freePlayingStationId);
        socket.data.freePlayingStationId=null;
        const deleted=raw?.token?await PlaybackLease.deleteOne({
          accountId:account,deviceId:socket.data.deviceId,socketId:socket.id,
          token:raw.token
        }):null;
        if(deleted?.deletedCount||wasFreePlaying)await publish(account);
        answer(ack,{ok:true});
      }catch{answer(ack,{ok:false,error:'RELEASE_FAILED'});}
    });
    socket.on('disconnect',async()=>{
      try{
        const id=socket.data.deviceId;
        if(id){
          const set=presence.get(account)?.get(id);
          set?.delete(socket.id);
          if(set && !set.size)presence.get(account).delete(id);
          if(presence.get(account)&&!presence.get(account).size)presence.delete(account);
        }
        const deleted=await PlaybackLease.deleteOne({accountId:account,socketId:socket.id});
        for(const [id,t] of pendingFreeTransfers){
          if(t.target===socket.id||t.source===socket.id||t.expiresAt<Date.now())
            pendingFreeTransfers.delete(id);
        }
        await publish(account);
      }catch(error){console.warn('[CONNECT] disconnect',error.message);}
    });
  });
  return {list};
}
module.exports={createDeviceService,safeDescriptor};
