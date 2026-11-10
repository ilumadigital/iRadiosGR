const FRONTEND_URL = process.env.FRONTEND_URL || '__IRADIOS_SITE_ORIGIN__';

const { renderBrandedEmail, escapeHtml } = require('./emailDesign');

// All existing transactional templates retain their message-specific content,
// but share one premium, responsive, email-client-safe visual shell.
const baseTemplate = (content, category = 'IRADIOS NETWORK') =>
  renderBrandedEmail({ content, category });


const otpVerificationEmail = (userName, otp) => {
  const content = `
    <h3>Καλωσήρθες, ${escapeHtml(userName)}!</h3>
    <p>Σε ευχαριστούμε για την εγγραφή σου στο <strong>iRadios Network</strong>. Για να ενεργοποιήσεις τον λογαριασμό σου και να αποκτήσεις πλήρη πρόσβαση, χρησιμοποίησε τον παρακάτω κωδικό επαλήθευσης (OTP):</p>
    
    <div class="otp-box">${escapeHtml(otp)}</div>
    
    <p style="font-size: 13px; color: #888;">Ο κωδικός λήγει σε 15 λεπτά. Μην τον μοιραστείτε με κανέναν.</p>
  `;
  return { subject: `🔑 Ενεργοποίηση Λογαριασμού: Ο Κωδικός σας (OTP)`, html: baseTemplate(content, 'SECURE YOUR ACCOUNT') };
};

const verificationLinkEmail = (userName, token) => {
  const link = FRONTEND_URL.replace(/\/+$/,'') + '/verify-email#token=' + encodeURIComponent(token);
  const content = `
    <h3>Επιβεβαίωσε το email σου, ${escapeHtml(userName)}!</h3>
    <p>Ο Free λογαριασμός σου στο iRadios λειτουργεί ήδη. Για να δεις τα playlists των σταθμών, επιβεβαίωσε το email σου.</p>
    <div style="text-align:center;margin:30px 0;"><a href="${escapeHtml(link)}" class="btn">ΕΠΙΒΕΒΑΙΩΣΗ EMAIL</a></div>
    <p style="font-size:13px;color:#aaa;">Ο σύνδεσμος λήγει σε 24 ώρες και χρησιμοποιείται μόνο μία φορά. Νέο link ακυρώνει το παλιό.</p>
    <p style="font-size:12px;color:#888;overflow-wrap:anywhere;">${escapeHtml(link)}</p>
    <p style="font-size:12px;color:#888;">Αν δεν έκανες την εγγραφή, αγνόησε αυτό το email.</p>
  `;
  return {subject:'Επιβεβαίωσε το email σου - iRadios',html:baseTemplate(content,'EMAIL VERIFICATION')};
};

const welcomeEmail = (userName, isBroadcaster = false) => {
  const loginUrl = `${FRONTEND_URL}/login`;
  let extraText = isBroadcaster 
    ? "Τώρα μπορείς να καταχωρήσεις τον σταθμό σου και να μπεις στο μεγαλύτερο ραδιοφωνικό δίκτυο." 
    : "Ξεκίνα να ακούς και να αποθηκεύεις τους αγαπημένους σου σταθμούς.";

  const content = `
    <h3>Ο λογαριασμός σου είναι έτοιμος!</h3>
    <p>Γεια σου ${escapeHtml(userName)}, η επαλήθευση του email σου ολοκληρώθηκε με επιτυχία.</p>
    <p>${escapeHtml(extraText)}</p>
    <div style="text-align: center; margin-top: 30px;">
      <a href="${escapeHtml(loginUrl)}" class="btn">ΕΙΣΟΔΟΣ ΣΤΟ IRADIOS</a>
    </div>
  `;
  return { subject: `Καλωσήρθες στο iRadios Network! 📻`, html: baseTemplate(content, 'WELCOME TO IRADIOSGR') };
};

/**
 * Welcome immediately after a verified listener email/OTP.
 * The confirmation is always sent. Strong upgrade advertising is optional
 * and must be enabled only for an account with explicit marketing consent.
 * All features come from the exact same benefits inventory as /premium.
 */
