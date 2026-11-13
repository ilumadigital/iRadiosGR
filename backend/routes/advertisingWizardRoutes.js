'use strict';
// Ordered staging advertising workflow. Never routes listener traffic through a
// broad /api authentication guard and never treats a browser return as payment.
const express=require('express');
const mongoose=require('mongoose');
const router=express.Router();
const {protect}=require('../utils/authMiddleware');
const Campaign=require('../models/AdvertisingCampaign');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const Pricing=require('../models/AdvertisingPricing');
const Quote=require('../models/AdvertisingQuote');
const Intent=require('../models/AdvertisingPaymentIntent');
const Lot=require('../models/AdvertisingFundingLot');
const {getAdvertisingPricing}=require('../services/advertisingPricingStore');
const {aggregateBalances}=require('../services/advertisingBalances');
const {validateAgencyGeo}=require('../services/agencyAdGeo');
const {sanitizeAdDesign}=require('../services/adDesignRules');
const mailer=require('../services/advertisingCampaignMailScheduler');
const noticeOutbox=require('../services/agencyAdNoticeOutbox');

const routes=[
 {prefix:'/advertising/wizard',role:'agency'},
 {prefix:'/admin/advertising/wizard',role:'admin'}
];
const oid=value=>mongoose.isValidObjectId(value);
const fail=(res,e)=>res.status(e.status||400).json({error:e.message||'Invalid campaign'});
const issue=(message,status=400)=>Object.assign(new Error(message),{status});
const noCache=(req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();};
const mediaLink=value=>{
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&Boolean(u.hostname)&&
 !u.username&&!u.password&&value.length<=1800;}catch{return false;}
};
const placements=new Set(['hero','home','radio_feed','news_feed','station_profile']);
const frequencies=new Set(['entry','every_2_stations','every_4_stations','every_5_stations',
 'every_10_stations','every_15_stations','every_20_stations','every_30_stations',
 'every_1_hour','every_2_hours','every_6_hours','once_a_day','twice_a_day',
 'four_times_a_day','once_a_week']);
