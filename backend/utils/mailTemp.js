const FRONTEND_URL = process.env.FRONTEND_URL || '__IRADIOS_SITE_ORIGIN__';

const { renderBrandedEmail } = require('./emailDesign');

// All existing transactional templates retain their message-specific content,
// but share one premium, responsive, email-client-safe visual shell.
const baseTemplate = (content, category = 'IRADIOS NETWORK') =>
  renderBrandedEmail({ content, category });


const otpVerificationEmail = (userName, otp) => {
  const content = `
    <h3>Καλωσήρθες, ${userName}!</h3>
    <p>Σε ευχαριστούμε για την εγγραφή σου στο <strong>iRadios Network</strong>. Για να ενεργοποιήσεις τον λογαριασμό σου και να αποκτήσεις πλήρη πρόσβαση, χρησιμοποίησε τον παρακάτω κωδικό επαλήθευσης (OTP):</p>
    
    <div class="otp-box">${otp}</div>
    
    <p style="font-size: 13px; color: #888;">Ο κωδικός λήγει σε 15 λεπτά. Μην τον μοιραστείτε με κανέναν.</p>
  `;
  return { subject: `🔑 Ενεργοποίηση Λογαριασμού: Ο Κωδικός σας (OTP)`, html: baseTemplate(content, 'SECURE YOUR ACCOUNT') };
};

const welcomeEmail = (userName, isBroadcaster = false) => {
  const loginUrl = `${FRONTEND_URL}/login`;
  let extraText = isBroadcaster 
    ? "Τώρα μπορείς να καταχωρήσεις τον σταθμό σου και να μπεις στο μεγαλύτερο ραδιοφωνικό δίκτυο." 
    : "Ξεκίνα να ακούς και να αποθηκεύεις τους αγαπημένους σου σταθμούς.";

  const content = `
    <h3>Ο λογαριασμός σου είναι έτοιμος!</h3>
    <p>Γεια σου ${userName}, η επαλήθευση του email σου ολοκληρώθηκε με επιτυχία.</p>
    <p>${extraText}</p>
    <div style="text-align: center; margin-top: 30px;">
      <a href="${loginUrl}" class="btn">ΕΙΣΟΔΟΣ ΣΤΟ IRADIOS</a>
    </div>
  `;
  return { subject: `Καλωσήρθες στο iRadios Network! 📻`, html: baseTemplate(content, 'WELCOME TO IRADIOSGR') };
};

const customAdminEmail = (htmlContent) => {
  return baseTemplate(htmlContent, 'A MESSAGE FROM IRADIOSGR');
};

// 🟢 ΝΕΟ: Template για Password Reset
const passwordResetEmail = (userName, resetLink) => {
  const content = `
    <h3>Επαναφορά Κωδικού Πρόσβασης</h3>
    <p>Γεια σου ${userName}, λάβαμε ένα αίτημα για αλλαγή του κωδικού πρόσβασης στο λογαριασμό σου.</p>
    <p>Πάτησε το παρακάτω κουμπί για να δημιουργήσεις έναν νέο κωδικό. Το link είναι <strong>ενεργό για 1 ώρα</strong>.</p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${resetLink}" class="btn">ΔΗΜΙΟΥΡΓΙΑ ΝΕΟΥ ΚΩΔΙΚΟΥ</a>
    </div>

    <p style="font-size: 13px; color: #888; margin-top: 30px;">Αν δεν έκανες εσύ το αίτημα, μπορείς να αγνοήσεις αυτό το email με ασφάλεια. Ο κωδικός σου παραμένει ο ίδιος.</p>
  `;
  return { subject: `Ανάκτηση Κωδικού Πρόσβασης - iRadios`, html: baseTemplate(content, 'ACCOUNT SECURITY') };
};

