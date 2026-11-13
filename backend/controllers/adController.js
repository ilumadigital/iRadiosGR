const Ad = require('../models/Ad');
const User = require('../models/User');
const Station=require('../models/Station');
const {hasStationRight}=require('../services/billingEntitlements');
const mongoose=require('mongoose');
const {sendAdAudio,localAudioFile}=require('../services/adAudioDelivery');
const {isStage,activeCampaignQuery,live,publicAd,fields,permitMetric} =
  require('../services/adDeliveryRules');
const writable=['title','client','audioUrl','logoUrl','linkUrl','frequency',
  'dspPreset','targetLocations','targetCountry','targetRegion','status','duration','expiresAt'];
const correctFrequency=value=>({
  first_station:'entry',every_2:'every_2_stations',every_4:'every_4_stations'
}[value]||value);

const fs = require('fs').promises;
const path = require('path');

// 🟢 Βοηθητική Συνάρτηση: Διαβάζει το URL και διαγράφει το αρχείο από τον Nginx φάκελο
const deleteMediaFile = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('/media/')) return;
    
    try {
        // Παίρνουμε το κομμάτι μετά το /media/ (π.χ. "audio/iluma/123-spot.mp3")
        const relativePath=String(fileUrl.split('/media/')[1]||'').split(/[?#]/)[0];
        const uploadRoot=path.resolve(process.cwd(),'uploads');
        const fullPath=path.resolve(uploadRoot,relativePath);
        if(!relativePath||!fullPath.startsWith(uploadRoot+path.sep))
          throw new Error('Rejected unsafe media path');
        await fs.unlink(fullPath);
        console.log(`✅ Το αρχείο διαγράφηκε: ${relativePath}`);
    } catch (error) {
        // Αν το αρχείο δεν υπάρχει, απλά το αγνοούμε
        console.error(`⚠️ Το αρχείο δεν βρέθηκε ή δεν διαγράφηκε: ${fileUrl}`);
    }
};

exports.getPublicAds=async(req,res)=>{
  try {
    res.set('Cache-Control','no-store, private');
    const ads=await Ad.find(activeCampaignQuery()).sort({createdAt:1}).lean();
    if(!isStage())return res.json(ads.map(publicAd));
    // Never offer listeners an unplayable spot (e.g. imported missing files).
    const media=await Promise.all(ads.map(ad=>localAudioFile(ad.audioUrl)));
    return res.json(ads.filter((ad,index)=>Boolean(media[index]))
      .map(ad=>({...publicAd(ad),audioUrl:'/api/ads/'+ad._id+'/media'})));
  }catch(error){
    console.error('[ADS] Public delivery failed',error.message);
    res.status(500).json({error:'Σφάλμα λήψης.'});
  }
};

// Public streaming serves ONLY an active, local, stage-tagged spot. The same
// endpoint supports browser Range requests and Safari media preloading.
exports.streamPublicAudio=async(req,res)=>{
  if(!isStage()||!mongoose.isValidObjectId(req.params.id))
    return res.status(404).json({error:'Not found'});
  try {
    const ad=await Ad.findById(req.params.id).select('audioUrl status expiresAt isStageCreative');
    if(!live(ad))return res.status(404).json({error:'Not found'});
    await sendAdAudio(res,ad.audioUrl);
  }catch(error){
    console.error('[ADS] Playback media failed',error.message);
    if(!res.headersSent)res.status(500).json({error:'Audio unavailable'});
  }
};

// Authenticated staff preview never contributes to impression/play metrics;
// imported campaigns can be inspected but missing local files fail with 404.
exports.previewAudio=async(req,res)=>{
  if(!isStage()||!mongoose.isValidObjectId(req.params.id))
    return res.status(404).json({error:'Not found'});
  try {
    const ad=await Ad.findById(req.params.id).select('audioUrl');
    if(!ad)return res.status(404).json({error:'Not found'});
    await sendAdAudio(res,ad.audioUrl,{preview:true});
  }catch(error){
    console.error('[ADS] Preview media failed',error.message);
    if(!res.headersSent)res.status(500).json({error:'Preview unavailable'});
  }
};

exports.getAdminAds = async (req, res) => {
  try {
    // Εδώ ο admin τα βλέπει όλα
    const ads = await Ad.find({ isGlobal: true }).sort({ createdAt: -1 }).lean();
    if(!isStage())return res.json(ads);
    const files=await Promise.all(ads.map(ad=>localAudioFile(ad.audioUrl)));
    res.json(ads.map((ad,i)=>({...ad,mediaReady:Boolean(files[i])})));
  } catch (err) { res.status(500).json({ error: 'Σφάλμα λήψης.' }); }
};

exports.getAdminLocalAds = async (req, res) => {
  try {
    const ads = await Ad.find({ isGlobal: false }).populate('stationId', 'name logo').sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα λήψης.' }); }
};

exports.createAdminAd=async(req,res)=>{
  try{
    const patch=fields(req.body,writable);
    patch.frequency=correctFrequency(patch.frequency||'entry');
    const newAd=await Ad.create({...patch,isGlobal:true,agencyId:null,
      isStageCreative:isStage(),
      ...(isStage()&&!patch.expiresAt?{expiresAt:new Date(Date.now()+30*86400000)}:{})});
    res.status(201).json(newAd);
  }catch(error){
    console.error('[ADS] Create failed',error.message);
    res.status(400).json({error:'Δεν δημιουργήθηκε το spot. Έλεγξε τη συχνότητα και το αρχείο.'});
  }
};

// Explicit Admin action: copy legacy data into isolated, pending staging inventory.
exports.cloneStageAd=async(req,res)=>{
  if(!isStage())return res.status(404).json({error:'Unavailable'});
  try{
    const original=await Ad.findById(req.params.id).lean();
    if(!original||original.isStageCreative)return res.status(404).json({error:'No import to copy'});
    const patch=fields(original,['title','client','audioUrl','logoUrl','linkUrl','frequency',
      'dspPreset','targetLocations','targetCountry','targetRegion']);
    const clone=await Ad.create({...patch,title:`${original.title} · STAGING`,
      frequency:correctFrequency(patch.frequency||'entry'),
      status:'pending',duration:'month',expiresAt:null,isStageCreative:true,
      isGlobal:true,agencyId:null});
    res.status(201).json(clone);
  }catch(error){res.status(400).json({error:'Δεν δημιουργήθηκε δοκιμαστικό αντίγραφο.'});}
};

exports.updateAd=async(req,res)=>{
  try{
    const patch=fields(req.body,writable);
    if(patch.frequency!==undefined)patch.frequency=correctFrequency(patch.frequency);
    // The server-owned staging marker is immutable; imported data stays hidden.
    const updated=await Ad.findByIdAndUpdate(req.params.id,{$set:patch},
      {new:true,runValidators:true});
    if(!updated)return res.status(404).json({error:'Δεν βρέθηκε το spot.'});
    res.json(updated);
  }catch(error){
    console.error('[ADS] Update failed',error.message);
    res.status(400).json({error:'Η ενημέρωση απέτυχε. Έλεγξε τις τιμές.'});
  }
};

// 🟢 ΑΝΑΒΑΘΜΙΣΜΕΝΟ DELETE (Διαγράφει και τα αρχεία)
exports.deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Το spot δεν βρέθηκε.' });

    // 1. ΔΙΑΓΡΑΦΗ ΑΡΧΕΙΟΥ ΗΧΟΥ ΑΠΟ ΤΟΝ ΔΙΣΚΟ
    if (ad.audioUrl) {
      await deleteMediaFile(ad.audioUrl);
    }
    // Προαιρετικά: Αν είχαν ανεβάσει και Logo στον δικό μας server
    if (ad.logoUrl && ad.logoUrl.includes('/media/visuals/')) {
      await deleteMediaFile(ad.logoUrl);
    }

    // 2. ΔΙΑΓΡΑΦΗ ΑΠΟ ΤΗ ΒΑΣΗ ΔΕΔΟΜΕΝΩΝ
    await ad.deleteOne();

    res.json({ message: 'Διαγράφηκε οριστικά (Βάση & Αρχεία)!' });
  } catch (err) { 
    console.error("Σφάλμα διαγραφής Ad:", err);
    res.status(500).json({ error: 'Σφάλμα διαγραφής.' }); 
  }
};

