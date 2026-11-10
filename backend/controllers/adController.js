const Ad = require('../models/Ad');
const User = require('../models/User');
const Station=require('../models/Station');
const {hasStationRight}=require('../services/billingEntitlements');

const fs = require('fs').promises;
const path = require('path');

// 🟢 Βοηθητική Συνάρτηση: Διαβάζει το URL και διαγράφει το αρχείο από τον Nginx φάκελο
const deleteMediaFile = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('/media/')) return;
    
    try {
        // Παίρνουμε το κομμάτι μετά το /media/ (π.χ. "audio/iluma/123-spot.mp3")
        const relativePath = fileUrl.split('/media/')[1]; 
        const fullPath = path.join(process.cwd(), 'uploads', relativePath);
        
        await fs.unlink(fullPath);
        console.log(`✅ Το αρχείο διαγράφηκε: ${relativePath}`);
    } catch (error) {
        // Αν το αρχείο δεν υπάρχει, απλά το αγνοούμε
        console.error(`⚠️ Το αρχείο δεν βρέθηκε ή δεν διαγράφηκε: ${fileUrl}`);
    }
};

exports.getPublicAds = async (req, res) => {
  // Never deliver imported production campaigns on a public test domain.
  if (process.env.APP_ENV === 'staging') return res.json([]);
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); 
    
    // 🟢 ΣΗΜΑΝΤΙΚΟ: Φέρνουμε ΜΟΝΟ τα Active ads που ΔΕΝ έχουν λήξει!
    const ads = await Ad.find({
      status: 'active',
      $or: [
        { expiresAt: { $gt: new Date() } }, 
        { expiresAt: null },
        { expiresAt: { $exists: false } }
      ]
    }).sort({ createdAt: 1 });
    
    res.json(ads);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα λήψης.' }); }
};

exports.getAdminAds = async (req, res) => {
  try {
    // Εδώ ο admin τα βλέπει όλα
    const ads = await Ad.find({ isGlobal: true }).sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα λήψης.' }); }
};

exports.getAdminLocalAds = async (req, res) => {
  try {
    const ads = await Ad.find({ isGlobal: false }).populate('stationId', 'name logo').sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα λήψης.' }); }
};

exports.createAdminAd = async (req, res) => {
  try {
    const newAd = new Ad({ ...req.body, isGlobal: true });
    await newAd.save();
    res.status(201).json(newAd);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα προσθήκης.' }); }
};

exports.updateAd = async (req, res) => {
  try {
    const updatedAd = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedAd);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα ενημέρωσης.' }); }
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
    stationId:station._id,isGlobal:false,status:'active'});
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

exports.logImpression = async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1, plays: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα καταγραφής play" }); }
};

exports.logClick = async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα καταγραφής click" }); }
};
