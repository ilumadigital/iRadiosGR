'use strict';
// Phase 4: isolated, JWT-authorized radio management API.
// Ownership is derived from req.user, never supplied by the browser.
const express=require('express');
const mongoose=require('mongoose');
const multer=require('multer');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const Station=require('../models/Station');
const User=require('../models/User');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const {hasAcceptedCurrentBroadcasterTerms}=require('../utils/broadcasterTerms');
const router=express.Router();

router.use('/backoffice',protect,authorizeRoles('admin','broadcaster','producer'),
  (req,res,next)=>{
    res.setHeader('Cache-Control','private, no-store');
    if(req.user.role==='broadcaster'&&!hasAcceptedCurrentBroadcasterTerms(req.user))
      return res.status(409).json({error:'Αποδέξου τους ισχύοντες όρους broadcaster για να συνεχίσεις.',code:'BROADCASTER_TERMS'});
    next();
  });

const fields='name slogan description genre region city transmissionType frequency plays popularity logo cover stream metadata website facebook instagram twitter tiktok phone viber email explicit status broadcasterId pendingEdits slug isFeatured schedule createdAt';
const textFields=Object.freeze({
  name:100,slogan:240,description:4000,genre:100,region:100,city:100,
  transmissionType:30,frequency:30,website:450,stream:1200,metadata:1200,
  facebook:450,instagram:450,twitter:450,tiktok:450,phone:60,viber:60,email:254
});
const imageFields=new Set(['logo','cover']);
const allowedFields=new Set([...Object.keys(textFields),'explicit','logo','cover']);
const urlFields=new Set(['stream','metadata','website','facebook','instagram','twitter','tiktok']);
function validationError(message){const e=new Error(message);e.status=400;return e;}
function validExternalUrl(value){
  if(!value)return true;
  let url;
  try{url=new URL(value);}catch{return false;}
  if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)return false;
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
    host==='0.0.0.0'||host==='127.0.0.1'||host==='::1'||host==='[::1]')return false;
  if(/^(?:10|127|192\.168|169\.254)\./.test(host))return false;
  if(/^172\.(?:1[6-9]|2\d|3[01])\./.test(host))return false;
  if(/^[0-9.]+$/.test(host)||host.includes(':'))return false;
  return true;
}
function cleanEdits(payload,{ignoreUnknown=false}={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw validationError('Μη έγκυρα στοιχεία σταθμού.');
  const result={};
  for(const [key,value] of Object.entries(payload)){
    if(!allowedFields.has(key)){
      if(ignoreUnknown)continue;
      throw validationError('Το πεδίο δεν επιτρέπεται: '+key);
    }
    if(key==='explicit'){
      if(typeof value!=='boolean')throw validationError('Μη έγκυρη σήμανση explicit.');
      result.explicit=value;continue;
    }
    if(typeof value!=='string'||value.length>(textFields[key]||1400))
      throw validationError('Μη έγκυρη τιμή στο πεδίο '+key);
    const trimmed=value.trim();
    if(urlFields.has(key)&&!validExternalUrl(trimmed))
      throw validationError('Το URL στο πεδίο '+key+' δεν είναι δημόσιο HTTP/HTTPS.');
    if(imageFields.has(key)&&trimmed&&!/^\/media\/radioassets\/[a-f0-9]{24}\/[a-zA-Z0-9._-]+$/.test(trimmed)&&
      !validExternalUrl(trimmed))throw validationError('Μη έγκυρο URL εικόνας.');
    if(key==='transmissionType'&&trimmed&&!['Επίγειο','Web Radio','DAB'].includes(trimmed))
      throw validationError('Μη έγκυρος τύπος μετάδοσης.');
    result[key]=trimmed;
  }
  if(Object.keys(result).length===0)throw validationError('Δεν υπάρχουν αλλαγές προς αποθήκευση.');
  return result;
}
function safeStation(station,role){
  const s=station.toObject?station.toObject():station;
  const result={};
  for(const key of fields.split(' '))if(s[key]!==undefined&&
    (key!=='broadcasterId'||role==='admin')&&
    (key!=='pendingEdits'||role!=='producer'))result[key]=s[key];
  result._id=s._id;
  return result;
}
function stationQuery(user){
  if(user.role==='admin')return {};
  if(user.role==='broadcaster')return {broadcasterId:user._id};
  return {_id:user.assignedStation||new mongoose.Types.ObjectId()};
}
async function ownedStation(req,res,{writer=false}={}){
  if(!mongoose.isValidObjectId(req.params.id)){
    res.status(400).json({error:'Μη έγκυρο αναγνωριστικό σταθμού.'});return null;
  }
  if(writer&&req.user.role==='producer'){
    res.status(403).json({error:'Ο παραγωγός δεν μπορεί να επεξεργαστεί το προφίλ του σταθμού.'});return null;
  }
  const station=await Station.findOne({_id:req.params.id,...stationQuery(req.user)});
  if(!station){res.status(404).json({error:'Ο σταθμός δεν βρέθηκε ή δεν σου ανήκει.'});return null;}
  return station;
}
function fail(res,error){
  if(error?.status)return res.status(error.status).json({error:error.message});
  console.error('[BACKOFFICE]',error?.name||'server');
  return res.status(500).json({error:'Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.'});
}
router.get('/backoffice/overview',async(req,res)=>{
  try{
    const query=stationQuery(req.user);
    const [items,total,pending]=await Promise.all([
      Station.find(query).select(fields).sort({popularity:-1,plays:-1,_id:1}).limit(1000).lean(),
      Station.countDocuments(query),
      req.user.role==='admin'?Station.countDocuments({pendingEdits:{$ne:null}}):
        Station.countDocuments({...query,pendingEdits:{$ne:null}})
    ]);
    const counts={
      total,approved:items.filter(s=>s.status==='approved').length,
      pendingApproval:items.filter(s=>s.status==='pending').length,
      pendingEdits:pending
    };
    if(req.user.role==='admin'){
      counts.users=await User.countDocuments({});
      counts.broadcasters=await User.countDocuments({role:'broadcaster'});
    }
    return res.json({
      user:{role:req.user.role,fname:req.user.fname||'',email:req.user.email||'',
        username:req.user.username||'',maxStations:req.user.broadcasterProfile?.maxStations||3},
      counts,
      stations:items.map(s=>safeStation(s,req.user.role))
    });
  }catch(error){return fail(res,error);}
});
router.get('/backoffice/stations/:id',async(req,res)=>{
  try{
    const station=await ownedStation(req,res);
    if(!station)return;
    return res.json({station:safeStation(station,req.user.role)});
  }catch(error){return fail(res,error);}
});
router.post('/backoffice/stations',async(req,res)=>{
  try{
    if(req.user.role==='producer')return res.status(403).json({error:'Η προσθήκη σταθμού δεν επιτρέπεται.'});
    const cleaned=cleanEdits(req.body);
    if(!cleaned.name||!cleaned.genre||!cleaned.stream)return res.status(400).json({
      error:'Χρειάζονται όνομα, μουσική κατηγορία και stream URL.'
    });
    if(req.user.role==='broadcaster'){
      const total=await Station.countDocuments({broadcasterId:req.user._id});
      const max=Number(req.user.broadcasterProfile?.maxStations||3);
      if(total>=max)return res.status(403).json({error:'Έχεις φτάσει το όριο σταθμών του λογαριασμού σου.'});
    }
    const station=await Station.create({
      ...cleaned,logo:'/noicon-iradios-app-logo.png',
      broadcasterId:req.user.role==='broadcaster'?req.user._id:null,
      status:'pending'
    });
    return res.status(201).json({station:safeStation(station,req.user.role),
      message:'Ο σταθμός δημιουργήθηκε και περιμένει έγκριση.'});
  }catch(error){return fail(res,error);}
});
router.patch('/backoffice/stations/:id',async(req,res)=>{
  try{
    const station=await ownedStation(req,res,{writer:true});
    if(!station)return;
    const edits=cleanEdits(req.body);
    if(req.user.role==='admin'){
      station.set(edits);
      await station.save();
      return res.json({station:safeStation(station,req.user.role),
        message:'Οι αλλαγές αποθηκεύτηκαν.'});
    }
    // Broadcaster changes must be explicitly reviewed; never apply directly.
    station.pendingEdits={...(station.pendingEdits||{}),...edits};
    await station.save();
    return res.json({station:safeStation(station,req.user.role),
      message:'Οι αλλαγές στάλθηκαν στον διαχειριστή για έγκριση.'});
  }catch(error){return fail(res,error);}
});
router.post('/backoffice/stations/:id/review',authorizeRoles('admin'),async(req,res)=>{
  try{
    const station=await ownedStation(req,res);
    if(!station)return;
    if(!station.pendingEdits||Object.keys(station.pendingEdits).length===0)
      return res.status(409).json({error:'Δεν υπάρχουν αλλαγές προς έγκριση.'});
    const action=req.body?.action;
    if(!['approve','reject'].includes(action))return res.status(400).json({error:'Μη έγκυρη ενέργεια.'});
    if(action==='approve'){
      const cleaned=cleanEdits(station.pendingEdits,{ignoreUnknown:true});
      station.set(cleaned);
    }
    station.pendingEdits=null;
    await station.save();
    return res.json({station:safeStation(station,'admin'),
      message:action==='approve'?'Οι αλλαγές εγκρίθηκαν.':'Οι αλλαγές απορρίφθηκαν.'});
  }catch(error){return fail(res,error);}
});
router.post('/backoffice/stations/:id/approve',authorizeRoles('admin'),async(req,res)=>{
  try{
    const station=await ownedStation(req,res);
    if(!station)return;
    if(station.status!=='pending')return res.status(409).json({error:'Ο σταθμός δεν εκκρεμεί.'});
    station.status='approved';
    await station.save();
    return res.json({station:safeStation(station,'admin'),message:'Ο σταθμός εγκρίθηκε.'});
  }catch(error){return fail(res,error);}
});
router.put('/backoffice/stations/:id/schedule',async(req,res)=>{
  try{
    const station=await ownedStation(req,res);
    if(!station)return;
    const schedule=req.body?.schedule;
    if(!Array.isArray(schedule)||schedule.length>80)throw validationError('Το πρόγραμμα πρέπει να έχει έως 80 εκπομπές.');
    const clean=schedule.map(show=>{
      if(!show||typeof show!=='object')throw validationError('Μη έγκυρη εκπομπή.');
      const day=Number(show.day),startTime=String(show.startTime||''),
        endTime=String(show.endTime||''),title=String(show.title||'').trim(),
        host=String(show.host||'').trim();
      if(!Number.isInteger(day)||day<1||day>7||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||
        startTime>=endTime||!title||title.length>120||host.length>100)
        throw validationError('Έλεγξε ημέρα, ώρες, τίτλο και παραγωγό της εκπομπής.');
      return {day,startTime,endTime,title,host};
    });
    for(let day=1;day<=7;day++){
      const daily=clean.filter(x=>x.day===day).sort((a,b)=>a.startTime.localeCompare(b.startTime));
      for(let i=1;i<daily.length;i++)if(daily[i].startTime<daily[i-1].endTime)
        throw validationError('Υπάρχουν επικαλυπτόμενες εκπομπές στο πρόγραμμα.');
    }
    station.schedule=clean;
    await station.save();
    return res.json({station:safeStation(station,req.user.role),message:'Το πρόγραμμα ενημερώθηκε.'});
  }catch(error){return fail(res,error);}
});

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1},
  fileFilter:(_req,file,cb)=>cb(null,['image/png','image/jpeg','image/webp'].includes(file.mimetype))});
