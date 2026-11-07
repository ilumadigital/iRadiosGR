const express = require('express');
const router = express.Router();
const User = require('../models/User'); // 🟢 Βάλε το σωστό path για το User model σου

router.get('/network', async (req, res) => {
  try {
    const users = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ isPremium: true });

    const currentLiveListeners = global.totalLiveListeners || 0;

    res.json({
      totals: {
        users,
        premiumUsers,
        liveListeners: currentLiveListeners
      }
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ error: 'Server error fetching public stats' });
  }
});

module.exports = router;
