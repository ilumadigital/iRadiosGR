const User = require('../models/User');
const Station = require('../models/Station');
const ChatMessage = require('../models/ChatMessage');
const BannerAd = require('../models/BannerAd'); 
const Ad = require('../models/Ad');
const Transaction = require('../models/Transaction'); 
const EmailHistory = require('../models/EmailHistory');
const bcrypt = require('bcryptjs');

// 🟢 ΠΡΟΣΘΗΚΕΣ ΓΙΑ ΤΑ ΑΡΧΕΙΑ:
const fs = require('fs').promises; // Χρησιμοποιούμε το promises API
const path = require('path');

// 🟢 Κάνουμε import τον Mailer
const { sendEmail } = require('../utils/myMailer'); 
const { customAdminEmail, broadcasterPremiumSuccessEmail, listenerPremiumSuccessEmail } = require('../utils/mailTemp');

exports.cleanChat = async (req, res) => {
  try {
    const timeLimit = new Date(Date.now() - 3600 * 1000); 
    const result = await ChatMessage.deleteMany({ createdAt: { $lt: timeLimit } });
    await ChatMessage.syncIndexes();

    res.json({ 
      message: "Επιτυχία!", 
      deletedMessages: result.deletedCount,
      info: "Ο 'σκουπιδιάρης' της MongoDB ενεργοποιήθηκε."
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
    res.json({ message: 'Ο κωδικός ενημερώθηκε!' });
  } catch (err) { res.status(500).json({ error: 'Σφάλμα κωδικού.' }); }
};

exports.fullUpdateUser = async (req, res) => {
  try {
    const { fname, lname, email, username, birthdate, phone, newPassword } = req.body;
    
    // 1. Βρίσκουμε τον χρήστη
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });
    }

    // 2. Ενημερώνουμε τα βασικά στοιχεία
    if (fname !== undefined) user.fname = fname;
    if (lname !== undefined) user.lname = lname;
    if (email !== undefined) user.email = email;
    if (username !== undefined) user.username = username;
    if (birthdate !== undefined) user.birthdate = birthdate;
    if (phone !== undefined) user.phone = phone;

    // 3. Ελέγχουμε αν στάλθηκε νέος κωδικός
    if (newPassword && newPassword.trim() !== '') {
      // Κάνουμε hash τον νέο κωδικό
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedPassword;
    }

    // 4. Αποθηκεύουμε. Αυτό θα τρέξει τυχόν pre-save hooks (αν έχεις) και θα σώσει τον χρήστη.
    await user.save();

    // 5. Επιστρέφουμε τον χρήστη ΧΩΡΙΣ τον κωδικό (για ασφάλεια)
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json(userResponse);
    
  } catch (err) { 
    console.error("Error in fullUpdateUser:", err);
    res.status(500).json({ error: 'Σφάλμα ενημέρωσης.' }); 
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const usersWithStations = await Promise.all(users.map(async (user) => {
      const stations = await Station.find({ broadcasterId: user._id });
      return { ...user._doc, stationsCount: stations.length };
    }));
    res.json(usersWithStations);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role, isPremium, broadcasterProfile, assignedStation } = req.body;

    // 1. Βρίσκουμε τον χρήστη ΠΡΙΝ την αλλαγή (για να ξέρουμε αν άλλαξε κάτι)
    const oldUser = await User.findById(req.params.id);
    if (!oldUser) return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε' });

    // 2. Εκτελούμε την ενημέρωση (διατηρώντας τα πεδία σου)
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id, 
      { role, isPremium, broadcasterProfile, assignedStation }, 
      { new: true }
    ).select('-password');

    // 3. 🚀 ΕΛΕΓΧΟΣ ΓΙΑ ΑΠΟΣΤΟΛΗ EMAIL
    if (typeof sendEmail === 'function') {
      const userName = updatedUser.fname || updatedUser.username || 'Συνεργάτη';

      // Περίπτωση Α: Ενεργοποιήθηκε το Listener Premium
      if (!oldUser.isPremium && updatedUser.isPremium) {
        const mailData = listenerPremiumSuccessEmail(userName, "0.00 (Admin Update)");
        sendEmail({ to: updatedUser.email, subject: mailData.subject, html: mailData.html }).catch(e => {});
      }

      // Περίπτωση Β: Ενεργοποιήθηκε το Broadcaster PRO PACK (Tier)
      const oldTier = oldUser.broadcasterProfile?.tier || 'free';
      const newTier = updatedUser.broadcasterProfile?.tier || 'free';
      
      if (oldTier !== 'premium' && newTier === 'premium') {
        const mailData = broadcasterPremiumSuccessEmail(userName, "iRadios PRO PACK", "0.00 (Admin Update)");
        sendEmail({ to: updatedUser.email, subject: mailData.subject, html: mailData.html }).catch(e => {});
      }

      // Περίπτωση Γ: Ενεργοποιήθηκε μεμονωμένο feature (αν δεν είναι ήδη premium)
      if (newTier !== 'premium' && updatedUser.broadcasterProfile?.features) {
          // Έλεγχος DSP
          if (!oldUser.broadcasterProfile?.features?.dspEngine && updatedUser.broadcasterProfile.features.dspEngine) {
            const mailData = broadcasterPremiumSuccessEmail(userName, "dsp_solo", "0.00");
            sendEmail({ to: updatedUser.email, subject: mailData.subject, html: mailData.html }).catch(e => {});
          }
          // Έλεγχος Ad Control
          if (!oldUser.broadcasterProfile?.features?.adControl && updatedUser.broadcasterProfile.features.adControl) {
            const mailData = broadcasterPremiumSuccessEmail(userName, "ad_control_solo", "0.00");
            sendEmail({ to: updatedUser.email, subject: mailData.subject, html: mailData.html }).catch(e => {});
          }
      }
    }

    res.json(updatedUser);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
};

