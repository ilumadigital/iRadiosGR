'use strict';
const nodemailer=require('nodemailer');
const {renderBrandedEmail,escapeHtml}=require('../utils/emailDesign');
const RECIPIENT='sales@iluma.gr';
// Separate delivery: staging's generic mailer intentionally uses Mailpit.
// Admin login must reach the real fixed mailbox, or fail closed.
async function sendAdminOtpEmail({code,username}){
 const host=String(process.env.ADMIN_2FA_SMTP_HOST||'').trim();
 const user=String(process.env.ADMIN_2FA_SMTP_USER||'').trim();
 const pass=process.env.ADMIN_2FA_SMTP_PASS;
 const from=String(process.env.ADMIN_2FA_SMTP_FROM||'').trim();
 const port=Number(process.env.ADMIN_2FA_SMTP_PORT||465);
 if(!host||!user||!pass||!from||!Number.isInteger(port)||port<1||port>65535||
   /^(?:localhost|mailpit|127(?:\.\d{1,3}){3}|::1)$/i.test(host))
  throw Error('Admin 2FA real SMTP is not configured');
 const transporter=nodemailer.createTransport({host,port,secure:port===465,
  auth:{user,pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000});
 try{
  const info=await transporter.sendMail({
   from,to:RECIPIENT,subject:'iRadiosGR Admin — Κωδικός σύνδεσης',
   text:'iRadiosGR Admin login\nΚωδικός: '+code+'\nΙσχύει για 10 λεπτά. Αν δεν ζητήσατε σύνδεση, αγνοήστε το μήνυμα.',
   html:renderBrandedEmail({category:'IRADIOSGR · SECURITY',
    headline:'Επιβεβαίωση σύνδεσης Admin',
    preheader:'Κωδικός σύνδεσης μίας χρήσης — ισχύς 10 λεπτά',
    content:'<p>Ζητήθηκε σύνδεση στο iRadiosGR Admin'+
     (username?' για <strong>'+escapeHtml(username)+'</strong>':'')+
     '.</p><p>Χρησιμοποίησε τον παρακάτω κωδικό μίας χρήσης:</p>'+
     '<div class="otp-box" style="padding:20px;font-size:32px;letter-spacing:10px;text-align:center;font-weight:800;">'+code+
     '</div><p>Ο κωδικός λήγει σε <strong>10 λεπτά</strong>. Αν δεν ζήτησες σύνδεση, αγνόησε το email.</p>',
    showHomeLink:false})
  });
  return Array.isArray(info.accepted)&&
   info.accepted.some(address=>String(address).toLowerCase()===RECIPIENT);
 }finally{transporter.close();}
}
module.exports={sendAdminOtpEmail,RECIPIENT};
