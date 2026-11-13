const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const admin=[protect,authorizeRoles('admin')];

router.put('/admin/users/:id/password', adminController.updateUserPassword);
router.put('/admin/users/:id/full-update', adminController.fullUpdateUser);
router.get('/admin/users', adminController.getUsers);
router.put('/admin/users/:id/role', adminController.updateUserRole);
router.delete('/admin/users/:id', adminController.deleteUser);
router.get('/admin/fix-slugs', adminController.fixSlugs);

// 🟢 ΕΓΚΡΙΣΗ ΔΙΑΦΗΜΙΣΕΩΝ (AD NETWORK)
router.put('/admin/banners/:id/approve', ...admin, adminController.approveBannerAd);
router.put('/admin/ads/:id/approve', ...admin, adminController.approveAudioAd);


// Agency revisions: review exact before/after; never accept an email link as approval.
const AgencyAdRevision=require('../models/AgencyAdRevision');
const BannerAd=require('../models/BannerAd');
const Ad=require('../models/Ad');
const User=require('../models/User');
const {mailAgency}=require('../services/agencyAdNotifications');
router.get('/admin/agency-ad-revisions',...admin,async(req,res)=>{
  try {
    const revisions=await AgencyAdRevision.find({}).sort({createdAt:-1}).limit(200)
      .populate('agencyId','username email').lean();
    res.json(revisions);
  }catch{return res.status(500).json({error:'Δεν φορτώθηκαν οι αλλαγές.'});}
});
router.put('/admin/agency-ad-revisions/:id/decision',...admin,async(req,res)=>{
  const decision=req.body?.decision;
  const rejectionReason=String(req.body?.reason||'').trim().slice(0,1000);
  if(!['approve','reject'].includes(decision))
    return res.status(400).json({error:'Invalid decision'});
  if(decision==='reject'&&!rejectionReason)
    return res.status(400).json({error:'Απαιτείται αιτιολογία απόρριψης.'});
  try{
    const revision=await AgencyAdRevision.findOne({_id:req.params.id,status:'pending'});
    if(!revision)return res.status(409).json({error:'Η αλλαγή έχει ήδη εξεταστεί ή δεν υπάρχει.'});
    const Model=revision.creativeType==='banner'?BannerAd:Ad;
    const creative=await Model.findOne({_id:revision.creativeId,agencyId:revision.agencyId,
      isStageCreative:true});
    if(!creative)return res.status(404).json({error:'Η καμπάνια δεν υπάρχει.'});
    // Guard against stale approvals after admin-side creative modification.
    for(const [key,previous] of Object.entries(revision.before||{})){
      if(JSON.stringify(creative.get(key)??null)!==JSON.stringify(previous??null))
        return res.status(409).json({error:'Η καμπάνια άλλαξε μετά την υποβολή. Απαιτείται νέα υποβολή.'});
    }
    const status=decision==='approve'?'approved':'rejected';
    const claimed=await AgencyAdRevision.findOneAndUpdate({_id:revision._id,status:'pending'},
      {$set:{status,reviewedBy:req.user._id,reviewedAt:new Date(),
        rejectionReason:decision==='reject'?rejectionReason:''}},{new:true});
    if(!claimed)return res.status(409).json({error:'Η αλλαγή εξετάστηκε ήδη.'});
    try{
      if(decision==='approve'){
        const updated=await Model.findOneAndUpdate({_id:creative._id,agencyId:revision.agencyId,
          updatedAt:revision.baseUpdatedAt||{$exists:false}},
          {$set:revision.patch},{new:true,runValidators:true});
        if(!updated)throw Error('Creative no longer exists');
      }
    }catch(error){
      await AgencyAdRevision.updateOne({_id:revision._id,status},{$set:{status:'pending',
        reviewedBy:null,reviewedAt:null,rejectionReason:''}});
      throw error;
    }
    const agency=await User.findById(revision.agencyId).select('email').lean();
    const notified=await mailAgency({agency,creative,approved:decision==='approve',reason:rejectionReason})
      .catch(()=>false);
    res.json({success:true,status,agencyNotified:notified});
  }catch(error){
    console.error('[ADMIN] Agency revision decision failed',error.message);
    res.status(500).json({error:'Αποτυχία ελέγχου αλλαγών.'});
  }
});

// 🟢 B2B PAYMENTS & INVOICES ROUTES
router.get('/admin/transactions', adminController.getAllTransactions);
router.put('/admin/transactions/:id/invoice', adminController.updateInvoiceStatus);

// 🟢 ADMIN MAILER ROUTES
router.get('/admin/emails', adminController.getEmailHistory);
router.post('/admin/emails/send', adminController.sendCustomEmail);

// Protect analytics on all environments, not just staging's global guard.
router.get('/admin/dashboard-stats',
  require('../utils/authMiddleware').protect,
  require('../utils/roleMiddleware').authorizeRoles('admin'),
  adminController.getDashboardStats);

module.exports = router;