function imageExt(buffer){
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
  if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return 'jpg';
  if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'webp';
  return null;
}
router.post('/backoffice/stations/:id/media/:kind',authorizeRoles('admin','broadcaster'),
  (req,res,next)=>upload.single('image')(req,res,error=>
    error?res.status(400).json({error:'Δέχεται PNG/JPG/WEBP έως 3 MB.'}):next()),
  async(req,res)=>{
    try{
      const station=await ownedStation(req,res,{writer:true});
      if(!station)return;
      const kind=req.params.kind;
      if(!['logo','cover'].includes(kind)||!req.file)return res.status(400).json({error:'Επίλεξε εικόνα λογοτύπου ή εξωφύλλου.'});
      const ext=imageExt(req.file.buffer);
      if(!ext)return res.status(400).json({error:'Η εικόνα δεν έχει έγκυρη μορφή PNG/JPG/WEBP.'});
      const folder=path.join(process.cwd(),'uploads','radioassets',String(station._id));
      const filename=kind+'-'+crypto.randomUUID()+'.'+ext;
      await fs.mkdir(folder,{recursive:true,mode:0o755});
      await fs.writeFile(path.join(folder,filename),req.file.buffer,{flag:'wx',mode:0o644});
      const uri='/media/radioassets/'+String(station._id)+'/'+filename;
      if(req.user.role==='admin')station[kind]=uri;
      else station.pendingEdits={...(station.pendingEdits||{}),[kind]:uri};
      await station.save();
      return res.json({station:safeStation(station,req.user.role),
        message:req.user.role==='admin'?'Η εικόνα αποθηκεύτηκε.':'Η εικόνα στάλθηκε για έγκριση.'});
    }catch(error){return fail(res,error);}
  });
module.exports=router;
