const Station = require('../models/Station');

// 1. Έλεγχος Ρόλων (Ποιος επιτρέπεται να μπει)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Αν ο ρόλος του χρήστη δεν υπάρχει στη λίστα που επιτρέπουμε, τρώει "πόρτα"
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Απαγορεύεται η πρόσβαση. Ο λογαριασμός σας δεν έχει τα απαραίτητα δικαιώματα.' 
      });
    }
    next();
  };
};

// 2. Έλεγχος Πρόσβασης Σταθμού (Resource Isolation)
const checkStationAccess = async (req, res, next) => {
  try {
    // Βρίσκουμε το ID του σταθμού (από το URL ή το Body)
    const stationId = req.params.stationId || req.params.id || req.body.stationId;
    
    if (!stationId) {
      return res.status(400).json({ message: 'Δεν δόθηκε το ID του σταθμού.' });
    }

    // Ο Admin περνάει ελεύθερα παντού
    if (req.user.role === 'admin') {
      return next(); 
    }

    // Έλεγχος για Producer: Επιτρέπεται ΜΟΝΟ αν χτυπάει τον δικό του σταθμό
    if (req.user.role === 'producer') {
      if (!req.user.assignedStation || req.user.assignedStation.toString() !== stationId.toString()) {
        return res.status(403).json({ message: 'Δεν έχετε δικαίωμα προβολής/επεξεργασίας σε αυτόν τον σταθμό.' });
      }
      return next();
    }

    // Έλεγχος για Broadcaster: Επιτρέπεται ΜΟΝΟ αν του ανήκει ο σταθμός
    if (req.user.role === 'broadcaster') {
      const station = await Station.findById(stationId);
      if (!station || station.broadcasterId.toString() !== (req.user._id || req.user.id).toString()) {
        return res.status(403).json({ message: 'Δεν είστε ο ιδιοκτήτης αυτού του σταθμού.' });
      }
      return next();
    }

    // Αν δεν είναι τίποτα από τα παραπάνω, κόβεται
    return res.status(403).json({ message: 'Απαγορεύεται η πρόσβαση.' });
  } catch (error) {
    console.error("Σφάλμα στο checkStationAccess:", error);
    return res.status(500).json({ message: 'Σφάλμα ελέγχου πρόσβασης.' });
  }
};

module.exports = { authorizeRoles, checkStationAccess };