// 🟢 ΑΝΑΒΑΘΜΙΣΜΕΝΟ: ΠΛΗΡΗΣ ΔΙΑΓΡΑΦΗ ΧΡΗΣΤΗ (CASCADE DELETE ΜΕ UPLOADS)
exports.deleteUser = async (req, res) => {
  try {
    const adminId = req.headers['admin-id'];
    const userIdToDelete = req.params.id;

    if (userIdToDelete === adminId) {
      return res.status(403).json({ error: 'Δεν επιτρέπεται να διαγράψετε τον εαυτό σας!' });
    }

    const user = await User.findById(userIdToDelete);
    if (!user) {
      return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });
    }

    // 🧹 1. ΚΑΘΑΡΙΣΜΟΣ ΦΑΚΕΛΩΝ ΣΤΟN ΔΙΣΚΟ (UPLOADS)
    const username = user.username;
    if (username) {
      const userAudioDir = path.join(process.cwd(), 'uploads', 'audio', username);
      const userVisualsDir = path.join(process.cwd(), 'uploads', 'visuals', username); 

      try {
        await fs.rm(userAudioDir, { recursive: true, force: true });
        await fs.rm(userVisualsDir, { recursive: true, force: true }); 
      } catch(e) {
        console.error(`Σφάλμα διαγραφής φακέλων για ${username}:`, e.message);
      }
    }

    // 🧹 2. ΚΑΘΑΡΙΣΜΟΣ ΔΕΔΟΜΕΝΩΝ ΒΑΣΗΣ
    if (user.role === 'broadcaster' || user.role === 'producer') {
      await Station.deleteMany({ broadcasterId: userIdToDelete });
      await Ad.deleteMany({ broadcasterId: userIdToDelete, isGlobal: false });
    }

    if (user.role === 'agency') {
      await Ad.deleteMany({ agencyId: userIdToDelete });
      await BannerAd.deleteMany({ agencyId: userIdToDelete });
    }

    // 🗑️ ΤΕΛΟΣ: Διαγραφή του ίδιου του χρήστη
    await User.findByIdAndDelete(userIdToDelete);

    res.json({ message: 'Ο χρήστης, τα αρχεία του, και όλα τα συνδεδεμένα δεδομένα διεγράφησαν επιτυχώς!' });
  } catch (err) { 
    console.error("Σφάλμα διαγραφής χρήστη:", err);
    res.status(500).json({ error: 'Εσωτερικό σφάλμα κατά τη διαγραφή.' }); 
  }
};

