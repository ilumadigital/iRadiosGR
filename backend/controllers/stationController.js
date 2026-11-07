const Station = require('../models/Station');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const fs = require('fs').promises;
const path = require('path');

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
    { $set: { boostStatus: false, position: 999, boostExpiresAt: null } }
  );
};

exports.getApprovedStations = async (req, res) => {
  try {
    await cleanExpiredBoosts();
    const stations = await Station.find({ status: 'approved' }).sort({ position: 1, createdAt: -1 });
    res.json(stations);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAllStations = async (req, res) => {
  try {
    await cleanExpiredBoosts();
    const stations = await Station.find().sort({ position: 1, createdAt: -1 });
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
    const stationData = req.body;

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
exports.createBroadcasterStation = async (req, res) => {
  try {
    const { broadcasterId } = req.body;
    const user = await User.findById(broadcasterId);
    const currentStations = await Station.countDocuments({ broadcasterId });

    // Ελέγχουμε τα όρια ΜΟΝΟ αν ο χρήστης είναι broadcaster (οι admin περνάνε ελεύθερα)
    if (user.role === 'broadcaster') {
      const tier = user.broadcasterProfile?.tier || 'free';
      
      // Ορίζουμε το μέγιστο όριο βάσει του πακέτου: Premium = 999, Free = 3
      const maxAllowed = tier === 'premium' ? 999 : (user.broadcasterProfile?.maxStations || 3);

      if (currentStations >= maxAllowed) {
        if (tier === 'free') {
          return res.status(403).json({ error: `Έχετε φτάσει το όριο των ${maxAllowed} σταθμών. Αναβαθμίστε στο Pro Plan για περισσότερους!` });
        } else {
          return res.status(403).json({ error: `Έχετε φτάσει το απόλυτο όριο των ${maxAllowed} σταθμών για το Pro Plan σας.` });
        }
      }
    }

    const stationData = { ...req.body, status: 'pending' };

    // Αν ο Broadcaster ανέβασε αρχείο, φτιάχνουμε το URL
    if (req.file) {
      stationData.logo = `__IRADIOS_SITE_ORIGIN__/media/radioassets/${stationData.slug}/${req.file.filename}`;
    }

    const newStation = new Station(stationData);
    await newStation.save();
    res.status(201).json({ message: 'Υποβλήθηκε επιτυχώς και αναμένει έγκριση!' });
  } catch (err) { 
    res.status(400).json({ error: err.message }); 
  }
};

// 🟢 ADMIN: Απευθείας Edit Σταθμού
exports.updateStation = async (req, res) => {
  try {
    const updateData = req.body;

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
    const editData = { ...req.body };
    delete editData._id; 
    delete editData.broadcasterId; 
    delete editData.status;

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

exports.deleteStation = async (req, res) => {
  try {
    // 1. Βρίσκουμε τον σταθμό πριν τον διαγράψουμε, για να πάρουμε το slug του
    const station = await Station.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Ο σταθμός δεν βρέθηκε.' });
    }

    // 2. Αν έχει slug, βρίσκουμε και διαγράφουμε τον φάκελό του
    if (station.slug) {
      const folderPath = path.join(process.cwd(), 'uploads', 'radioassets', station.slug);
      
      try {
        // Το rm με recursive: true σβήνει τον φάκελο και ΟΛΑ τα περιεχόμενά του (λογότυπα, covers κλπ)
        await fs.rm(folderPath, { recursive: true, force: true });
        console.log(`[CLEANUP] Διαγράφηκε επιτυχώς ο φάκελος: ${folderPath}`);
      } catch (fsError) {
        // Αν ο φάκελος δεν υπάρχει, απλά το αγνοούμε και προχωράμε
        console.error(`[CLEANUP ERROR] Σφάλμα διαγραφής φακέλου ${folderPath}:`, fsError.message);
      }
    }

    // 3. Διαγράφουμε οριστικά τον σταθμό από τη Βάση Δεδομένων
    await Station.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Ο σταθμός και τα αρχεία του διαγράφηκαν οριστικά!' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
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

    // 3. Ενημερώνουμε την κατάσταση στη βάση δεδομένων
    const updatedStation = await Station.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );

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

exports.updateDSP = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    
    const owner = await User.findById(station.broadcasterId);
    const isRequesterAdmin = decoded.role === 'admin';
    const hasFeature = owner && owner.broadcasterProfile?.features?.dspEngine;

    if (!isRequesterAdmin && !hasFeature) {
       return res.status(403).json({ error: "Το DSP Engine είναι κλειδωμένο." });
    }

    const updatedStation = await Station.findByIdAndUpdate(
      req.params.id, 
      { dspPreset: req.body.dspPreset }, 
      { new: true }
    );
    res.json(updatedStation);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
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

exports.updateNetworkAds = async (req, res) => {
  try {
    const { disableNetworkAds } = req.body;
    const updated = await Station.findByIdAndUpdate(req.params.id, { disableNetworkAds }, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα ενημέρωσης' }); }
};

// 🚀 SMART DISCOVERY MODE
exports.getDiscoveryStations = async (req, res) => {
  try {
    const userId = req.query.userId;
    let matchQuery = { status: 'approved' };

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
            { $match: { status: 'approved' } },
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
