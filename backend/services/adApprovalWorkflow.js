'use strict';
const {randomUUID}=require('crypto');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const Event=require('../models/AdApprovalEvent');
const {validAgencyGeo}=require('./adGeoTargeting');
const {sanitizeAdDesign}=require('./adDesignRules');
const models={banner:Banner,audio:Audio};
const trackedFields={
 banner:['title','description','imageUrl','squareImageUrl','targetUrl','placement',
  'targetLocations','targetCountry','targetRegion','logoUrl','ctaLabel',
  'brandColor','focalX','focalY','designConfig'],
 audio:['title','client','audioUrl','logoUrl','linkUrl','frequency',
  'targetLocations','targetCountry','targetRegion','dspPreset']
};
const stringify=value=>JSON.stringify(value??null);
function changed(doc,patch){
 return Object.entries(patch).filter(([key,value])=>stringify(doc[key])!==stringify(value))
  .map(([field,after])=>({field,before:doc[field]??null,after}));
}
const quote=doc=>Object.fromEntries(['targetCountry','targetRegion','targetLocations']
 .filter(key=>doc?.[key]!==undefined).map(key=>[key,doc[key]]));
async function event({kind,type,doc,agencyId,actorId,revisionId,isRevision,changes=[],reason=''}) {
 const ref=String(doc._id);
 const item={eventKey:[kind,type,ref,revisionId].join(':'),kind,adType:type,
  adId:doc._id,agencyId,actorId,revisionId,isRevision,
  title:String(doc.title||'Campaign').slice(0,200),changes,reason,
  reviewState:kind==='submitted'?'pending':kind==='approved'?'approved':'rejected'};
 try {return await Event.create(item);}
 catch(error){if(error.code===11000)return null;throw error;}
}
async function notifySubmission({type,doc,agencyId,actorId,revisionId,isRevision,changes}) {
 return event({kind:'submitted',type,doc,agencyId,actorId,revisionId,isRevision,changes});
}
async function revise({type,id,agencyId,patch}) {
 const Model=models[type];
 if(!Model)throw Object.assign(Error('Invalid type'),{http:400});
 const doc=await Model.findOne({_id:id,agencyId,isStageCreative:true});
 if(!doc)throw Object.assign(Error('Δεν βρέθηκε η καμπάνια.'),{http:404});
 if(!['active','pending','rejected'].includes(doc.status))
  throw Object.assign(Error('Δεν επιτρέπονται αλλαγές σε ληγμένη καμπάνια.'),{http:409});
 // Ignore any client status, prices, ownership or approval fields.
 const clean=Object.fromEntries(Object.entries(patch).filter(([key])=>trackedFields[type].includes(key)));
 if(clean.designConfig!==undefined)clean.designConfig=sanitizeAdDesign(clean.designConfig);
 if(!Object.keys(clean).length)throw Object.assign(Error('Δεν δόθηκαν αλλαγές.'),{http:400});
 if(!validAgencyGeo({...quote(doc),...quote(clean)}))
  throw Object.assign(Error('Επίλεξε χώρα, περιφέρεια ή νομό — όχι πόλη.'),{http:400});
 const changes=changed(doc,clean);
 if(!changes.length)throw Object.assign(Error('Δεν υπάρχουν νέες αλλαγές.'),{http:400});
 const revisionId=randomUUID(),isRevision=doc.status==='active';
 const cond={_id:doc._id,agencyId,isStageCreative:true,status:doc.status,__v:doc.__v};
 const operation=isRevision?
  {$set:{pendingRevision:{id:revisionId,patch:clean,changes,submittedAt:new Date(),submittedBy:agencyId}},$inc:{__v:1}}:
  {$set:{...clean,status:'pending',...(type==='banner'?{isActive:false}:{})},$inc:{__v:1}};
 const updated=await Model.findOneAndUpdate(cond,operation,{new:true,runValidators:true});
 if(!updated)throw Object.assign(Error('Η καμπάνια άλλαξε ταυτόχρονα. Φόρτωσε ξανά.'),{http:409});
 if(doc.pendingRevision?.id){
  await Event.updateOne({adType:type,adId:doc._id,revisionId:doc.pendingRevision.id,
   kind:'submitted',reviewState:'pending'},{$set:{reviewState:'superseded'}});
 }
 await notifySubmission({type,doc:updated,agencyId,actorId:agencyId,revisionId,isRevision,changes});
 return updated;
}
function expiry(duration){
 const at=new Date();
 if(duration==='day')at.setDate(at.getDate()+1);
 else if(duration==='year')at.setFullYear(at.getFullYear()+1);
 else at.setMonth(at.getMonth()+1);
 return at;
}
async function decision({type,id,actorId,approve,reason=''}) {
 const Model=models[type];
 const doc=await Model.findById(id);
 if(!doc)throw Object.assign(Error('Η διαφήμιση δεν βρέθηκε.'),{http:404});
 if(process.env.APP_ENV==='staging'&&doc.isStageCreative!==true)
  throw Object.assign(Error('Μόνο staging creatives επιτρέπονται.'),{http:409});
 if(!approve&&(!reason||reason.trim().length<4||reason.length>600))
  throw Object.assign(Error('Συμπλήρωσε λόγο απόρριψης (4–600 χαρακτήρες).'),{http:400});
 const pending=doc.pendingRevision;
 const revisionId=pending?.id||String((await Event.findOne({adType:type,adId:doc._id,kind:'submitted'})
   .sort({createdAt:-1}).lean())?.revisionId||doc._id);
 let operation,query={_id:doc._id,__v:doc.__v};
 if(doc.status==='active'&&pending?.id){
  query['pendingRevision.id']=pending.id;
  if(approve){
   if(!validAgencyGeo({...quote(doc),...quote(pending.patch)}))
    throw Object.assign(Error('Μη έγκυρη γεωγραφική στόχευση.'),{http:400});
   operation={$set:{...pending.patch},$unset:{pendingRevision:1},$inc:{__v:1}};
  }else operation={$unset:{pendingRevision:1},$inc:{__v:1}};
 }else if(doc.status==='pending'){
  query.status='pending';
  operation=approve?
   {$set:{status:'active',...(type==='banner'?{isActive:true}:{}),
      expiresAt:expiry(doc.duration)},$inc:{__v:1}}:
   {$set:{status:'rejected',...(type==='banner'?{isActive:false}:{})},$inc:{__v:1}};
 }else{
  throw Object.assign(Error('Δεν υπάρχουν αλλαγές προς έγκριση.'),{http:409});
 }
 const updated=await Model.findOneAndUpdate(query,operation,{new:true,runValidators:true});
 if(!updated)throw Object.assign(Error('Η έγκριση άλλαξε ταυτόχρονα. Φόρτωσε ξανά.'),{http:409});
 if(doc.agencyId){
  await Event.updateOne({adType:type,adId:doc._id,revisionId,kind:'submitted',reviewState:'pending'},
   {$set:{reviewState:approve?'approved':'rejected'}});
  await event({kind:approve?'approved':'rejected',type,doc:updated,agencyId:doc.agencyId,
   actorId,revisionId,isRevision:Boolean(pending),changes:pending?.changes||[],reason});
 }
 return updated;
}
module.exports={revise,decision,notifySubmission,changed};
