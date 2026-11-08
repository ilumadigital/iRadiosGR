const Subscription = require('../models/Subscription');
const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails('mailto:info@iluma.gr', vapidPublicKey, vapidPrivateKey);

exports.getVapidKey = (req, res) => { 
  res.send(vapidPublicKey); 
};

exports.subscribe = async (req, res) => {
  try {
    const {subscription}=req.body||{};
    if(!subscription?.endpoint || typeof subscription.endpoint!=='string' ||
       !/^https:\/\//i.test(subscription.endpoint) || subscription.endpoint.length>2048 ||
       !subscription?.keys?.p256dh || !subscription?.keys?.auth)
      return res.status(400).json({error:'Μη έγκυρη εγγραφή.'});
    // Legacy public registration is anonymous. Client-supplied userId is
    // intentionally ignored, so it can never attach a device to another user.
    await Subscription.findOneAndUpdate(
      {endpoint:subscription.endpoint},
      {$set:{endpoint:subscription.endpoint,expirationTime:subscription.expirationTime||null,
        keys:{p256dh:subscription.keys.p256dh,auth:subscription.keys.auth},userId:null}},
      {upsert:true,new:true,runValidators:true}
    );
    res.status(201).json({ message: 'Επιτυχής εγγραφή.' });
  } catch (error) { res.status(500).json({ error: 'Σφάλμα κατά την εγγραφή.' }); }
};


const {notificationPreferencesOf,canNotify,TOPICS}=require('../utils/notificationPreferences');

const verifyEndpoint = value => typeof value === 'string' && value.length < 2048
  && /^https:\/\//i.test(value);

// Authenticated per-user subscription lifecycle. Never trust userId from the browser.
exports.registerMyDevice = async(req,res)=>{
  if(process.env.APP_ENV==='staging')return res.status(503).json({error:'Οι πραγματικές push εγγραφές είναι απενεργοποιημένες στο staging.'});
  const sub=req.body?.subscription;
  if(!verifyEndpoint(sub?.endpoint)||!sub?.keys?.p256dh||!sub?.keys?.auth)
    return res.status(400).json({error:'Μη έγκυρη εγγραφή συσκευής.'});
  if(!canNotify(req.user,'push','shows') && !canNotify(req.user,'push','newStations') &&
     !canNotify(req.user,'push','news') && !canNotify(req.user,'push','favoriteSchedule') &&
     !canNotify(req.user,'push','promotions'))
    return res.status(409).json({error:'Ενεργοποίησε πρώτα μία κατηγορία push ειδοποιήσεων.'});
  try {
    await Subscription.findOneAndUpdate({endpoint:sub.endpoint},
      {$set:{endpoint:sub.endpoint,expirationTime:sub.expirationTime||null,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth},userId:req.user._id}},
      {upsert:true,new:true,runValidators:true});
    res.status(201).json({success:true});
  }catch(e){
    console.error('[PUSH] Register device failed:',e.message);
    res.status(500).json({error:'Δεν αποθηκεύτηκε η συσκευή.'});
  }
};

exports.removeMyDevice = async(req,res)=>{
  const endpoint=req.body?.endpoint;
  if(!verifyEndpoint(endpoint))return res.status(400).json({error:'Μη έγκυρο αναγνωριστικό συσκευής.'});
  try{
    await Subscription.deleteOne({endpoint,userId:req.user._id});
    return res.json({success:true});
  }catch(e){return res.status(500).json({error:'Δεν ήταν δυνατή η αφαίρεση της συσκευής.'});}
};

exports.checkMyDevice = async(req,res)=>{
  const endpoint=req.body?.endpoint;
  if(!verifyEndpoint(endpoint))return res.status(400).json({error:'Μη έγκυρο αναγνωριστικό συσκευής.'});
  const enabled=Boolean(await Subscription.exists({endpoint,userId:req.user._id}));
  return res.json({registered:enabled});
};

exports.getStats = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const subs = await Subscription.find({}).populate('userId', 'role isPremium broadcasterProfile');
    let all = subs.length;
    let premium = 0; let broadcasters = 0;

    subs.forEach(sub => {
      if (sub.userId) {
        if (sub.userId.isPremium || sub.userId.broadcasterProfile?.tier === 'premium') premium++;
        if (sub.userId.role === 'broadcaster') broadcasters++;
      }
    });
    res.json({ all, premium, broadcasters }); 
  } catch (error) { res.status(500).json({ error: 'Σφάλμα λήψης στατιστικών' }); }
};

exports.sendNotification = async (req,res)=>{
  const {title,body,topic='promotions',alsoEmail=false}=req.body||{};
  if(!TOPICS.includes(topic)||typeof title!=='string'||!title.trim()||title.length>140||
     typeof body!=='string'||!body.trim()||body.length>600||typeof alsoEmail!=='boolean') {
    return res.status(400).json({error:'Συμπλήρωσε έγκυρη κατηγορία και μήνυμα.'});
  }
  try{
    const {deliver}=require('../utils/notificationDelivery');
    const result=await deliver({topic,title,body,channels:alsoEmail?['push','email']:['push']});
    res.json({message:'Η αποστολή ολοκληρώθηκε.',...result});
  }catch(e){
    console.error('[NOTIFY] Manual admin dispatch failed:',e.message);
    res.status(500).json({error:'Η αποστολή δεν ολοκληρώθηκε.'});
  }
};
