'use strict';
// SHADOW / NON-BILLABLE qualification. Browser reports are untrusted evidence,
// NOT proof of a human or authorization for CPM settlement.
const crypto=require('node:crypto');
const ID=/^[0-9a-f]{24}$/;
const TICKET=/^[0-9a-f]{32}$/;
const SECRET_MIN=32;
const LIMITS=Object.freeze({
 ticketMs:120000, heartbeatGapMs:2500, visualRatio:0.50,
 visualMs:1000,heroMs:2000, audioFraction:0.90, audioMaxMs:30000
});
const signed=(secret,value)=>crypto.createHmac('sha256',secret).update(value).digest('hex');
function validSecret(secret){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<SECRET_MIN)
  throw Error('Staging ad qualification secret must be >=32 bytes');
 return secret;
}
function clientFingerprint(secret,ip,ua){
 validSecret(secret);
 // No raw IP or user-agent is stored in Mongo. Do not accept X-Forwarded-For
 // directly here; Express req.ip must be set by a separately verified proxy.
 return signed(secret,'visitor|'+String(ip).slice(0,128)+'|'+String(ua).slice(0,180));
}
function sealTicket(ticket,secret){
 validSecret(secret);
 const body=ticket._id+'.'+new Date(ticket.expiresAt).getTime();
 return body+'.'+signed(secret,'v2|'+body+'|'+ticket.clientKey);
}
function verifyTicket(capability,ticket,clientKey,secret,now=Date.now()){
 validSecret(secret);
 if(typeof capability!=='string'||capability.length>190||!ticket||
    !TICKET.test(String(ticket._id))||ticket.clientKey!==clientKey)return false;
 const segments=capability.split('.');
 if(segments.length!==3||!TICKET.test(segments[0])||
    !/^[0-9]{13}$/.test(segments[1])||
    !/^[0-9a-f]{64}$/.test(segments[2]))return false;
 const expires=new Date(ticket.expiresAt).getTime();
 if(segments[0]!==String(ticket._id)||Number(segments[1])!==expires||
    now>expires||now<new Date(ticket.issuedAt).getTime()-1000)return false;
 const expected=sealTicket(ticket,secret).split('.')[2];
 return crypto.timingSafeEqual(Buffer.from(segments[2]),Buffer.from(expected));
}
function issueTicket({campaignId,creativeId,kind,tier,placement,durationMs=0,clientKey,
 now=Date.now(),id=crypto.randomBytes(16).toString('hex')}){
 if(!ID.test(String(campaignId))||!ID.test(String(creativeId))||
    !TICKET.test(id)||!/^[a-f0-9]{64}$/.test(String(clientKey))||
    !['visual','audio'].includes(kind)||
    !['hero','standard','audio'].includes(tier)||
    (kind==='audio')!==(tier==='audio')||
    !(kind==='audio'?placement==='audio':
      ['hero','home','radio_feed','news_feed','station_profile'].includes(placement))||
    (kind==='audio'?
     !Number.isInteger(durationMs)||durationMs<1000||durationMs>300000:
     durationMs!==0))
  throw Error('Invalid server-owned advertising ticket scope');
 if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid server clock');
 return {_id:id,campaignId,creativeId,kind,tier,placement,durationMs,clientKey,
  issuedAt:new Date(now),expiresAt:new Date(now+LIMITS.ticketMs),
  seq:0,lastAt:null,lastActive:false,lastPositionMs:null,
  continuousMs:0,status:'issued',qualifiedAt:null};
}
function audioRequiredMs(durationMs){
 if(!Number.isInteger(durationMs)||durationMs<1000||durationMs>300000)
  throw Error('Invalid server measured audio duration');
 return Math.min(LIMITS.audioMaxMs,Math.ceil(durationMs*LIMITS.audioFraction));
}
function observation(ticket,report,now=Date.now()){
 if(!ticket||ticket.status==='invalid'||!['issued','qualified'].includes(ticket.status))
  throw Error('Ticket unavailable');
 if(!Number.isSafeInteger(now)||now<new Date(ticket.issuedAt).getTime()-1000||
    now>new Date(ticket.expiresAt).getTime())throw Error('Ticket expired');
 if(!report||!Number.isSafeInteger(report.seq)||report.seq<1||report.seq>1000)
  throw Error('Invalid heartbeat sequence');
 if(report.seq<=ticket.seq)return {duplicate:true,state:ticket,qualified:false};
 if(report.seq!==ticket.seq+1)throw Error('Out-of-order heartbeat');
 if(ticket.status==='qualified')return {duplicate:true,state:ticket,qualified:false};
 const prevAt=ticket.lastAt?new Date(ticket.lastAt).getTime():null;
 const gap=prevAt===null?0:now-prevAt;
 if(gap<0)throw Error('Nonmonotonic server receipt');
 let active=false,increment=0,nextPosition=ticket.lastPositionMs;
 if(ticket.kind==='visual'){
  if(typeof report.foreground!=='boolean'||
     typeof report.ratio!=='number'||!Number.isFinite(report.ratio)||
     report.ratio<0||report.ratio>1||report.playing!==undefined||
     report.positionMs!==undefined)throw Error('Invalid visual observation');
  active=report.foreground&&report.ratio>=LIMITS.visualRatio;
  if(active&&ticket.lastActive&&gap>0&&gap<=LIMITS.heartbeatGapMs)
   increment=gap;
 }else{
  if(typeof report.foreground!=='boolean'||typeof report.playing!=='boolean'||
     typeof report.muted!=='boolean'||typeof report.volume!=='number'||
     !Number.isFinite(report.volume)||report.volume<0||report.volume>1||
     !Number.isInteger(report.positionMs)||report.positionMs<0||
     report.positionMs>ticket.durationMs+250||
     typeof report.error!=='boolean'||typeof report.streamChanged!=='boolean'||
     report.ratio!==undefined)throw Error('Invalid audio observation');
  if(report.error||report.streamChanged)
   return {duplicate:false,state:{...ticket,seq:report.seq,lastAt:new Date(now),
    lastActive:false,continuousMs:0,status:'invalid'},qualified:false};
  const p=report.positionMs;
  if(ticket.lastPositionMs===null&&p>1000)
   throw Error('Impossible initial audio position');
  const positionDelta=ticket.lastPositionMs===null?0:p-ticket.lastPositionMs;
  if(positionDelta>Math.max(0,gap)+300)
   throw Error('Impossible audio progress');
  nextPosition=p;
  active=report.foreground&&report.playing&&!report.muted&&report.volume>0;
  if(active&&ticket.lastActive&&gap>0&&gap<=LIMITS.heartbeatGapMs&&
     positionDelta>0)
   increment=Math.min(gap,positionDelta);
 }
 const continuousMs=active?(ticket.lastActive?ticket.continuousMs+increment:0):0;
 const minimum=ticket.kind==='visual'?
  (ticket.tier==='hero'?LIMITS.heroMs:LIMITS.visualMs):
  audioRequiredMs(ticket.durationMs);
 const qualified=continuousMs>=minimum&&now-new Date(ticket.issuedAt).getTime()>=minimum;
 const state={...ticket,seq:report.seq,lastAt:new Date(now),lastActive:active,
  lastPositionMs:nextPosition,continuousMs,
  status:qualified?'qualified':'issued',
  qualifiedAt:qualified?new Date(now):null};
 return {duplicate:false,state,qualified};
}
module.exports={LIMITS,clientFingerprint,sealTicket,verifyTicket,
 issueTicket,audioRequiredMs,observation};