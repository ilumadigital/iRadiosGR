'use strict';
const mongoose=require('mongoose');
const crypto=require('crypto');
const Promotion=require('../models/PromotedStation');
const Station=require('../models/Station');

const clean=v=>typeof v==='string'?v.trim():'';
const fail=(res,e)=>res.status(e.status||503).json({error:e.status?e.message:'Αδυναμία διαχείρισης προτεινόμενου σταθμού.'});
const invalid=message=>{const e=new Error(message);e.status=400;throw e;};
function scope(input){
  const placement=clean(input?.placement);
  const placementValue=clean(input?.value??input?.placementValue);
  if(!['genre','region','news'].includes(placement) ||
    (placement!=='news'&&(!placementValue||placementValue.length>120)) ||
    (placement==='news'&&placementValue))
    invalid('Επιλέξτε μουσικό είδος, περιοχή ή Newsfeed.');
  return {placement,placementValue};
}
function normalize(input){
  const placement=scope(input);
  const stationId=clean(input?.stationId);
  if(!mongoose.isValidObjectId(stationId)||typeof input?.enabled!=='boolean')
    invalid('Επιλέξτε εγκεκριμένο σταθμό και κατάσταση.');
  return {...placement,stationId,enabled:input.enabled};
}
exports.normalize=normalize;
exports.publicPromoted=async(req,res)=>{
  try{
    const key=scope(req.query);
    const promotion=await Promotion.findOne({...key,enabled:true}).select('stationId').lean();
    if(!promotion)return res.json(null);
    const station=await Station.findOne({_id:promotion.stationId,status:'approved',isOffline:{$ne:true}})
      .select('_id').lean();
    if(!station)return res.json(null);
    // This endpoint is guest-accessible: never reveal native/AI song titles,
    // stream credentials, playlist records or listener information. The
    // frontend renders the station's public schedule independently.
    res.setHeader('Cache-Control','public, max-age=15');
    return res.json({stationId:String(station._id)});
  }catch(e){fail(res,e);}
};
exports.list=async(_req,res)=>{
  try{res.json(await Promotion.find().sort({placement:1,placementValue:1}).lean());}
  catch(e){fail(res,e);}
};
exports.save=async(req,res)=>{
  try{
    const payload=normalize(req.body);
    if(!await Station.exists({_id:payload.stationId,status:'approved'}))
      invalid('Ο σταθμός δεν είναι εγκεκριμένος.');
    const {placement,placementValue,...fields}=payload;
    const doc=await Promotion.findOneAndUpdate({placement,placementValue},
      {$set:fields},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
    res.json(doc);
  }catch(e){
    if(e.code===11000)return res.status(409).json({error:'Η τοποθέτηση ενημερώθηκε ταυτόχρονα. Δοκίμασε ξανά.'});
    fail(res,e);
  }
};
exports.remove=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))invalid('Μη έγκυρος κωδικός εγγραφής.');
    const doc=await Promotion.findByIdAndDelete(req.params.id);
    if(!doc)return res.status(404).json({error:'Η καταχώριση δεν βρέθηκε.'});
    res.json({success:true});
  }catch(e){fail(res,e);}
};

const campaignPlacements=input=>{
  if(!Array.isArray(input)||!input.length||input.length>12)invalid('Επίλεξε 1 έως 12 τοποθετήσεις.');
  const scopes=input.map(item=>scope(item));
  const keys=scopes.map(x=>x.placement+':'+x.placementValue);
  if(new Set(keys).size!==keys.length)invalid('Η ίδια τοποθέτηση υπάρχει δύο φορές.');
  return scopes;
};
// A promoted campaign can appear in many existing genre/region pages plus Newsfeed.
// One placement stays exclusive to one station, preserving the original public endpoint.
exports.saveCampaign=async(req,res)=>{
  try{
    const stationId=clean(req.body?.stationId);
    if(!mongoose.isValidObjectId(stationId) || typeof req.body?.enabled!=='boolean')
      invalid('Επίλεξε εγκεκριμένο σταθμό και κατάσταση.');
    if(!await Station.exists({_id:stationId,status:'approved'}))
      invalid('Ο σταθμός δεν είναι εγκεκριμένος.');
    const placements=campaignPlacements(req.body?.placements);
    const provided=clean(req.body?.campaignId);
    if(provided && !/^[a-f0-9-]{36}$/.test(provided))invalid('Μη έγκυρη καμπάνια.');
    const campaignId=provided||crypto.randomUUID();
    const keys=placements.map(p=>({placement:p.placement,placementValue:p.placementValue}));
    // An exclusive slot must never be silently stolen from a different campaign.
    // Reusing a matching legacy station's ungrouped slot remains supported.
    const occupied=await Promotion.find({$or:keys})
      .select('campaignId stationId placement placementValue').lean();
    if(occupied.some(p=>p.campaignId
      ? p.campaignId!==campaignId : String(p.stationId)!==stationId))
      return res.status(409).json({error:'Μία θέση ανήκει ήδη σε άλλη καμπάνια. Αφαίρεσέ την πρώτα από την προηγούμενη καμπάνια.'});
    // The guard also prevents a concurrent editor from hijacking an existing
    // campaign between validation and the individual write.
    for(const key of keys){
      await Promotion.findOneAndUpdate({...key,$or:[
        {campaignId},{campaignId:{$in:['',null]},stationId}
      ]},{$set:{stationId,enabled:req.body.enabled,campaignId}},
        {upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
    }
    await Promotion.deleteMany({campaignId,$nor:keys});
    res.json({campaignId,stationId,enabled:req.body.enabled,placements});
  }catch(e){if(e.code===11000)return res.status(409).json({error:'Άλλη καμπάνια ενημέρωσε τη θέση. Δοκίμασε ξανά.'});fail(res,e);}
};
exports.removeCampaign=async(req,res)=>{
  try{
    if(!/^[a-f0-9-]{36}$/.test(req.params.id))invalid('Μη έγκυρη καμπάνια.');
    const result=await Promotion.deleteMany({campaignId:req.params.id});
    if(!result.deletedCount)return res.status(404).json({error:'Η καμπάνια δεν βρέθηκε.'});
    res.json({success:true});
  }catch(e){fail(res,e);}
};
