// backend/utils/generateOgImage.js
const { createCanvas, loadImage } = require('canvas');

// ΠΡΟΣΘΗΚΗ: Βάλαμε το stationName ως δεύτερη παράμετρο
const generateMinimalOgImage = async (logoUrl, stationName) => {
    // 1. Στήσιμο Καμβά (1200x630 είναι το στάνταρ του Facebook)
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // 2. Καθαρό Dark Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 1200, 630);

    // 3. Ζωγραφική του Λογότυπου
    try {
        const safeLogoUrl = logoUrl && logoUrl.startsWith('http') 
            ? logoUrl 
            : `__IRADIOS_SITE_ORIGIN__${logoUrl || '/favicon.png'}`;

        const img = await loadImage(safeLogoUrl);
        const logoSize = 350; // Ελαφρώς μικρότερο για να χωρέσει το κείμενο
        const logoX = 600; // Κέντρο στον άξονα X
        const logoY = 250; // Το ανεβάσαμε λίγο πιο πάνω (άξονας Y)

        // Υπολογισμός αναλογιών για να μην παραμορφωθεί (Stretch)
        const ratio = Math.min(logoSize / img.width, logoSize / img.height);
        const nw = img.width * ratio;
        const nh = img.height * ratio;

        // Σχεδίαση Λογότυπου στο κέντρο
        ctx.drawImage(img, logoX - nw / 2, logoY - nh / 2, nw, nh);
    } catch (err) {
        console.error("Σφάλμα φόρτωσης λογοτύπου για το OG Image:", err.message);
    }

    // 4. Όνομα Σταθμού (Λευκά, μεγάλα γράμματα)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff'; 
    ctx.font = 'bold 55px sans-serif'; 
    // Αν δεν έρθει όνομα (σπάνιο), ας βάλει γενικά "iRadios"
    const displayName = stationName || 'iRadios';
    ctx.fillText(displayName, 600, 500); // Τοποθέτηση κάτω από το logo

    // 5. Slogan (Lime Green, μικρότερα γράμματα)
    ctx.fillStyle = '#ccff00'; 
    ctx.font = 'bold 32px sans-serif'; 
    ctx.fillText('Άκου LIVE στο iRadios', 600, 560); // 60 pixels πιο κάτω από τον τίτλο

    // Επιστρέφουμε την εικόνα ως Buffer
    return canvas.toBuffer('image/png');
};

module.exports = { generateMinimalOgImage };
