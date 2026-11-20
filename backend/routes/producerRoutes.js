const express = require('express');
const router = express.Router();
const producerController = require('../controllers/producerController');

// Φέρνουμε ΚΑΙ τα δύο: και την ταυτοποίηση (protect) και τον έλεγχο ρόλου (authorizeRoles)
const { protect } = require('../utils/authMiddleware'); 
const { authorizeRoles } = require('../utils/roleMiddleware'); 

// Routes Broadcaster (Πρώτα ελέγχουμε ΑΝ είναι συνδεδεμένος, και ΜΕΤΑ αν είναι Broadcaster/Admin)
router.post('/producers/invite', protect, authorizeRoles('broadcaster', 'admin'), producerController.inviteProducer);
router.get('/producers', protect, authorizeRoles('broadcaster', 'admin'), producerController.getMyProducers);
router.delete('/producers/:id', protect, authorizeRoles('broadcaster', 'admin'), producerController.removeProducer);

// Route Παραγωγού (Ανοιχτό, γιατί ο παραγωγός δεν έχει κάνει login ακόμα)
router.post('/producers/accept-invite', producerController.acceptInvite);

// Νέο route για τον Παραγωγό (ώστε να τραβάει τον σταθμό που του έχουν δώσει)
router.get('/producers/my-station', protect, authorizeRoles('producer'), producerController.getMyAssignedStation);

module.exports = router;
