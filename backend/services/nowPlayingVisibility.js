'use strict';
// Phase C: never serialize station-wide AI song details to a non-Premium viewer.
// Keep the raw in-process catalog cache private; projections happen per request.
function broadcastOnly(value){
  return typeof value?.broadcastHint==='string'&&value.broadcastHint.trim()
    ?{broadcastHint:value.broadcastHint}:null;
}
function aiTeaser(value){
  return {
    foundWithAI:true,premiumOnly:true,
    ...(typeof value?.expiresAt==='string'?{expiresAt:value.expiresAt}:{}),
    ...(broadcastOnly(value)||{})
  };
}
function catalogEntryForViewer(entry,viewer){
  if(!entry)return null;
  if(!viewer?.signedIn)return broadcastOnly(entry);
  if(entry.foundWithAI===true&&!viewer.canSeeAI)return aiTeaser(entry);
  return entry;
}
function snapshotForViewer(snapshot,viewer){
  if(!snapshot)return {title:'',source:'none',foundWithAI:false};
  if(!viewer?.signedIn)return broadcastOnly(snapshot)||
    {title:'',source:'none',foundWithAI:false};
  if(snapshot.source==='acrcloud'&&snapshot.foundWithAI===true&&!viewer.canSeeAI)
    return aiTeaser(snapshot);
  return snapshot;
}
function liveTrackForViewer(track,viewer){
  if(track?.source==='acrcloud'&&track.foundWithAI===true&&!viewer?.canSeeAI)
    return {stationId:track.stationId,...aiTeaser(track)};
  return track;
}
function historyTrackForViewer(track,viewer){
  if(track?.source==='acrcloud'&&!viewer?.canSeeAI)
    return {source:'acrcloud',foundWithAI:true,premiumOnly:true,playedAt:track.playedAt};
  return track;
}
async function isPremiumAiViewer(user){
  if(!user)return false;
  if(user.role==='admin')return true;
  const {hasAccountRight}=require('./billingEntitlements');
  if(user.role==='broadcaster'&&await hasAccountRight(user,'broadcaster.unlimited_stations'))
    return true;
  return hasAccountRight(user,'listener.premium');
}
async function protectedViewer(req){
  if(!req.user)return {signedIn:false,canSeeAI:false};
  // The billing resolver checks current paid/grant expiry on EVERY request.
  // Failure never grants AI access.
  try{return {signedIn:true,canSeeAI:await isPremiumAiViewer(req.user)};}
  catch(error){
    console.warn('[AI VISIBILITY] entitlement check unavailable',error?.name||'unknown');
    return {signedIn:true,canSeeAI:false};
  }
}
async function catalogViewer(req){
  const auth=String(req.headers?.authorization||'');
  if(!auth.startsWith('Bearer '))return {signedIn:false,canSeeAI:false};
  try{
    const jwt=require('jsonwebtoken');
    const secret=process.env.JWT_SECRET;
    if(!secret)return {signedIn:false,canSeeAI:false};
    const decoded=jwt.verify(auth.slice(7),secret);
    const id=decoded?.id||decoded?._id;
    if(typeof id!=='string'||!/^[a-f0-9]{24}$/i.test(id))
      return {signedIn:false,canSeeAI:false};
    const User=require('../models/User');
    const user=await User.findById(id).select('_id role isPremium broadcasterProfile').lean();
    if(!user)return {signedIn:false,canSeeAI:false};
    if(user.role==='admin'&&(decoded.role!=='admin'||decoded.admin2fa!==true))
      return {signedIn:false,canSeeAI:false};
    return protectedViewer({user});
  }catch{
    return {signedIn:false,canSeeAI:false};
  }
}
module.exports={catalogEntryForViewer,snapshotForViewer,liveTrackForViewer,
  historyTrackForViewer,isPremiumAiViewer,protectedViewer,catalogViewer};
