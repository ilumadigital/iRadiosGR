const User = require('../models/User');
const Station = require('../models/Station');
const BannerAd = require('../models/BannerAd'); 
const Ad = require('../models/Ad');
const Transaction = require('../models/Transaction'); 
const EmailHistory = require('../models/EmailHistory');
const bcrypt = require('bcryptjs');
const gatewayBilling = require('../services/ilumaGatewayClient');
const BillingOrder = require('../models/BillingOrder');
const BroadcasterBillingOrder = require('../models/BroadcasterBillingOrder');
const {summarizePayments,adDashboardStats} = require('../services/dashboardMetrics');

// 🟢 ΠΡΟΣΘΗΚΕΣ ΓΙΑ ΤΑ ΑΡΧΕΙΑ:
const fs = require('fs').promises; // Χρησιμοποιούμε το promises API
const path = require('path');

// 🟢 Κάνουμε import τον Mailer
const { sendEmail } = require('../utils/myMailer'); 
const { customAdminEmail, broadcasterPremiumSuccessEmail, listenerPremiumSuccessEmail } = require('../utils/mailTemp');

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
    const nextRole=role||oldUser.role;
    // A role edit must never re-enable historical Broadcaster Premium,
    // custom station allowances or standalone addon flags. Paid/granted
    // entitlements are managed solely through Billing Engine.
    const setFields={
      role:nextRole,
      assignedStation:nextRole==='producer'?(assignedStation||null):null,
      isPremium:nextRole==='user'?isPremium===true:false
    };
    if(nextRole==='broadcaster'){
      Object.assign(setFields,{
        'broadcasterProfile.tier':'free',
        'broadcasterProfile.maxStations':3,
        'broadcasterProfile.features.dspEngine':false,
        'broadcasterProfile.features.analytics':false,
        'broadcasterProfile.features.adControl':false
      });
    }
    const updatedUser=await User.findByIdAndUpdate(req.params.id,
      {$set:setFields},{new:true,runValidators:true}).select('-password');

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
    const adminId = String(req.user?._id || req.headers['admin-id'] || '');
    const userIdToDelete = req.params.id;

    if (userIdToDelete === adminId) {
      return res.status(403).json({ error: 'Δεν επιτρέπεται να διαγράψετε τον εαυτό σας!' });
    }

    const user = await User.findById(userIdToDelete);
    if (!user) {
      return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });
    }

    // Financial safety barrier: stop ALL Listener and Broadcaster MIT mandates
    // (including station add-ons) in Gateway before destroying the account.
    // If Gateway cannot confirm the shutdown, retain the user and their files.
    let billingShutdown;
    try {
      billingShutdown = await gatewayBilling.cancelAllOnAccountDeletion(user);
    } catch (error) {
      console.error('[ADMIN DELETE] Gateway subscription shutdown failed:', error.code || error.name);
      return res.status(503).json({
        code: 'GATEWAY_SUBSCRIPTIONS_NOT_CANCELLED',
        error: 'Η διαγραφή δεν έγινε, επειδή δεν επιβεβαιώθηκε η ακύρωση όλων των συνδρομών στο Gateway. Δοκιμάστε ξανά ή ελέγξτε τις συνδρομές.'
      });
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

    res.json({
      message: 'Ο λογαριασμός διαγράφηκε και οι επόμενες χρεώσεις ακυρώθηκαν στο Gateway.',
      billing: {
        listenerCancelled: billingShutdown.listener_cancelled,
        broadcasterCancelled: billingShutdown.broadcaster_cancelled,
        subscriptionsCancelled: billingShutdown.subscriptions_cancelled
      }
    });
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
    if (process.env.APP_ENV === 'staging' && banner.isStageCreative !== true)
      return res.status(409).json({error:'Η παλιά παραγωγική καμπάνια δεν ενεργοποιείται στο staging. Δημιούργησε δοκιμαστικό αντίγραφο.'});

    if(banner.campaignId){
      const Campaign=require('../models/AdvertisingCampaign');
      const Lot=require('../models/AdvertisingFundingLot');
      const campaign=await Campaign.findById(banner.campaignId).select('workflowVersion approvalStatus createdByRole');
      if(campaign?.workflowVersion===2&&campaign.createdByRole==='agency'&&
        (campaign.approvalStatus!=='pending'||!
          await Lot.exists({campaignId:campaign._id,source:'nexi_verified'})))
        return res.status(409).json({error:'Η έγκριση Visual απαιτεί πληρωμή και τελική υποβολή.'});
    }
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
    if (process.env.APP_ENV === 'staging' && ad.isStageCreative !== true)
      return res.status(409).json({error:'Το παλιό spot παραγωγής δεν ενεργοποιείται στο staging. Δημιούργησε δοκιμαστικό αντίγραφο.'});

    if(ad.campaignId){
      const Campaign=require('../models/AdvertisingCampaign');
      const Lot=require('../models/AdvertisingFundingLot');
      const campaign=await Campaign.findById(ad.campaignId).select('workflowVersion approvalStatus createdByRole');
      if(campaign?.workflowVersion===2&&campaign.createdByRole==='agency'&&
        (campaign.approvalStatus!=='pending'||!
          await Lot.exists({campaignId:campaign._id,source:'nexi_verified'})))
        return res.status(409).json({error:'Η έγκριση Audio απαιτεί πληρωμή και τελική υποβολή.'});
    }
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
exports.getDashboardStats = async (req,res)=>{
  try{
    const [users,transactions,listenerOrders,broadcasterOrders,adAgg,bannerAgg,
      approvedStations,topStationsRaw,topBannersRaw,topAdsRaw]=await Promise.all([
      User.find({},'role isPremium broadcasterProfile'),
      Transaction.find({status:'completed'}),
      BillingOrder.find({status:'paid',environment:'staging'}),
      BroadcasterBillingOrder.find({status:'paid',environment:'staging'}),
      Ad.aggregate([{$group:{_id:null,totalPlays:{$sum:'$plays'},
        totalClicks:{$sum:'$clicks'}}}]),
      BannerAd.aggregate([{$group:{_id:null,totalImpressions:{$sum:'$impressions'},
        totalClicks:{$sum:'$clicks'}}}]),
      Station.find({status:'approved',isOffline:{$ne:true}})
        .select('_id boostStatus isFeatured'),
      Station.find({status:'approved'}).sort({plays:-1}).limit(10)
        .select('_id name plays'),
      BannerAd.find().sort({clicks:-1}).limit(10)
        .select('_id title impressions clicks'),
      Ad.find().sort({plays:-1}).limit(10)
        .select('_id title client plays clicks')
    ]);
    const counts={user:0,broadcaster:0,producer:0,agency:0,admin:0};
    let legacyPremiumFlags=0;
    for(const user of users){
      if(Object.hasOwn(counts,user.role))counts[user.role]++;
      if(user.isPremium||user.broadcasterProfile?.tier==='premium')
        legacyPremiumFlags++;
    }
    const payments=summarizePayments(transactions,listenerOrders,broadcasterOrders);
    const adStats=adDashboardStats(adAgg[0]?.totalPlays,adAgg[0]?.totalClicks,
      bannerAgg[0]?.totalImpressions,bannerAgg[0]?.totalClicks);
    const topStations=topStationsRaw.map(station=>({
      id:station._id,name:station.name,plays:station.plays||0
    }));
    const topBanners=topBannersRaw.map(b=>({
      id:b._id,title:b.title,company:'',
      views:b.impressions||0,clicks:b.clicks||0,
      ctr:b.impressions?100*(b.clicks||0)/b.impressions:0
    }));
    const topAds=topAdsRaw.map(ad=>({
      id:ad._id,title:ad.title,company:ad.client||'',
      plays:ad.plays||0,clicks:ad.clicks||0,
      ctr:ad.plays?100*(ad.clicks||0)/ad.plays:0
    }));
    return res.json({
      revenueData:payments.revenueData,
      revenueSource:'recorded-completed-transactions-and-paid-gateway-orders',
      roleCounts:{listeners:counts.user,broadcasters:counts.broadcaster,
        producers:counts.producer,agencies:counts.agency},
      roleData:[
        {name:'Ακροατές',value:counts.user},
        {name:'Broadcasters',value:counts.broadcaster},
        {name:'Producers',value:counts.producer},
        {name:'Agencies',value:counts.agency}
      ],
      adStats,topStations,topBanners,topAds,
      totals:{
        revenue:payments.revenue,payments:payments.payments,
        users:users.length,premiumUsers:legacyPremiumFlags,
        plays:adStats.audio.plays,clicks:adStats.audio.clicks,
        bannerViews:adStats.banner.views,bannerClicks:adStats.banner.clicks
      },
      stationStats:{
        activeStations:approvedStations.length,
        broadcasters:counts.broadcaster,producers:counts.producer,
        // Legacy feature flags and paid station entitlements cannot be
        // interpreted as one verified count; do not invent such a number.
        addons:null,
        boosts:approvedStations.filter(station=>station.boostStatus||station.isFeatured).length,
        pendingInvoices:payments.pendingInvoices
      }
    });
  }catch(error){
    console.error('Dashboard analytics failed',error);
    return res.status(500).json({error:'Σφάλμα φόρτωσης στατιστικών'});
  }
};