const verifiedListenerWelcomeEmail = (userName,{promotePremium=false,unsubscribeLink=null}={}) => {
  const {siteOrigin,actionButton}=require('./emailDesign');
  const {premiumBenefitsList}=require('./premiumBillingEmailTemplates');
  const name=escapeHtml(userName||'φίλε ακροατή');
  const origin=siteOrigin();
  const premium=promotePremium===true;
  const verified=`
   <div style="margin:0 0 24px;border:1px solid #52683D;background:#1B2920;border-radius:18px;padding:18px 21px;">
    <p style="color:#CCFF00;margin:0 0 7px;font-weight:800;font-size:12px;letter-spacing:1px;">✓ ΕΠΙΒΕΒΑΙΩΜΕΝΟΣ ΛΟΓΑΡΙΑΣΜΟΣ</p>
    <p style="color:#F6F8FF;margin:0;font-size:20px;font-weight:800;line-height:1.35;">Ο λογαριασμός σου επιβεβαιώθηκε με επιτυχία!</p>
   </div>
   <h3>Καλωσόρισες στο iRadiosGR, ${name}!</h3>
   <p>Το email σου επιβεβαιώθηκε και ο λογαριασμός σου είναι πλέον ενεργός. Μπορείς να ακούσεις τους αγαπημένους σου σταθμούς, να τους αποθηκεύσεις στα Αγαπημένα και να δεις τα playlists των σταθμών.</p>
   <p>Η δωρεάν ακρόαση παραμένει διαθέσιμη κανονικά. Η αναβάθμιση σε Premium είναι προαιρετική.</p>
   ${actionButton('ΜΠΕΣ ΣΤΟ IRADIOS',origin+'/')}
  `;
  const upgrade=premium?`
   <div style="margin:32px 0 0;padding:24px 22px;border-radius:22px;border:1px solid #566E2E;background-color:#182317;">
    <p style="margin:0 0 8px;color:#CCFF00;letter-spacing:1.7px;font-size:11px;font-weight:800;">Η ΜΟΥΣΙΚΗ ΣΟΥ. ΣΤΟ ΕΠΟΜΕΝΟ ΕΠΙΠΕΔΟ.</p>
    <h2 style="font-size:25px;line-height:1.2;letter-spacing:-.5px;margin:0 0 12px;color:#FFFFFF;">Το Free είναι μόνο η αρχή. Το Premium είναι η πλήρης εμπειρία.</h2>
    <p style="font-size:14px;line-height:1.75;margin:0;color:#D0DACD;">Περισσότερος έλεγχος στον ήχο, αναγνώριση τραγουδιών και γρήγορη αναζήτηση στο Spotify και το Apple Music. Δες τι ξεκλειδώνει το iRadiosGR Premium.</p>
   </div>
   ${premiumBenefitsList('ΟΛΑ ΟΣΑ ΑΠΟΛΑΜΒΑΝΕΙΣ ΜΕ PREMIUM')}
   <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:#222B1A;border:1px solid #566E2E;border-radius:18px;">
    <tr><td style="padding:24px 22px;text-align:center;">
     <p style="margin:0 0 5px;color:#D7E7CA;font-size:12px;font-weight:700;">ΞΕΚΙΝΑ ΤΗΝ PREMIUM ΕΜΠΕΙΡΙΑ</p>
     <p style="margin:0;color:#CCFF00;font-size:38px;line-height:1.2;font-weight:900;">3,99 € <span style="font-size:15px;color:#D7E7CA;">/ μήνα</span></p>
     <p style="margin:10px 0 0;color:#BAC6B2;font-size:12px;">Τελική τιμή με ΦΠΑ 24% · Μηνιαία συνδρομή · Ακύρωση όποτε θέλεις</p>
    </td></tr>
   </table>
   ${actionButton('ΑΝΑΒΑΘΜΙΣΗ ΣΕ PREMIUM — 3,99 €/ΜΗΝΑ',origin+'/premium')}
   <p style="color:#AEB9C4;font-size:12px;line-height:1.8;">Η συνδρομή ανανεώνεται αυτόματα με 3,99 € κάθε μήνα, έως ότου την ακυρώσεις από το Billing. Δεν γίνεται καμία χρέωση μέσω αυτού του email — πρώτα επιλέγεις εσύ «Έναρξη συνδρομής» και ολοκληρώνεις την ασφαλή πληρωμή.</p>
   <p style="color:#AEB9C4;font-size:12px;line-height:1.8;">Προτιμάς μόνο το Free; Συνέχισε κανονικά, χωρίς καμία υποχρέωση.</p>
   ${unsubscribeLink?'<p style="font-size:12px;"><a style="color:#B9C6D3;text-decoration:underline;" href="'+escapeHtml(unsubscribeLink)+'">Διακοπή προωθητικών emails</a></p>':''}
  `:'';
  const html=baseTemplate(verified+upgrade,'EMAIL VERIFIED · IRADIOSGR');
  return {
    subject:'✅ Το email σου επιβεβαιώθηκε — iRadiosGR',
    html,
    text:'Ο λογαριασμός σου επιβεβαιώθηκε με επιτυχία. Μπορείς να χρησιμοποιείς το iRadiosGR και να βλέπεις τα playlists των σταθμών.\n'+origin+'/' +
      (premium?'\nΗ μέγιστη εμπειρία iRadiosGR: Premium 3,99 € τον μήνα με ΦΠΑ. Μηνιαία αυτόματη ανανέωση μέχρι να ακυρώσεις. Αναβάθμιση: '+origin+'/premium\n'+(unsubscribeLink||''):'')
  };
};