// 🟢 ΝΕΟ: Template για Επιβεβαίωση Πληρωμής Διαφήμισης (Agency)
const adPaymentSuccessEmail = (userName, planName, amount) => {
  const dashboardUrl = `${FRONTEND_URL}/advertiser-dashboard`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background: rgba(204,255,0,0.1); color: #ccff00; padding: 5px 15px; border-radius: 50px; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border: 1px solid rgba(204,255,0,0.2);">
        Payment Confirmed
      </span>
    </div>
    
    <h3>Η καμπάνια σου είναι έτοιμη!</h3>
    <p>Γεια σου <strong>${userName}</strong>,</p>
    <p>Σε ευχαριστούμε για την εμπιστοσύνη σου στο <strong>iRadios Ad Network</strong>. Η πληρωμή σου ολοκληρώθηκε επιτυχώς και η καμπάνια σου έχει σταλεί για τελικό έλεγχο από την ομάδα μας.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px solid #222; margin: 25px 0;">
      <table width="100%" style="color: #ccc; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0;">Πακέτο:</td>
          <td style="text-align: right; color: #fff; font-weight: 800;">${planName}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">${amount}€</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Κατάσταση:</td>
          <td style="text-align: right; color: #ffa500; font-weight: 800;">Υπό Έγκριση</td>
        </tr>
      </table>
    </div>

    <p>Μπορείς να παρακολουθείς την πορεία της διαφήμισής σου και τα στατιστικά (Views, Clicks, CTR) από το Dashboard σου.</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${dashboardUrl}" class="btn">ADVERTISER DASHBOARD</a>
    </div>

    <p style="font-size: 12px; color: #666; margin-top: 30px;">
      * Η καμπάνια ενεργοποιείται συνήθως εντός 1-2 ωρών μετά τον έλεγχο του δημιουργικού. 
      Ο χρόνος της συνδρομής σου ξεκινά να μετράει <strong>μόνο</strong> από τη στιγμή που η διαφήμιση βγει Live.
    </p>
  `;
  
  return { 
    subject: `✅ Επιβεβαίωση Πληρωμής & Ενεργοποίηση: ${planName} - iRadios`, 
    html: baseTemplate(content, 'AD NETWORK · PAYMENT') 
  };
};

// 🟢 ΝΕΟ: Alert προς τον Admin για B2B Πληρωμές
const adminTransactionAlertEmail = (companyName, amount, planName, userEmail, role) => {
  const adminDashboardUrl = `${FRONTEND_URL}/admin-dashboard`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background: rgba(255,165,0,0.1); color: #ffa500; padding: 5px 15px; border-radius: 50px; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border: 1px solid rgba(255,165,0,0.2);">
        🚨 ΝΕΑ B2B ΠΛΗΡΩΜΗ
      </span>
    </div>
    
    <h3>Έχεις νέα είσπραξη! 💰</h3>
    <p>Ο λογαριασμός διαχειριστή μόλις έλαβε μια νέα πληρωμή από εταιρικό πελάτη (<strong>${role.toUpperCase()}</strong>).</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px dashed #ffa500; margin: 25px 0;">
      <table width="100%" style="color: #ccc; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #222;">Πελάτης / Εταιρεία:</td>
          <td style="text-align: right; color: #fff; font-weight: 800; border-bottom: 1px solid #222;">${companyName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #222;">Email Πελάτη:</td>
          <td style="text-align: right; color: #fff; font-weight: 800; border-bottom: 1px solid #222;">${userEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #222;">Υπηρεσία:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800; border-bottom: 1px solid #222;">${planName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-size: 18px; font-weight: 900;">${amount}€</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #aaa;">Εκκρεμεί η αποστολή τιμολογίου και (αν είναι διαφήμιση) ο έλεγχος του υλικού της καμπάνιας.</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${adminDashboardUrl}" class="btn" style="background-color: #ffa500; color: #000 !important;">ΜΕΤΑΒΑΣΗ ΣΤΟ ADMIN PANEL</a>
    </div>
  `;
  
  return { 
    subject: `💰 Νέα Είσπραξη ${amount}€ από ${companyName} (${role})`, 
    html: baseTemplate(content, 'FINANCE · TRANSACTION') 
  };
};

