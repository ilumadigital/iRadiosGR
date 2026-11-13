// controllers/bannerController.js
const BannerAd = require('../models/BannerAd');
const mongoose=require('mongoose');
const {sanitizeAdDesign}=require('../services/adDesignRules');
const {isStage,activeCampaignQuery,live,fields,permitMetric} =
  require('../services/adDeliveryRules');
const writable=['title','description','imageUrl','squareImageUrl','targetUrl',
  'placement','targetLocations','targetCountry','targetRegion',
  'logoUrl','ctaLabel','brandColor','focalX','focalY','designConfig','status','duration','expiresAt'];
const placements=new Set(['hero','home','radio_feed','news_feed','station_profile']);
function validPatch(patch){
  if(patch.placement!==undefined&&(!Array.isArray(patch.placement)||
     !patch.placement.length||patch.placement.some(p=>!placements.has(p))))return false;
  if(patch.targetUrl!==undefined){
    try{if(!['http:','https:'].includes(new URL(patch.targetUrl).protocol))return false;}
    catch{return false;}
  }
  return true;
} 
const fs = require('fs').promises;
const path = require('path');

// 🟢 Βοηθητική Συνάρτηση: Διαβάζει το URL και διαγράφει το αρχείο εικόνας
const deleteMediaFile = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('/media/')) return;
    
    try {
        const relativePath=String(fileUrl.split('/media/')[1]||'').split(/[?#]/)[0];
        const root=path.resolve(process.cwd(),'uploads');
        const fullPath=path.resolve(root,relativePath);
        if(!relativePath||!fullPath.startsWith(root+path.sep))throw Error('Unsafe media path');
        
        await fs.unlink(fullPath);
        console.log(`✅ Η εικόνα διαγράφηκε: ${relativePath}`);
    } catch (error) {
        console.error(`⚠️ Το αρχείο δεν βρέθηκε ή δεν διαγράφηκε: ${fileUrl}`);
    }
};

// Φέρνει όλα τα ενεργά banners (Για το Public Frontend)
exports.getActiveBanners=async(req,res)=>{
  try{
    res.set('Cache-Control','no-store, private');
    const banners=await BannerAd.find(activeCampaignQuery()).select('-pendingRevision').sort({createdAt:-1}).lean();
    res.json(banners.filter(b=>Array.isArray(b.placement)&&b.placement.length));
  }catch(error){
    console.error('[BANNERS] Public delivery failed',error.message);
    res.status(500).json({error:'Σφάλμα ανάκτησης Banners.'});
  }
};

// Φέρνει ΟΛΑ τα banners (Για το Admin Panel)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await BannerAd.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: 'Σφάλμα ανάκτησης Banners Admin.' });
  }
};

// Δημιουργία νέου banner
exports.createBanner=async(req,res)=>{
  try{
    const patch=fields(req.body,writable);
    if(!validPatch(patch))return res.status(400).json({error:'Μη έγκυρη τοποθέτηση ή σύνδεσμος.'});
    if(patch.designConfig!==undefined)patch.designConfig=sanitizeAdDesign(patch.designConfig);
    const created=await BannerAd.create({...patch,agencyId:null,
      isActive:patch.status!=='expired'&&patch.status!=='rejected',
      isStageCreative:isStage(),
      ...(isStage()&&!patch.expiresAt?{expiresAt:new Date(Date.now()+30*86400000)}:{})});
    res.status(201).json(created);
  }catch(error){
    console.error('[BANNERS] Create failed',error.message);
    res.status(400).json({error:'Αποτυχία δημιουργίας Banner.'});
  }
};

// Ενημέρωση υπάρχοντος banner
exports.cloneStageBanner=async(req,res)=>{
  if(!isStage())return res.status(404).json({error:'Unavailable'});
  try{
    const original=await BannerAd.findById(req.params.id).lean();
    if(!original||original.isStageCreative)return res.status(404).json({error:'No import to copy'});
    const patch=fields(original,['title','description','imageUrl','squareImageUrl',
      'targetUrl','placement','targetLocations','targetCountry','targetRegion',
      'logoUrl','ctaLabel','brandColor','focalX','focalY','designConfig']);
    const clone=await BannerAd.create({...patch,title:`${original.title} · STAGING`,
      status:'pending',duration:'month',expiresAt:null,isStageCreative:true,
      isActive:false,agencyId:null});
    res.status(201).json(clone);
  }catch(error){res.status(400).json({error:'Δεν δημιουργήθηκε δοκιμαστικό banner.'});}
};

exports.updateBanner=async(req,res)=>{
  try{
    const patch=fields(req.body,writable);
    if(!validPatch(patch))return res.status(400).json({error:'Μη έγκυρη τοποθέτηση ή σύνδεσμος.'});
    if(patch.status!==undefined)patch.isActive=patch.status==='active';
    const updated=await BannerAd.findByIdAndUpdate(req.params.id,{$set:patch},
      {new:true,runValidators:true});
    if(!updated)return res.status(404).json({error:'Δεν βρέθηκε η διαφήμιση.'});
    res.json(updated);
  }catch(error){res.status(400).json({error:'Αποτυχία ενημέρωσης Banner.'});}
};

// 🟢 ΑΝΑΒΑΘΜΙΣΜΕΝΟ DELETE (Διαγράφει και τις Εικόνες)
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await BannerAd.findById(id);
    if (!banner) return res.status(404).json({ error: 'Η διαφήμιση δεν βρέθηκε.' });

    // 1. ΔΙΑΓΡΑΦΗ ΕΙΚΟΝΩΝ ΑΠΟ ΤΟΝ ΔΙΣΚΟ
    if (banner.imageUrl) {
      await deleteMediaFile(banner.imageUrl);
    }
    if (banner.squareImageUrl) {
      await deleteMediaFile(banner.squareImageUrl);
    }

    // 2. ΔΙΑΓΡΑΦΗ ΑΠΟ ΤΗ ΒΑΣΗ ΔΕΔΟΜΕΝΩΝ
    await banner.deleteOne();

    res.json({ message: 'Η διαφήμιση και οι εικόνες της διαγράφηκαν οριστικά.' });
  } catch (err) {
    console.error("Σφάλμα διαγραφής Banner:", err);
    res.status(500).json({ error: 'Αποτυχία διαγραφής Banner.' });
  }
};

// ==========================================
// 🟢 TRACKING METRICS
// ==========================================

exports.registerClick=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const banner=await BannerAd.findById(req.params.id).select('status expiresAt isStageCreative');
    if(!live(banner))return res.status(404).json({error:'Not found'});
    if(!permitMetric(req,'banner-click',req.params.id))return res.json({success:true,deduplicated:true});
    await BannerAd.updateOne({_id:banner._id,...activeCampaignQuery()},{$inc:{clicks:1}});
    res.json({success:true});
  }catch(error){res.status(500).json({error:'Σφάλμα καταγραφής κλικ.'});}
};

exports.registerImpression=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid ID'});
    const banner=await BannerAd.findById(req.params.id).select('status expiresAt isStageCreative');
    if(!live(banner))return res.status(404).json({error:'Not found'});
    if(!permitMetric(req,'banner-view',req.params.id,10000))return res.json({success:true,deduplicated:true});
    await BannerAd.updateOne({_id:banner._id,...activeCampaignQuery()},{$inc:{impressions:1}});
    res.json({success:true});
  }catch(error){res.status(500).json({error:'Σφάλμα καταγραφής view'});}
};
