'use strict';
const mongoose=require('mongoose');
const Promotion=require('../models/PromotedStation');
const Station=require('../models/Station');
const Playlist=require('../models/StationPlaylist');
const {snapshotSong}=require('../utils/stageNativeNow');

const clean=v=>typeof v==='string'?v.trim():'';
const fail=(res,e)=>res.status(e.status||503).json({error:e.status?e.message:'Αδυναμία διαχείρισης προτεινόμενου σταθμού.'});
const invalid=message=>{const e=new Error(message);e.status=400;throw e;};
function scope(input){
  const placement=clean(input?.placement);
  const placementValue=clean(input?.value??input?.placementValue);
  if(!['genre','region'].includes(placement)||!placementValue||placementValue.length>120)
    invalid('Επιλέξτε μουσικό είδος ή περιοχή.');
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
    const station=await Station.findOne({_id:promotion.stationId,status:'approved'})
      .select('_id').lean();
    if(!station)return res.json(null);
    // Only a single admin-selected, approved station has public editorial now-playing.
    // No private profiles, streams, metadata URLs, playlist histories or listener IDs.
    const playlist=await Playlist.findOne({stationId:station._id})
      .select('nativeNow nativeShow currentAI').lean();
    const song=snapshotSong(playlist,Date.now());
    const track=typeof song?.title==='string' && song.title.trim() ?
      {title:song.title,source:song.source==='acrcloud'?'acrcloud':'station',
        foundWithAI:song.foundWithAI===true} : null;
    res.setHeader('Cache-Control','public, max-age=15');
    return res.json({stationId:String(station._id),nowPlaying:track});
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