exports.fixSlugs = async (req, res) => {
  try {
    const stations = await Station.find({});
    for (let station of stations) {
      station.slug = station.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      await station.save();
    }
    res.json({ message: `Slugs fixed!` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ============================================================================
// 🟢 ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ΤΟ AD NETWORK (ΕΓΚΡΙΣΕΙΣ & ΥΠΟΛΟΓΙΣΜΟΣ ΧΡΟΝΟΥ)
// ============================================================================
const calculateExpiryDate = (duration) => {
  const now = new Date();
  if (duration === 'day') return new Date(now.setDate(now.getDate() + 1));
  if (duration === 'month') return new Date(now.setMonth(now.getMonth() + 1));
  if (duration === 'year') return new Date(now.setFullYear(now.getFullYear() + 1));
  return new Date(now.setMonth(now.getMonth() + 1));
};

exports.approveBannerAd = async (req, res) => {
  try {
    const banner = await BannerAd.findById(req.params.id);
    if (!banner) return res.status(404).json({ error: 'Η διαφήμιση δεν βρέθηκε.' });

    const expiresAt = calculateExpiryDate(banner.duration || 'month');

    banner.status = 'active';
    banner.isActive = true; 
    banner.expiresAt = expiresAt;

    await banner.save();
    res.json({ success: true, message: 'Η διαφήμιση εγκρίθηκε και ξεκίνησε να τρέχει!', banner });
  } catch (error) {
    console.error("Σφάλμα έγκρισης Banner:", error);
    res.status(500).json({ error: 'Σφάλμα διακομιστή.' });
  }
};

exports.approveAudioAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Το spot δεν βρέθηκε.' });

    const expiresAt = calculateExpiryDate(ad.duration || 'month');

    ad.status = 'active';
    ad.expiresAt = expiresAt;

    await ad.save();
    res.json({ success: true, message: 'Το Audio Spot εγκρίθηκε και είναι live!', ad });
  } catch (error) {
    console.error("Σφάλμα έγκρισης Audio Ad:", error);
    res.status(500).json({ error: 'Σφάλμα διακομιστή.' });
  }
};

// ============================================================================
// 🟢 TRACKING METRICS (VIEWS, CLICKS, PLAYS)
// ============================================================================
exports.logBannerImpression = async (req, res) => {
  try {
    await BannerAd.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα καταγραφής view" }); }
};

exports.logBannerClick = async (req, res) => {
  try {
    await BannerAd.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα καταγραφής click" }); }
};

exports.logAudioPlay = async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα καταγραφής play" }); }
};

exports.logAudioClick = async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα καταγραφής click" }); }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('user')
      .sort({ createdAt: -1 }); 
      
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceSent } = req.body;
    
    const updatedTx = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $set: { invoiceSent } },
      { new: true }
    );

    if (!updatedTx) return res.status(404).json({ error: 'Η συναλλαγή δεν βρέθηκε' });
    
    res.json(updatedTx);
  } catch (error) {
    console.error("Σφάλμα ενημέρωσης τιμολογίου:", error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ============================================================================
// 🟢 ΣΥΝΑΡΤΗΣΕΙΣ ADMIN MAILER
// ============================================================================

// 1. Φέρνει το ιστορικό των απεσταλμένων email
exports.getEmailHistory = async (req, res) => {
  try {
    const history = await EmailHistory.find().sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error("Σφάλμα φόρτωσης ιστορικού emails:", err);
    res.status(500).json({ error: 'Σφάλμα φόρτωσης ιστορικού emails' });
  }
};

// 2. Στέλνει email μέσω του sendEmail utility και το καταγράφει
exports.sendCustomEmail = async (req, res) => {
  try {
    const { sendType, targetRole, to, bcc, subject, body, userId } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Τα πεδία Θέμα και Κείμενο είναι υποχρεωτικά.' });
    }

    let emailRecipients = [];
    let finalTo = to;
    let finalBcc = bcc;
    let recipientCount = 1;

    // 🟢 ΛΟΓΙΚΗ ΜΑΖΙΚΗΣ ΑΠΟΣΤΟΛΗΣ (ΑΝΑ ΡΟΛΟ)
    if (sendType === 'role') {
      let query = {};
      
      // Διαβάζουμε τους "εικονικούς" ρόλους του frontend
      if (targetRole === 'premium_user') {
        query = { isPremium: true };
      } else if (targetRole === 'user') {
        query = { role: 'user', isPremium: false };
      } else if (targetRole !== 'all_users') {
        // broadaster, producer, agency
        query = { role: targetRole };
      }

      // Φέρνουμε όλους τους χρήστες που ταιριάζουν (παίρνουμε μόνο τα emails τους για ταχύτητα)
      const users = await User.find(query, 'email');
      emailRecipients = users.map(u => u.email).filter(e => e); // Φιλτράρουμε τυχόν κενά emails
      
      if (emailRecipients.length === 0) {
        return res.status(400).json({ error: 'Δεν βρέθηκαν χρήστες σε αυτή την κατηγορία.' });
      }

      // Στη μαζική αποστολή, βάζουμε ένα dummy 'To' και όλα τα πραγματικά emails στο 'Bcc'
      finalTo = 'noreply@iradios.gr'; // Ή το δικό σου info@
      
      // Ενώνουμε τα email που βρήκαμε με κόμμα. Αν υπήρχε ήδη κάποιο bcc από τη φόρμα, το κρατάμε.
      finalBcc = bcc ? `${bcc},${emailRecipients.join(',')}` : emailRecipients.join(',');
      recipientCount = emailRecipients.length;

    } else {
      // 🟢 ΛΟΓΙΚΗ ΑΠΛΗΣ ΑΠΟΣΤΟΛΗΣ (Manual ή Dropdown)
      if (!to) {
        return res.status(400).json({ error: 'Ο Παραλήπτης είναι υποχρεωτικός.' });
      }
    }

    // Δημιουργία του HTML Template (όπως το είχες)
    const finalHtmlTemplate = customAdminEmail(body);

    // Αποστολή μέσω SMTP
    const emailResult = await sendEmail({
      to: finalTo,
      bcc: finalBcc || undefined,
      subject: subject,
      html: finalHtmlTemplate 
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Αποτυχία αποστολής από τον SMTP Server.' });
    }

    // Αποθήκευση στο Ιστορικό (EmailHistory)
    const record = new EmailHistory({
      to: sendType === 'role' ? `Ομάδα: ${targetRole}` : finalTo,
      bcc: bcc, // Στη βάση αποθηκεύουμε μόνο το Bcc που έγραψε χειροκίνητα ο Admin (αν έγραψε), όχι όλη τη λίστα!
      subject,
      body,
      toUser: userId || null,
      status: 'sent',
      // Προσθέτουμε metrics για να τα βλέπει το Frontend (αν το Schema του EmailHistory τα υποστηρίζει, αλλιώς απλά αγνοούνται)
      sendType: sendType || 'single', 
      targetRole: targetRole || null,
      recipientCount: recipientCount 
    });
    
    await record.save();

    res.json({ success: true, message: 'Το email στάλθηκε επιτυχώς!', record });
  } catch (err) {
    console.error('Σφάλμα αποστολής custom email:', err);
    res.status(500).json({ error: 'Το email απέτυχε να σταλεί λόγω εσωτερικού σφάλματος.' });
  }
};

// 🟢 ΦΕΡΝΕΙ ΟΛΑ ΤΑ ΣΤΑΤΙΣΤΙΚΑ ΓΙΑ ΤΟ DASHBOARD
exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Κατανομή Χρηστών (Pie Chart) & Μετρήσεις Χρηστών
    const users = await User.find({}, 'role isPremium broadcasterProfile');
    
    let roleCounts = { listener: 0, broadcaster: 0, producer: 0, agency: 0 };
    let premiumUsers = 0;
    
    users.forEach(u => {
      if (roleCounts[u.role] !== undefined) roleCounts[u.role]++;
      if (u.isPremium || u.broadcasterProfile?.tier === 'premium') premiumUsers++;
    });

    const formattedRoles = [
      { name: 'Ακροατές', value: roleCounts.listener },
      { name: 'Broadcasters', value: roleCounts.broadcaster },
      { name: 'Producers', value: roleCounts.producer },
      { name: 'Agencies', value: roleCounts.agency }
    ].filter(r => r.value > 0);

    // 2. Έσοδα ανά Μήνα (Bar Chart) & Μετρήσεις Συναλλαγών
    const transactions = await Transaction.find({ status: 'completed' });
    
    let totalRevenue = 0;
    let pendingInvoices = 0;
    const monthlyRev = {};

    transactions.forEach(tx => {
      totalRevenue += tx.amount;
      if (!tx.invoiceSent) pendingInvoices++;
      
      const date = new Date(tx.createdAt);
      const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      monthlyRev[key] = (monthlyRev[key] || 0) + tx.amount;
    });

    const formattedRevenue = Object.keys(monthlyRev).map(key => ({
      name: key,
      amount: monthlyRev[key]
    })).sort((a, b) => {
      const [m1, y1] = a.name.split('/');
      const [m2, y2] = b.name.split('/');
      return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
    });

    // 3. Στατιστικά Διαφημίσεων (Ακριβής διαχωρισμός Audio vs Banners)
    const adStatsAgg = await Ad.aggregate([{ $group: { _id: null, totalPlays: { $sum: "$plays" }, totalClicks: { $sum: "$clicks" } } }]);
    const bannerStatsAgg = await BannerAd.aggregate([{ $group: { _id: null, totalImpressions: { $sum: "$impressions" }, totalClicks: { $sum: "$clicks" } } }]);

    const audioPlays = adStatsAgg[0]?.totalPlays || 0;
    const audioClicks = adStatsAgg[0]?.totalClicks || 0;
    const bannerViews = bannerStatsAgg[0]?.totalImpressions || 0;
    const bannerClicks = bannerStatsAgg[0]?.totalClicks || 0;

    // 4. Στατιστικά Σταθμών
    const stations = await Station.find({}, 'boostStatus isFeatured hasAddons');
    const totalStations = stations.length;
    const activeBoosts = stations.filter(s => s.boostStatus || s.isFeatured).length;
    const stationsWithAddons = users.filter(u => 
      u.role === 'broadcaster' && u.broadcasterProfile && 
      (u.broadcasterProfile.features?.dspEngine || u.broadcasterProfile.features?.adControl)
    ).length;

    // =========================================================
    // 🚀 NEW: LEADERBOARDS (Top 10 για το κάτω μέρος του UI)
    // =========================================================
    
    // Top 10 Σταθμοί
    const topStationsRaw = await Station.find({ status: 'approved' }).sort({ plays: -1 }).limit(10).select('name plays');
    const topStations = topStationsRaw.map(s => ({
      id: s._id,
      name: s.name,
      plays: s.plays || 0
    }));

    // Top 10 Banners
    const topBannersRaw = await BannerAd.find().sort({ clicks: -1 }).limit(10).select('title company impressions clicks');
    const topBanners = topBannersRaw.map(b => ({
      id: b._id,
      title: b.title,
      company: b.company || 'Άγνωστο',
      views: b.impressions || 0,
      clicks: b.clicks || 0,
      ctr: b.impressions ? ((b.clicks / b.impressions) * 100).toFixed(2) : 0
    }));

    // Top 10 Audio Ads
    const topAdsRaw = await Ad.find().sort({ plays: -1 }).limit(10).select('title company plays clicks');
    const topAds = topAdsRaw.map(ad => ({
      id: ad._id,
      title: ad.title,
      company: ad.company || 'Άγνωστο',
      plays: ad.plays || 0,
      clicks: ad.clicks || 0,
      ctr: ad.plays ? ((ad.clicks / ad.plays) * 100).toFixed(2) : 0
    }));

    // =========================================================
    // ΕΠΙΣΤΡΟΦΗ ΔΕΔΟΜΕΝΩΝ 
    // =========================================================
    res.json({
      revenueData: formattedRevenue.length ? formattedRevenue : [{ name: "Δεν υπάρχουν", amount: 0 }],
      roleData: formattedRoles,
      topStations,
      topBanners,
      topAds,
      totals: {
        revenue: totalRevenue,
        users: users.length,
        premiumUsers: premiumUsers,
        plays: audioPlays,
        clicks: audioClicks,
        bannerViews: bannerViews,
        bannerClicks: bannerClicks
      },
      stationStats: {
        activeStations: totalStations,
        broadcasters: roleCounts.broadcaster,
        producers: roleCounts.producer,
        addons: stationsWithAddons,
        boosts: activeBoosts,
        pendingInvoices: pendingInvoices
      }
    });
  } catch (error) {
    console.error("Σφάλμα Dashboard:", error);
    res.status(500).json({ error: 'Σφάλμα φόρτωσης στατιστικών' });
  }
};
