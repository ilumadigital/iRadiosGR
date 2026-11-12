'use strict';
const express=require('express');
const router=express.Router();
const BannerAd=require('../models/BannerAd');
const Ad=require('../models/Ad');
const {protect}=require('../utils/authMiddleware');
const {isStage,fields}=require('../services/adDeliveryRules');
const allowedPlacements=new Set(['hero','home','radio_feed','news_feed','station_profile']);
const audioFields=['title','client','audioUrl','logoUrl','linkUrl','frequency','targetLocations','targetCountry','targetRegion','dspPreset'];
const bannerFields=['title','description','imageUrl','squareImageUrl','targetUrl','placement','targetLocations','targetCountry','targetRegion',
  'logoUrl','ctaLabel','brandColor','focalX','focalY'];
const frequencies=new Set(['entry','every_5_stations','every_10_stations','every_15_stations',
  'every_20_stations','every_30_stations','every_1_hour','every_2_hours',
  'every_6_hours','once_a_day','twice_a_day','four_times_a_day','once_a_week']);
router.use(protect);
router.use((req,res,next)=>{
  if(!['agency','admin'].includes(req.user?.role))
    return res.status(403).json({error:'Agency account required'});
  next();
});
const ownQuery=(req,id)=>req.user.role==='admin'?{agencyId:id}:
  String(req.user._id)===String(id)?{agencyId:req.user._id}:null;
const stageOnly=(req,res,next)=>isStage()?next():
  res.status(503).json({error:'Agency purchases are not enabled in this environment.'});
const safeLink=value=>{
  try{return ['https:','http:'].includes(new URL(value).protocol);}
  catch{return false;}
};
router.get('/:agencyId/banners',async(req,res)=>{
  const q=ownQuery(req,req.params.agencyId);
  if(!q)return res.status(403).json({error:'Forbidden'});
  try{res.json(await BannerAd.find(q).sort({createdAt:-1}));}
  catch{return res.status(500).json({error:'Δεν φορτώθηκαν οι καμπάνιες.'});}
});
router.get('/:agencyId/audio-ads',async(req,res)=>{
  const q=ownQuery(req,req.params.agencyId);
  if(!q)return res.status(403).json({error:'Forbidden'});
  try{res.json(await Ad.find(q).sort({createdAt:-1}));}
  catch{return res.status(500).json({error:'Δεν φορτώθηκαν τα spots.'});}
});
router.post('/banners',stageOnly,async(req,res)=>{
  try{
    const patch=fields(req.body,bannerFields);
    if(!Array.isArray(patch.placement)||!patch.placement.length||
      patch.placement.some(p=>!allowedPlacements.has(p))||
      !safeLink(patch.targetUrl))
      return res.status(400).json({error:'Επίλεξε έγκυρα placements και URL.'});
    const saved=await BannerAd.create({...patch,agencyId:req.user._id,
      duration:'month',status:'pending',isActive:false,isStageCreative:true});
    res.status(201).json(saved);
  }catch(error){
    console.error('[AGENCY] Banner draft failed',error.message);
    res.status(400).json({error:'Δεν δημιουργήθηκε το δοκιμαστικό banner.'});
  }
});
router.post('/audio-ads',stageOnly,async(req,res)=>{
  try{
    const patch=fields(req.body,audioFields);
    if(!frequencies.has(patch.frequency||'entry'))
      return res.status(400).json({error:'Μη έγκυρη συχνότητα spot.'});
    const saved=await Ad.create({...patch,frequency:patch.frequency||'entry',
      agencyId:req.user._id,duration:'month',status:'pending',
      isGlobal:true,isStageCreative:true});
    res.status(201).json(saved);
  }catch(error){
    console.error('[AGENCY] Audio draft failed',error.message);
    res.status(400).json({error:'Δεν δημιουργήθηκε το δοκιμαστικό spot.'});
  }
});
// Agencies can revise pending/rejected test creatives; active ads cannot be silently edited.
router.put('/banners/:id',stageOnly,async(req,res)=>{
  try{
    const patch=fields(req.body,bannerFields);
    if(patch.placement&&(!Array.isArray(patch.placement)||
      patch.placement.some(p=>!allowedPlacements.has(p))))return res.status(400).json({error:'Invalid placement'});
    if(patch.targetUrl&&!safeLink(patch.targetUrl))return res.status(400).json({error:'Invalid URL'});
    const updated=await BannerAd.findOneAndUpdate({_id:req.params.id,agencyId:req.user._id,
      isStageCreative:true,status:{$in:['pending','rejected']}},{$set:{...patch,status:'pending',isActive:false}},
      {new:true,runValidators:true});
    if(!updated)return res.status(404).json({error:'Η καμπάνια δεν είναι επεξεργάσιμη.'});
    res.json(updated);
  }catch{return res.status(400).json({error:'Αποτυχία ενημέρωσης.'});}
});
router.put('/audio-ads/:id',stageOnly,async(req,res)=>{
  try{
    const patch=fields(req.body,audioFields);
    if(patch.frequency&&!frequencies.has(patch.frequency))return res.status(400).json({error:'Invalid frequency'});
    const updated=await Ad.findOneAndUpdate({_id:req.params.id,agencyId:req.user._id,
      isStageCreative:true,status:{$in:['pending','rejected']}},{$set:{...patch,status:'pending'}},
      {new:true,runValidators:true});
    if(!updated)return res.status(404).json({error:'Το spot δεν είναι επεξεργάσιμο.'});
    res.json(updated);
  }catch{return res.status(400).json({error:'Αποτυχία ενημέρωσης.'});}
});
module.exports=router;
