'use strict';
const express = require('express');
const mongoose = require('mongoose');
const Station = require('../models/Station');
const Quota = require('../models/StationContactQuota');
const { protect } = require('../utils/authMiddleware');
const { sendEmail } = require('../utils/myMailer');
const { buildStationContactEmail } = require('../utils/stationContactEmail');

const router = express.Router();
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Unique index + conditional upsert enforce quotas across multiple Node workers.
// An upsert collision means the existing entry cannot pass the quota/cooldown.
async function reserveQuota(userId, stationId, day, max, cooldown) {
  const now = new Date();
  const filter = { userId, stationId, day, count: { $lt: max } };
  if (cooldown) filter.$or = [
    { lastAttemptAt: { $lte:new Date(now.getTime()-cooldown) } },
    { lastAttemptAt: { $exists:false } }
  ];
  try {
    await Quota.findOneAndUpdate(filter,
      { $inc:{count:1}, $set:{lastAttemptAt:now} },
      { new:true, upsert:true, setDefaultsOnInsert:true });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

router.post('/stations/:id/contact', protect, async (req,res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({error:'Μη έγκυρος σταθμός.'});
    const subject=req.body?.subject;
    if (typeof subject !== 'string' || subject.trim().length < 4 ||
        subject.trim().length > 120 || /[\r\n\u0000-\u001F\u007F]/.test(subject))
      return res.status(400).json({error:'Το θέμα πρέπει να έχει 4 έως 120 χαρακτήρες.'});
    const message=req.body?.message;
    if (typeof message !== 'string' || message.trim().length < 10 ||
        message.trim().length > 2000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message))
      return res.status(400).json({error:'Το μήνυμα πρέπει να έχει 10 έως 2.000 χαρακτήρες.'});
    // Recipient and identity are trusted database data, not client-supplied fields.
    const station=await Station.findOne({_id:req.params.id,status:'approved'}).select('name email slug');
    if(!station || !EMAIL.test(String(station.email||'').trim()))
      return res.status(404).json({error:'Δεν υπάρχει email επικοινωνίας για τον σταθμό.'});
    const senderEmail=String(req.user.email||'').trim();
    if(!EMAIL.test(senderEmail) || /[\r\n]/.test(senderEmail))
      return res.status(400).json({error:'Απαιτείται έγκυρο email λογαριασμού.'});
    // Never present a preview-only Ethereal message as a production delivery.
    if(process.env.APP_ENV !== 'staging' &&
      !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS))
      return res.status(503).json({error:'Η υπηρεσία email δεν είναι διαθέσιμη.'});
    const day=new Date().toISOString().slice(0,10);
    if(!(await reserveQuota(req.user._id,null,day,16,0)) ||
       !(await reserveQuota(req.user._id,station._id,day,4,120000))) {
      res.set('Retry-After','120');
      return res.status(429).json({error:'Έχεις στείλει αρκετά μηνύματα. Δοκίμασε λίγο αργότερα.'});
    }
    const fullName=[req.user.fname,req.user.lname].filter(Boolean).join(' ').trim();
    const senderName=fullName && fullName!=='iR User' ? fullName : String(req.user.username||'Ακροατής');
    const letter=buildStationContactEmail({
      stationName:station.name, senderName, senderEmail, subject:subject.trim(), message:message.trim()
    });
    const delivery=await sendEmail({to:station.email.trim(),replyTo:senderEmail,...letter});
    if(!delivery.success) {
      console.error('[StationContact] Delivery failed for',String(station._id));
      return res.status(503).json({error:'Η αποστολή απέτυχε. Δοκίμασε ξανά.'});
    }
    return res.json({success:true});
  } catch(error) {
    console.error('[StationContact] Failed:',error);
    return res.status(500).json({error:'Δεν ήταν δυνατή η αποστολή.'});
  }
});
module.exports=router;
