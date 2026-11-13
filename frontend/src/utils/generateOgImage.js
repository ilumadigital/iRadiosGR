// backend/utils/generateOgImage.js
const { createCanvas, loadImage } = require('canvas');

const generateMinimalOgImage = async (logoUrl) => {
    // 1. Στήσιμο Καμβά (1200x630 είναι το στάνταρ του Facebook)
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // 2. Καθαρό Dark Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 1200, 630);

    // 3. Ζωγραφική του Λογότυπου
    try {
        // Έλεγχος αν το URL είναι απόλυτο (http) ή σχετικό (/uploads/...)
        const safeLogoUrl = logoUrl && logoUrl.startsWith('http') 
            ? logoUrl 
            : `__IRADIOS_SITE_ORIGIN__${logoUrl || '/icon-tr.svg'}`;

        const img = await loadImage(safeLogoUrl);
        const logoSize = 380; // Μεγάλο και επιβλητικό
        const logoX = 600; // Κέντρο στον άξονα X
        const logoY = 270; // Λίγο πιο πάνω από τη μέση (άξονας Y)

        // Υπολογισμός αναλογιών για να μην παραμορφωθεί (Stretch)
        const ratio = Math.min(logoSize / img.width, logoSize / img.height);
        const nw = img.width * ratio;
        const nh = img.height * ratio;

        // Σχεδίαση Λογότυπου στο κέντρο
        ctx.drawImage(img, logoX - nw / 2, logoY - nh / 2, nw, nh);
    } catch (err) {
        console.error("Σφάλμα φόρτωσης λογοτύπου για το OG Image:", err.message);
        // Αν αποτύχει το logo (π.χ. σπασμένο link), το script θα συνεχίσει και 
        // θα ζωγραφίσει το background και το "iRadios" κανονικά.
    }

    // 4. Σφραγίδα "iRadios"
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ccff00'; // Το χαρακτηριστικό Lime Green
    ctx.font = 'bold 55px sans-serif'; 
    ctx.fillText('iRadios', 600, 540);

    // Επιστρέφουμε την εικόνα ως Buffer (το καταλαβαίνει τέλεια ο Express)
    return canvas.toBuffer('image/png');
};

module.exports = { generateMinimalOgImage };
