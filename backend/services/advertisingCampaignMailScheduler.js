'use strict';
const MailEvent=require('../models/AdvertisingCampaignMailEvent');
const Campaign=require('../models/AdvertisingCampaign');
const User=require('../models/User');
const {sendEmail}=require('../utils/myMailer');
const {escapeHtml,actionButton}=require('../utils/emailDesign');
let timer=null,working=false;
const safe=value=>escapeHtml(String(value||''));
const origin=()=>process.env.APP_PUBLIC_URL||'https://stage.iradios.gr';
async function enqueue({eventKey,kind,campaign,amountCents=0}){
 if(process.env.APP_ENV!=='staging')return false;
 await MailEvent.updateOne({eventKey},{$setOnInsert:{
  eventKey,kind,campaignId:campaign._id,agencyId:campaign.agencyId,
  amountCents,status:'pending'
 }},{upsert:true});
 kick();
 return true;
}
const templates={
 paid_pending_review:{
  subject:'Νέα πληρωμένη καμπάνια προς έγκριση',
  headline:'Νέα καμπάνια προς έγκριση',
  body:'Η πληρωμή έχει επιβεβαιωθεί από το Gateway. Έλεγξε τα δημιουργικά και την καμπάνια πριν ενεργοποιηθεί.'
 },
 campaign_activated:{
  subject:'Η καμπάνια ενεργοποιήθηκε στο iRadios GR',
  headline:'Η καμπάνια σου ενεργοποιήθηκε!',
  body:'Η καμπάνια εγκρίθηκε και είναι επιλέξιμη για προβολή σύμφωνα με το διαθέσιμο budget και τους κανόνες διανομής.'
 },
 campaign_approved:{
  subject:'Η καμπάνια εγκρίθηκε στο iRadios GR',
  headline:'Η καμπάνια σου εγκρίθηκε',
  body:'Η καμπάνια εγκρίθηκε. Η προβολή της θα ξεκινήσει όταν ικανοποιούνται οι προϋποθέσεις διάρκειας, ON/OFF, διαθέσιμου budget και ασφαλούς delivery.'
 },
 campaign_rejected:{
  subject:'Η καμπάνια απορρίφθηκε στο iRadios GR',
  headline:'Η καμπάνια σου δεν εγκρίθηκε',
  body:'Η καμπάνια απορρίφθηκε από τον Admin. Η αιτιολογία εμφανίζεται παρακάτω.'
 },
 topup_success:{
  subject:'Επιτυχής προσθήκη budget',
  headline:'Το budget προστέθηκε!',
  body:'Το επιβεβαιωμένο top-up πιστώθηκε στην ίδια καμπάνια. Το οικονομικό ιστορικό και οι αρχικές CPM τιμές παραμένουν ανέπαφα.'
 },
 budget_exhausted:{
  subject:'Το budget της καμπάνιας εξαντλήθηκε',
  headline:'Χρειάζεται νέο budget',
  body:'Η καμπάνια σταμάτησε να προβάλλεται επειδή εξαντλήθηκε το διαθέσιμο budget. Μπορείς να προσθέσεις budget στην ίδια καμπάνια.'
 }
};
async function deliver(event){
 const [campaign,agency]=await Promise.all([
  Campaign.findById(event.campaignId).lean(),
  User.findById(event.agencyId).select('email username').lean()
 ]);
 if(!campaign||!agency)throw Error('Campaign/agency missing');
 const template=templates[event.kind];
 const toAdmins=event.kind==='paid_pending_review';
 const recipients=toAdmins?
  (await User.find({role:'admin',email:{$exists:true,$ne:''}}).select('email').lean())
   .map(user=>user.email):[agency.email];
 if(!recipients.length)throw Error('No notification recipients');
 const amount=event.amountCents>0?'<p><strong>Ποσό budget:</strong> '+
  (event.amountCents/100).toFixed(2)+' €</p>':'';
 const action=toAdmins?
  origin().replace(/\/$/,'')+'/backoffice/admin/campaigns':
  origin().replace(/\/$/,'')+'/agency/v2/campaigns';
 const reason=event.kind==='campaign_rejected'&&campaign.rejectedReason?
  '<p><strong>Αιτιολογία:</strong> '+safe(campaign.rejectedReason)+'</p>':'';
 const html='<h2>'+safe(template.headline)+'</h2>'+
  '<p><strong>Καμπάνια:</strong> '+safe(campaign.title)+'</p>'+
  '<p><strong>Brand:</strong> '+safe(campaign.brand)+'</p>'+amount+
  '<p>'+safe(template.body)+'</p>'+reason+
  actionButton(toAdmins?'Έλεγχος στο Admin Backoffice':'Προβολή καμπάνιας',action);
 for(const recipient of recipients){
  const outcome=await sendEmail({to:recipient,
   subject:'iRadios GR · '+template.subject+': '+campaign.title,html});
  if(!outcome.success)throw Error('Mailpit delivery unavailable');
 }
}
async function run(){
 if(working||process.env.APP_ENV!=='staging')return;
 working=true;
 try{
  for(let i=0;i<15;i++){
   const now=new Date();
   const event=await MailEvent.findOneAndUpdate({
    $or:[
     {status:'pending',nextAttemptAt:{$lte:now}},
     {status:'sending',nextAttemptAt:{$lte:now}}
    ]
   },{$set:{status:'sending',nextAttemptAt:new Date(Date.now()+120000)},
     $inc:{attempts:1}},{new:true,sort:{createdAt:1}});
   if(!event)break;
   try{
    await deliver(event);
    await MailEvent.updateOne({_id:event._id,status:'sending'},
     {$set:{status:'sent',sentAt:new Date(),lastError:''}});
   }catch(error){
    const backoff=Math.min(3600,Math.pow(2,Math.min(event.attempts,9))*30);
    await MailEvent.updateOne({_id:event._id,status:'sending'},
     {$set:{status:'pending',nextAttemptAt:new Date(Date.now()+backoff*1000),
      lastError:String(error.message||'delivery failure').slice(0,140)}});
   }
  }
 }finally{working=false;}
}
function kick(){run().catch(error=>console.error('[AD MAIL] Outbox retry',error.message));}
function start(){
 if(timer||process.env.APP_ENV!=='staging')return;
 timer=setInterval(kick,60000);timer.unref?.();kick();
}
module.exports={enqueue,kick,start};
