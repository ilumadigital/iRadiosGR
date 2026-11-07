const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// Βεβαιώσου ότι το path του authMiddleware είναι το σωστό για το project σου
const { protect } = require('../utils/authMiddleware'); 

// ==========================================
// 1. STORAGE ΓΙΑ ΗΧΗΤΙΚΑ ΣΠΟΤ (AUDIO)
// ==========================================
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user.username; 
    const uploadPath = path.join(process.cwd(), 'uploads', 'audio', username);

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

const audioFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Μόνο αρχεία ήχου επιτρέπονται!'), false);
  }
};

const uploadAudio = multer({ storage: audioStorage, fileFilter: audioFilter });

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
router.post('/upload-ad', protect, uploadAudio.single('audioFile'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Δεν βρέθηκε αρχείο.' });
    const username = req.user.username;
    const filename = req.file.filename;
    
    // Το URL που θα διαβάζει ο Nginx
    const fileUrl = `__IRADIOS_SITE_ORIGIN__/media/audio/${username}/${filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Audio Upload Error:", error);
    res.status(500).json({ error: 'Σφάλμα κατά το ανέβασμα του ήχου.' });
  }
});

// Endpoint για Banners / Εικόνες
router.post('/upload-banner', protect, uploadBanner.single('imageFile'), (req, res) => {
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
router.post('/upload-logo', protect, uploadLogo.single('logoFile'), (req, res) => {
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
