const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// Βεβαιώσου ότι το path του authMiddleware είναι το σωστό για το project σου
const { protect } = require('../utils/authMiddleware'); 
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const Station=require('../models/Station');
const mongoose=require('mongoose');
const {hasStationRight}=require('../services/billingEntitlements');

// ==========================================
// 1. STORAGE ΓΙΑ ΗΧΗΤΙΚΑ ΣΠΟΤ (AUDIO)
// ==========================================
// Use a stable, safe MongoDB user id instead of a user-controlled username.
// Existing media URLs are unaffected; this only changes NEW uploads.
const audioStorage=multer.diskStorage({
  destination:(req,file,cb)=>{
    const safeUserId=String(req.user._id);
    const location=path.join(process.cwd(),'uploads','audio',safeUserId);
    fs.mkdirSync(location,{recursive:true});
    cb(null,location);
  },
  filename:(req,file,cb)=>{
    const extension=path.extname(file.originalname||'').toLowerCase();
    const safeExt=['.mp3','.wav','.ogg'].includes(extension)?extension:'.mp3';
    cb(null,crypto.randomUUID()+safeExt);
  }
});
const audioFilter=(req,file,cb)=>{
  const extension=path.extname(file.originalname||'').toLowerCase();
  const allowed={
    '.mp3':['audio/mpeg','audio/mp3'],
    '.wav':['audio/wav','audio/wave','audio/x-wav'],
    '.ogg':['audio/ogg','application/ogg']
  };
  if(allowed[extension]?.includes(file.mimetype))return cb(null,true);
  cb(new Error('Επιτρέπονται μόνο MP3, WAV ή OGG.'),false);
};
const uploadAudio=multer({storage:audioStorage,fileFilter:audioFilter,
  limits:{fileSize:20*1024*1024,files:1}});
async function requireAdUploadEntitlement(req,res,next){
  try{
    // Production has its existing workflow until the billing rollout.
    if(process.env.APP_ENV!=='staging'||req.user.role==='admin')return next();
    // Agency creative drafts are sandbox-only and still require Admin approval.
    if(req.user.role==='agency')return next();
    if(req.user.role!=='broadcaster')
      return res.status(403).json({error:'Δεν επιτρέπεται upload σε αυτόν τον ρόλο.'});
    const stationId=req.get('X-iRadios-Station');
    if(!mongoose.isValidObjectId(stationId))
      return res.status(400).json({error:'Χρειάζεται έγκυρο station ID για το upload.'});
    const station=await Station.findOne({_id:stationId,broadcasterId:req.user._id});
    if(!station||!await hasStationRight(req.user,station,'broadcaster.ad_control'))
      return res.status(403).json({error:'Δεν υπάρχει ενεργό Ad Control για τον σταθμό.'});
    return next();
  }catch(error){
    console.error('[AD UPLOAD] Authorization error',error.message);
    return res.status(500).json({error:'Ο έλεγχος πρόσβασης απέτυχε.'});
  }
}
function stageVisualUploader(req,res,next){
  if(process.env.APP_ENV==='staging' && !['admin','agency'].includes(req.user?.role))
    return res.status(403).json({error:'Μόνο Admin ή Agency μπορεί να ανεβάσει διαφήμιση.'});
  next();
}
function mediaSignatureMatches(file){
  const header=Buffer.alloc(12);
  let fd;
  try{
    fd=fs.openSync(file.path,'r');
    const count=fs.readSync(fd,header,0,12,0);
    const first=header.subarray(0,count);
    const ext=path.extname(file.filename).toLowerCase();
    if(ext==='.wav')return count>=12&&first.toString('ascii',0,4)==='RIFF'&&
      first.toString('ascii',8,12)==='WAVE';
    if(ext==='.ogg')return count>=4&&first.toString('ascii',0,4)==='OggS';
    return ext==='.mp3'&&(first.toString('ascii',0,3)==='ID3'||
      (count>=2&&first[0]===0xff&&(first[1]&0xe0)===0xe0));
  }catch{return false;}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}

