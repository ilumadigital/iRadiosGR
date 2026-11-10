const User = require('../models/User');
const {projectAccountUser}=require('../services/billingEntitlements');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const BroadcasterInvitation = require('../models/BroadcasterInvitation'); // 🟢 ΝΕΟ: Για τη δημιουργία του token ανάκτησης
const { sendEmail } = require('../utils/myMailer');
const { otpVerificationEmail, verificationLinkEmail, welcomeEmail, passwordResetEmail } = require('../utils/mailTemp');
const { createEmailVerification, hashEmailVerificationToken } = require('../utils/emailVerification'); // 🟢 ΝΕΟ: Import το νέο template

const JWT_SECRET = process.env.JWT_SECRET;
const {
  CURRENT_BROADCASTER_TERMS_VERSION,
  hasAcceptedCurrentBroadcasterTerms,
  withBroadcasterTermsStatus
} = require('../utils/broadcasterTerms');
const FRONTEND_URL = process.env.FRONTEND_URL || '__IRADIOS_SITE_ORIGIN__'; // Για το link του email

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.verifyVat = async (req, res) => {
  try {
    const { countryCode, vat } = req.params;
    const viesRes = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vat}`);
    const data = await viesRes.json();
    res.json(data);
  } catch (error) { 
    res.status(500).json({ error: "Το σύστημα VIES είναι προσωρινά μη διαθέσιμο." }); 
  }
};

exports.registerAgency = async (req, res) => {
  try {
    const { 
      username, email, password, fname, lname, phone, 
      businessType, vatNumber, companyName, countryCode 
    } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: "Ο χρήστης ή το email υπάρχει ήδη" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 15 * 60000); 

    const newUser = new User({
      username, email, password: hashedPassword, fname, lname, phone: phone || "", role: 'agency',
      isVerified: false, verificationOtp: otp, otpExpires,
      agencyProfile: { businessType, vatNumber, companyName, countryCode }
    });

    await newUser.save();

    const emailData = otpVerificationEmail(fname, otp);
    await sendEmail({
      to: email, subject: "Επαλήθευση Λογαριασμού Agency - iRadios", html: emailData.html
    });

    res.status(201).json({ message: "Ελέγξτε το email σας για τον κωδικό OTP!", requireOtp: true });
  } catch (err) {
    console.error("Agency Register Error:", err);
    res.status(500).json({ error: "Σφάλμα κατά την εγγραφή του Agency" });
  }
};

exports.register = async (req, res) => {
  try {
    const body=req.body||{};
    const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const fname=typeof body.fname==='string'?body.fname.trim():'';
    const lname=typeof body.lname==='string'?body.lname.trim():'';
    const password=body.password;
    const birthdate=body.birthdate;
    const phone=typeof body.phone==='string'?body.phone.trim():'';

    if(!/^[a-z0-9_.-]{3,60}$/.test(username))
      return res.status(400).json({error:'Το username πρέπει να έχει 3–60 λατινικούς χαρακτήρες, αριθμούς, τελείες, παύλες ή κάτω παύλες.'});
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({error:'Συμπλήρωσε έγκυρη διεύθυνση email.'});
    if(!fname || !lname || fname.length>120 || lname.length>120)
      return res.status(400).json({error:'Συμπλήρωσε σωστά όνομα και επώνυμο.'});
    if(typeof password!=='string' ||
       !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%*]).{6,128}$/.test(password))
      return res.status(400).json({error:'Ο κωδικός πρέπει να περιλαμβάνει κεφαλαίο, πεζό, αριθμό και σύμβολο (!@#$%*).'});
    if(typeof birthdate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate))
      return res.status(400).json({error:'Συμπλήρωσε έγκυρη ημερομηνία γέννησης.'});
    const parsedDate=new Date(birthdate+'T00:00:00.000Z');
    if(!Number.isFinite(parsedDate.getTime()) ||
       parsedDate.toISOString().slice(0,10)!==birthdate || parsedDate.getTime()>Date.now())
      return res.status(400).json({error:'Η ημερομηνία γέννησης δεν είναι έγκυρη.'});

    // Escape dynamic email before matching historical accounts that used mixed case.
    const escaped=email.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
    const existingUser=await User.findOne({$or:[{email:new RegExp('^'+escaped+'$','i')},{username}]});
    if(existingUser)return res.status(409).json({error:'Το username ή το email χρησιμοποιείται ήδη. Δοκίμασε σύνδεση.'});

    const hashedPassword=await bcrypt.hash(password,10);
    const verification=createEmailVerification();
    const newUser=new User({
      username,email,password:hashedPassword,fname,lname,birthdate:parsedDate,phone,
      role:'user',isVerified:false,...verification.fields
    });
    await newUser.save();
    // Free is immediately usable even if SMTP/Mailpit delivery fails.
    const emailData=verificationLinkEmail(fname,verification.token);
    const delivery=await sendEmail({to:email,subject:emailData.subject,html:emailData.html});
    if(!delivery?.success)console.warn('[AUTH] Verification mail failed; user can resend later.');
    const token=jwt.sign({id:newUser._id,role:newUser.role},JWT_SECRET,{expiresIn:'30d'});
    res.set('Cache-Control','no-store');
    return res.status(201).json({
      message:'Ο λογαριασμός δημιουργήθηκε. Επιβεβαίωσε το email σου για να δεις playlists.',
      token,verificationEmailSent:!!delivery?.success,user:await projectAccountUser(newUser)
    });
  }catch(err){
    if(err?.code===11000)return res.status(409).json({error:'Το username ή το email χρησιμοποιείται ήδη.'});
    if(err?.name==='ValidationError')return res.status(400).json({error:'Κάποια στοιχεία εγγραφής δεν είναι έγκυρα. Έλεγξε τα πεδία.'});
    console.error('[AUTH] Listener registration failed:',err?.name||'unknown',err?.code||'');
    return res.status(500).json({error:'Η εγγραφή δεν ολοκληρώθηκε. Δοκίμασε ξανά ή επικοινώνησε με την υποστήριξη.'});
  }
};

exports.registerBroadcaster = async (req, res) => {
  try {
    const { username, email, password, fname, lname, phone, businessType, vatNumber, companyName, inviteToken } = req.body;
    // Optional invitation: reject mismatched/expired email BEFORE creating the account.
    // Normal broadcaster registration without a token remains unchanged.
    if (inviteToken !== undefined) {
      if (typeof inviteToken !== 'string' || !/^[a-f0-9]{64}$/i.test(inviteToken)) {
        return res.status(400).json({ error: 'Μη έγκυρη πρόσκληση Broadcaster.' });
      }
      const invited = await BroadcasterInvitation.findOne({
        tokenHash: crypto.createHash('sha256').update(inviteToken).digest('hex'),
        status: 'pending', expiresAt: { $gt: new Date() },
        email: String(email || '').trim().toLowerCase()
      });
      if (!invited) return res.status(409).json({ error: 'Η πρόσκληση έχει λήξει ή αφορά διαφορετικό email.' });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: "Ο χρήστης ή το email υπάρχει ήδη" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 15 * 60000); 

    const newUser = new User({
      username, email, password: hashedPassword, 
      fname, lname, phone: phone || "", 
      role: 'broadcaster', businessType, vatNumber, companyName,
      broadcasterProfile: { tier: 'free', maxStations: 3, features: { adControl: false, dspEngine: false, betaAccess: false, analytics: false } }, 
      isVerified: false, verificationOtp: otp, otpExpires
    });

    await newUser.save();

    const emailData = otpVerificationEmail(fname, otp);
    await sendEmail({
      to: email, subject: emailData.subject, html: emailData.html
    });

    res.status(201).json({ message: "Ελέγξτε το email σας για το OTP!", requireOtp: true });
  } catch (err) { res.status(500).json({ error: "Σφάλμα κατά την εγγραφή" }); }
};

exports.verifyOtp = async (req, res) => {
  try {
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    const otp=req.body?.otp;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "Ο χρήστης δεν βρέθηκε." });
    if (user.isVerified) return res.status(400).json({ error: "Ο λογαριασμός είναι ήδη ενεργός." });
    if (user.verificationOtp !== otp) return res.status(400).json({ error: "Λάθος κωδικός OTP." });
    if (new Date() > user.otpExpires) return res.status(400).json({ error: "Ο κωδικός έχει λήξει." });

    user.isVerified = true;
    user.verificationOtp = null;
    user.otpExpires = null;
    await user.save();

    const welcomeData = welcomeEmail(user.fname, (user.role === 'broadcaster' || user.role === 'agency'));
    await sendEmail({
      to: email, subject: welcomeData.subject, html: welcomeData.html
    }).catch(e => console.log("Welcome email fail, ignoring..."));

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ 
      message: "Επιτυχής επαλήθευση!", 
      token, 
      user: await projectAccountUser(withBroadcasterTermsStatus({
        _id: user._id, username: user.username, email: user.email, isVerified: user.isVerified, role: user.role, isPremium: user.isPremium,
        broadcasterProfile: user.broadcasterProfile, agencyProfile: user.agencyProfile,
        hasAcceptedTerms: user.hasAcceptedTerms, termsAcceptedAt: user.termsAcceptedAt,
        termsAcceptedVersion: user.termsAcceptedVersion
      })) 
    });
  } catch (err) { res.status(500).json({ error: "Σφάλμα επαλήθευσης." }); }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body; 
    const user = await User.findOne({ $or: [ { username: identifier }, { email: identifier } ] });
    if (!user) return res.status(401).json({ error: 'Λάθος στοιχεία σύνδεσης' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Λάθος στοιχεία σύνδεσης' });

    // Broadcaster/Agency retain OTP; unverified Free listeners can log in.
    if (!user.isVerified && user.role !== 'user') {
      const otp = generateOTP();
      user.verificationOtp = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60000);
      await user.save();

      const emailData = otpVerificationEmail(user.fname, otp);
      await sendEmail({
        to: user.email, subject: emailData.subject, html: emailData.html
      });

      return res.status(403).json({ 
        error: 'Ο λογαριασμός δεν έχει επιβεβαιωθεί. Στείλαμε νέο κωδικό!', requireOtp: true, email: user.email 
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: await projectAccountUser(withBroadcasterTermsStatus({
        _id: user._id, username: user.username, email: user.email, isVerified: user.isVerified, fname: user.fname, lname: user.lname,
        birthdate: user.birthdate, isPremium: user.isPremium, favorites: user.favorites, role: user.role,
        broadcasterProfile: user.broadcasterProfile, agencyProfile: user.agencyProfile,
        hasAcceptedTerms: user.hasAcceptedTerms, termsAcceptedAt: user.termsAcceptedAt,
        termsAcceptedVersion: user.termsAcceptedVersion
      }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// One-time token redemption, with no JWT or user details in public responses.
exports.verifyEmail = async (req,res)=>{
  const token=req.body?.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token))
    return res.status(400).json({error:'Μη έγκυρος σύνδεσμος επιβεβαίωσης.'});
  try{
    const user=await User.findOneAndUpdate({
      role:'user',isVerified:false,
      verificationTokenHash:hashEmailVerificationToken(token),
      verificationTokenExpires:{$gt:new Date()}
    },{$set:{isVerified:true},$unset:{
      verificationTokenHash:'',verificationTokenExpires:'',verificationEmailLastSentAt:'',
      verificationOtp:'',otpExpires:''
    }},{new:true});
    if(!user)return res.status(400).json({error:'Ο σύνδεσμος έχει λήξει ή χρησιμοποιήθηκε ήδη. Ζήτησε νέο link από τον λογαριασμό σου.'});
    const welcome=welcomeEmail(user.fname,false);
    sendEmail({to:user.email,subject:welcome.subject,html:welcome.html}).catch(()=>{});
    res.set('Cache-Control','no-store');
    return res.json({success:true,message:'Το email επιβεβαιώθηκε. Το playlist είναι διαθέσιμο.'});
  }catch(error){
    console.error('[AUTH] Verify email failed:',error?.name);
    return res.status(503).json({error:'Η επιβεβαίωση δεν ολοκληρώθηκε. Δοκίμασε ξανά.'});
  }
};

// Resend invalidates every earlier link, atomically limits requests to one/minute,
// and cannot be used to send mail to an address supplied by another user.
exports.resendVerificationEmail = async (req,res)=>{
  if(req.user?.role!=='user')return res.status(403).json({error:'Η λειτουργία αφορά λογαριασμούς ακροατών.'});
  if(req.user.isVerified)return res.json({alreadyVerified:true,message:'Το email έχει ήδη επιβεβαιωθεί.'});
  const now=new Date(),verification=createEmailVerification(now);
  try{
    const user=await User.findOneAndUpdate({
      _id:req.user._id,role:'user',isVerified:false,
      $or:[{verificationEmailLastSentAt:null},
        {verificationEmailLastSentAt:{$exists:false}},
        {verificationEmailLastSentAt:{$lte:new Date(now.getTime()-60000)}}]
    },{$set:verification.fields,$unset:{verificationOtp:'',otpExpires:''}},{new:true});
    if(!user){
      const fresh=await User.findById(req.user._id).select('isVerified');
      if(fresh?.isVerified)return res.json({alreadyVerified:true,message:'Το email έχει ήδη επιβεβαιωθεί.'});
      res.set('Retry-After','60');
      return res.status(429).json({error:'Περίμενε ένα λεπτό πριν ζητήσεις νέο σύνδεσμο.'});
    }
    const mail=verificationLinkEmail(user.fname,verification.token);
    const result=await sendEmail({to:user.email,subject:mail.subject,html:mail.html});
    if(!result?.success)return res.status(503).json({error:'Δεν στάλθηκε το email. Δοκίμασε ξανά αργότερα.'});
    res.set('Cache-Control','no-store');
    return res.json({success:true,message:'Στάλθηκε νέο link. Ο προηγούμενος σύνδεσμος ακυρώθηκε.'});
  }catch(error){
    console.error('[AUTH] Resend verification failed:',error?.name);
    return res.status(503).json({error:'Δεν ήταν δυνατή η επαναποστολή. Δοκίμασε ξανά.'});
  }
};

exports.getMe = async (req, res) => {
  // protect middleware verified the JWT and loaded this user from MongoDB.
  res.set('Cache-Control','private, no-store');
  return res.json(await projectAccountUser(req.user));
};

exports.updateMe = async (req, res) => {
  try {
    // The target account comes exclusively from the verified JWT.
    const keys=['username','email','fname','lname','phone','birthdate'];
    const patch={};
    for(const key of keys){
      if(!Object.prototype.hasOwnProperty.call(req.body||{},key))continue;
      if(typeof req.body[key]!=='string'||req.body[key].length>254)
        return res.status(400).json({error:'Μη έγκυρη τιμή στο '+key+'.'});
      patch[key]=req.body[key].trim();
    }
    if(patch.username!==undefined && (patch.username.length<3||patch.username.length>60))
      return res.status(400).json({error:'Το όνομα χρήστη πρέπει να έχει 3–60 χαρακτήρες.'});
    if(patch.email!==undefined){
      patch.email=patch.email.toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email))
        return res.status(400).json({error:'Συμπλήρωσε έγκυρο email.'});
    }
    if(patch.fname!==undefined && !patch.fname)
      return res.status(400).json({error:'Το όνομα είναι υποχρεωτικό.'});
    if(patch.lname!==undefined && !patch.lname)
      return res.status(400).json({error:'Το επώνυμο είναι υποχρεωτικό.'});
    if(Object.prototype.hasOwnProperty.call(patch,'birthdate')){
      if(patch.birthdate){
        const date=new Date(patch.birthdate);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(patch.birthdate)||!Number.isFinite(date.getTime()))
          return res.status(400).json({error:'Η ημερομηνία γέννησης δεν είναι έγκυρη.'});
        patch.birthdate=date;
      }else delete patch.birthdate; // Never overwrite an existing date with a fake year.
    }
    if(!Object.keys(patch).length)
      return res.status(400).json({error:'Δεν δόθηκαν στοιχεία για ενημέρωση.'});
    // Reconfirm a changed listener email; never inherit the previous address's status.
    const emailChanged=req.user.role==='user' && patch.email!==undefined &&
      patch.email!==String(req.user.email).trim().toLowerCase();
    let verification;
    if(emailChanged){
      const last= new Date(req.user.verificationEmailLastSentAt||0).getTime();
      if(Number.isFinite(last) && Date.now()-last<60000){
        res.set('Retry-After','60');
        return res.status(429).json({error:'Περίμενε ένα λεπτό πριν αλλάξεις ξανά email.'});
      }
      if(await User.findOne({_id:{$ne:req.user._id},email:patch.email}).select('_id'))
        return res.status(409).json({error:'Το email χρησιμοποιείται ήδη.'});
      verification=createEmailVerification();
      Object.assign(patch,verification.fields,{isVerified:false});
    }
    const updated=await User.findByIdAndUpdate(req.user._id,{$set:patch,
      ...(emailChanged?{$unset:{verificationOtp:'',otpExpires:''}}:{})},
      {new:true,runValidators:true});
    if(emailChanged&&updated){
      const mail=verificationLinkEmail(updated.fname,verification.token);
      const sent=await sendEmail({to:updated.email,subject:mail.subject,html:mail.html});
      if(!sent?.success)console.warn('[PROFILE] Verification mail failed; resend remains available.');
    }
    if(!updated)return res.status(404).json({error:'Ο λογαριασμός δεν βρέθηκε.'});
    res.set('Cache-Control','no-store');
    return res.json(await projectAccountUser(updated));
  }catch(error){
    if(error.code===11000)return res.status(409).json({error:'Το όνομα χρήστη ή το email χρησιμοποιείται ήδη.'});
    console.error('[PROFILE] Save failed:',error.message);
    return res.status(500).json({error:'Δεν αποθηκεύτηκαν τα στοιχεία του λογαριασμού.'});
  }
};

// Per-device push opt-in is separate from the saved user preference: a true
// preference must never be represented as browser permission.
exports.getNotificationPreferences = async (req, res) => {
  const {notificationPreferencesOf} = require('../utils/notificationPreferences');
  res.set('Cache-Control', 'no-store');
  res.json({preferences: notificationPreferencesOf(req.user),
    pushDeliveryAvailable: process.env.APP_ENV !== 'staging'});
};

exports.updateNotificationPreferences = async (req, res) => {
  const {validateChange, notificationPreferencesOf} = require('../utils/notificationPreferences');
  const change = validateChange(req.body);
  if (!change) return res.status(400).json({error:'Μη έγκυρη ρύθμιση ειδοποιήσεων.'});
  try {
    const $set = {[change.path]:change.newsCategories || change.enabled};
    if (change.channel === 'push') $set.pushNotifications = change.enabled;
    if (change.topic === 'promotions') {
      // Keep time of explicit consent for audit; revocation removes consent.
      $set['notificationPreferences.marketingConsentAt'] = change.enabled ? new Date() : null;
    }
    const updated = await User.findByIdAndUpdate(req.user._id, {$set}, {new:true,runValidators:true}).select('-password');
    if (!updated) return res.status(404).json({error:'Ο λογαριασμός δεν βρέθηκε.'});
    res.set('Cache-Control','no-store');
    return res.json({preferences:notificationPreferencesOf(updated),
      pushDeliveryAvailable:process.env.APP_ENV !== 'staging'});
  } catch (error) {
    console.error('[NOTIFICATIONS] Preference update failed:', error.message);
    return res.status(500).json({error:'Οι ρυθμίσεις δεν αποθηκεύτηκαν. Δοκίμασε ξανά.'});
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const { stationId } = req.body;
    const user = await User.findById(req.params.userId);
    const index = user.favorites.indexOf(stationId);
    if (index === -1) user.favorites.push(stationId);
    else user.favorites.splice(index, 1);
    await user.save();
    res.json(user.favorites); 
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// =========================================================
// 🟢 ΝΕΑ: Λειτουργίες Password Reset
// =========================================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      // Καλό είναι να επιστρέφουμε γενικό μήνυμα για security (να μη φαίνεται ποια email υπάρχουν), 
      // αλλά εφόσον ζητάμε error στο frontend, το αφήνουμε έτσι:
      return res.status(404).json({ error: "Δεν βρέθηκε λογαριασμός με αυτό το Email." });
    }

    // 1. Φτιάχνουμε το Token (Τυχαίο String 64 χαρακτήρων)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // 2. Αποθήκευση στη Βάση με λήξη σε 1 ώρα
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); 
    await user.save();

    // 3. Δημιουργία του URL (Που θα "προσγειωθεί" στο React)
    const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;

    // 4. Αποστολή Email
    const emailData = passwordResetEmail(user.fname, resetLink);
    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html
    });

    res.status(200).json({ message: "Το email επαναφοράς εστάλη!" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ error: "Σφάλμα κατά την αποστολή του email." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Ψάχνουμε τον χρήστη με αυτό το token ΚΑΙ το token να μην έχει λήξει ($gt: greater than now)
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: "Το link επαναφοράς είναι άκυρο ή έχει λήξει." });
    }

    // Κρυπτογράφηση του νέου κωδικού
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Ενημέρωση και καθαρισμός των token fields
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: "Ο κωδικός πρόσβασης ενημερώθηκε επιτυχώς! Μπορείτε να συνδεθείτε." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Σφάλμα κατά την αλλαγή του κωδικού." });
  }
};

// Διαγραφή του ίδιου του χρήστη (Οριστική)
exports.deleteMe = async (req,res)=>{
  const user=req.user;
  if(!user)return res.status(401).json({error:'Χρειάζεται σύνδεση.'});
  if(user.role==='admin')return res.status(403).json({error:'Δεν επιτρέπεται η διαγραφή λογαριασμού διαχειριστή.'});
  if(process.env.APP_ENV==='staging')return res.status(503).json({error:'Η διαγραφή λογαριασμού είναι απενεργοποιημένη στο staging.'});
  // Avoid deleting an account while a paid period or a legacy billing cycle is active.
  // Old records are retained for audit, without contacting a retired processor.
  const activeLegacy=(user.activeSubscriptions||[]).some(sub=>
    !['canceled','cancelled','expired','incomplete_expired'].includes(sub.status) &&
    (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd).getTime()>Date.now()));
  const paidOrder=await require('../models/BillingOrder').exists({
    accountId:user._id,status:'paid',periodEndsAt:{$gt:new Date()}
  });
  if(activeLegacy||paidOrder)
    return res.status(409).json({error:'Υπάρχει ενεργή περίοδος συνδρομής. Επικοινώνησε με την υποστήριξη πριν από τη διαγραφή.'});
  try{
    if(user.role==='broadcaster'){
      const Station=require('../models/Station');
      if(await Station.exists({broadcasterId:user._id}))
        return res.status(409).json({error:'Μετέφερε ή αφαίρεσε πρώτα τους σταθμούς που διαχειρίζεσαι.'});
    }
    const removed=await User.deleteOne({_id:user._id});
    if(!removed.deletedCount)return res.status(404).json({error:'Ο λογαριασμός δεν βρέθηκε.'});
    await Promise.allSettled([
      require('../models/Subscription').deleteMany({userId:user._id}),
      require('../models/ListenerInbox').deleteMany({recipient:user._id})
    ]);
    return res.json({success:true,message:'Ο λογαριασμός διαγράφηκε.'});
  }catch(error){
    console.error('[PROFILE] Account deletion error:',error.message);
    return res.status(500).json({error:'Η διαγραφή λογαριασμού απέτυχε.'});
  }
};

exports.acceptTerms = async (req, res) => {
  try {
    // Route uses protect: the target is ALWAYS the authenticated user.
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Απαιτείται σύνδεση.' });

    if (user.role === 'broadcaster') {
      // Avoid accepting a newer legal agreement using an old browser tab.
      if (req.body?.termsVersion !== CURRENT_BROADCASTER_TERMS_VERSION) {
        return res.status(409).json({
          error: 'Οι όροι έχουν ενημερωθεί. Ανανεώστε τη σελίδα και δοκιμάστε ξανά.',
          requiredBroadcasterTermsVersion: CURRENT_BROADCASTER_TERMS_VERSION
        });
      }

      // Preserve timestamps and approvals when the same version is already accepted.
      if (hasAcceptedCurrentBroadcasterTerms(user)) {
        return res.json({ message: 'Οι όροι έχουν ήδη γίνει αποδεκτοί.', user: withBroadcasterTermsStatus(user) });
      }
      user.termsAcceptedVersion = CURRENT_BROADCASTER_TERMS_VERSION;
    } else if (user.hasAcceptedTerms) {
      return res.json({ message: 'Οι όροι έχουν ήδη γίνει αποδεκτοί.', user: withBroadcasterTermsStatus(user) });
    }

    user.hasAcceptedTerms = true;
    user.termsAcceptedAt = new Date();
    await user.save();

    return res.json({ message: 'Οι όροι έγιναν αποδεκτοί.', user: withBroadcasterTermsStatus(user) });
  } catch (error) {
    console.error('Σφάλμα αποδοχής όρων:', error);
    return res.status(500).json({ error: 'Σφάλμα κατά την αποδοχή των όρων.' });
  }
};