const customAdminEmail = (htmlContent) => {
  return baseTemplate(htmlContent, 'A MESSAGE FROM IRADIOSGR');
};

// 🟢 ΝΕΟ: Template για Password Reset
const passwordResetEmail = (userName, resetLink) => {
  const content = `
    <h3>Επαναφορά Κωδικού Πρόσβασης</h3>
    <p>Γεια σου ${escapeHtml(userName)}, λάβαμε ένα αίτημα για αλλαγή του κωδικού πρόσβασης στο λογαριασμό σου.</p>
    <p>Πάτησε το παρακάτω κουμπί για να δημιουργήσεις έναν νέο κωδικό. Το link είναι <strong>ενεργό για 1 ώρα</strong>.</p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${escapeHtml(resetLink)}" class="btn">ΔΗΜΙΟΥΡΓΙΑ ΝΕΟΥ ΚΩΔΙΚΟΥ</a>
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
    <p>Γεια σου <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Σε ευχαριστούμε για την εμπιστοσύνη σου στο <strong>iRadios Ad Network</strong>. Η πληρωμή σου ολοκληρώθηκε επιτυχώς και η καμπάνια σου έχει σταλεί για τελικό έλεγχο από την ομάδα μας.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px solid #222; margin: 25px 0;">
      <table width="100%" style="color: #ccc; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0;">Πακέτο:</td>
          <td style="text-align: right; color: #fff; font-weight: 800;">${escapeHtml(planName)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">${escapeHtml(amount)}€</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Κατάσταση:</td>
          <td style="text-align: right; color: #ffa500; font-weight: 800;">Υπό Έγκριση</td>
        </tr>
      </table>
    </div>

    <p>Μπορείς να παρακολουθείς την πορεία της διαφήμισής σου και τα στατιστικά (Views, Clicks, CTR) από το Dashboard σου.</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${escapeHtml(dashboardUrl)}" class="btn">ADVERTISER DASHBOARD</a>
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
          <td style="text-align: right; color: #fff; font-weight: 800; border-bottom: 1px solid #222;">${escapeHtml(companyName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #222;">Email Πελάτη:</td>
          <td style="text-align: right; color: #fff; font-weight: 800; border-bottom: 1px solid #222;">${escapeHtml(userEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #222;">Υπηρεσία:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800; border-bottom: 1px solid #222;">${escapeHtml(planName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-size: 18px; font-weight: 900;">${escapeHtml(amount)}€</td>
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
    
    <p>Γεια σου <strong>${escapeHtml(userName)}</strong>,</p>
    
    <p>Η ομάδα μας μόλις ολοκλήρωσε τον έλεγχο και ενέκρινε την καταχώρηση του σταθμού <strong style="color: #fff;">${escapeHtml(stationName)}</strong>!</p>
    
    <p>Ο σταθμός σου βρίσκεται πλέον στον επίσημο κατάλογο του <strong>iRadios</strong>, διαθέσιμος σε όλους τους ακροατές μας.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px dashed rgba(204,255,0,0.4); margin: 30px 0; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
      <p style="margin-top: 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Το επισημο link του σταθμου σου ειναι:</p>
      <a href="${escapeHtml(stationUrl)}" style="color: #ccff00; font-size: 16px; font-weight: 800; text-decoration: none; word-break: break-all;">
        ${escapeHtml(stationUrl)}
      </a>
    </div>

    <p>Μπες στο <strong>Broadcaster Dashboard</strong> για να δεις τα πρώτα σου στατιστικά, να ενεργοποιήσεις το <strong>DSP Engine</strong> (αν δεν το έχεις κάνει ήδη) και να διαχειριστείς το πρόγραμμα και την παρουσία του σταθμού σου στο δίκτυο.</p>

    <div style="text-align: center; margin-top: 35px; margin-bottom: 40px;">
      <a href="${escapeHtml(dashboardUrl)}" class="btn">BROADCASTER DASHBOARD</a>
    </div>

    <div style="background-color: #1a1a1a; padding: 20px; border-radius: 12px; border-left: 4px solid #ccff00; margin-top: 20px;">
      <h4 style="color: #fff; margin-top: 0; margin-bottom: 10px; font-size: 18px;">Μοιραστείτε τα καλά νέα! 📢</h4>
      <p style="font-size: 14px; color: #ccc; margin-bottom: 15px;">
        Βοηθήστε τους ακροατές σας να σας βρίσκουν εύκολα από κάθε συσκευή. Σας προτείνουμε να:
      </p>
      <ul style="color: #ccc; font-size: 14px; padding-left: 20px; margin-bottom: 0;">
        <li style="margin-bottom: 8px;"><strong>Κοινοποιήσετε το link</strong> στα Social Media σας (Facebook, Instagram Stories, X/Twitter).</li>
        <li style="margin-bottom: 8px;"><strong>Χρησιμοποιήστε τον Widget Player στο Website σας</strong>  κάνοντας Copy-Paste τον κώδικά του, μέσα το Broadcaster Studio.</li>
        <li style="margin-bottom: 8px;">Προσθέσετε το link και το υλικό στο <strong>επίσημο Website σας</strong>. Κατεβάστε τα επίσημα badges στο: <a href="${escapeHtml(pressKitUrl)}" style="color: #ccff00; text-decoration: none; font-weight: bold;">Press Kit & Badge</a>.</li>
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
    
    <p>Γεια σου <strong>${escapeHtml(userName)}</strong>,</p>
    
    <p>Η ομάδα μας έλεγξε την καταχώρηση για τον σταθμό <strong style="color: #fff;">${escapeHtml(stationName)}</strong>, αλλά δυστυχώς δεν μπορέσαμε να την εγκρίνουμε σε αυτή τη φάση.</p>
    
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
      <a href="${escapeHtml(dashboardUrl)}" class="btn" style="background-color: #ff4d4d; color: #fff !important;">ΔΙΟΡΘΩΣΗ ΣΤΟΙΧΕΙΩΝ</a>
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
    
    <p>Γεια σου <strong>${escapeHtml(userName)}</strong>,</p>
    
    <p>Σε ευχαριστούμε για την προτίμηση και την αγορά σου. Η συναλλαγή ολοκληρώθηκε επιτυχώς και το πακέτο σου είναι ήδη ενεργό στον λογαριασμό σου.</p>
    
    <div style="background-color: #000; padding: 25px; border-radius: 20px; border: 1px solid #333; margin: 30px 0; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
      <p style="margin-top: 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid #222; padding-bottom: 10px;">Στοιχεια Συναλλαγης</p>
      
      <table width="100%" style="color: #ccc; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0;">Υπηρεσία:</td>
          <td style="text-align: right; color: #fff; font-weight: 800;">${escapeHtml(displayPlanName)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Ποσό:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">${escapeHtml(amount)}€</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Κατάσταση:</td>
          <td style="text-align: right; color: #ccff00; font-weight: 800;">Ενεργό</td>
        </tr>
      </table>
    </div>

    <p>Οι νέες λειτουργίες (εφόσον αφορούν το PRO Pack ή κάποιο Addon) είναι άμεσα διαθέσιμες μέσα από το Broadcaster Dashboard. Αν αγοράσατε κάποιο Station Boost, ο σταθμός σας βρίσκεται ήδη σε προβεβλημένη θέση.</p>

    <div style="text-align: center; margin-top: 35px;">
      <a href="${escapeHtml(dashboardUrl)}" class="btn">ΜΕΤΑΒΑΣΗ ΣΤΟ DASHBOARD</a>
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

// Shared current Premium onboarding: never advertise retired or unavailable
// features from the previous generic Listener Premium template.
const {premiumBillingEmail}=require('./premiumBillingEmailTemplates');
const listenerPremiumSuccessEmail=(userName,amount='3.99')=>{
 const cents=Math.round(Number.parseFloat(String(amount).replace(',','.'))*100);
 return premiumBillingEmail({kind:'welcome',name:userName,
  amountCents:cents===199?199:399});
};

module.exports = {
  otpVerificationEmail,
  verificationLinkEmail,
  welcomeEmail,
  verifiedListenerWelcomeEmail,
  customAdminEmail,
  passwordResetEmail,
  adPaymentSuccessEmail,
  adminTransactionAlertEmail,
  stationApprovedEmail,
  stationRejectedEmail,
  broadcasterPremiumSuccessEmail,
  listenerPremiumSuccessEmail
};
