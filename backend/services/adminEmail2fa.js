'use strict';
// Every Admin password login requires a NEW six-digit email challenge.
// The only recipient is hard-coded here, never taken from the account or request.
const crypto=require('node:crypto');
const jwt=require('jsonwebtoken');
const RECIPIENT='sales@iluma.gr';
const CODE_TTL_MS=10*60*1000;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function codeHash(userId,challenge,code){
 const secret=process.env.JWT_SECRET;
 if(typeof secret!=='string'||secret.length<32)throw Error('Admin 2FA signing secret unavailable');
 return crypto.createHmac('sha256',secret).update('admin-email-2fa:'+String(userId)+':'+challenge+':'+code).digest('hex');
}
class Admin2FAError extends Error{
 constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
const clear={$unset:{adminOtpChallengeHash:'',adminOtpCodeHash:'',adminOtpExpiresAt:'',adminOtpAttempts:''}};
async function issueChallenge(User,user,{deliver}={}){
 if(!user?._id||user.role!=='admin')throw new Admin2FAError(403,'ADMIN_ONLY','Διαθέσιμο μόνο για Admin.');
 const now=new Date(),challenge=crypto.randomBytes(32).toString('hex');
 const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
 const stored=await User.findOneAndUpdate({_id:user._id,role:'admin',
  $or:[{adminOtpLastSentAt:{$exists:false}},{adminOtpLastSentAt:null},
       {adminOtpLastSentAt:{$lte:new Date(now.getTime()-60000)}}]},
  {$set:{adminOtpChallengeHash:hash(challenge),
    adminOtpCodeHash:codeHash(user._id,challenge,code),
    adminOtpExpiresAt:new Date(now.getTime()+CODE_TTL_MS),
    adminOtpAttempts:0,adminOtpLastSentAt:now}},
  {new:true}).select('_id');
 if(!stored)throw new Admin2FAError(429,'ADMIN_2FA_RATE_LIMIT',
  'Έχει σταλεί κωδικός. Περίμενε ένα λεπτό πριν ζητήσεις νέο.');
 try{
  const send=deliver||require('./adminOtpMail').sendAdminOtpEmail;
  if(!await send({code,username:user.username||''}))
   throw Error('Admin OTP email not accepted by SMTP');
 }catch(error){
  // Do not permit verification after an unconfirmed SMTP delivery.
  await User.updateOne({_id:user._id,role:'admin',adminOtpChallengeHash:hash(challenge)},
   {$unset:{...clear.$unset,adminOtpLastSentAt:''}}).catch(()=>{});
  throw new Admin2FAError(503,'ADMIN_2FA_DELIVERY_FAILED',
   'Δεν παραδόθηκε ο κωδικός στο sales@iluma.gr. Έλεγξε το Admin SMTP.');
 }
 return {challenge,expiresInSeconds:CODE_TTL_MS/1000,recipient:RECIPIENT};
}
async function verifyChallenge(User,{challenge,code}={}){
 if(typeof challenge!=='string'||!/^[a-f0-9]{64}$/.test(challenge)||
  typeof code!=='string'||!/^[0-9]{6}$/.test(code))
  throw new Admin2FAError(400,'ADMIN_2FA_INVALID','Μη έγκυρος κωδικός επαλήθευσης.');
 const digest=hash(challenge),now=new Date();
 // Atomic compare-and-consume ensures a code cannot be replayed twice.
 // Increment a per-challenge counter on failure, even across API workers.
 const record=await User.findOne({
  role:'admin',adminOtpChallengeHash:digest,
  adminOtpExpiresAt:{$gt:now},adminOtpAttempts:{$lt:5}
 }).select('+adminOtpCodeHash _id role');
 if(!record)throw new Admin2FAError(401,'ADMIN_2FA_REJECTED','Ο κωδικός είναι λάθος ή έχει λήξει.');
 const expected=codeHash(record._id,challenge,code);
 const matches=typeof record.adminOtpCodeHash==='string' &&
   crypto.timingSafeEqual(Buffer.from(expected,'hex'),
     Buffer.from(record.adminOtpCodeHash.padEnd(64,'0').slice(0,64),'hex'));
 if(!matches){
  await User.updateOne({_id:record._id,role:'admin',adminOtpChallengeHash:digest,
    adminOtpAttempts:{$lt:5}},{$inc:{adminOtpAttempts:1}});
  throw new Admin2FAError(401,'ADMIN_2FA_REJECTED','Ο κωδικός είναι λάθος ή έχει λήξει.');
 }
 const consumed=await User.findOneAndUpdate({_id:record._id,role:'admin',
  adminOtpChallengeHash:digest,adminOtpCodeHash:expected,
  adminOtpExpiresAt:{$gt:new Date()},adminOtpAttempts:{$lt:5}},
  clear,{new:true});
 if(!consumed)throw new Admin2FAError(401,'ADMIN_2FA_REJECTED','Ο κωδικός είναι λάθος ή χρησιμοποιήθηκε ήδη.');
 const secret=process.env.JWT_SECRET;
 const token=jwt.sign({id:consumed._id,role:'admin',admin2fa:true},
  secret,{expiresIn:'12h'});
 return {token,user:consumed};
}
module.exports={RECIPIENT,issueChallenge,verifyChallenge,Admin2FAError};
