'use strict';
// Visitor-bound server session; browser counts are never authoritative for paid tickets.
const crypto=require('node:crypto');
const Session=require('../models/AdvertisingListenerSession');
const Station=require('../models/Station');
const DAY_MS=86400000,SESSION_MS=12*3600000,PROOF_MS=4*60000;
const ID=/^[a-f0-9]{32}$/,STATION=/^[a-f0-9]{24}$/i;
let indexReady=null;
const secret=()=>{
 const raw=process.env.ADVERTISING_V2_DELIVERY_SECRET;
 if(typeof raw!=='string'||Buffer.byteLength(raw)<32)
  throw Error('Paid delivery key unavailable');
 return raw;
};
const mac=payload=>crypto.createHmac('sha256',secret()).update(payload).digest('hex');
const compare=(a,b)=>/^[a-f0-9]{64}$/.test(String(a))&&
 crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
function sessionToken(id,visitor){
 return id+'.'+mac('listener-session|'+id+'|'+visitor);
}
function validSessionToken(token,visitor){
 if(typeof token!=='string')return null;
 const parts=token.split('.');
 if(parts.length!==2||!ID.test(parts[0])||
    !compare(parts[1],mac('listener-session|'+parts[0]+'|'+visitor)))return null;
 return parts[0];
}
const switchInterval=Object.freeze({
 entry:0,every_5_stations:5,every_10_stations:10,
 every_20_stations:20,every_30_stations:30
});
const isDue=(placement,count)=>Number.isSafeInteger(count)&&count>0&&
 Object.hasOwn(switchInterval,placement)&&
 (placement==='entry'?count===1:count%switchInterval[placement]===0);
function proofPayload(session,visitor){
 const timestamp=new Date(session.changedAt).getTime();
 const value=session._id+'.'+session.switchCount+'.'+String(session.stationId)+'.'+timestamp;
 return value+'.'+mac('listener-change|'+value+'|'+visitor);
}
async function ensureIndexes(){
 if(!indexReady)indexReady=Session.createIndexes().catch(error=>{indexReady=null;throw error;});
 await indexReady;
}
async function register({visitor,stationId,token,now=Date.now()}){
 if(!STATION.test(String(stationId||''))||!(/^[a-f0-9]{64}$/.test(visitor)))
  throw Object.assign(Error('Invalid station or listener'),{status:400});
 await ensureIndexes();
 const station=await Station.exists({_id:stationId,isOffline:{$ne:true},
  status:'approved',disableNetworkAds:{$ne:true}});
 if(!station)throw Object.assign(Error('Station unavailable for advertisements'),{status:404});
 const previous=token?validSessionToken(token,visitor):null;
 if(token&&!previous)throw Object.assign(Error('Invalid listening session'),{status:403});
 let session;
 if(!previous){
  const id=crypto.randomBytes(16).toString('hex');
  session=await Session.create({_id:id,visitorKey:visitor,stationId,
   switchCount:1,changedAt:new Date(now),expiresAt:new Date(now+SESSION_MS)});
 }else{
  // Duplicate station choice is idempotent; genuine changes advance a
  // monotonically increasing sequence stored on the server.
  const prior=await Session.findOne({_id:previous,visitorKey:visitor,expiresAt:{$gt:new Date(now)}});
  if(!prior)throw Object.assign(Error('Listening session expired'),{status:409});
  if(String(prior.stationId)===String(stationId)){
   session=prior;
  }else{
   if(now-new Date(prior.changedAt).getTime()<400)
    throw Object.assign(Error('Station switch too fast'),{status:429});
   session=await Session.findOneAndUpdate({_id:prior._id,visitorKey:visitor,
    stationId:prior.stationId,switchCount:prior.switchCount,
    expiresAt:{$gt:new Date(now)}},
    {$set:{stationId,changedAt:new Date(now),expiresAt:new Date(now+SESSION_MS)},
     $inc:{switchCount:1}},{new:true});
   if(!session)throw Object.assign(Error('Concurrent station transition'),{status:409});
  }
 }
 return {sessionToken:sessionToken(session._id,visitor),
  stationId:String(session.stationId),count:session.switchCount,
  proof:proofPayload(session,visitor)};
}
async function verify({visitor,stationId,placement,proof,now=Date.now()}){
 if(typeof proof!=='string'||proof.length>220||!isDue(placement,1)&&!Object.hasOwn(switchInterval,placement))return null;
 const parts=proof.split('.');
 if(parts.length!==5||!ID.test(parts[0])||!/^[0-9]{1,10}$/.test(parts[1])||
    !STATION.test(parts[2])||!/^[0-9]{13}$/.test(parts[3])||
    !/^[a-f0-9]{64}$/.test(parts[4]))return null;
 const count=Number(parts[1]),issuedAt=Number(parts[3]);
 if(!isDue(placement,count)||String(stationId).toLowerCase()!==parts[2].toLowerCase()||
    issuedAt>now+2000||issuedAt<now-PROOF_MS)return null;
 const unsigned=parts.slice(0,4).join('.');
 if(!compare(parts[4],mac('listener-change|'+unsigned+'|'+visitor)))return null;
 const session=await Session.findOne({_id:parts[0],visitorKey:visitor,
  expiresAt:{$gt:new Date(now)}}).select('stationId switchCount changedAt').lean();
 if(!session||String(session.stationId)!==String(stationId)||
    session.switchCount!==count||new Date(session.changedAt).getTime()!==issuedAt)return null;
 return {breakId:parts[0]+':'+count,count};
}
module.exports={register,verify,isDue,validSessionToken,sessionToken,proofPayload};
