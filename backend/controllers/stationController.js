const Station = require('../models/Station');
const {validateStationCategories}=require('../utils/stationCategories');
const {normalizeStationCity}=require('../utils/stationLocations');
const User = require('../models/User');
const {hasAccountRight,hasStationRight}=require('../services/billingEntitlements');
const {projectPublicStations}=require('../services/stationBillingProjection');
const jwt = require('jsonwebtoken');

const {deleteStationRecord}=require('../services/stationDeletion');

// 🟢 IMPORT ΓΙΑ ΤΑ EMAILS
const { sendEmail } = require('../utils/myMailer'); 
const { stationApprovedEmail } = require('../utils/mailTemp');

const JWT_SECRET = process.env.JWT_SECRET;

// Καθαρισμός ληγμένων Boosts (Χρησιμοποιείται εσωτερικά)
const cleanExpiredBoosts = async () => {
  // Preserve imported production snapshot in isolated staging: GET routes must never mutate imported boosts.
  if (process.env.APP_ENV === 'staging') return;
  const now = new Date();
  await Station.updateMany(
    { boostStatus: true, boostExpiresAt: { $lt: now } },
    // Expiring a boost must never destroy the editor's manual global ranking.
    { $set: { boostStatus: false, boostExpiresAt: null } }
  );
};

// Public catalog exposes availability only; destination mailboxes remain server-side.
const CONTACT_EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function toPublicStation(station) {
  const data=typeof station.toObject==='function'?station.toObject():{...station};
  const hasContactEmail=CONTACT_EMAIL.test(String(data.email||'').trim());
  delete data.email;
  // Needed internally for billing eligibility, never published on public stage.
  if(process.env.APP_ENV==='staging')delete data.broadcasterId;
  return {...data,hasContactEmail};
}

