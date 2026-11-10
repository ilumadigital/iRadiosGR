'use strict';
// Phase 1: safe, additive catalog + complimentary entitlements.
// This route does not create payments, claim paid transactions or auto-renew.
const express=require('express');
const crypto=require('node:crypto');
const {fingerprintGrant}=require('../utils/billingGrantRequest');
const mongoose=require('mongoose');
const User=require('../models/User');
const Station=require('../models/Station');
const Ad=require('../models/Ad');
const BannerAd=require('../models/BannerAd');
const BillingGrant=require('../models/BillingGrant');
const {getProduct,listProducts}=require('../config/billingCatalog');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const {validateComplimentaryScope,resolveComplimentaryEntitlements,isActiveGrant}=require('../services/billingPolicy');
const {effectiveRights,legacyRights,activeGrantsFor,accountRights}=require('../services/billingEntitlements');
const router=express.Router();
const admin=[protect,authorizeRoles('admin')];
const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const idOk=value=>mongoose.isValidObjectId(value);
const key=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{16,96}$/.test(value);
const cleanReason=value=>typeof value==='string' ? value.trim() : '';
const escapeRx=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});

router.get('/billing/catalog',(_req,res)=>res.json({
  products:listProducts(),version:'excel-2026-11-10',
  environment:process.env.APP_ENV||'unknown',renewalsAvailable:false
}));

router.get('/billing/me/grants',protect,safe(async(req,res)=>{
 const grants=await BillingGrant.find({accountId:req.user._id}).select('-__v').sort({createdAt:-1}).lean();
 res.json({grants:grants.map(g=>({...g,active:isActiveGrant(g)})),note:'Complimentary grants; not payments'});
}));

router.get('/billing/me/entitlements',protect,safe(async(req,res)=>{
 const stationId=req.query.stationId||null,campaignId=req.query.campaignId||null;
 if(stationId && (!idOk(stationId)||!await Station.exists({_id:stationId,broadcasterId:req.user._id})))
   return res.status(403).json({error:'Station not owned by account'});
 if(campaignId){
   if(!idOk(campaignId)||req.user.role!=='agency')return res.status(403).json({error:'Campaign not owned by account'});
   const owns=await Ad.exists({_id:campaignId,agencyId:req.user._id})||
     await BannerAd.exists({_id:campaignId,agencyId:req.user._id});
   if(!owns)return res.status(403).json({error:'Campaign not owned by account'});
 }
 const now=new Date();
 const grants=await activeGrantsFor(req.user,now);
 const entitlementSet=new Set(effectiveRights(req.user,grants,{stationId,campaignId,now}));
 // Verified first-cycle L-PREM is read from BillingOrder, not Stripe flags.
 if(req.user.role==='user'){
   for(const right of await accountRights(req.user,now))entitlementSet.add(right);
 }
 res.json({
   entitlements:[...entitlementSet].sort(),
   complimentaryEntitlements:resolveComplimentaryEntitlements(grants,{stationId,campaignId,now}),
   legacyEntitlements:legacyRights(req.user),
   paidSubscriptionsIntegrated:req.user.role==='user', // L-PREM first-cycle only
   renewalsAvailable:false
 });
}));


// The frontend may show station-scoped paid tools only for owned stations.
// All values are computed on the server from the real user and unexpired grants.
router.get('/billing/me/station-entitlements',protect,safe(async(req,res)=>{
 if(req.user.role!=='broadcaster' && req.user.role!=='admin')
   return res.status(403).json({error:'Broadcaster role required'});
 const stations=await Station.find({broadcasterId:req.user._id}).select('_id').lean();
 const now=new Date();
 const grants=await activeGrantsFor(req.user,now);
 const byStation={};
 for(const station of stations){
   const id=String(station._id);
   byStation[id]=effectiveRights(req.user,grants,{stationId:id,now});
 }
 return res.json({byStation,paidSubscriptionsIntegrated:false,renewalsAvailable:false});
}));

router.get('/admin/billing/subjects',...admin,safe(async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,80);
 if(q.length<2)return res.json({users:[]});
 const rx=new RegExp(escapeRx(q),'i');
 const users=await User.find({$or:[{email:rx},{username:rx},{fname:rx},{lname:rx}]})
  .select('_id username fname lname email role').limit(25).lean();
 res.json({users});
}));

router.get('/admin/billing/resources/:accountId',...admin,safe(async(req,res)=>{
 const {accountId}=req.params,sku=String(req.query.sku||'');
 if(!idOk(accountId))return res.status(400).json({error:'Invalid account ID'});
 const product=getProduct(sku);
 if(!product?.complimentaryEligible)return res.status(400).json({error:'Unsupported subscription SKU'});
 const user=await User.findById(accountId).select('role');
 if(!user)return res.status(404).json({error:'Account not found'});
 if(product.scopeType==='account')return res.json({resources:[]});
 if(product.scopeType==='station'){
   if(user.role!=='broadcaster')return res.status(403).json({error:'Requires broadcaster'});
   const stations=await Station.find({broadcasterId:accountId,status:'approved'}).select('_id name').limit(250).lean();
   return res.json({resources:stations.map(s=>({id:s._id,label:s.name}))});
 }
 if(user.role!=='agency')return res.status(403).json({error:'Requires agency'});
 if(sku==='AG-AUDIO'){
   const ads=await Ad.find({agencyId:accountId}).select('_id title').limit(250).lean();
   return res.json({resources:ads.map(a=>({id:a._id,label:a.title}))});
 }
 const placement={'AG-RADIO':'radio_feed','AG-HERO':'hero','AG-NEWS':'news_feed'}[sku];
 const banners=await BannerAd.find({agencyId:accountId,placement}).select('_id title').limit(250).lean();
 res.json({resources:banners.map(b=>({id:b._id,label:b.title}))});
}));

