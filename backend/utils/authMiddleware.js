require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// No hard-coded JWT secrets may be committed to source control.
const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  try {
    let token;
    
    // Ελέγχουμε αν υπάρχει το token στα headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Μη εξουσιοδοτημένη πρόσβαση, δεν βρέθηκε token.' });
    }

    // Αποκρυπτογραφούμε το token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Βρίσκουμε τον χρήστη και τον "κολλάμε" στο req.user για να τον δουν τα επόμενα βήματα
    const user = await User.findById(decoded.id || decoded._id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Ο χρήστης δεν βρέθηκε.' });
    }

    // Existing 30-day admin tokens and role-promoted user tokens cannot bypass
    // email 2FA. Only JWTs minted AFTER a verified single-use challenge work.
    if(user.role==='admin'&&(decoded.role!=='admin'||decoded.admin2fa!==true))
      return res.status(401).json({code:'ADMIN_2FA_REQUIRED',
        message:'Απαιτείται νέα σύνδεση Admin με email 2FA.'});
    req.user = user;
    next(); // Προχωράμε στο επόμενο βήμα (δηλαδή στο roleMiddleware)
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({ message: 'Μη έγκυρο token ή το token έχει λήξει.' });
  }
};

module.exports = { protect };
