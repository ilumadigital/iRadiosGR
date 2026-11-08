const nodemailer = require("nodemailer");
const { ensureBrandedEmail, plainTextContent } = require("./emailDesign");

let transporterInstance = null;

async function getTransporter() {
  if (transporterInstance) return transporterInstance;

  if (process.env.APP_ENV === 'staging') {
    transporterInstance = nodemailer.createTransport({
      host: 'mailpit', port: 1025, secure: false, ignoreTLS: true
    });
    return transporterInstance;
  }


  // 1. Production / Staging SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 587);
    
    transporterInstance = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: port === 465, // true μόνο για θύρα 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporterInstance.verify();
      console.log(`✅ ΕΠΙΤΥΧΗΣ σύνδεση στον SMTP (${process.env.SMTP_HOST}:${port})`);
    } catch (verifyErr) {
      console.error("❌ ΑΠΟΤΥΧΙΑ σύνδεσης στον SMTP:", verifyErr.message);
    }
    
    return transporterInstance;
  }

  // 2. Fallback σε Ethereal (Test account) αν λείπουν τα credentials
  console.log("⚠️ Δεν βρέθηκαν SMTP credentials στο .env. Δημιουργία Ethereal (test) account...");
  const testAcc = await nodemailer.createTestAccount();

  transporterInstance = nodemailer.createTransport({
    host: testAcc.smtp.host,
    port: testAcc.smtp.port,
    secure: testAcc.smtp.secure,
    auth: {
      user: testAcc.user,
      pass: testAcc.pass,
    },
  });

  return transporterInstance;
}

/**
 * Κεντρική συνάρτηση αποστολής email
 */
async function sendEmail({ to, bcc, subject, text, html }) {
  try {
    const transporter = await getTransporter();

    // Default From Name/Email προσαρμοσμένο στο iRadios
    const from = process.env.MAIL_FROM || '"iRadios Network" <no-reply@iradios.gr>';

    // One centralized render path also brands legacy ad-hoc emails (invitations,
    // notifications, admin messages) without double-wrapping shared templates.
    const hasHtml = typeof html === 'string' && html.trim().length > 0;
    const htmlSource = hasHtml ? html :
      (typeof text === 'string' && text.trim() ? plainTextContent(text) : null);
    const finalHtml = htmlSource ? ensureBrandedEmail(htmlSource, {
      preheader: subject || 'Μήνυμα από το iRadiosGR',
      category: 'IRADIOSGR · UPDATE'
    }) : undefined;

    const info = await transporter.sendMail({
      from,
      to,
      bcc,
      subject,
      text,
      html: finalHtml,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log("✅ Email preview (Ethereal):", preview);
    } else {
      console.log(`✅ Email εστάλη στο ${to} | ID: ${info.messageId}`);
    }

    return { success: true, messageId: info.messageId, preview };
  } catch (error) {
    console.error(`❌ Σφάλμα κατά την αποστολή email στο ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
