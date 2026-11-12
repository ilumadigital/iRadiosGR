'use strict';
const User=require('../models/User');
const {PRIMARY_CATEGORIES}=require('../utils/stationCategories');
const ID=/^[0-9a-f]{24}$/i;
const DEVICE=/^dev_[a-z0-9_-]{2,60}$/i;

// The account stores *preferences*, never raw audio, IP addresses or streams.
// Each device uploads a bounded cumulative snapshot: repeating the same PUT
// is idempotent, and concurrent devices update separate MongoDB subpaths.
function normalizeSnapshot(body,now=Date.now()){
  if(!body||typeof body!=='object'||Array.isArray(body)||
     typeof body.deviceId!=='string'||!DEVICE.test(body.deviceId)||
     !body.stations||typeof body.stations!=='object'||Array.isArray(body.stations)||
     !body.categories||typeof body.categories!=='object'||Array.isArray(body.categories))
    return null;
  const entries=Object.entries(body.stations);
  const categories=Object.entries(body.categories);
  if(entries.length>80||categories.length>80)return null;
  const result={stations:{},categories:{},updatedAt:new Date(now)};
  for(const [id,stat] of entries){
    if(!ID.test(id)||!stat||typeof stat!=='object')return null;
    const {seconds,sessions,lastPlayedAt}=stat;
    if(!Number.isInteger(seconds)||seconds<0||seconds>31_536_000||
       !Number.isInteger(sessions)||sessions<0||sessions>100_000||
       !Number.isFinite(lastPlayedAt)||lastPlayedAt<0||lastPlayedAt>now+86400000)return null;
    result.stations[id.toLowerCase()]={seconds,sessions,lastPlayedAt:Math.floor(lastPlayedAt)};
  }
  for(const [label,count] of categories){
    if(!PRIMARY_CATEGORIES.includes(label)||
       !Number.isInteger(count)||count<0||count>20)return null;
    result.categories[label]=count;
  }
  return result;
}

async function getProfile(req,res){
  try{
    const user=await User.findById(req.user._id).select('+listeningPreferences').lean();
    if(!user)return res.status(404).json({error:'User not found'});
    return res.json({devices:user.listeningPreferences||{}});
  }catch(error){
    console.error('[LISTENING PROFILE] Read failed',error);
    return res.status(500).json({error:'Unable to load listening preferences'});
  }
}
async function putProfile(req,res){
  const snapshot=normalizeSnapshot(req.body);
  if(!snapshot)return res.status(400).json({error:'Invalid or oversized listening profile'});
  try{
    const user=await User.findById(req.user._id).select('+listeningPreferences').lean();
    if(!user)return res.status(404).json({error:'User not found'});
    const devices=user.listeningPreferences||{};
    const deviceId=req.body.deviceId;
    // A bounded number of device snapshots avoids unbounded user documents.
    if(!Object.hasOwn(devices,deviceId)&&Object.keys(devices).length>=8)
      return res.status(409).json({error:'Maximum number of listening devices reached'});
    await User.updateOne({_id:req.user._id},
      {$set:{['listeningPreferences.'+deviceId]:snapshot}});
    return res.json({ok:true});
  }catch(error){
    console.error('[LISTENING PROFILE] Save failed',error);
    return res.status(500).json({error:'Unable to save listening preferences'});
  }
}
async function clearProfile(req,res){
  try{
    await User.updateOne({_id:req.user._id},{$set:{listeningPreferences:{}}});
    return res.json({ok:true});
  }catch(error){
    console.error('[LISTENING PROFILE] Reset failed',error);
    return res.status(500).json({error:'Unable to clear listening preferences'});
  }
}
module.exports={normalizeSnapshot,getProfile,putProfile,clearProfile};
