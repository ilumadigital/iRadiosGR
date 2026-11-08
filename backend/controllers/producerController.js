const User = require('../models/User');
const Station = require('../models/Station');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/myMailer');

// 1. Αποστολή πρόσκλησης από τον Broadcaster
exports.inviteProducer = async (req, res) => {
  try {
    const { email, stationId, fname, lname } = req.body;
    const broadcasterId = req.user._id || req.user.id; // Από το auth middleware

    // Έλεγχος αν ο σταθμός ανήκει όντως σε αυτόν τον broadcaster
    const station = await Station.findOne({ _id: stationId, broadcasterId });
    if (!station) {
      return res.status(403).json({ message: 'Μη εξουσιοδοτημένη ενέργεια ή ο σταθμός δεν βρέθηκε.' });
    }

    // Έλεγχος αν το email υπάρχει ήδη
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Αυτό το email χρησιμοποιείται ήδη στο σύστημα.' });
    }

    // Δημιουργία προσωρινού τυχαίου κωδικού (δεν θα τον ξέρει κανείς)
    const tempPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
    
    // Δημιουργία unique username με βάση το email
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;

    const newProducer = new User({
      username,
      email,
      password: tempPassword,
      fname: fname || 'Radio',
      lname: lname || 'Producer',
      role: 'producer',
      assignedStation: stationId,
      invitedBy: broadcasterId,
      isVerified: false
    });

    await newProducer.save();

    // Δημιουργία Invite Token (λήγει σε 7 μέρες)
    const inviteToken = jwt.sign(
      { userId: newProducer._id, email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Το Link που θα πατήσει ο παραγωγός στο email του
    const inviteLink = `__IRADIOS_SITE_ORIGIN__/accept-invite?token=${inviteToken}`;

    // Αποστολή Email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ccff00; background: #000; padding: 20px; text-align: center; margin-bottom: 30px;">iRadios Network</h2>
        <p>Γεια σας,</p>
        <p>Έχετε προσκληθεί να διαχειριστείτε τον ραδιοφωνικό σταθμό <strong>${station.name}</strong> στο δίκτυο του iRadios.</p>
        <p>Για να αποδεχτείτε την πρόσκληση και να ορίσετε τον δικό σας κωδικό πρόσβασης, πατήστε το παρακάτω κουμπί:</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${inviteLink}" style="background-color: #ccff00; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 8px;">Αποδοχή Πρόσκλησης</a>
        </div>
        <p style="font-size: 12px; color: #777;">Ο σύνδεσμος λήγει σε 7 ημέρες.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: `Πρόσκληση διαχείρισης σταθμού: ${station.name}`,
      html: emailHtml
    });

    res.status(201).json({ message: 'Η πρόσκληση εστάλη επιτυχώς!', producer: newProducer });
  } catch (error) {
    console.error("Σφάλμα στην πρόσκληση:", error);
    res.status(500).json({ message: 'Σφάλμα διακομιστή.' });
  }
};

// 2. Αποδοχή πρόσκλησης και ορισμός κωδικού (Από τον Producer)
exports.acceptInvite = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if(typeof token!=='string'||typeof newPassword!=='string'||
       newPassword.length<10||newPassword.length>128)
      return res.status(400).json({message:'Ο κωδικός χρειάζεται 10 έως 128 χαρακτήρες.'});

    // Επαλήθευση Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Atomic compare-and-set closes the replay race when the same invitation
    // is submitted concurrently from two tabs: only one can set a password.
    const hashed=await bcrypt.hash(newPassword,10);
    const activated=await User.findOneAndUpdate({
      _id:decoded.userId,role:'producer',email:decoded.email,isVerified:false
    },{$set:{password:hashed,isVerified:true}},{new:false});
    if(!activated)return res.status(400).json({
      message:'Η πρόσκληση έχει λήξει, χρησιμοποιηθεί ή είναι άκυρη.'
    });

    res.json({ message: 'Ο λογαριασμός ενεργοποιήθηκε! Μπορείτε πλέον να συνδεθείτε.' });
  } catch (error) {
    res.status(400).json({ message: 'Η πρόσκληση έχει λήξει ή είναι άκυρη.' });
  }
};

// 3. Λήψη των παραγωγών ενός Broadcaster (Για να τους βλέπει σε λίστα)
exports.getMyProducers = async (req, res) => {
  try {
    const broadcasterId = req.user._id || req.user.id;
    // Φέρνουμε τους χρήστες και κάνουμε populate τον σταθμό τους για να δείχνουμε το όνομα του σταθμού
    const producers = await User.find({ invitedBy: broadcasterId, role: 'producer' })
                                .select('-password')
                                .populate('assignedStation', 'name logo');
    res.json(producers);
  } catch (error) {
    res.status(500).json({ message: 'Σφάλμα διακομιστή.' });
  }
};

// 4. Ανάκληση πρόσβασης (Διαγραφή παραγωγού από τον Broadcaster)
exports.removeProducer = async (req, res) => {
  try {
    const { id } = req.params;
    const broadcasterId = req.user._id || req.user.id;

    // Βεβαιωνόμαστε ότι ο broadcaster διαγράφει δικό του παραγωγό
    const producer = await User.findOneAndDelete({ _id: id, invitedBy: broadcasterId });
    
    if (!producer) {
      return res.status(404).json({ message: 'Ο παραγωγός δεν βρέθηκε.' });
    }

    res.json({ message: 'Η πρόσβαση του παραγωγού ανακλήθηκε.' });
  } catch (error) {
    res.status(500).json({ message: 'Σφάλμα διακομιστή.' });
  }
};

// 5. Λήψη Σταθμού και Δικαιωμάτων Παραγωγού
exports.getMyAssignedStation = async (req, res) => {
  try {
    const producerId = req.user._id || req.user.id;
    
    // Βρίσκουμε τον παραγωγό, και κάνουμε populate τον Σταθμό του ΚΑΙ το Αφεντικό του (Broadcaster)
    const producer = await User.findById(producerId)
      .populate('assignedStation')
      .populate('invitedBy', 'broadcasterProfile');

    if (!producer || !producer.assignedStation) {
      return res.json({ station: null, parentFeatures: null, bossId: null });
    }

    res.json({
      station: producer.assignedStation,
      parentFeatures: producer.invitedBy?.broadcasterProfile?.features || {},
      bossId: producer.invitedBy?._id // Το ID του Broadcaster για να βλέπουμε τα analytics του
    });
  } catch (error) {
    console.error("Σφάλμα ανάκτησης σταθμού παραγωγού:", error);
    res.status(500).json({ message: 'Σφάλμα διακομιστή.' });
  }
};
