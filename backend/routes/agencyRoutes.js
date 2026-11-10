const express = require('express');
const router = express.Router();
const BannerAd = require('../models/BannerAd');
const Ad = require('../models/Ad');

// 1. Λήψη όλων των Banners ενός Agency
router.get('/:agencyId/banners', async (req, res) => {
  try {
    const banners = await BannerAd.find({ agencyId: req.params.agencyId }).sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "Σφάλμα ανάκτησης Banners." });
  }
});

// 2. Λήψη όλων των Audio Ads ενός Agency
router.get('/:agencyId/audio-ads', async (req, res) => {
  try {
    const audioAds = await Ad.find({ agencyId: req.params.agencyId }).sort({ createdAt: -1 });
    res.json(audioAds);
  } catch (error) {
    res.status(500).json({ error: "Σφάλμα ανάκτησης Audio Ads." });
  }
});

// 3. Αποθήκευση Νέου Banner (Από το Dashboard μετά από έγκριση και ενεργό entitlement)
router.post('/banners', async (req, res) => {
  try {
    const { title, description, imageUrl, targetUrl, placement, duration, agencyId } = req.body;
    
    const newBanner = new BannerAd({
      title,
      description,
      imageUrl,
      targetUrl,
      placement: placement || ['home'],
      agencyId,
      duration,
      status: 'pending', // 🔒 SECURITY: Πάντα ξεκινάει ως pending!
      isActive: false
    });

    const savedBanner = await newBanner.save();
    res.status(201).json(savedBanner);
  } catch (error) {
    console.error("Σφάλμα δημιουργίας Banner:", error);
    res.status(500).json({ error: "Σφάλμα κατά την αποθήκευση της καμπάνιας." });
  }
});

// 4. Αποθήκευση Νέου Audio Ad (Από το Dashboard μετά από έγκριση και ενεργό entitlement)
router.post('/audio-ads', async (req, res) => {
  try {
    const { title, client, audioUrl, linkUrl, duration, frequency, agencyId } = req.body;
    
    const newAudioAd = new Ad({
      title,
      client: client || 'Agency Client',
      audioUrl,
      linkUrl,
      frequency: frequency || 'every_4',
      agencyId,
      duration,
      status: 'pending', // 🔒 SECURITY: Πάντα ξεκινάει ως pending!
      isGlobal: true
    });

    const savedAd = await newAudioAd.save();
    res.status(201).json(savedAd);
  } catch (error) {
    console.error("Σφάλμα δημιουργίας Audio Ad:", error);
    res.status(500).json({ error: "Σφάλμα κατά την αποθήκευση της καμπάνιας." });
  }
});

module.exports = router;