// Signature checks alone do not prove that browsers can decode the audio.
async function validatePlayableAdAudio(file) {
  const extension=path.extname(file.filename).toLowerCase();
  const codecs={
    '.mp3':new Set(['mp3']),
    '.wav':new Set(['pcm_s16le','pcm_s24le','pcm_s32le','pcm_f32le','pcm_f64le']),
    '.ogg':new Set(['vorbis','opus'])
  };
  const {stdout}=await execFileAsync('ffprobe',[
    '-v','error','-select_streams','a:0','-show_entries',
    'stream=codec_name,codec_type:format=duration','-of','json',file.path
  ],{timeout:7000,maxBuffer:128*1024});
  const info=JSON.parse(stdout);
  const codec=info.streams?.[0]?.codec_name;
  const duration=Number(info.format?.duration);
  return Boolean(codecs[extension]?.has(codec) &&
    Number.isFinite(duration) && duration>=0.5 && duration<=600);
}

// ==========================================
// 2. STORAGE ΓΙΑ BANNERS (VISUALS)
// ==========================================
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user.username; 
    const uploadPath = path.join(process.cwd(), 'uploads', 'visuals', username);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Μόνο αρχεία εικόνας επιτρέπονται!'), false);
  }
};

const uploadBanner = multer({ storage: bannerStorage, fileFilter: imageFilter });


// ==========================================
// 3. 🟢 STORAGE ΓΙΑ ΛΟΓΟΤΥΠΑ (LOGOS ΓΙΑ ADS)
// ==========================================
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user.username; 
    // Σώζει στον φάκελο uploads/logo/{username}
    const uploadPath = path.join(process.cwd(), 'uploads', 'logo', username);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `logo-${Date.now()}-${cleanName}`);
  }
});

const uploadLogo = multer({ storage: logoStorage, fileFilter: imageFilter });


// ==========================================
// ENDPOINTS
// ==========================================

// Endpoint για Audio
router.post('/upload-ad',protect,requireAdUploadEntitlement,
  uploadAudio.single('audioFile'),async(req,res)=>{
    if(!req.file)return res.status(400).json({error:'Δεν βρέθηκε αρχείο.'});
    try {
      if(!mediaSignatureMatches(req.file) ||
        (process.env.APP_ENV==='staging'&&!await validatePlayableAdAudio(req.file)))
        throw new Error('Invalid or unsupported audio codec/duration');
      const safeUserId=String(req.user._id);
      return res.json({success:true,
        url:`__IRADIOS_SITE_ORIGIN__/media/audio/${safeUserId}/${req.file.filename}`});
    }catch(error){
      try{fs.unlinkSync(req.file.path);}catch{}
      console.warn('[ADS] Rejected audio upload:',error.message);
      return res.status(415).json({error:'Το αρχείο δεν αναπαράγεται σωστά. Ανέβασε MP3 ή WAV με έγκυρο codec και διάρκεια έως 10 λεπτά.'});
    }
  });

// Endpoint για Banners / Εικόνες
router.post('/upload-banner', protect, stageVisualUploader, uploadBanner.single('imageFile'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Δεν βρέθηκε αρχείο εικόνας.' });
    const username = req.user.username;
    const filename = req.file.filename;
    
    // Το URL που θα διαβάζει ο Nginx
    const fileUrl = `__IRADIOS_SITE_ORIGIN__/media/visuals/${username}/${filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Banner Upload Error:", error);
    res.status(500).json({ error: 'Σφάλμα κατά το ανέβασμα της εικόνας.' });
  }
});

// 🟢 ΝΕΟ: Endpoint για Λογότυπα Διαφημίσεων
router.post('/upload-logo', protect, stageVisualUploader, uploadLogo.single('logoFile'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Δεν βρέθηκε αρχείο λογοτύπου.' });
    const username = req.user.username;
    const filename = req.file.filename;
    
    // Το URL που θα διαβάζει ο Nginx (Το uploads/logo/ μεταφράζεται σε /media/logo/)
    const fileUrl = `__IRADIOS_SITE_ORIGIN__/media/logo/${username}/${filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Logo Upload Error:", error);
    res.status(500).json({ error: 'Σφάλμα κατά το ανέβασμα του λογοτύπου.' });
  }
});

module.exports = router;
