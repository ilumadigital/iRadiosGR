'use strict';
const mongoose=require('mongoose');
const User=require('../models/User');
const Station=require('../models/Station');
const Inbox=require('../models/ListenerInbox');
const {normalize,followKey}=require('../utils/programFollows');
const {safePath}=require('../utils/notificationDelivery');
const validId=id=>mongoose.isValidObjectId(id)&&String(id).length===24;
const format=doc=>({id:String(doc._id),kind:doc.kind,key:doc.key,label:doc.label,
  stationId:String(doc.stationId),stationName:doc.stationName,stationSlug:doc.stationSlug,
  createdAt:doc.createdAt});
const safeText=value=>typeof value==='string'&&value.length<=150&&value.trim()&&!/[<>\r\n]/.test(value);
const fail=(res,error)=>{console.error('[LISTENER CENTER]',error.message);res.status(500).json({error:'Δεν ήταν δυνατή η ολοκλήρωση της ενέργειας.'});};

exports.listFollows=async(req,res)=>{
  try{
    const user=await User.findById(req.user._id).select('followedPrograms').lean();
    if(!user)return res.status(404).json({error:'Ο λογαριασμός δεν βρέθηκε.'});
    res.set('Cache-Control','no-store');
    res.json({follows:(user.followedPrograms||[]).map(format).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))});
  }catch(error){fail(res,error);}
};
exports.follow=async(req,res)=>{
  const {kind,stationId,label}=req.body||{};
  if(!['show','dj'].includes(kind)||!validId(stationId)||!safeText(label))
    return res.status(400).json({error:'Επίλεξε έγκυρη εκπομπή ή παραγωγό.'});
  try{
    const station=await Station.findOne({_id:stationId,status:'approved'})
      .select('_id name slug schedule').lean();
    if(!station)return res.status(404).json({error:'Ο σταθμός δεν είναι διαθέσιμος.'});
    // Only approved, actually scheduled DJs/shows are followable.
    const row=(station.schedule||[]).find(entry=>normalize(kind==='show'?entry.title:entry.host)===normalize(label));
    if(!row)return res.status(400).json({error:'Η εκπομπή ή ο παραγωγός δεν υπάρχει στο πρόγραμμα.'});
    const canonical=kind==='show'?row.title:row.host;
    const key=followKey(kind,station._id,canonical);
    if(!key)return res.status(400).json({error:'Μη έγκυρη καταχώριση.'});
    const follow={kind,key,label:canonical,stationId:station._id,stationName:station.name,
      stationSlug:station.slug||'',createdAt:new Date()};
    const updated=await User.findOneAndUpdate({
      _id:req.user._id,'followedPrograms.key':{$ne:key},'followedPrograms.99':{$exists:false}
    },{$push:{followedPrograms:follow}},{new:true,runValidators:true}).select('followedPrograms');
    let state=updated;
    if(!state){
      state=await User.findById(req.user._id).select('followedPrograms');
      if(!state)return res.status(404).json({error:'Ο χρήστης δεν βρέθηκε.'});
      if(!(state.followedPrograms||[]).some(f=>f.key===key))
        return res.status(409).json({error:'Έχεις φτάσει το όριο 100 εκπομπών και παραγωγών.'});
    } else {
      try{
        await Inbox.create({
          recipient:req.user._id,topic:'system',
          title:kind==='dj'?'Ακολουθείς τον παραγωγό '+canonical:'Ακολουθείς την εκπομπή '+canonical,
          body:'Θα βρίσκεις τις ενημερώσεις σου εδώ, ανάλογα με τις προτιμήσεις ειδοποιήσεων.',
          path:'/station/'+encodeURIComponent(station.slug||String(station._id)),
          eventKey:'follow:'+key+':'+Date.now()
        });
      }catch(error){console.warn('[INBOX] Follow confirmation not saved:',error.message);}
    }
    res.set('Cache-Control','no-store');
    res.json({followed:true,key,follows:(state.followedPrograms||[]).map(format)});
  }catch(error){fail(res,error);}
};
exports.unfollow=async(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Μη έγκυρη παρακολούθηση.'});
  try{
    const updated=await User.findOneAndUpdate({
      _id:req.user._id,'followedPrograms._id':req.params.id
    },{$pull:{followedPrograms:{_id:req.params.id}}},{new:true}).select('followedPrograms');
    if(!updated)return res.status(404).json({error:'Η παρακολούθηση δεν βρέθηκε.'});
    res.set('Cache-Control','no-store');
    res.json({follows:(updated.followedPrograms||[]).map(format)});
  }catch(error){fail(res,error);}
};
exports.inbox=async(req,res)=>{
  const before=req.query?.before;
  if(before&&!validId(before))return res.status(400).json({error:'Μη έγκυρη σελιδοποίηση.'});
  try{
    const where={recipient:req.user._id,...(before?{_id:{$lt:new mongoose.Types.ObjectId(before)}}:{})};
    const rows=await Inbox.find(where).select('topic title body path readAt createdAt')
      .sort({_id:-1}).limit(26).lean();
    const unread=await Inbox.countDocuments({recipient:req.user._id,readAt:null});
    res.set('Cache-Control','no-store');
    res.json({items:rows.slice(0,25).map(item=>({
      id:String(item._id),topic:item.topic,title:item.title,body:item.body,
      path:safePath(item.path),readAt:item.readAt,createdAt:item.createdAt
    })),unread,nextCursor:rows.length>25?String(rows[24]._id):null});
  }catch(error){fail(res,error);}
};
exports.unreadCount=async(req,res)=>{
  try{
    res.set('Cache-Control','no-store');
    res.json({unread:await Inbox.countDocuments({recipient:req.user._id,readAt:null})});
  }catch(error){fail(res,error);}
};
exports.markRead=async(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Μη έγκυρη ειδοποίηση.'});
  try{
    const entry=await Inbox.findOneAndUpdate({_id:req.params.id,recipient:req.user._id,readAt:null},
      {$set:{readAt:new Date()}},{new:true});
    if(!entry){
      const present=await Inbox.exists({_id:req.params.id,recipient:req.user._id});
      if(!present)return res.status(404).json({error:'Η ειδοποίηση δεν βρέθηκε.'});
    }
    res.json({success:true});
  }catch(error){fail(res,error);}
};
exports.markAllRead=async(req,res)=>{
  try{
    const changed=await Inbox.updateMany({recipient:req.user._id,readAt:null},{$set:{readAt:new Date()}});
    res.json({success:true,count:changed.modifiedCount||0});
  }catch(error){fail(res,error);}
};
exports.remove=async(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Μη έγκυρη ειδοποίηση.'});
  try{
    const changed=await Inbox.deleteOne({_id:req.params.id,recipient:req.user._id});
    if(!changed.deletedCount)return res.status(404).json({error:'Η ειδοποίηση δεν βρέθηκε.'});
    res.json({success:true});
  }catch(error){fail(res,error);}
};
exports.clear=async(req,res)=>{
  try{
    const result=await Inbox.deleteMany({recipient:req.user._id});
    res.json({success:true,count:result.deletedCount||0});
  }catch(error){fail(res,error);}
};
