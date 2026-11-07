const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // 🟢 ΝΕΟ: Για τη δημιουργία του token ανάκτησης
const { sendEmail } = require('../utils/myMailer');
const { otpVerificationEmail, welcomeEmail, passwordResetEmail } = require('../utils/mailTemp'); // 🟢 ΝΕΟ: Import το νέο template

const JWT_SECRET = process.env.JWT_SECRET;
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
    const { username, email, password, fname, lname, birthdate, phone } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: "Ο χρήστης ή το email υπάρχει ήδη" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 15 * 60000); 

    const newUser = new User({
      username, email, password: hashedPassword,
      fname, lname, birthdate: new Date(birthdate), phone: phone || "", role: 'user',
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

exports.registerBroadcaster = async (req, res) => {
  try {
    const { username, email, password, fname, lname, phone, businessType, vatNumber, companyName } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: "Ο χρήστης ή το email υπάρχει ήδη" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 15 * 60000); 

    const newUser = new User({
      username, email, password: hashedPassword, 
      fname, lname, phone: phone || "", 
      role: 'broadcaster', businessType, vatNumber, companyName,
      broadcasterProfile: { tier: 'free', maxStations: 3, features: { adControl: false, dspEngine: false, betaAccess: false, liveChat: true, analytics: false } }, 
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
    const { email, otp } = req.body;
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
      user: { 
        _id: user._id, username: user.username, role: user.role, isPremium: user.isPremium, 
        broadcasterProfile: user.broadcasterProfile, agencyProfile: user.agencyProfile
      } 
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

    if (!user.isVerified) {
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
      user: {
        _id: user._id, username: user.username, fname: user.fname, lname: user.lname,
        birthdate: user.birthdate, isPremium: user.isPremium, favorites: user.favorites, role: user.role,
        broadcasterProfile: user.broadcasterProfile, agencyProfile: user.agencyProfile
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(401).json({ error: 'Invalid token' }); }
};

exports.updateMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Δεν δόθηκε Token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { username, email, fname, lname, phone, birthdate, pushNotifications } = req.body;
    const existingUser = await User.findOne({ 
      $and: [ { _id: { $ne: decoded.id } }, { $or: [{ username }, { email }] } ]
    });

    if (existingUser) return res.status(400).json({ error: 'Το Username ή το Email χρησιμοποιείται ήδη.' });

    const updatedUser = await User.findByIdAndUpdate(
      decoded.id, 
      { username, email, fname, lname, phone, birthdate: birthdate ? new Date(birthdate) : new Date('2000-01-01'), pushNotifications }, 
      { new: true, runValidators: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (err) { res.status(500).json({ error: 'Σφάλμα κατά την αποθήκευση στοιχείων' }); }
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
exports.deleteMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Δεν δόθηκε Token' });
    
    const token = authHeader.split(' ')[1];
    // Χρησιμοποιούμε το ίδιο JWT_SECRET με το υπόλοιπο αρχείο
    const JWT_SECRET = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 🛡️ Ασπίδα: Οι Admins ΔΕΝ μπορούν να διαγραφούν
    if (decoded.role === 'admin') {
      return res.status(403).json({ error: 'Οι λογαριασμοί διαχειριστή δεν μπορούν να διαγραφούν.' });
    }

    // Διαγραφή του χρήστη από τη βάση (User model)
    // Αν δεν έχεις κάνει import το User πάνω-πάνω, βεβαιώσου ότι υπάρχει: const User = require('../models/User');
    const deletedUser = await User.findByIdAndDelete(decoded.id);
    
    if (!deletedUser) {
      return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });
    }

    res.json({ message: 'Ο λογαριασμός διαγράφηκε επιτυχώς.' });
  } catch (err) {
    console.error("Σφάλμα διαγραφής λογαριασμού:", err);
    res.status(500).json({ error: 'Σφάλμα κατά τη διαγραφή του λογαριασμού.' });
  }
};

exports.acceptTerms = async (req, res) => {
  try {
    // 1. Παίρνουμε το Token από τον Header
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Δεν δόθηκε Token' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET); // Χρησιμοποιούμε το JWT_SECRET του αρχείου

    // 2. Κάνουμε update τον χρήστη χρησιμοποιώντας το ID από το Token
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { 
        $set: { 
          hasAcceptedTerms: true,
          termsAcceptedAt: new Date() 
        } 
      },
      { new: true } // Φέρνει πίσω τον ανανεωμένο χρήστη
    ).select('-password'); // Κρύβουμε τον κωδικό για ασφάλεια

    if (!user) return res.status(404).json({ error: "Ο χρήστης δεν βρέθηκε." });

    res.json({ message: "Οι όροι έγιναν αποδεκτοί.", user });
  } catch (error) {
    console.error("Σφάλμα αποδοχής όρων:", error.message);
    res.status(500).json({ error: "Σφάλμα κατά την αποδοχή των όρων." });
  }
};