exports.getApprovedStations = async (req, res) => {
  try {
    await cleanExpiredBoosts();
    const query = Station.find({ status: 'approved' }).sort({ isOffline: 1, position: 1, createdAt: -1 });
    // Public stage may expose station metadata, never broadcaster personal
    // information or private pending edits imported from production.
    if (process.env.APP_ENV === 'staging') {
      query.select('name slogan description genre secondaryGenre country region prefecture city isOffline transmissionType frequency plays logo cover stream metadata website facebook instagram twitter tiktok email explicit status slug popularity schedule scheduleDayBase position rankings isFeatured dspPreset disableNetworkAds broadcasterId');
    }
    const stations=await query;
    const effective=await projectPublicStations(stations);
    res.json(effective.map(toPublicStation));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAllStations = async (req, res) => {
  try {
    await cleanExpiredBoosts();
    const stations = await Station.find().sort({ isOffline: 1, position: 1, createdAt: -1 });
    res.json(stations);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getBroadcasterStations = async (req, res) => {
  try {
    const stations = await Station.find({ broadcasterId: req.params.userId });
    res.json(stations);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// 🟢 ADMIN: Δημιουργία Σταθμού
exports.createStation = async (req, res) => {
  try {
    const {data: stationData, error: locationError} = normalizeStationCity(req.body);
    if(locationError)return res.status(400).json({error:locationError});
    const categoryError = validateStationCategories(stationData,{required:true});
    if(categoryError)return res.status(400).json({error:categoryError});

    // Αν υπάρχει αρχείο, φτιάχνουμε το URL
    if (req.file) {
      stationData.logo = `__IRADIOS_SITE_ORIGIN__/media/radioassets/${stationData.slug}/${req.file.filename}`;
    }

    const newStation = new Station(stationData);
    const savedStation = await newStation.save();
    res.status(201).json(savedStation);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// 🟢 BROADCASTER: Δημιουργία Σταθμού
// Legacy broadcaster creation path: authenticated identity only, never a
// client-supplied broadcasterId. Backoffice is the preferred creation route.
exports.createBroadcasterStation = async (req,res)=>{
  try {
    const user=req.user;
    if(!user || user.role!=='broadcaster')
      return res.status(403).json({error:'Απαιτείται λογαριασμός Broadcaster.'});
    const unlimited=await hasAccountRight(user,'broadcaster.unlimited_stations');
    if(!unlimited){
      const current=await Station.countDocuments({broadcasterId:user._id});
      const max=Number(user.broadcasterProfile?.maxStations||3);
      if(current>=max)
        return res.status(403).json({error:'Έχετε φτάσει το όριο νέων σταθμών.'});
    }

    const {data:stationData,error:locationError}=normalizeStationCity(req.body||{});
    if(locationError)return res.status(400).json({error:locationError});
    const categoryError=validateStationCategories(stationData,{required:true});
    if(categoryError)return res.status(400).json({error:categoryError});
    for(const key of ['_id','broadcasterId','isFeatured','boostStatus','boostExpiresAt',
      'position','rankings','dspPreset','disableNetworkAds','pendingEdits','status'])
      delete stationData[key];
    stationData.broadcasterId=user._id;
    stationData.status='pending';
    if(req.file){
      stationData.logo=`__IRADIOS_SITE_ORIGIN__/media/radioassets/${stationData.slug}/${req.file.filename}`;
    }
    const created=await Station.create(stationData);
    return res.status(201).json({message:'Ο σταθμός υποβλήθηκε για έγκριση.',stationId:created._id});
  }catch(error){
    console.error('[BILLING] Legacy station creation failed',error.message);
    return res.status(400).json({error:'Η δημιουργία σταθμού απέτυχε.'});
  }
};

// 🟢 ADMIN: Απευθείας Edit Σταθμού
exports.updateStation = async (req, res) => {
  try {
    const {data: updateData, error: locationError} = normalizeStationCity(req.body);
    if(locationError)return res.status(400).json({error:locationError});
    const categoryError = validateStationCategories(updateData);
    if(categoryError)return res.status(400).json({error:categoryError});

    // Αν ο Admin ανέβασε νέο αρχείο
    if (req.file) {
      updateData.logo = `__IRADIOS_SITE_ORIGIN__/media/radioassets/${updateData.slug || req.body.slug}/${req.file.filename}`;
    }

    const updatedStation = await Station.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updatedStation);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// 🟢 BROADCASTER: Αίτημα Edit Σταθμού
exports.requestEdit = async (req, res) => {
  try {
    const {data: editData, error: locationError} = normalizeStationCity(req.body);
    if(locationError)return res.status(400).json({error:locationError});
    delete editData.isOffline;
    delete editData._id; 
    delete editData.broadcasterId; 
    delete editData.status;
    const categoryError = validateStationCategories(editData);
    if(categoryError)return res.status(400).json({error:categoryError});

    // Αν ο Broadcaster ανέβασε νέο αρχείο
    if (req.file) {
      editData.logo = `__IRADIOS_SITE_ORIGIN__/media/radioassets/${editData.slug || req.body.slug}/${req.file.filename}`;
    }

    const updatedStation = await Station.findByIdAndUpdate(
      req.params.id, 
      { $set: { pendingEdits: editData } }, 
      { new: true }
    );
    res.json(updatedStation);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα διακομιστή.' }); }
};

exports.deleteStation = async (req,res) => {
  // Legacy admin tool delegates to the same safe, exact-name-confirmed deletion.
  if(req.user?.role!=='admin')return res.status(403).json({error:'Μόνο ο Admin μπορεί να διαγράψει σταθμό.'});
  try{
    const removed=await deleteStationRecord({
      Station,stationId:req.params.id,confirmationName:req.body?.confirmationName
    });
    console.info('[STATION DELETE]',JSON.stringify({stationId:removed._id,adminId:String(req.user._id)}));
    return res.json({message:'Ο σταθμός «'+removed.name+'» διαγράφηκε από το δίκτυο.',
      removedStationId:removed._id});
  }catch(error){
    return res.status(error.status||500).json({
      ...(error.code?{code:error.code}:{}),
      error:error.status?error.message:'Η διαγραφή του σταθμού απέτυχε.'
    });
  }
};

exports.updateStationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // 1. Επικύρωση (Validation) της κατάστασης
    const validStatuses = ['pending', 'rejected', 'approved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Μη έγκυρη κατάσταση. Επιτρεπτές τιμές: pending, rejected, approved.' });
    }
    
    // 2. Παίρνουμε τον σταθμό πριν το update για να συγκρίνουμε το status
    const oldStation = await Station.findById(req.params.id);
    if (!oldStation) {
      return res.status(404).json({ error: 'Ο σταθμός δεν βρέθηκε.' });
    }

    // Status changes do not change billing. Stale edits or a pending
    // deletion lease must not silently override each other.
    if(oldStation.status===status)
      return res.json({message:'Η κατάσταση παραμένει '+status,station:oldStation});
    const updatedStation=await Station.findOneAndUpdate({
      _id:req.params.id,status:oldStation.status,
      deletionLockUntil:{$not:{$gt:new Date()}}
    },{$set:{status}},{new:true,runValidators:true});
    if(!updatedStation)
      return res.status(409).json({error:'Ο σταθμός άλλαξε ή διαγράφεται. Ανανέωσε και δοκίμασε ξανά.'});

    // 4. 🟢 MAIL LOGIC: Κάνουμε import τον Mailer και τα Templates
    const { sendEmail } = require('../utils/myMailer'); 
    const { stationApprovedEmail, stationRejectedEmail } = require('../utils/mailTemp');
    
    // Βρίσκουμε τον ιδιοκτήτη του σταθμού
    const owner = await User.findById(updatedStation.broadcasterId);

    if (owner && owner.email) {
      const ownerName = owner.name || owner.username || 'Broadcaster';

      // 4A. Περίπτωση: APPROVED
      if (oldStation.status !== 'approved' && status === 'approved') {
        try {
          console.log(`[MAILER] Στέλνουμε email έγκρισης στον: ${owner.email}`);
          const mailOptions = stationApprovedEmail(ownerName, updatedStation.name, updatedStation.slug);
          
          // Δεν χρησιμοποιούμε await εδώ αν δεν θέλουμε να καθυστερήσει το API response
          sendEmail({
            to: owner.email,
            subject: mailOptions.subject,
            html: mailOptions.html
          }).catch(err => console.error('❌ Σφάλμα email έγκρισης:', err));
        } catch (e) { console.error(e); }
      } 
      
      // 4B. Περίπτωση: REJECTED
      else if (oldStation.status !== 'rejected' && status === 'rejected') {
        try {
          console.log(`[MAILER] Στέλνουμε email απόρριψης στον: ${owner.email}`);
          const mailOptions = stationRejectedEmail(ownerName, updatedStation.name);
          
          sendEmail({
            to: owner.email,
            subject: mailOptions.subject,
            html: mailOptions.html
          }).catch(err => console.error('❌ Σφάλμα email απόρριψης:', err));
        } catch (e) { console.error(e); }
      }
    }

    // Notify listeners only on a real first approval; staging dispatch is a no-op.
    if (oldStation.status !== 'approved' && status === 'approved') {
      const {deliver}=require('../utils/notificationDelivery');
      deliver({
        topic:'newStations',eventKey:'station-approved:'+String(updatedStation._id),
        title:'Νέος σταθμός στο iRadiosGR!',
        body:'Ανακάλυψε τον '+updatedStation.name+(updatedStation.genre?' · '+updatedStation.genre:''),
        path:'/station/'+encodeURIComponent(updatedStation.slug||String(updatedStation._id))
      }).catch(e=>console.error('[NOTIFY] Station approval:',e.message));
    }
    res.json({ message: `Η κατάσταση του σταθμού ενημερώθηκε σε ${status}`, station: updatedStation });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
};

exports.toggleFeatured = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    station.isFeatured = !station.isFeatured;
    await station.save();
    res.json({ message: 'Ενημερώθηκε!', isFeatured: station.isFeatured });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Every DSP write is both station-ownership AND station-entitlement gated.
// Do not accept decoded JWT role from unverified client metadata.
exports.updateDSP=async(req,res)=>{
  try{
    const stationId=req.params.id;
    const station=await Station.findById(stationId);
    if(!station)return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.'});
    if(!req.user)return res.status(401).json({error:'Χρειάζεται σύνδεση.'});
    if(!await hasStationRight(req.user,station,'broadcaster.webdsp'))
      return res.status(403).json({error:'Το WebDSP δεν είναι διαθέσιμο για αυτόν τον σταθμό.'});
    const preset=req.body?.dspPreset;
    if(!['OFF','SOFT','NORMALIZE','ULTRABAND','ULTRA','OMNIA','0DB_LEVELER'].includes(preset))
      return res.status(400).json({error:'Μη έγκυρο DSP preset.'});
    const updated=await Station.findByIdAndUpdate(stationId,
      {$set:{dspPreset:preset}},{new:true,runValidators:true});
    return res.json(updated);
  }catch(error){
    console.error('[DSP] Update failed',error.message);
    return res.status(500).json({error:'Δεν αποθηκεύτηκε το DSP preset.'});
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { schedule } = req.body;
    const updatedStation = await Station.findByIdAndUpdate(req.params.id, { schedule }, { new: true });
    res.json(updatedStation);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα προγράμματος.' }); }
};

exports.approveEdit = async (req, res) => {
  try {
    // 1. Βρίσκουμε το σταθμό
    const station = await Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Ο σταθμός δεν βρέθηκε.' });
    }
    
    if (!station.pendingEdits) {
      return res.status(400).json({ error: 'Δεν βρέθηκαν αλλαγές (Draft) προς έγκριση.' });
    }

    // 2. Παίρνουμε τα δεδομένα με απόλυτη ασφάλεια
    const edits = JSON.parse(JSON.stringify(station.pendingEdits));
    
    // 3. 🟢 ΠΡΟΣΤΑΣΙΑ: Αφαιρούμε επικίνδυνα πεδία που δεν πρέπει ποτέ να περάσουν από αυτή τη φόρμα
    delete edits._id;
    delete edits.broadcasterId;
    delete edits.status; 
    delete edits.isOffline;
    delete edits.createdAt;
    delete edits.updatedAt;
    delete edits.schedule; // 🚀 ΑΥΤΟ ΕΙΝΑΙ ΠΟΥ ΛΥΝΕΙ ΤΟ CRASH ΜΕ ΤΟ [object Object]

    // 4. Περνάμε τις αλλαγές μία-μία πάνω στο object του Mongoose
    Object.keys(edits).forEach(key => {
      // Έξτρα δικλείδα ασφαλείας: Αν κάποιο άλλο πεδίο έγινε [object Object], το αγνοούμε
      if (edits[key] !== undefined && !(typeof edits[key] === 'string' && edits[key].includes('[object Object]'))) {
         station[key] = edits[key];
      }
    });

    // 5. Διαγράφουμε το Draft (το κάνουμε undefined, το Mongoose το καταλαβαίνει)
    station.pendingEdits = undefined;

    // 6. Σώζουμε το document (το save() θα τρέξει τα validations και θα περάσει)
    await station.save();

    res.json(station);
  } catch (err) { 
    console.error("❌ Σφάλμα κατά την έγκριση (Approve Edit Error):", err); 
    res.status(500).json({ error: 'Εσωτερικό σφάλμα διακομιστή κατά την έγκριση.', details: err.message }); 
  }
};

exports.rejectEdit = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    if (station) { station.pendingEdits = null; await station.save(); }
    res.json({ message: 'Απορρίφθηκε.' });
  } catch (err) { res.status(500).json({ error: 'Σφάλμα απόρριψης.' }); }
};

exports.updateNetworkAds=async(req,res)=>{
  try{
    const station=await Station.findById(req.params.id);
    if(!station)return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.'});
    if(!await hasStationRight(req.user,station,'broadcaster.ad_control'))
      return res.status(403).json({error:'Το Ad Control δεν είναι διαθέσιμο για αυτόν τον σταθμό.'});
    if(typeof req.body?.disableNetworkAds!=='boolean')
      return res.status(400).json({error:'Μη έγκυρη τιμή Ad Control.'});
    const updated=await Station.findByIdAndUpdate(req.params.id,
      {$set:{disableNetworkAds:req.body.disableNetworkAds}},{new:true,runValidators:true});
    return res.json(updated);
  }catch(error){
    console.error('[AD CONTROL] Network ads update failed',error.message);
    return res.status(500).json({error:'Η ενημέρωση Ad Control απέτυχε.'});
  }
};

// An admin may mark an approved station offline without removing its catalog entry.
exports.updateStationOffline = async (req, res) => {
  try {
    if (typeof req.body.isOffline !== 'boolean')
      return res.status(400).json({error:'Το isOffline πρέπει να είναι boolean.'});
    const updated = await Station.findByIdAndUpdate(req.params.id,
      {$set:{isOffline:req.body.isOffline}}, {new:true,runValidators:true});
    if (!updated) return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.'});
    res.json({station:updated});
  } catch (err) { res.status(400).json({error:'Αδυναμία ενημέρωσης διαθεσιμότητας.'}); }
};

// 🚀 SMART DISCOVERY MODE
exports.getDiscoveryStations = async (req, res) => {
  try {
    // Never look up arbitrary imported user favorites from a public query.
    const userId = process.env.APP_ENV === 'staging' ? null : req.query.userId;
    let matchQuery = { status: 'approved', isOffline: {$ne: true} };

    // Αν υπάρχει χρήστης συνδεδεμένος, βρες ποια είναι τα αγαπημένα του
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.favorites && user.favorites.length > 0) {
        // Εξαίρεσε τα stations που το _id τους είναι μέσα στη λίστα favorites
        matchQuery._id = { $nin: user.favorites };
      }
    }

    const randomStations = await Station.aggregate([
      { $match: matchQuery },
      { $sample: { size: 10 } },
      // Φέρνουμε μόνο τα απαραίτητα πεδία για ταχύτητα
      { $project: {
          name: 1, genre: 1, logo: 1, stream: 1, region: 1, slug: 1, isFeatured: 1
      }}
    ]);

    // Αν ο χρήστης έχει βάλει ΟΛΟΥΣ τους σταθμούς στα αγαπημένα του, φέρνουμε 10 τυχαίους αγνοώντας τα αγαπημένα.
    if (randomStations.length === 0 && userId) {
        const backupStations = await Station.aggregate([
            { $match: { status: 'approved', isOffline: {$ne: true} } },
            { $sample: { size: 10 } }
        ]);
        return res.json(backupStations);
    }

    res.json(randomStations);

  } catch (err) {
    console.error("❌ Discovery Engine Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};
