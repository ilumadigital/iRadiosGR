export const cleanMetadata = (rawTitle) => {
  if (!rawTitle) return '';
  let text = rawTitle.toString();

  // 1. Πέταμα URLs (http, https, www)
  text = text.replace(/https?:\/\/\S+|www\.\S+/gi, '');

  // 2. Πέταμα συχνοτήτων FM (π.χ. 98.4 FM, 105.5FM)
  text = text.replace(/\d{2,3}\.\d\s*fm/gi, '');

  // 3. Πέταμα αρίθμησης CD / Track numbers στην αρχή (π.χ. "01 - " ή "12. ")
  text = text.replace(/^\d{1,3}\s*[-.]\s*/g, '');

  // 4. Πέταμα καταλήξεων αρχείων ήχου (αν διαβάζει κατευθείαν από το αρχείο)
  text = text.replace(/\.(mp3|wav|flac|wma|m4a|aac)$/gi, '');

  // 5. Πέταμα γνωστών "σκουπιδιών"
  const garbageWords = [
    /\[.*?\]/g, // Οτιδήποτε μέσα σε αγκύλες [Official Video]
    /\(original.*?\)/gi,
    /\(extended.*?\)/gi,
    /\(official.*?\)/gi, // (Official Video), (Official Audio)
    /\(lyric.*?\)/gi, // (Lyric Video)
    /\(.*?(\bmix\b|edit|version|id|remastered|acoustic|live)\)/gi, // 🟢 ΕΞΥΠΝΟ: Πιάνει (Radio Edit), (Club Mix), (Taylor's Version), κλπ.
    /\*.*?\*/g, // Οτιδήποτε μέσα σε αστεράκια *οποιαδήποτε λέξη*
    /@\w+/g, // 🟢 Πιάνει Social Media handles (π.χ. @iradios)
    /\b(promo|PIN|jingle|sweeper|advert|ad break|news|weather|podcast|dj set|on air|web radio)\b/gi,
    /\.gr|\.com|\.net/gi, // Καταλήξεις domains
    /live\s*broadcast/gi,
    /playing\s*now:/gi
  ];

  garbageWords.forEach(regex => {
    text = text.replace(regex, '');
  });

  // 6. Ο ΧΡΥΣΟΣ ΚΑΝΟΝΑΣ: Το σπλιτάρισμα!
  text = text.replace(/\|/g, '-'); 
  
  const parts = text.split('-').map(p => p.trim()).filter(Boolean);
  
  if (parts.length >= 2) {
    // Κρατάμε μόνο τα 2 πρώτα (Καλλιτέχνης - Τίτλος). Αν υπάρχει 3ο, συνήθως είναι το όνομα του σταθμού.
    text = `${parts[0]} - ${parts[1]}`;
  }

  // 7. Καθαρισμός περίεργων χαρακτήρων στην αρχή ΚΑΙ στο τέλος
  // Το ^... καθαρίζει την αρχή. Το ...$ καθαρίζει το τέλος.
  text = text.replace(/^[-_~|@#*:\s]+|[-_~|@#*:\s]+$/g, '');

  // Αν για κάποιο λόγο καθαρίστηκε εντελώς, το επιστρέφουμε όπως ήταν (χωρίς τις καταλήξεις)
  // για να μην μείνει κενό το UI. Αλλιώς επιστρέφουμε το καθαρό.
  return text.trim() || rawTitle.trim();
};
