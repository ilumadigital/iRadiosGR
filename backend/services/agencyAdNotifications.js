'use strict';
const User=require('../models/User');
const {sendEmail}=require('../utils/myMailer');
const {escapeHtml,actionButton}=require('../utils/emailDesign');
const safe=s=>escapeHtml(String(s??''));
const link=(kind,id)=> {
  const root=process.env.APP_PUBLIC_URL || 'https://stage.iradios.gr';
  return root.replace(/\/$/,'')+'/backoffice/admin/'+(kind==='banner'?'banners':'ads')+'/'+encodeURIComponent(String(id))+'/edit';
};
async function mailAdmins({kind,creative,revision,agency}) {
  const admins=await User.find({role:'admin',email:{$exists:true,$ne:''}}).select('email').lean();
  const rows=Object.keys(revision.patch).map(key=>
    '<li><strong>'+safe(key)+'</strong>: '+safe(JSON.stringify(revision.before?.[key]??null))+
    ' → '+safe(JSON.stringify(revision.patch[key]))+'</li>').join('');
  const body='<h2>Αλλαγές καμπάνιας προς έγκριση</h2><p><strong>'+safe(creative.title)+
    '</strong> · Agency: '+safe(agency?.username||agency?.email||revision.agencyId)+'</p>'+
    '<p>Η ενεργή διαφήμιση παραμένει στην προηγούμενη εγκεκριμένη έκδοση.</p><ul>'+rows+'</ul>'+
    actionButton('Έλεγχος αλλαγών στο Backoffice',link(kind,creative._id));
  const sent=await Promise.all(admins.map(u=>sendEmail({
    to:u.email,subject:'iRadios GR · Έγκριση αλλαγών: '+creative.title,html:body
  })));
  return admins.length>0 && sent.every(r=>r.success);
}
async function mailAgency({agency,creative,approved,reason}) {
  if(!agency?.email)return false;
  const body='<h2>'+(approved?'Οι αλλαγές εγκρίθηκαν':'Οι αλλαγές απορρίφθηκαν')+
    '</h2><p>Καμπάνια: <strong>'+safe(creative.title)+'</strong></p>'+
    (approved?'<p>Η εγκεκριμένη έκδοση έχει δημοσιευτεί.</p>':
      '<p>Η προηγούμενη έκδοση διατηρείται. Αιτιολογία: '+safe(reason)+'</p>');
  return (await sendEmail({to:agency.email,subject:'iRadios GR · '+(approved?'Έγκριση':'Απόρριψη')+
    ' αλλαγών: '+creative.title,html:body})).success;
}
module.exports={mailAdmins,mailAgency};