// 🟢 ΝΕΟ: Template για Έγκριση Σταθμού από τον Admin
const stationApprovedEmail = (userName, stationName, stationSlug) => {
  const stationUrl = `${FRONTEND_URL}/station/${stationSlug}`;
  const dashboardUrl = `${FRONTEND_URL}/broadcast`;
  const pressKitUrl = `__IRADIOS_SITE_ORIGIN__/press-kit`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background: rgba(204,255,0,0.1); color: #ccff00; padding: 5px 15px; border-radius: 50px; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border: 1px solid rgba(204,255,0,0.2);">
        Station Approved
      </span>
    </div>
    
    <h3 style="text-align: center; font-style: italic;">Συγχαρητήρια, ο σταθμός σου είναι πλέον LIVE! 🎉</h3>
    
    <p>Γεια σου <strong>${userName}</strong>,</p>
    
    <p>Η ομάδα μας μόλις ολοκλήρωσε τον έλεγχο και ενέκρινε την καταχώρηση του σταθμού <strong style="color: #fff;">${stationName}</strong>!</p>
    
    <p>Ο σταθμός σου βρίσκεται πλέον στον επίσημο κατάλογο του <strong>iRadios</strong>, διαθέσιμος σε όλους τους ακροατές μας.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px dashed rgba(204,255,0,0.4); margin: 30px 0; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
      <p style="margin-top: 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Το επισημο link του σταθμου σου ειναι:</p>
      <a href="${stationUrl}" style="color: #ccff00; font-size: 16px; font-weight: 800; text-decoration: none; word-break: break-all;">
        ${stationUrl}
      </a>
    </div>

    <p>Μπες στο <strong>Broadcaster Dashboard</strong> για να δεις τα πρώτα σου στατιστικά, να ενεργοποιήσεις το <strong>DSP Engine</strong> (αν δεν το έχεις κάνει ήδη) και να απαντήσεις στα μηνύματα των ακροατών σου στο <strong>Live Chat</strong>.</p>

    <div style="text-align: center; margin-top: 35px; margin-bottom: 40px;">
      <a href="${dashboardUrl}" class="btn">BROADCASTER DASHBOARD</a>
    </div>

    <div style="background-color: #1a1a1a; padding: 20px; border-radius: 12px; border-left: 4px solid #ccff00; margin-top: 20px;">
      <h4 style="color: #fff; margin-top: 0; margin-bottom: 10px; font-size: 18px;">Μοιραστείτε τα καλά νέα! 📢</h4>
      <p style="font-size: 14px; color: #ccc; margin-bottom: 15px;">
        Βοηθήστε τους ακροατές σας να σας βρίσκουν εύκολα από κάθε συσκευή. Σας προτείνουμε να:
      </p>
      <ul style="color: #ccc; font-size: 14px; padding-left: 20px; margin-bottom: 0;">
        <li style="margin-bottom: 8px;"><strong>Κοινοποιήσετε το link</strong> στα Social Media σας (Facebook, Instagram Stories, X/Twitter).</li>
        <li style="margin-bottom: 8px;"><strong>Χρησιμοποιήστε τον Widget Player στο Website σας</strong>  κάνοντας Copy-Paste τον κώδικά του, μέσα το Broadcaster Studio.</li>
        <li style="margin-bottom: 8px;">Προσθέσετε το link και το υλικό στο <strong>επίσημο Website σας</strong>. Κατεβάστε τα επίσημα badges στο: <a href="${pressKitUrl}" style="color: #ccff00; text-decoration: none; font-weight: bold;">Press Kit & Badge</a>.</li>
        <li style="margin-bottom: 0;"><strong>Ανακοινώσετε on-air</strong> ότι πλέον εκπέμπετε και μέσα από το δίκτυο του iRadios.</li>
      </ul>
    </div>

    <p style="font-size: 12px; color: #666; margin-top: 35px; line-height: 1.5;">
      * Αν δεις ότι το stream σου έχει καθυστερήσεις ή προβλήματα, έλεγξε τα εναλλακτικά <strong>Proxy Streams</strong> μέσα από τις ρυθμίσεις του σταθμού σου στο dashboard.
    </p>
  `;
  
  return { 
    subject: `🎉 Ο σταθμός ${stationName} είναι LIVE! - iRadios App`, 
    html: baseTemplate(content, 'BROADCASTER · STATION LIVE') 
  };
};

// 🟢 ΝΕΟ: Template για Απόρριψη Σταθμού (Rejected)
const stationRejectedEmail = (userName, stationName) => {
  const dashboardUrl = `${FRONTEND_URL}/broadcast`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background: rgba(255,77,77,0.1); color: #ff4d4d; padding: 5px 15px; border-radius: 50px; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border: 1px solid rgba(255,77,77,0.2);">
        Action Required
      </span>
    </div>
    
    <h3 style="text-align: center; font-style: italic;">Η καταχώρηση χρειάζεται διόρθωση ⚠️</h3>
    
    <p>Γεια σου <strong>${userName}</strong>,</p>
    
    <p>Η ομάδα μας έλεγξε την καταχώρηση για τον σταθμό <strong style="color: #fff;">${stationName}</strong>, αλλά δυστυχώς δεν μπορέσαμε να την εγκρίνουμε σε αυτή τη φάση.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px dashed #ff4d4d; margin: 30px 0; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
      <p style="margin-top: 0; color: #ff4d4d; font-weight: bold; text-transform: uppercase; font-size: 13px; letter-spacing: 1px;">Τι πηγε λαθος;</p>
      <p style="color: #ccc; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
        Παρακαλούμε ελέγξτε τα στοιχεία που καταχωρήσατε. Συνήθως, οι απορρίψεις οφείλονται σε:
      </p>
      <ul style="color: #aaa; font-size: 14px; line-height: 1.6; margin-top: 10px; padding-left: 20px;">
        <li>Μη έγκυρο ή ανενεργό <strong>Stream URL</strong>.</li>
        <li>Πολύ χαμηλή ανάλυση ή λάθος διαστάσεις στο <strong>Λογότυπο</strong>.</li>
        <li>Ελλιπή ή παραπλανητική <strong>Περιγραφή</strong> του σταθμού.</li>
      </ul>
    </div>

    <p>Μπορείς να επεξεργαστείς τα στοιχεία του σταθμού σου μέσα από το Dashboard και να κάνεις <strong>ξανά υποβολή</strong> για έγκριση.</p>

    <div style="text-align: center; margin-top: 35px;">
      <a href="${dashboardUrl}" class="btn" style="background-color: #ff4d4d; color: #fff !important;">ΔΙΟΡΘΩΣΗ ΣΤΟΙΧΕΙΩΝ</a>
    </div>

    <p style="font-size: 12px; color: #666; margin-top: 35px; line-height: 1.5;">
      * Αν χρειάζεσαι βοήθεια με το Stream URL ή αντιμετωπίζεις κάποιο τεχνικό πρόβλημα, επικοινώνησε με το τμήμα υποστήριξης μέσω του ILUMA Help Desk.
    </p>
  `;
  
  return { 
    subject: `⚠️ Απαιτείται διόρθωση για τον σταθμό ${stationName} - iRadios App`, 
    html: baseTemplate(content, 'BROADCASTER · ACTION REQUIRED') 
  };
}; 

