const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://iradios-db:27017/iradios';
    
    await mongoose.connect(MONGO_URI);
    console.log('🔥 MongoDB Συνδέθηκε επιτυχώς!');
  } catch (error) {
    console.error('Σφάλμα σύνδεσης MongoDB:', error);
    process.exit(1); // Αν αποτύχει η βάση, σταματάει η εφαρμογή (για ασφάλεια)
  }
};

module.exports = connectDB;
