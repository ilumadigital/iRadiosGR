const express = require('express');
const router = express.Router();
const stationController = require('../controllers/stationController');
const Station = require('../models/Station');
const User = require('../models/User');
const BroadcasterInvitation = require('../models/BroadcasterInvitation');
const mongoose = require('mongoose');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');

// Recognition uses the approved station ID; only the backend contacts SonoVault.
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// ==============================================================
// 🟢 1. MULTER CONFIGS
// ==============================================================

// 1.B Storage για τα Station Logos (Αποθηκεύει τα λογότυπα στον δίσκο)
const stationLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Το slug έρχεται από το req.body επειδή το βάλαμε πρώτο στο FormData στο React
    const slug = req.body.slug || 'temp-station';
    const uploadPath = path.join(process.cwd(), 'uploads', 'radioassets', slug);

    // Φτιάχνει τον φάκελο αν δεν υπάρχει (π.χ. uploads/radioassets/rythmos-949)
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // Βάζουμε Date.now() για να μην κάνει cache ο browser αν ο χρήστης αλλάξει λογότυπο
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

const uploadStationLogo = multer({ storage: stationLogoStorage });

// Legacy audio-upload route is closed. Recognition always uses the approved
// station stream through the existing, authenticated proxy endpoint.
router.post('/recognize',protect,(_req,res)=>res.status(410).json({
  error:'Χρησιμοποίησε το Βρες το τραγούδι από έναν σταθμό.',code:'RECOGNITION_LEGACY_DISABLED'
}));
router.post('/recognize-proxy',protect,
  require('../utils/stageSonovault').stageRecognizeProxy);

// --- Public & Global ---
router.get('/stations', stationController.getApprovedStations);
router.get('/stations/all', stationController.getAllStations);

// 🚀 DISCOVERY MODE ROUTE (Πάντα πριν από routes με :id)
router.get('/stations/discovery', stationController.getDiscoveryStations);

router.post('/stations', uploadStationLogo.single('logoFile'), stationController.createStation);
router.put('/stations/:id/dsp', stationController.updateDSP);
// Legacy endpoint remains for older clients but cannot bypass backoffice ownership.
router.put('/stations/:id/schedule',
  require('../utils/authMiddleware').protect,
  require('../utils/roleMiddleware').authorizeRoles('admin','broadcaster','producer'),
  async(req,res)=>{
    try{
      const mongoose=require('mongoose');
      if(!mongoose.isValidObjectId(req.params.id))
        return res.status(400).json({error:'Μη έγκυρο ID σταθμού.'});
      const query={_id:req.params.id};
      if(req.user.role==='broadcaster')query.broadcasterId=req.user._id;
      else if(req.user.role==='producer')query._id=req.user.assignedStation;
      const station=await Station.findOne(query).select('+scheduleFeed');
      if(!station)return res.status(404).json({error:'Δεν έχεις πρόσβαση στον σταθμό.'});
      const parsed=require('../utils/scheduleNormalization').normalize(req.body?.schedule);
      if(station.scheduleFeed?.enabled&&req.user.role==='producer')
        return res.status(403).json({error:'Ο broadcaster πρέπει να απενεργοποιήσει πρώτα το XML feed.'});
      if(station.scheduleFeed?.lockUntil>new Date())
        return res.status(409).json({error:'Το XML πρόγραμμα ενημερώνεται. Δοκίμασε ξανά.'});
      station.schedule=parsed.schedule;
      station.scheduleDayBase=1;
      if(station.scheduleFeed?.enabled)station.scheduleFeed.enabled=false;
      await station.save();
      return res.json(station.toObject({transform:(_doc,ret)=>{delete ret.scheduleFeed;return ret;}}));
    }catch(e){return res.status(400).json({error:e.message||'Σφάλμα προγράμματος.'});}
  });

// --- Broadcaster ---
router.get('/broadcaster/:userId/stations', stationController.getBroadcasterStations);

// 🟢 ΕΔΩ "ΚΟΥΜΠΩΣΑΜΕ" ΤΟ MULTER ΓΙΑ ΤΑ LOGOS
router.post('/broadcaster/stations', uploadStationLogo.single('logoFile'), stationController.createBroadcasterStation);
router.put('/broadcaster/stations/:id/edit-request', uploadStationLogo.single('logoFile'), stationController.requestEdit);

router.put('/broadcaster/stations/:id/network-ads', stationController.updateNetworkAds);

// --- Admin Station Controls ---

// 🟢 ΝΕΟ: ROUTE ΑΝΑΘΕΣΗΣ ΣΤΑΘΜΟΥ ΣΕ BROADCASTER
router.put('/admin/stations/:id/assign', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const { broadcasterId } = req.body;
    if (!mongoose.isValidObjectId(req.params.id) ||
        (broadcasterId && !mongoose.isValidObjectId(broadcasterId))) {
      return res.status(400).json({ error: 'Μη έγκυρο ID.' });
    }
    if (broadcasterId) {
      const user = await User.findOne({ _id: broadcasterId, role: { $in: ['broadcaster', 'admin'] } });
      if (!user) return res.status(400).json({ error: 'Ο επιλεγμένος χρήστης δεν είναι Broadcaster.' });
    }
    const updatedStation = await Station.findByIdAndUpdate(
      req.params.id, { broadcasterId: broadcasterId || null }, { new: true, runValidators: true }
    ).populate('broadcasterId', 'username email role');
    if (!updatedStation) return res.status(404).json({ error: 'Ο σταθμός δεν βρέθηκε.' });

    // A manual assignment always supersedes any outstanding emailed links.
    if (broadcasterId) await BroadcasterInvitation.updateMany(
      { stationId: updatedStation._id, status: 'pending' },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );
    return res.json(updatedStation);
  } catch (error) {
    console.error('Σφάλμα ανάθεσης σταθμού:', error);
    return res.status(500).json({ error: 'Σφάλμα κατά την ανάθεση.' });
  }
});

router.put('/admin/stations/reorder', async (req, res) => {
  try {
    const { stationsData } = req.body; 
    const bulkOps = stationsData.map((st) => ({
      updateOne: { 
        filter: { _id: st.id }, 
        update: { 
          position: st.position, 
          boostStatus: st.boostStatus, 
          boostExpiresAt: st.boostExpiresAt 
        } 
      }
    }));
    await Station.bulkWrite(bulkOps);
    res.json({ message: 'Επιτυχής αποθήκευση!' });
  } catch (err) { 
    res.status(500).json({ error: 'Σφάλμα αποθήκευσης.' }); 
  }
});

router.put('/admin/stations/:id', uploadStationLogo.single('logoFile'), stationController.updateStation);
router.delete('/admin/stations/:id', stationController.deleteStation);
router.put('/admin/stations/:id/status', protect, authorizeRoles('admin'), stationController.updateStationStatus);
router.patch('/admin/stations/:id/offline', protect, authorizeRoles('admin'), stationController.updateStationOffline);
router.patch('/admin/stations/:id/featured', stationController.toggleFeatured);
router.post('/admin/stations/:id/approve-edit', stationController.approveEdit);
router.delete('/admin/stations/:id/reject-edit', stationController.rejectEdit);

module.exports = router;