// 🟢 ΝΕΟ: Template για Ενεργοποίηση B2B Premium / Addons
const broadcasterPremiumSuccessEmail = (userName, planName, amount) => {
  const dashboardUrl = `${FRONTEND_URL}/broadcast`;
  
  // Φιλτράρουμε το όνομα του πακέτου για να φαίνεται πιο "ανθρώπινο" αν χρειαστεί
  let displayPlanName = planName;
  if (planName === 'full_premium' || planName === 'FULL PREMIUM') displayPlanName = 'iRadios PRO PACK';
  if (planName === 'dsp_solo') displayPlanName = 'DSP Audio Engine (Addon)';
  if (planName === 'ad_control_solo') displayPlanName = 'Ad Control (Addon)';
  if (planName === 'analytics_solo') displayPlanName = 'Advanced Analytics (Addon)';
  if (planName && planName.includes('boost')) displayPlanName = 'Station Boost';

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background: rgba(204,255,0,0.1); color: #ccff00; padding: 5px 15px; border-radius: 50px; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border: 1px solid rgba(204,255,0,0.2);">
        Payment & Activation Successful
      </span>
    </div>
    
    <h3 style="text-align: center; font-style: italic;">Οι νέες σας υπηρεσίες ενεργοποιήθηκαν! 🚀</h3>
    
    <p>Γεια σου <strong>${userName}</strong>,</p>
    
    <p>Σε ευχαριστούμε για την προτίμηση και την αγορά σου. Η συναλλαγή ολοκληρώθηκε επιτυχώς και το πακέτο σου είναι ήδη ενεργό στον λογαριασμό σου.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px solid #333; margin: 30px 0; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
      <p style="margin-top: 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #222; padding-bottom: 10px;">Στοιχεια Συναλλαγης</p>
      
      <table width="100%" style="color: #ccc; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0;">Υπηρεσία:</td>
          <td style="text-align: right; color: #fff; font-weight: 800;">${displayPlanName}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">${amount}€</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Κατάσταση:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">Ενεργό</td>
        </tr>
      </table>
    </div>

    <p>Οι νέες λειτουργίες (εφόσον αφορούν το PRO Pack ή κάποιο Addon) είναι άμεσα διαθέσιμες μέσα από το Broadcaster Dashboard. Αν αγοράσατε κάποιο Station Boost, ο σταθμός σας βρίσκεται ήδη σε προβεβλημένη θέση.</p>

    <div style="text-align: center; margin-top: 35px;">
      <a href="${dashboardUrl}" class="btn">ΜΕΤΑΒΑΣΗ ΣΤΟ DASHBOARD</a>
    </div>

    <p style="font-size: 12px; color: #666; margin-top: 35px; line-height: 1.5;">
      * Το νόμιμο παραστατικό (Τιμολόγιο Παροχής Υπηρεσιών) για την επιχείρησή σας θα εκδοθεί και θα σας αποσταλεί ηλεκτρονικά μέσα στις επόμενες εργάσιμες ημέρες. Για θέματα χρεώσεων, επικοινωνήστε μαζί μας στο accounting@iluma.gr.
    </p>
  `;
  
  return { 
    subject: `✅ Ενεργοποίηση Υπηρεσίας: ${displayPlanName} - iRadios`, 
    html: baseTemplate(content, 'BROADCASTER · PREMIUM') 
  };
};

// 🟢 ΝΕΟ: Template για Ενεργοποίηση Listener Premium
const listenerPremiumSuccessEmail = (userName, amount) => {
  const appUrl = `${FRONTEND_URL}/`;

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="background: rgba(204,255,0,0.1); color: #ccff00; padding: 5px 15px; border-radius: 50px; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border: 1px solid rgba(204,255,0,0.2);">
        Premium Activated
      </span>
    </div>
    
    <h3 style="text-align: center; font-style: italic;">Καλωσήρθες στο iRadios Premium! 🎧</h3>
    
    <p>Γεια σου <strong>${userName}</strong>,</p>
    
    <p>Η συνδρομή σου ενεργοποιήθηκε με επιτυχία! Πλέον ανήκεις στην ελίτ των ακροατών μας. Σε ευχαριστούμε που στηρίζεις το <strong>iRadios Network</strong>.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px solid #333; margin: 30px 0; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
      <p style="margin-top: 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #222; padding-bottom: 10px;">Στοιχεια Συναλλαγης</p>
      
      <table width="100%" style="color: #ccc; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0;">Πακέτο:</td>
          <td style="text-align: right; color: #fff; font-weight: 800;">iRadios Premium (Listener)</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">${amount}€ /μήνα</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Κατάσταση:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">Ενεργό</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #1a1a1a; padding: 30px; border-radius: 24px; border: 1px solid rgba(204,255,0,0.2);">
      <h4 style="color: #ccff00; margin-top: 0; margin-bottom: 20px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Elite Access: Η Απολυτη Εμπειρια</h4>
      
      <div style="space-y: 20px;">
        
        <div style="margin-bottom: 20px;">
          <p style="color: #fff; font-weight: 800; margin-bottom: 5px; font-size: 15px;">🚫 Zero Interruptions</p>
          <p style="color: #aaa; font-size: 13px; margin-top: 0;">Η μουσική σου, χωρίς διακοπές. Σκοτώνουμε κάθε in-app ηχητικό σποτ πριν ή ενδιάμεσα στην ακρόαση.</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="color: #fff; font-weight: 800; margin-bottom: 5px; font-size: 15px;">📱 iRadios Connect</p>
          <p style="color: #aaa; font-size: 13px; margin-top: 0;">Άλλαξε συσκευή χωρίς να χάσεις δευτερόλεπτο. Το κινητό σου γίνεται το απόλυτο τηλεχειριστήριο για τον υπολογιστή σου.</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="color: #fff; font-weight: 800; margin-bottom: 5px; font-size: 15px;">🤖 Live AI Music Radar</p>
          <p style="color: #aaa; font-size: 13px; margin-top: 0;">Τέρμα τα "άγνωστα" κομμάτια. Το AI μας σκανάρει τον ήχο και σου γράφει ακαριαία ποιο τραγούδι παίζει live.</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="color: #fff; font-weight: 800; margin-bottom: 5px; font-size: 15px;">🟢 1-Click Spotify</p>
          <p style="color: #aaa; font-size: 13px; margin-top: 0;">Αναγνώρισες μια κομματάρα; Άνοιξέ τη και αποθήκευσέ τη στην αγαπημένη σου playlist με ένα μόνο πάτημα.</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="color: #fff; font-weight: 800; margin-bottom: 5px; font-size: 15px;">🎚️ Studio-Grade EQ</p>
          <p style="color: #aaa; font-size: 13px; margin-top: 0;">Πάρε τον έλεγχο του ήχου στα χέρια σου. Προσάρμοσε το μπάσο ή ενεργοποίησε το 3D Spatial Audio.</p>
        </div>

        <div style="margin-bottom: 0;">
          <p style="color: #fff; font-weight: 800; margin-bottom: 5px; font-size: 15px;">🚗 Smart Car Mode</p>
          <p style="color: #aaa; font-size: 13px; margin-top: 0;">Οδήγησε με ασφάλεια. Minimal, σκοτεινό περιβάλλον με τεράστια κουμπιά για να μη χάνεις την προσοχή σου.</p>
        </div>

      </div>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <a href="${appUrl}" class="btn">ΑΚΟΥΣΤΕ ΤΩΡΑ</a>
    </div>

    <p style="text-align: center; color: #555; font-size: 11px; margin-top: 30px;">
        Μπορείτε να διαχειριστείτε ή να ακυρώσετε τη συνδρομή σας ανά πάσα στιγμή μέσα από τις ρυθμίσεις του προφίλ σας.
    </p>
  `;
  
  return { 
    subject: `🎧 Καλωσήρθες στο iRadios Premium!`, 
    html: baseTemplate(content, 'LISTENER · PREMIUM') 
  };
};

module.exports = {
  otpVerificationEmail,
  welcomeEmail,
  customAdminEmail,
  passwordResetEmail,
  adPaymentSuccessEmail,
  adminTransactionAlertEmail,
  stationApprovedEmail,
  stationRejectedEmail,
  broadcasterPremiumSuccessEmail,
  listenerPremiumSuccessEmail
};
