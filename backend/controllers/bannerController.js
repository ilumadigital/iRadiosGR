// controllers/bannerController.js
const BannerAd = require('../models/BannerAd'); 
const fs = require('fs').promises;
const path = require('path');

// 🟢 Βοηθητική Συνάρτηση: Διαβάζει το URL και διαγράφει το αρχείο εικόνας
const deleteMediaFile = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('/media/')) return;
    
    try {
        const relativePath = fileUrl.split('/media/')[1]; 
        const fullPath = path.join(process.cwd(), 'uploads', relativePath);
        
        await fs.unlink(fullPath);
        console.log(`✅ Η εικόνα διαγράφηκε: ${relativePath}`);
    } catch (error) {
        console.error(`⚠️ Το αρχείο δεν βρέθηκε ή δεν διαγράφηκε: ${fileUrl}`);
    }
};

// Φέρνει όλα τα ενεργά banners (Για το Public Frontend)
exports.getActiveBanners = async (req, res) => {
  // Do not serve advertisers' production creative to anonymous stage visitors.
  if (process.env.APP_ENV === 'staging') return res.json([]);
  try {
    const banners = await BannerAd.find({
      $or: [{ status: 'active' }, { isActive: true }],
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
    });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: 'Σφάλμα ανάκτησης Banners.' });
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
exports.createBanner = async (req, res) => {
  try {
    const newBanner = new BannerAd(req.body);
    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    res.status(500).json({ error: 'Αποτυχία δημιουργίας Banner.' });
  }
};

// Ενημέρωση υπάρχοντος banner
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBanner = await BannerAd.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedBanner) return res.status(404).json({ error: 'Δεν βρέθηκε η διαφήμιση.' });
    res.json(updatedBanner);
  } catch (err) {
    res.status(500).json({ error: 'Αποτυχία ενημέρωσης Banner.' });
  }
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

exports.registerClick = async (req, res) => {
  try {
    const { id } = req.params;
    await BannerAd.findByIdAndUpdate(id, { $inc: { clicks: 1 } });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Σφάλμα καταγραφής κλικ.' });
  }
};

exports.registerImpression = async (req, res) => {
  try {
    const { id } = req.params;
    await BannerAd.findByIdAndUpdate(id, { $inc: { impressions: 1 } });
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: "Σφάλμα καταγραφής view" }); 
  }
};