exports.getBroadcasterAds = async (req, res) => {
  try {
    const ads = await Ad.find({ broadcasterId: req.params.userId, isGlobal: false });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα λήψης διαφημίσεων' }); }
};

// Broadcaster local ad actions must be scoped by the signed-in user and by
// the station's entitlement, NEVER by a broadcasterId supplied in JSON.
exports.createBroadcasterAd=async(req,res)=>{
 try{
  const user=req.user,stationId=req.body?.stationId;
  if(!user || user.role!=='broadcaster')
    return res.status(403).json({error:'Απαιτείται Broadcaster.'});
  const station=await Station.findOne({_id:stationId,broadcasterId:user._id});
  if(!station)return res.status(403).json({error:'Ο σταθμός δεν ανήκει στον λογαριασμό σας.'});
  if(!await hasStationRight(user,station,'broadcaster.ad_control'))
    return res.status(403).json({error:'Δεν έχετε ενεργό Ad Control για αυτόν τον σταθμό.'});
  const allowed=['title','client','audioUrl','logoUrl','linkUrl','frequency','dspPreset','targetLocations'];
  const patch={};
  for(const field of allowed)if(req.body?.[field]!==undefined)patch[field]=req.body[field];
  // Legacy frontend calls the entry frequency "first_station".
  if(patch.frequency==='first_station')patch.frequency='entry';
  const created=await Ad.create({...patch,agencyId:null,broadcasterId:user._id,
    stationId:station._id,isGlobal:false,status:'active',isStageCreative:isStage()});
  return res.status(201).json(created);
 }catch(e){
  console.error('[AD CONTROL] Create failed',e.message);
  return res.status(400).json({error:'Δεν δημιουργήθηκε το τοπικό spot.'});
 }
};
exports.updateBroadcasterAd=async(req,res)=>{
 try{
  const ad=await Ad.findOne({_id:req.params.id,broadcasterId:req.user._id,isGlobal:false});
  if(!ad)return res.status(404).json({error:'Το spot δεν βρέθηκε.'});
  const station=await Station.findOne({_id:ad.stationId,broadcasterId:req.user._id});
  if(!station||!await hasStationRight(req.user,station,'broadcaster.ad_control'))
    return res.status(403).json({error:'Δεν έχετε Ad Control για αυτόν τον σταθμό.'});
  const patch={};
  for(const field of ['title','client','audioUrl','logoUrl','linkUrl','frequency','dspPreset','targetLocations'])
    if(req.body?.[field]!==undefined)patch[field]=req.body[field];
  if(patch.frequency==='first_station')patch.frequency='entry';
  const updated=await Ad.findOneAndUpdate({_id:ad._id,broadcasterId:req.user._id,isGlobal:false},
    {$set:patch},{new:true,runValidators:true});
  return res.json(updated);
 }catch(e){
  console.error('[AD CONTROL] Update failed',e.message);
  return res.status(400).json({error:'Δεν αποθηκεύτηκε το spot.'});
 }
};
exports.deleteBroadcasterAd=async(req,res)=>{
 try{
  const ad=await Ad.findOne({_id:req.params.id,broadcasterId:req.user._id,isGlobal:false});
  if(!ad)return res.status(404).json({error:'Το spot δεν βρέθηκε.'});
  const station=await Station.findOne({_id:ad.stationId,broadcasterId:req.user._id});
  if(!station||!await hasStationRight(req.user,station,'broadcaster.ad_control'))
    return res.status(403).json({error:'Δεν έχετε Ad Control για αυτόν τον σταθμό.'});
  const removed=await Ad.findOneAndDelete({_id:ad._id,broadcasterId:req.user._id,isGlobal:false});
  if(!removed)return res.status(409).json({error:'Το spot τροποποιήθηκε. Δοκίμασε ξανά.'});
  // Retain no fake financial record; this is a broadcaster's own local spot.
  // Existing agency creatives are deliberately NOT affected by this endpoint.
  await Promise.allSettled([deleteMediaFile(removed.audioUrl),deleteMediaFile(removed.logoUrl)]);
  return res.json({message:'Το τοπικό spot αφαιρέθηκε.'});
 }catch(e){
  console.error('[AD CONTROL] Delete failed',e.message);
  return res.status(500).json({error:'Δεν αφαιρέθηκε το spot.'});
 }
};

exports.logImpression=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const ad=await Ad.findById(req.params.id).select('status expiresAt isStageCreative');
    if(!live(ad))return res.status(404).json({error:'Not found'});
    if(!permitMetric(req,'audio-play',req.params.id))return res.json({success:true,deduplicated:true});
    await Ad.updateOne({_id:ad._id,...activeCampaignQuery()},{$inc:{impressions:1,plays:1}});
    res.json({success:true});
  }catch(error){res.status(500).json({error:'Σφάλμα καταγραφής play'});}
};

exports.logClick=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const ad=await Ad.findById(req.params.id).select('status expiresAt isStageCreative');
    if(!live(ad))return res.status(404).json({error:'Not found'});
    if(!permitMetric(req,'audio-click',req.params.id))return res.json({success:true,deduplicated:true});
    await Ad.updateOne({_id:ad._id,...activeCampaignQuery()},{$inc:{clicks:1}});
    res.json({success:true});
  }catch(error){res.status(500).json({error:'Σφάλμα καταγραφής click'});}
};
