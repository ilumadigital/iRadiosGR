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
// A revision remains pending throughout the creative write. If an Admin
// request crashes, retrying the SAME approval safely recovers its marker.
const {reviewAgencyRevision}=require('../services/agencyRevisionApprovalCore');
const modelForRevision=revision=>revision.creativeType==='banner'?BannerAd:Ad;
const revisionDecisionStore={
 getRevision:id=>AgencyAdRevision.findById(id).lean(),
 getCreative:revision=>modelForRevision(revision).findOne({
  _id:revision.creativeId,agencyId:revision.agencyId,isStageCreative:true
 }).lean(),
 claimApproval:(revision,reviewer)=>AgencyAdRevision.findOneAndUpdate({
  _id:revision._id,status:'pending',processing:{$ne:true}
 },{$set:{processing:true,processingDecision:'approve',
  processingBy:reviewer,processingStartedAt:new Date()}},
 {new:true,runValidators:true}).lean(),
 applyApproval:revision=>modelForRevision(revision).findOneAndUpdate({
  _id:revision.creativeId,agencyId:revision.agencyId,
  isStageCreative:true,updatedAt:revision.baseUpdatedAt||{$exists:false},
  lastApprovedRevisionId:{$ne:revision._id}
 },{$set:{...revision.patch,lastApprovedRevisionId:revision._id}},
 {new:true,runValidators:true}).lean(),
 finalizeApproval:(revision,reviewer)=>AgencyAdRevision.findOneAndUpdate({
  _id:revision._id,status:'pending',processing:true,processingDecision:'approve'
 },{$set:{status:'approved',processing:false,reviewedBy:revision.processingBy||reviewer,
  reviewedAt:new Date(),rejectionReason:''}},{new:true,runValidators:true}).lean(),
 reject:(revision,reviewer,reason)=>AgencyAdRevision.findOneAndUpdate({
  _id:revision._id,status:'pending',processing:{$ne:true}
 },{$set:{status:'rejected',reviewedBy:reviewer,reviewedAt:new Date(),
  rejectionReason:reason}},{new:true,runValidators:true}).lean()
};
router.put('/admin/agency-ad-revisions/:id/decision',...admin,async(req,res)=>{
  const decision=req.body?.decision;
  const rejectionReason=String(req.body?.reason||'').trim().slice(0,1000);
  if(!['approve','reject'].includes(decision))
    return res.status(400).json({error:'Invalid decision'});
  if(decision==='reject'&&!rejectionReason)
    return res.status(400).json({error:'Απαιτείται αιτιολογία απόρριψης.'});
  const mongoose=require('mongoose');
  if(!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({error:'Invalid revision ID'});
  try{
    const outcome=await reviewAgencyRevision({
      revisionId:req.params.id,decision,reviewerId:req.user._id,
      reason:rejectionReason
    },revisionDecisionStore);
    if(outcome.state==='not_found')return res.status(404).json({
      error:'Το δημιουργικό δεν υπάρχει πλέον.'});
    if(outcome.state==='needs_manual_review')return res.status(409).json({
      error:'Η εφαρμογή αλλαγών χρειάζεται χειροκίνητο έλεγχο. '+
       'Μην υποβάλεις δεύτερη αναθεώρηση.',
      recoveryRequired:true,reason:outcome.code});
    if(outcome.state==='conflict')return res.status(409).json({
      error:'Η έκδοση άλλαξε, έχει εγκριθεί ή εξετάζεται ήδη.',
      reason:outcome.code});
    let notified=false;
    if(outcome.notify){
      const agency=await User.findById(outcome.revision.agencyId).select('email').lean();
      notified=await mailAgency({agency,creative:outcome.creative,
        approved:outcome.state==='approved',reason:rejectionReason})
       .catch(()=>false);
    }
    return res.json({success:true,status:outcome.state,
      duplicate:Boolean(outcome.duplicate),agencyNotified:notified});
  }catch(error){
    console.error('[ADMIN] Agency revision decision failed',error.message);
    return res.status(500).json({error:'Αποτυχία ελέγχου αλλαγών. '+
     'Αν έγινε claim, επανάλαβε την ίδια απόφαση για ασφαλή ανάκτηση.'});
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