router.get('/admin/billing/grants',...admin,safe(async(req,res)=>{
 const accountId=req.query.accountId||null;
 if(accountId && !idOk(accountId))return res.status(400).json({error:'Invalid account ID'});
 const filter=accountId?{accountId}:{};
 const grants=await BillingGrant.find(filter).sort({createdAt:-1}).limit(150)
  .populate('accountId','username email role').populate('grantedBy','username').lean();
 res.json({grants:grants.map(g=>({...g,active:isActiveGrant(g)}))});
}));

router.post('/admin/billing/grants',...admin,safe(async(req,res)=>{
 const {accountId,sku,resourceId=null,expiresAt=null}=req.body||{};
 const reason=cleanReason(req.body?.reason);
 const requestId=req.headers['idempotency-key'];
 const product=getProduct(sku);
 if(!key(requestId))return res.status(400).json({error:'Valid Idempotency-Key header required'});
 if(!idOk(accountId)||!product)return res.status(400).json({error:'Invalid account or SKU'});
 if(reason.length<4||reason.length>500)return res.status(400).json({error:'Reason must have 4–500 characters'});
 if(resourceId!==null && !idOk(resourceId))return res.status(400).json({error:'Invalid resourceId'});
 const scopeError=validateComplimentaryScope(sku,product.scopeType,resourceId);
 if(scopeError)return res.status(400).json({error:scopeError});
 const now=new Date();
 const end=expiresAt?new Date(expiresAt):null;
 if(end && (!Number.isFinite(end.getTime())||end<=now))
   return res.status(400).json({error:'Expiry must be in the future'});
 const requestFingerprint=fingerprintGrant({accountId,sku,resourceId,expiresAt:end,reason});
 const already=await BillingGrant.findOne({requestId}).lean();
 if(already){
   if(already.requestFingerprint!==requestFingerprint)
     return res.status(409).json({error:'Idempotency-Key already used for different grant terms'});
   return res.status(200).json({grant:already,alreadyProcessed:true});
 }
 const account=await User.findById(accountId).select('role');
 if(!account)return res.status(404).json({error:'Account not found'});
 if(sku==='L-PREM' && !['user','admin'].includes(account.role))return res.status(403).json({error:'Listener account required'});
 if(sku==='B-PREM' && account.role!=='broadcaster')return res.status(403).json({error:'Broadcaster account required'});
 if(product.scopeType==='station') {
   if(account.role!=='broadcaster' || !await Station.exists({_id:resourceId,broadcasterId:accountId,status:'approved'}))
     return res.status(403).json({error:'Approved station must belong to broadcaster'});
 }
 if(product.scopeType==='campaign'){
   if(account.role!=='agency')return res.status(403).json({error:'Agency account required'});
   const good=sku==='AG-AUDIO'
     ? await Ad.exists({_id:resourceId,agencyId:accountId})
     : await BannerAd.exists({_id:resourceId,agencyId:accountId,
        placement:{'AG-RADIO':'radio_feed','AG-HERO':'hero','AG-NEWS':'news_feed'}[sku]});
   if(!good)return res.status(403).json({error:'Campaign does not belong to agency or placement mismatch'});
 }
 const exists=await BillingGrant.findOne({accountId,sku,
   scopeType:product.scopeType,resourceId,revokedAt:null,
   startsAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}).lean();
 if(exists)return res.status(409).json({error:'An active complimentary grant already exists',grantId:exists._id});
 try {
   const grant=await BillingGrant.create({accountId,sku,scopeType:product.scopeType,
     resourceId,source:'admin_complimentary',reason,grantedBy:req.user._id,
     startsAt:now,expiresAt:end,requestId,requestFingerprint});
   res.status(201).json({grant,paid:false});
 }catch(e){
   if(e.code===11000){
     const duplicate=await BillingGrant.findOne({requestId}).lean();
     if(duplicate?.requestFingerprint===requestFingerprint)
       return res.status(200).json({grant:duplicate,alreadyProcessed:true});
     return res.status(409).json({error:'Duplicate grant request'});
   }
   throw e;
 }
}));

router.post('/admin/billing/grants/:id/revoke',...admin,safe(async(req,res)=>{
 if(!idOk(req.params.id))return res.status(400).json({error:'Invalid grant ID'});
 const reason=cleanReason(req.body?.reason);
 if(reason.length<4||reason.length>500)return res.status(400).json({error:'Reason required (4–500 characters)'});
 const updated=await BillingGrant.findOneAndUpdate({_id:req.params.id,revokedAt:null},
   {$set:{revokedAt:new Date(),revokedBy:req.user._id,revokeReason:reason}},{new:true});
 if(updated)return res.json({grant:updated,revoked:true});
 const previous=await BillingGrant.findById(req.params.id);
 if(!previous)return res.status(404).json({error:'Grant not found'});
 res.json({grant:previous,alreadyRevoked:true});
}));

module.exports=router;
