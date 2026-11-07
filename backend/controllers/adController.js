const Ad = require('../models/Ad');
const User = require('../models/User');

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

exports.createBroadcasterAd = async (req, res) => {
  try {
    const user = await User.findById(req.body.broadcasterId);
    if (user.role !== 'admin' && !user.broadcasterProfile?.features?.adControl) {
       return res.status(403).json({ error: "Το Ad Control είναι κλειδωμένο." });
    }
    const newAd = new Ad({ ...req.body, isGlobal: false, status: 'active' }); 
    await newAd.save();
    res.status(201).json(newAd);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα δημιουργίας' }); }
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
