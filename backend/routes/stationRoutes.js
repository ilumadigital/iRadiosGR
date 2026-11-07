const express = require('express');
const router = express.Router();
const stationController = require('../controllers/stationController');
const Station = require('../models/Station');

// 🚀 IMPORTS ΓΙΑ ΤΟ ACRCLOUD (SHAZAM FEATURE)
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// ==============================================================
// 🟢 1. MULTER CONFIGS
// ==============================================================

// 1.A Storage για το ACRCloud (Αποθηκεύει το αρχείο ΉΧΟΥ απευθείας στη μνήμη RAM)
const memoryUpload = multer({ storage: multer.memoryStorage() });

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

// ==============================================================
// 🌟 AUDIO RECOGNITION ROUTE (ACRCloud)
// ==============================================================
router.post('/recognize', memoryUpload.single('sample'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Δεν βρέθηκε δείγμα ήχου.' });
    }

    // Ανάγνωση κλειδιών από το .env
    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

    // Δικλείδα ασφαλείας σε περίπτωση που λείπουν από το .env
    if (!host || !accessKey || !accessSecret) {
        console.error("🚨 ΛΕΙΠΟΥΝ ΤΑ ACRCLOUD KEYS ΑΠΟ ΤΟ .ENV!");
        return res.status(500).json({ error: 'Λάθος ρυθμίσεις server (Missing API Keys).' });
    }

    const fileBuffer = req.file.buffer;

    // ACRCloud Configuration
    const endpoint = '/v1/identify';
    const signatureVersion = '1';
    const dataType = 'audio';
    const signatureMethod = 'sha1';
    const timestamp = Math.floor(Date.now() / 1000);

    // Δημιουργία κρυπτογραφημένης υπογραφής
    const stringToSign = ['POST', endpoint, accessKey, dataType, signatureVersion, timestamp].join('\n');
    const signature = crypto.createHmac(signatureMethod, accessSecret).update(Buffer.from(stringToSign, 'utf-8')).digest().toString('base64');

    // Χτίσιμο του πακέτου που θα στείλουμε
    const form = new FormData();
    form.append('sample', fileBuffer, { 
      filename: 'sample.webm', 
      contentType: req.file.mimetype 
    });
    form.append('access_key', accessKey);
    form.append('data_type', dataType);
    form.append('signature_version', signatureVersion);
    form.append('signature', signature);
    form.append('sample_bytes', fileBuffer.length);
    form.append('timestamp', timestamp);

    // Αποστολή στο ACRCloud
    const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
      headers: form.getHeaders()
    });

    // Επιστροφή των αποτελεσμάτων στο React (Frontend)
    res.json(acrResponse.data);

  } catch (error) {
    console.error("ACRCloud Request Error:", error.message);
    res.status(500).json({ error: 'Αποτυχία αναγνώρισης ήχου.' });
  }
});

// ==============================================================
// 🚀 CLOUD RECOGNITION (Προσπέλαση των περιορισμών του iPhone)
// ==============================================================
router.post('/recognize-proxy', process.env.APP_ENV === 'staging'
  ? require('../utils/stageAcrcloud').stageRecognizeProxy
  : async (req, res) => {
  try {
    const { streamUrl } = req.body;
    if (!streamUrl) return res.status(400).json({ error: 'Λείπει το URL του σταθμού.' });

    // 1. Ο Server συνδέεται στο stream για να "κλέψει" λίγο ήχο
    const streamRes = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream',
      timeout: 8000 // Μην περιμένεις για πάντα αν ο σταθμός είναι κάτω
    });

    const chunks = [];
    let bytesRead = 0;
    const MAX_BYTES = 600000; // Περίπου 6-8 δευτερόλεπτα δείγματος

    // Διαβάζουμε το stream μέχρι να έχουμε αρκετό δείγμα
    const audioBuffer = await new Promise((resolve, reject) => {
      streamRes.data.on('data', (chunk) => {
        chunks.push(chunk);
        bytesRead += chunk.length;
        if (bytesRead >= MAX_BYTES) {
          streamRes.data.destroy(); // Κλείνουμε τη σύνδεση αμέσως
          resolve(Buffer.concat(chunks));
        }
      });
      streamRes.data.on('error', (err) => reject(err));
      // Αν το stream τελειώσει νωρίτερα
      streamRes.data.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // 2. Τώρα χρησιμοποιούμε την ΗΔΗ υπάρχουσα λογική σου για το ACRCloud
    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

    const endpoint = '/v1/identify';
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = ['POST', endpoint, accessKey, 'audio', '1', timestamp].join('\n');
    const signature = crypto.createHmac('sha1', accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest().toString('base64');

    const form = new FormData();
    form.append('sample', audioBuffer, { filename: 'sample.mp3' });
    form.append('access_key', accessKey);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('sample_bytes', audioBuffer.length);
    form.append('timestamp', timestamp);

    const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
      headers: form.getHeaders()
    });

    res.json(acrResponse.data);

  } catch (error) {
    console.error("Proxy Recognition Error:", error.message);
    res.status(500).json({ error: 'Ο Server δεν μπόρεσε να "ακούσει" τον σταθμό.' });
  }
});

// --- Public & Global ---
router.get('/stations', stationController.getApprovedStations);
router.get('/stations/all', stationController.getAllStations);

// 🚀 DISCOVERY MODE ROUTE (Πάντα πριν από routes με :id)
router.get('/stations/discovery', stationController.getDiscoveryStations);

router.post('/stations', uploadStationLogo.single('logoFile'), stationController.createStation);
router.put('/stations/:id/dsp', stationController.updateDSP);
router.put('/stations/:id/schedule', stationController.updateSchedule);

// --- Broadcaster ---
router.get('/broadcaster/:userId/stations', stationController.getBroadcasterStations);

// 🟢 ΕΔΩ "ΚΟΥΜΠΩΣΑΜΕ" ΤΟ MULTER ΓΙΑ ΤΑ LOGOS
router.post('/broadcaster/stations', uploadStationLogo.single('logoFile'), stationController.createBroadcasterStation);
router.put('/broadcaster/stations/:id/edit-request', uploadStationLogo.single('logoFile'), stationController.requestEdit);

router.put('/broadcaster/stations/:id/network-ads', stationController.updateNetworkAds);

// --- Admin Station Controls ---

// 🟢 ΝΕΟ: ROUTE ΑΝΑΘΕΣΗΣ ΣΤΑΘΜΟΥ ΣΕ BROADCASTER
router.put('/admin/stations/:id/assign', async (req, res) => {
  try {
    const { broadcasterId } = req.body; 
    const stationId = req.params.id;

    // Ενημέρωση του Σταθμού με το νέο ID (ή αφαίρεσή του αν είναι null/κενό)
    const updatedStation = await Station.findByIdAndUpdate(
      stationId, 
      { broadcasterId: broadcasterId || null }, 
      { new: true }
    ).populate('broadcasterId', 'username email'); 

    if (!updatedStation) {
      return res.status(404).json({ error: "Ο σταθμός δεν βρέθηκε." });
    }

    res.json(updatedStation);

  } catch (error) {
    console.error("Σφάλμα ανάθεσης σταθμού:", error);
    res.status(500).json({ error: "Σφάλμα κατά την ανάθεση." });
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
router.put('/admin/stations/:id/status', stationController.updateStationStatus);
router.patch('/admin/stations/:id/featured', stationController.toggleFeatured);
router.post('/admin/stations/:id/approve-edit', stationController.approveEdit);
router.delete('/admin/stations/:id/reject-edit', stationController.rejectEdit);

module.exports = router;
