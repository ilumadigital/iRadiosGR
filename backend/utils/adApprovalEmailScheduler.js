'use strict';
const mongoose=require('mongoose');
const Event=require('../models/AdApprovalEvent');
const User=require('../models/User');
const {sendEmail}=require('./myMailer');
const {renderBrandedEmail,escapeHtml,actionButton,infoPanel}=require('./emailDesign');
let started=false,running=false;
const stage=()=>process.env.APP_ENV==='staging';
function describe(value){
 if(value===null||value===undefined)return '—';
 if(typeof value==='object')return JSON.stringify(value).slice(0,280);
 return String(value).slice(0,280);
}
const fieldNames={title:'Τίτλος',description:'Περιγραφή',client:'Brand',
 imageUrl:'Κεντρική εικόνα',squareImageUrl:'Square εικόνα',logoUrl:'Λογότυπο',
 targetUrl:'URL προορισμού',linkUrl:'URL προορισμού',placement:'Placements',
 targetCountry:'Χώρα',targetRegion:'Περιφέρεια',targetLocations:'Νομός/περιοχή',
 designConfig:'Creative Studio',audioUrl:'Audio Spot',frequency:'Συχνότητα',
 ctaLabel:'Κουμπί CTA',brandColor:'Χρώμα brand',dspPreset:'Audio processing'};
function message(row){
 const base=stage()?'https://stage.iradios.gr':'https://iradios.gr';
 const path=row.adType==='banner'?'banners':'ads';
 const reviewUrl=base+'/backoffice/admin/'+path+'?review='+encodeURIComponent(row.adId);
 const agencyUrl=base+'/agency/dashboard';
 const lines=(row.changes||[]).slice(0,25).map(item=>
  '<tr><td style="padding:10px;border-bottom:1px solid #293340;color:#fff;">'+
   escapeHtml(fieldNames[item.field]||item.field)+'</td><td style="padding:10px;border-bottom:1px solid #293340;">'+
   escapeHtml(describe(item.before))+' → '+escapeHtml(describe(item.after))+'</td></tr>').join('');
 const isSubmit=row.kind==='submitted';
 const headline=isSubmit?'Νέες αλλαγές προς έγκριση':
  row.kind==='approved'?'Η καμπάνια εγκρίθηκε':'Αλλαγές καμπάνιας απορρίφθηκαν';
 const content=infoPanel('Καμπάνια',row.title)+
  '<p>'+(isSubmit?'Ένα Agency υπέβαλε δημιουργικό ή αλλαγές για έλεγχο. Η τελευταία εγκεκριμένη έκδοση παραμένει ενεργή.':
  row.kind==='approved'?'Η έγκριση ολοκληρώθηκε. Οι εγκεκριμένες αλλαγές εφαρμόστηκαν.':
  'Οι αλλαγές δεν δημοσιεύτηκαν. Η προηγούμενη εγκεκριμένη έκδοση παραμένει διαθέσιμη.')+'</p>'+
  (lines?'<table role="presentation" width="100%" style="font-size:12px;border-collapse:collapse;">'+lines+'</table>':'')+
  (row.reason?infoPanel('Αιτιολογία',row.reason):'')+
  actionButton(isSubmit?'Έλεγχος αλλαγών':'Προβολή καμπάνιας',isSubmit?reviewUrl:agencyUrl)+
  '<p style="font-size:12px;color:#97A3B5;">Οι εγκρίσεις πραγματοποιούνται μόνο μέσα από το προστατευμένο Backoffice.</p>';
 return {subject:'iRadios GR · '+headline+' · '+row.title,
  html:renderBrandedEmail({content,category:'ADVERTISING PLATFORM',headline,
   preheader:'iRadios GR · '+row.title})};
}
async function recipients(row){
 if(row.kind==='submitted'){
  const admins=await User.find({role:'admin',email:{$type:'string'}}).select('email').lean();
  return [...new Set(admins.map(x=>x.email).filter(Boolean))];
 }
 const agency=await User.findById(row.agencyId).select('email role').lean();
 return agency?.email?[agency.email]:[];
}
async function dispatchOnce(now=new Date()){
 if(!stage()||mongoose.connection.readyState!==1)return false;
 const row=await Event.findOneAndUpdate({
  $or:[{mailState:'queued',dueAt:{$lte:now}},
    {mailState:'sending',lockedUntil:{$lte:now}}]
 },{
  $set:{mailState:'sending',lockedUntil:new Date(+now+90_000)},
  $inc:{attempts:1}
 },{new:true,sort:{createdAt:1}});
 if(!row)return false;
 try{
  const to=await recipients(row);
  if(!to.length)throw Error('No notification recipient available');
  const data=message(row);
  const response=await sendEmail({...data,to});
  if(!response?.success)throw Error(response?.error||'SMTP send failed');
  await Event.updateOne({_id:row._id,mailState:'sending'},
   {$set:{mailState:'sent',sentAt:new Date(),lockedUntil:null,lastError:''}});
 }catch(error){
  const failed=row.attempts>=6;
  await Event.updateOne({_id:row._id,mailState:'sending'},{$set:{
   mailState:failed?'failed':'queued',lockedUntil:null,
   dueAt:new Date(Date.now()+Math.min(3600_000,30_000*2**row.attempts)),
   lastError:String(error.message).slice(0,300)
  }});
  console.error('[AD APPROVAL MAIL] Deferred',row.eventKey,error.message);
 }
 return true;
}
async function flush(){
 if(running||!stage())return;
 running=true;
 try{for(let i=0;i<20;i++){if(!(await dispatchOnce()))break;}}
 catch(error){console.error('[AD APPROVAL MAIL]',error.message);}
 finally{running=false;}
}
function start(){
 if(started||!stage())return;
 started=true;
 const job=setInterval(()=>{flush().catch(()=>{});},30_000);
 job.unref?.();
 flush().catch(()=>{});
}
module.exports={start,flush,dispatchOnce,message};
