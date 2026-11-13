'use strict';
const express=require('express');
const router=express.Router();
const BannerAd=require('../models/BannerAd');
const Ad=require('../models/Ad');
const User=require('../models/User');
const AgencyAdRevision=require('../models/AgencyAdRevision');
// The partial unique pending index is a correctness requirement. Without it,
// simultaneous Agency edits could both be queued before Admin approval.
let revisionIndexesReady=null;
function ensureAgencyRevisionIndexes(){
 if(!revisionIndexesReady)revisionIndexesReady=AgencyAdRevision.createIndexes()
  .catch(error=>{revisionIndexesReady=null;throw error;});
 return revisionIndexesReady;
}
const AdvertisingCampaign=require('../models/AdvertisingCampaign');
const mongoose=require('mongoose');
const {validateAgencyGeo}=require('../services/agencyAdGeo');
const {mailAdmins}=require('../services/agencyAdNotifications');
const {localAudioFile}=require('../services/adAudioDelivery');
const {protect}=require('../utils/authMiddleware');
const {isStage,fields}=require('../services/adDeliveryRules');
const {sanitizeAdDesign}=require('../services/adDesignRules');
const allowedPlacements=new Set(['hero','home','radio_feed','news_feed','station_profile']);
const audioFields=['title','client','audioUrl','logoUrl','linkUrl','frequency','targetLocations','targetCountry','targetRegion','dspPreset','campaignId'];
const bannerFields=['title','description','imageUrl','squareImageUrl','targetUrl','placement','targetLocations','targetCountry','targetRegion',
  'logoUrl','ctaLabel','brandColor','focalX','focalY','designConfig','campaignId'];
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
async function checkCampaignOwner(campaignId,agencyId) {
 // Newly created Agency ads must belong to an owned unified campaign.
 // Existing pre-v2 legacy creatives remain readable and are not migrated.
 if(campaignId===undefined||campaignId===null||campaignId==='')
  throw Error('Απαιτείται ενιαία καμπάνια v2 για τη δημιουργία Agency διαφήμισης.');
 if(!mongoose.isValidObjectId(campaignId)||!
   await AdvertisingCampaign.exists({_id:campaignId,agencyId,isStageCampaign:true,deletedAt:null}))
   throw Error('Η ενιαία καμπάνια δεν ανήκει στο Agency.');
}
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
  try{
    const ads=await Ad.find(q).sort({createdAt:-1}).lean();
    if(!isStage())return res.json(ads);
    const files=await Promise.all(ads.map(ad=>localAudioFile(ad.audioUrl)));
    res.json(ads.map((ad,i)=>({...ad,mediaReady:Boolean(files[i])})));
  }
  catch{return res.status(500).json({error:'Δεν φορτώθηκαν τα spots.'});}
});
// Preview remains authenticated and strictly scoped to the campaign owner.
router.get('/audio-ads/:id/preview-audio',stageOnly,async(req,res)=>{
  try {
    const campaign=await Ad.findOne({_id:req.params.id,
      ...(req.user.role==='admin'?{}:{agencyId:req.user._id})}).select('audioUrl');
    if(!campaign)return res.status(404).json({error:'Not found'});
    await require('../services/adAudioDelivery').sendAdAudio(res,campaign.audioUrl,{preview:true});
  }catch(error){
    if(!res.headersSent)res.status(404).json({error:'Preview unavailable'});
  }
});
router.post('/banners',stageOnly,async(req,res)=>{
  try{
    const patch=fields(req.body,bannerFields);
    await checkCampaignOwner(patch.campaignId,req.user._id);
    if(patch.designConfig!==undefined)patch.designConfig=sanitizeAdDesign(patch.designConfig);
    Object.assign(patch,validateAgencyGeo(patch));
    if(!Array.isArray(patch.placement)||!patch.placement.length||
      patch.placement.some(p=>!allowedPlacements.has(p))||
      !safeLink(patch.targetUrl))
      return res.status(400).json({error:'Επίλεξε έγκυρα placements και URL.'});
    const saved=await BannerAd.create({...patch,agencyId:req.user._id,
      duration:'month',status:'pending',isActive:false,isStageCreative:true});
    await notifySubmission('banner',saved,patch,req.user);
    res.status(201).json(saved);
  }catch(error){
    console.error('[AGENCY] Banner draft failed',error.message);
    res.status(400).json({error:'Δεν δημιουργήθηκε το δοκιμαστικό banner.'});
  }
});
router.post('/audio-ads',stageOnly,async(req,res)=>{
  try{
    const patch=fields(req.body,audioFields);
    await checkCampaignOwner(patch.campaignId,req.user._id);
    Object.assign(patch,validateAgencyGeo(patch));
    if(!frequencies.has(patch.frequency||'entry'))
      return res.status(400).json({error:'Μη έγκυρη συχνότητα spot.'});
    const saved=await Ad.create({...patch,frequency:patch.frequency||'entry',
      agencyId:req.user._id,duration:'month',status:'pending',
      isGlobal:true,isStageCreative:true});
    await notifySubmission('audio',saved,patch,req.user);
    res.status(201).json(saved);
  }catch(error){
    console.error('[AGENCY] Audio draft failed',error.message);
    res.status(400).json({error:'Δεν δημιουργήθηκε το δοκιμαστικό spot.'});
  }
});
// Every agency edit is submitted as a separate immutable revision. Active
// creative fields remain unchanged until the admin explicitly approves it.
async function notifySubmission(kind,creative,patch,user,revision=null) {
  const agency=await User.findById(creative.agencyId).select('username email').lean();
  const item=revision||{patch,before:{},agencyId:creative.agencyId};
  try {
    const ok=await mailAdmins({kind,creative,revision:item,agency});
    if(revision)await AgencyAdRevision.updateOne({_id:revision._id},
      {$set:{notificationState:ok?'sent':'failed'}});
  }catch(error){
    console.error('[AGENCY] Approval notification failed',error.message);
    if(revision)await AgencyAdRevision.updateOne({_id:revision._id},
      {$set:{notificationState:'failed'}}).catch(()=>{});
  }
}
async function revise(req,res,kind) {
  try {
    const banner=kind==='banner';
    const Model=banner?BannerAd:Ad;
    const patch=fields(req.body,banner?bannerFields:audioFields);
    if(!Object.keys(patch).length)return res.status(400).json({error:'Δεν υποβλήθηκαν αλλαγές.'});
    if(banner) {
      if(patch.designConfig!==undefined)patch.designConfig=sanitizeAdDesign(patch.designConfig);
      if(patch.placement&&(!Array.isArray(patch.placement)||!patch.placement.length||
        patch.placement.some(p=>!allowedPlacements.has(p))))
        return res.status(400).json({error:'Invalid placement'});
      if(patch.targetUrl&&!safeLink(patch.targetUrl))
        return res.status(400).json({error:'Invalid URL'});
    }else if(patch.frequency&&!frequencies.has(patch.frequency))
      return res.status(400).json({error:'Invalid frequency'});
    const creative=await Model.findOne({_id:req.params.id,agencyId:req.user._id,
      isStageCreative:true});
    if(!creative)return res.status(404).json({error:'Δεν βρέθηκε η καμπάνια.'});
    if(patch.campaignId!==undefined && String(patch.campaignId||'')!==String(creative.campaignId||''))
      return res.status(409).json({error:'Δεν επιτρέπεται μεταφορά δημιουργικού σε άλλη καμπάνια.'});
    if(!['active','pending','rejected','expired'].includes(creative.status))
      return res.status(409).json({error:'Μη επεξεργάσιμη καμπάνια.'});
    if(['targetCountry','targetRegion','targetLocations'].some(k=>Object.hasOwn(patch,k)))
      Object.assign(patch,validateAgencyGeo(patch,creative));
    const existing=await AgencyAdRevision.findOne({creativeType:kind,creativeId:creative._id,status:'pending'});
    if(existing)return res.status(409).json({
      error:'Υπάρχουν ήδη αλλαγές προς έγκριση. Περίμενε απόφαση Admin.',revisionId:existing._id
    });
    const before=Object.fromEntries(Object.keys(patch).map(k=>[k,creative.get(k)]));
    await ensureAgencyRevisionIndexes();
    const revision=await AgencyAdRevision.create({
      agencyId:req.user._id,creativeId:creative._id,creativeType:kind,
      patch,before,baseUpdatedAt:creative.updatedAt||null,submittedBy:req.user._id
    });
    await notifySubmission(kind,creative,patch,req.user,revision);
    return res.status(202).json({pendingApproval:true,revisionId:revision._id,
      message:'Οι αλλαγές υποβλήθηκαν προς έγκριση.',creative});
  }catch(error){
    console.error('[AGENCY] Revision failed',error.message);
    return res.status(400).json({error:error.message||'Αποτυχία υποβολής αλλαγών.'});
  }
}
router.put('/banners/:id',stageOnly,(req,res)=>revise(req,res,'banner'));
router.put('/audio-ads/:id',stageOnly,(req,res)=>revise(req,res,'audio'));
router.get('/revisions/pending',stageOnly,async(req,res)=>{
  try {
    const filter=req.user.role==='admin'?{}:{agencyId:req.user._id};
    res.json(await AgencyAdRevision.find({...filter,status:'pending'}).sort({createdAt:-1}).lean());
  }catch{return res.status(500).json({error:'Δεν φορτώθηκαν οι αλλαγές.'});}
});
module.exports=router;