const validBudget=(value,settings)=>{
 if(!Number.isSafeInteger(value)||value<settings.minBudgetCents||
   value>settings.maxBudgetCents)throw issue('Το budget πρέπει να είναι εντός των ορίων τιμολόγησης.');
 return value;
};
const settings=getAdvertisingPricing;
async function owned(req,id,role){
 if(!oid(id))throw issue('Invalid campaign id');
 const result=await Campaign.findOne({_id:id,agencyId:req.user._id,
  createdByRole:role,workflowVersion:2,isStageCampaign:true,deletedAt:null});
 if(!result)throw issue('Η καμπάνια δεν υπάρχει ή δεν σου ανήκει.',404);
 return result;
}
async function mutable(campaign){
 if(campaign.approvalStatus!=='draft')throw issue('Η καμπάνια έχει ήδη υποβληθεί.',409);
 if(await Intent.exists({campaignId:campaign._id,
  status:{$in:['creating','redirect','unknown','paid']}}))
  throw issue('Η καμπάνια έχει πληρωμή σε εξέλιξη ή επιβεβαιωμένη. Δεν επιτρέπονται αλλαγές.',409);
}
async function invalidateQuotes(campaign){
 await Quote.updateMany({campaignId:campaign._id,status:'quoted'},{$set:{status:'canceled'}});
}
function campaignFields(body,pricing){
 const title=String(body?.title||'').trim(),brand=String(body?.brand||'').trim();
 const description=String(body?.description||'').trim();
 if(title.length<3||title.length>180||brand.length<2||brand.length>150||
   description.length>3000)throw issue('Συμπλήρωσε τίτλο, brand και έγκυρη περιγραφή.');
 const startsAt=new Date(body?.startsAt),endsAt=new Date(body?.endsAt);
 const now=Date.now();
 if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||
   startsAt.getTime()<now-86400000||endsAt<=startsAt||
   endsAt.getTime()>now+366*86400000)
  throw issue('Η ημερομηνία έναρξης ή λήξης δεν είναι έγκυρη.');
 if(!pricing.durationDays.includes(Math.ceil((endsAt-startsAt)/86400000)))
  throw issue('Η διάρκεια δεν είναι επιτρεπτή στον ισχύοντα τιμοκατάλογο.');
 const geo=validateAgencyGeo({targetCountry:body?.country||'Ελλάδα',
  targetRegion:body?.region||'All',
  targetLocations:[body?.prefecture||(body?.region&&body.region!=='All'?body.region:'Ελλάδα')]});
 return {title,brand,description,startsAt,endsAt,
  country:geo.targetCountry,region:geo.targetRegion,prefecture:geo.targetLocations[0]};
}
function geoOf(campaign){
 return {targetCountry:campaign.country,targetRegion:campaign.region,
  targetLocations:[campaign.prefecture]};
}
function creativeFields(kind,body,campaign){
 if(!body||typeof body!=='object'||Array.isArray(body))throw issue('Μη έγκυρο δημιουργικό.');
 const title=String(body.title||'').trim();
 if(title.length<3||title.length>180)throw issue('Χρειάζεται τίτλος δημιουργικού.');
 if(kind==='banner'){
  const place=Array.isArray(body.placement)?body.placement:[];
  if(!place.length||place.length>5||place.some(p=>!placements.has(p)))
   throw issue('Επίλεξε έγκυρη θέση Visual.');
  const imageUrl=String(body.imageUrl||'').trim();
  const targetUrl=String(body.targetUrl||'').trim();
  const squareImageUrl=String(body.squareImageUrl||'').trim();
  const logoUrl=String(body.logoUrl||'').trim();
  if(!mediaLink(imageUrl)||!mediaLink(targetUrl)||
     (squareImageUrl&&!mediaLink(squareImageUrl))||(logoUrl&&!mediaLink(logoUrl)))
   throw issue('Χρειάζονται έγκυρα URL για εικόνα και προορισμό.');
  const description=String(body.description||'').trim();
  if(!description||description.length>1200)throw issue('Συμπλήρωσε περιγραφή δημιουργικού.');
  const color=String(body.brandColor||'#a855f7');
  if(!/^#[a-f0-9]{6}$/i.test(color))throw issue('Μη έγκυρο χρώμα.');
  const focalX=Number(body.focalX??50),focalY=Number(body.focalY??50);
  if(![focalX,focalY].every(x=>Number.isFinite(x)&&x>=0&&x<=100))
   throw issue('Μη έγκυρο σημείο εικόνας.');
  return {title,description,imageUrl,targetUrl,squareImageUrl,logoUrl,
   ctaLabel:String(body.ctaLabel||'Μάθε περισσότερα').slice(0,45),
   brandColor:color,focalX,focalY,
   designConfig:sanitizeAdDesign(body.designConfig||{}),placement:place,...geoOf(campaign)};
 }
 if(kind==='audio'){
  const audioUrl=String(body.audioUrl||'').trim(),logoUrl=String(body.logoUrl||'').trim();
  const linkUrl=String(body.linkUrl||'').trim();
  if(!mediaLink(audioUrl)||(logoUrl&&!mediaLink(logoUrl))||
     (linkUrl&&!mediaLink(linkUrl)))
   throw issue('Ανέβασε έγκυρο Audio και προαιρετικά εικόνα/σύνδεσμο.');
  const frequency=String(body.frequency||'entry');
  if(!frequencies.has(frequency))throw issue('Μη έγκυρη συχνότητα Audio.');
  return {title,client:campaign.brand,audioUrl,logoUrl,linkUrl,frequency,
   dspPreset:'OFF',...geoOf(campaign)};
 }
 throw issue('Μη έγκυρος τύπος δημιουργικού.');
}
async function loadCreatives(campaign){
 const [banners,audios]=await Promise.all([
  Banner.find({campaignId:campaign._id,agencyId:campaign.agencyId,
   isStageCreative:true}).sort({createdAt:1}).lean(),
  Audio.find({campaignId:campaign._id,agencyId:campaign.agencyId,
   isStageCreative:true}).sort({createdAt:1}).lean()
 ]);
 return {banners,audios};
}
async function countCreatives(campaign){
 const [banners,audios]=await Promise.all([
  Banner.countDocuments({campaignId:campaign._id,agencyId:campaign.agencyId,
    isStageCreative:true,status:{$in:['draft','pending']}}),
  Audio.countDocuments({campaignId:campaign._id,agencyId:campaign.agencyId,
    isStageCreative:true,status:{$in:['draft','pending']}})
 ]);
 return banners+audios;
}
for(const {prefix,role} of routes){
 // Prefix-scoped JWT only: never intercept /api/proxy-stream or public login.
 router.use(prefix,protect,(req,res,next)=>{
  if(process.env.APP_ENV!=='staging')return res.status(503).json({error:'Staging only'});
  if(req.user?.role!==role)return res.status(403).json({error:'Role mismatch'});
  next();
 },noCache);
 router.post(prefix+'/campaigns',async(req,res)=>{
  try{
   const pricing=await settings();
   const info=campaignFields(req.body,pricing);
   const campaign=await Campaign.create({...info,agencyId:req.user._id,
    createdByRole:role,workflowVersion:2,agencyEnabled:true,
    approvalStatus:'draft'});
   res.status(201).json(campaign);
  }catch(e){fail(res,e);}
 });
 router.get(prefix+'/campaigns/:id',async(req,res)=>{
  try{
   const campaign=await owned(req,req.params.id,role);
   const [creatives,lots,intents,quote,pricing]=await Promise.all([
    loadCreatives(campaign),
    Lot.find({campaignId:campaign._id}).select('remainingNanos budgetNanos remainingMicros budgetMicros').lean(),
    Intent.find({campaignId:campaign._id}).select('_id status paidAt createdAt').sort({createdAt:-1}).limit(10).lean(),
    Quote.findOne({campaignId:campaign._id,status:'quoted',expiresAt:{$gt:new Date()}})
     .sort({createdAt:-1}).lean(),settings()
   ]);
   return res.json({campaign,creatives,finance:aggregateBalances(lots),intents,
    quote,pricing});
  }catch(e){fail(res,e);}
 });
 router.patch(prefix+'/campaigns/:id',async(req,res)=>{
  try{
   const campaign=await owned(req,req.params.id,role);
   await mutable(campaign);
   const pricing=await settings();
   const update=req.body?.step==='budget'?
    {plannedBudgetCents:validBudget(req.body?.budgetCents,pricing)}:
    campaignFields(req.body,pricing);
   const changed=await Campaign.findOneAndUpdate({_id:campaign._id,approvalStatus:'draft'},
    {$set:update},{new:true,runValidators:true});
   if(!changed)throw issue('Η καμπάνια έχει υποβληθεί.',409);
   await invalidateQuotes(campaign);
   res.json(changed);
  }catch(e){fail(res,e);}
 });
 router.post(prefix+'/campaigns/:id/creatives',async(req,res)=>{
  try{
   const campaign=await owned(req,req.params.id,role);
   await mutable(campaign);
   if(await countCreatives(campaign)>=12)throw issue('Επιτρέπονται έως 12 δημιουργικά ανά καμπάνια.');
   const kind=req.body?.kind;
   const fields=creativeFields(kind,req.body,campaign);
   const model=kind==='banner'?Banner:Audio;
   const row=await model.create({...fields,agencyId:campaign.agencyId,
    campaignId:campaign._id,status:'draft',isStageCreative:true,
    ...(kind==='banner'?{isActive:false}:{isGlobal:true}),
    agencyDraftNoticeVersion:0,duration:'month'});
   await invalidateQuotes(campaign);
   res.status(201).json(row);
  }catch(e){fail(res,e);}
 });
 router.put(prefix+'/campaigns/:id/creatives/:kind/:creativeId',async(req,res)=>{
  try{
   const campaign=await owned(req,req.params.id,role);await mutable(campaign);
   if(!oid(req.params.creativeId))throw issue('Invalid creative id');
   const model=req.params.kind==='banner'?Banner:req.params.kind==='audio'?Audio:null;
   if(!model)throw issue('Invalid creative type');
   const patch=creativeFields(req.params.kind,req.body,campaign);
   const row=await model.findOneAndUpdate({_id:req.params.creativeId,
    agencyId:campaign.agencyId,campaignId:campaign._id,status:'draft',
    isStageCreative:true},{$set:patch},{new:true,runValidators:true});
   if(!row)throw issue('Το δημιουργικό δεν είναι πλέον επεξεργάσιμο.',409);
   await invalidateQuotes(campaign);
   res.json(row);
  }catch(e){fail(res,e);}
 });
 router.delete(prefix+'/campaigns/:id/creatives/:kind/:creativeId',async(req,res)=>{
  try{
   const campaign=await owned(req,req.params.id,role);await mutable(campaign);
   if(!oid(req.params.creativeId))throw issue('Invalid creative id');
   const model=req.params.kind==='banner'?Banner:req.params.kind==='audio'?Audio:null;
   if(!model)throw issue('Invalid creative type');
   const deleted=await model.findOneAndDelete({_id:req.params.creativeId,
    agencyId:campaign.agencyId,campaignId:campaign._id,status:'draft',
    isStageCreative:true});
   if(!deleted)throw issue('Το δημιουργικό δεν είναι πλέον επεξεργάσιμο.',409);
   await invalidateQuotes(campaign);
   res.json({deleted:true});
  }catch(e){fail(res,e);}
 });
 router.post(prefix+'/campaigns/:id/submit',async(req,res)=>{
  try{
   if(role==='agency')
    throw issue('Η καμπάνια υποβάλλεται αυτόματα μετά την επαλήθευση πληρωμής Nexi.',409);
   const campaign=await owned(req,req.params.id,role);
   if(!['draft','pending'].includes(campaign.approvalStatus))
    throw issue('Η καμπάνια έχει ήδη ολοκληρωθεί.',409);
   if(role==='admin'&&campaign.approvalStatus==='pending')
    throw issue('Η καμπάνια έχει ήδη υποβληθεί.',409);
   if(await countCreatives(campaign)<1)throw issue('Πρόσθεσε πρώτα τουλάχιστον ένα δημιουργικό.',409);
   if(!Number.isSafeInteger(campaign.plannedBudgetCents)||campaign.plannedBudgetCents<1)
    throw issue('Δεν έχει οριστεί budget.',409);
   // An Admin manages their OWN creative directly, without Checkout or false
   // Nexi funding lots. Paid CPM eligibility remains financial-ledger guarded.
   const now=new Date();
   await Campaign.updateOne({_id:campaign._id,approvalStatus:'draft'},
    {$set:{approvalStatus:'approved',submittedAt:now,approvedAt:now,
      approvedBy:req.user._id}});
   await Promise.all([
    Banner.updateMany({campaignId:campaign._id,agencyId:campaign.agencyId,
     status:'draft',isStageCreative:true},{$set:{status:'active',isActive:true}}),
    Audio.updateMany({campaignId:campaign._id,agencyId:campaign.agencyId,
     status:'draft',isStageCreative:true},{$set:{status:'active'}})
   ]);
   return res.json({status:'approved',submitted:true,adminNoPayment:true,
    note:'Η Admin καμπάνια δεν έχει πληρωμένο CPM budget.'});
  }catch(e){fail(res,e);}
 });
}
router.get('/admin/advertising/wizard/campaigns/:id/creatives-review',
 protect,async(req,res)=>{
 if(process.env.APP_ENV!=='staging'||req.user.role!=='admin')
  return res.status(403).json({error:'Admin only'});
 try{
  const campaign=await Campaign.findOne({_id:req.params.id,isStageCampaign:true,deletedAt:null});
  if(!campaign)return res.status(404).json({error:'Not found'});
  res.json(await loadCreatives(campaign));
 }catch(e){fail(res,e);}
});
router.put('/admin/advertising/wizard/campaigns/:id/creatives-review/:kind/:creativeId',
 protect,async(req,res)=>{
 if(process.env.APP_ENV!=='staging'||req.user.role!=='admin')
  return res.status(403).json({error:'Admin only'});
 try{
  const campaign=await Campaign.findOne({_id:req.params.id,isStageCampaign:true,
   deletedAt:null,approvalStatus:'pending'});
  if(!campaign)throw issue('Η καμπάνια δεν είναι σε αναμονή έγκρισης.',409);
  const funded=await Lot.exists({campaignId:campaign._id,source:'nexi_verified'});
  if(!funded&&campaign.createdByRole!=='admin')
   throw issue('Απαιτείται επαληθευμένη πληρωμή.',409);
  if(!oid(req.params.creativeId))throw issue('Invalid creative id');
  const Model=req.params.kind==='banner'?Banner:req.params.kind==='audio'?Audio:null;
  if(!Model)throw issue('Invalid creative kind');
  const decision=req.body?.approval;
  if(!['approved','rejected'].includes(decision))throw issue('Invalid review decision');
  const set=decision==='approved'?{status:'active',...(Model===Banner?{isActive:true}:{})}:
   {status:'rejected',...(Model===Banner?{isActive:false}:{})};
  const row=await Model.findOneAndUpdate({_id:req.params.creativeId,
   campaignId:campaign._id,agencyId:campaign.agencyId,status:'pending',
   isStageCreative:true},{$set:set},{new:true});
  if(!row)throw issue('Το δημιουργικό έχει ήδη αξιολογηθεί.',409);
  res.json(row);
 }catch(e){fail(res,e);}
});
module.exports=router;
