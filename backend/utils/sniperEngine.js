const User = require('../models/User');

const checkSniperMatches = async (station, currentTitle, io) => {
  if (!currentTitle || currentTitle === "ΠΑΙΖΕΙ ΤΩΡΑ") return;

  try {
    // 1. Βρίσκουμε όλους τους Premium χρήστες που έχουν έστω και ένα target
    const users = await User.find({ 
      isPremium: true, 
      sniperTargets: { $exists: true, $not: { $size: 0 } } 
    }).select('_id sniperTargets');

    if (users.length === 0) return;

    // 2. Μετατρέπουμε το currentTitle σε lowercase για εύκολο match
    const titleLower = currentTitle.toLowerCase();

    users.forEach(user => {
      // Ελέγχουμε αν κάποιος από τους στόχους του χρήστη υπάρχει μέσα στο τρέχον τραγούδι
      const match = user.sniperTargets.find(target => 
        titleLower.includes(target.toLowerCase())
      );

      if (match) {
        // 3. 🎯 TARGET ACQUIRED! Στέλνουμε το Socket μόνο στον συγκεκριμένο χρήστη
        io.to(user._id.toString()).emit('sniper_hit', {
          artist: match.toUpperCase(),
          song: currentTitle,
          station: {
            _id: station._id,
            name: station.name,
            stream: station.stream,
            logo: station.logo
          }
        });
      }
    });
  } catch (err) {
    console.error("Sniper Engine Error:", err);
  }
};

module.exports = { checkSniperMatches };
