'use strict';
// Pure deterministic event keys and branded-email inner HTML. sendEmail() adds
// the current iRadios shared email template; never trust title, URL or patch HTML.
const {escapeHtml,actionButton}=require('../utils/emailDesign');
const ID=/^[a-f0-9]{24}$/i;
const validEmail=email=>typeof email==='string'&&email.length<=254&&
 /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const escape=s=>escapeHtml(String(s??''));
const cleanTitle=value=>String(value??'').replace(/[\r\n]+/g,' ').trim().slice(0,150);
function eventKey({kind,sourceId,recipientUserId}){
 if(!['draft_submitted','revision_submitted','revision_approved','revision_rejected'].includes(kind)||
   !ID.test(String(sourceId))||!ID.test(String(recipientUserId)))
  throw Error('Invalid Agency notice key');
 return 'agency-ad:v1:'+kind+':'+String(sourceId)+':'+String(recipientUserId);
}
function makeNotice({kind,source,recipient,agencyName=''}) {
 if(!source||!recipient||!validEmail(recipient.email)||!ID.test(String(source.creativeId))||
    !ID.test(String(source.agencyId))||!['banner','audio'].includes(source.creativeType))
  throw Error('Invalid Agency notice scope');
 const sourceId=kind==='draft_submitted'?source.creativeId:source.revisionId;
 const key=eventKey({kind,sourceId,recipientUserId:recipient._id});
 const title=cleanTitle(source.title)||'Δημιουργικό Agency';
 const category=source.creativeType==='banner'?'Banner':'Audio';
 const adminKind=['draft_submitted','revision_submitted'].includes(kind);
 const approved=kind==='revision_approved';
 const heading=kind==='draft_submitted'?'Νέο δημιουργικό προς έγκριση':
  kind==='revision_submitted'?'Αλλαγές δημιουργικού προς έγκριση':
  approved?'Οι αλλαγές εγκρίθηκαν':'Οι αλλαγές απορρίφθηκαν';
 const origin=process.env.APP_PUBLIC_URL||'https://stage.iradios.gr';
 const actionUrl=origin.replace(/\/$/,'')+(adminKind?
  '/backoffice/admin/'+(source.creativeType==='banner'?'banners':'ads')+'/'+source.creativeId+'/edit':
  '/agency/v2/campaigns');
 const rows=kind==='revision_submitted'?
  '<p>Η προηγούμενη εγκεκριμένη έκδοση παραμένει ενεργή έως την απόφαση του Admin.</p>'+
  '<ul>'+Object.entries(source.patch||{}).slice(0,32).map(([field,value])=>
   '<li><strong>'+escape(field.slice(0,100))+'</strong>: '+
   escape(JSON.stringify(source.before?.[field]??null).slice(0,1300))+
   ' → '+escape(JSON.stringify(value??null).slice(0,1300))+'</li>').join('')+'</ul>':
  kind==='draft_submitted'?
   '<p>Το δημιουργικό έχει αποθηκευτεί ως εκκρεμές και χρειάζεται έγκριση Admin.</p>':
  approved?
   '<p>Η νέα εγκεκριμένη έκδοση δημοσιεύτηκε σύμφωνα με τις προϋποθέσεις προβολής.</p>':
   '<p>Οι αλλαγές δεν δημοσιεύτηκαν. Η προηγούμενη έκδοση διατηρείται.</p>'+
   '<p><strong>Αιτιολογία:</strong> '+escape(source.reason||'Χωρίς αιτιολογία')+'</p>';
 const html='<h2>'+escape(heading)+'</h2><p><strong>'+
  escape(category)+':</strong> '+escape(title)+'</p>'+
  (adminKind?'<p><strong>Agency:</strong> '+escape(agencyName)+'</p>':'')+
  rows+actionButton(adminKind?'Έλεγχος στο Admin Backoffice':'Προβολή καμπάνιας',actionUrl);
 return {
  eventKey:key,kind,creativeType:source.creativeType,
  creativeId:source.creativeId,
  revisionId:kind==='draft_submitted'?null:source.revisionId,
  agencyId:source.agencyId,recipientUserId:recipient._id,
  recipientEmail:recipient.email,subject:'iRadios GR · '+heading+': '+title,html
 };
}
module.exports={eventKey,makeNotice,validEmail};
