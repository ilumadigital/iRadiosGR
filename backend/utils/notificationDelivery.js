'use strict';
const User=require('../models/User');
const Subscription=require('../models/Subscription');
const webpush=require('web-push');
const {sendEmail}=require('./myMailer');
const {canNotify,notificationPreferencesOf,TOPICS}=require('./notificationPreferences');

const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const site=()=>{
  const origin=process.env.FRONTEND_URL||'https://iradios.gr';
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(origin)?origin.replace(/\/$/,''):'https://iradios.gr';
};
const safePath=path=>typeof path==='string' && path.startsWith('/') && !path.startsWith('//')
  && !/[\r\n<>]/.test(path)?path:'/';
const isStaging=()=>process.env.APP_ENV==='staging';
let pushInitialized=false;
function initPush(){
  if(pushInitialized)return true;
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return false;
  webpush.setVapidDetails('mailto:info@iluma.gr',
    process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  pushInitialized=true;
  return true;
}

/**
 * Category notification sender.
 * - Both channels use the same saved preference and category checks.
 * - No external transport is called from staging.
 * - User selection always happens on the server, not through a userId in JSON.
 * - Query may scope recipients (e.g. favorites: stationId).
 */
async function deliver({topic,title,body,path='/',recipientFilter={},category='',channels=['push','email']}={}){
  if(!TOPICS.includes(topic))throw Error('Unsupported notification topic');
  if(isStaging())return {disabled:true,sentPush:0,sentEmail:0};
  const safeTitle=String(title||'').trim().slice(0,140);
  const safeBody=String(body||'').trim().slice(0,600);
  if(!safeTitle||!safeBody)throw Error('Missing message');
  const validPath=safePath(path);
  const userFilter={$and:[{isVerified:true},recipientFilter]};
  const users=await User.find(userFilter).limit(5000).lean();
  const target=users.filter(user=> {
    if(topic==='news' && user.notificationPreferences?.newsCategories?.length) {
      if(!user.notificationPreferences.newsCategories.includes(category))return false;
    }
    return channels.some(channel=>canNotify(user,channel,topic));
  });
  const pushUsers=target.filter(u=>channels.includes('push')&&canNotify(u,'push',topic));
  const emailUsers=target.filter(u=>channels.includes('email')&&canNotify(u,'email',topic)&&u.email);
  const pushIds=pushUsers.map(u=>u._id);
  let sentPush=0,sentEmail=0;
  if(pushIds.length&&initPush()){
    const subscriptions=await Subscription.find({userId:{$in:pushIds}}).lean();
    const bodyJson=JSON.stringify({title:safeTitle,body:safeBody,url:site()+validPath,tag:'ir-'+topic});
    const jobs=subscriptions.map(sub=>async()=>{
      try{await webpush.sendNotification(sub,bodyJson);sentPush++;}
      catch(error){
        if(error.statusCode===404||error.statusCode===410)await Subscription.deleteOne({_id:sub._id}).catch(()=>{});
      }
    });
    for(let i=0;i<jobs.length;i+=10)await Promise.all(jobs.slice(i,i+10).map(job=>job()));
  }
  const fullLink=site()+validPath;
  const profileLink=site()+'/profile';
  const html='<div style="background:#0c1215;padding:28px;color:#f8faf8;font-family:Arial,sans-serif;border-radius:18px">' +
    '<p style="font-size:12px;letter-spacing:2px;color:#ccff00">iRadiosGR</p>' +
    '<h2>'+escapeHtml(safeTitle)+'</h2><p style="line-height:1.65">'+escapeHtml(safeBody)+'</p>' +
    '<p><a style="color:#ccff00" href="'+escapeHtml(fullLink)+'">Άνοιξε στο iRadiosGR</a></p>' +
    '<hr style="border:0;border-top:1px solid #394347"><p style="color:#aeb8bb;font-size:11px">Οι ειδοποιήσεις διαχειρίζονται από <a style="color:#ccff00" href="'+escapeHtml(profileLink)+'">το προφίλ σου</a>.</p></div>';
  for(let i=0;i<emailUsers.length;i+=10){
    await Promise.all(emailUsers.slice(i,i+10).map(async user=>{
      try{
        const result=await sendEmail({to:user.email,subject:safeTitle,text:safeBody+'\n'+fullLink+'\nΡυθμίσεις: '+profileLink,html});
        if(result?.success)sentEmail++;
      }catch(error){console.warn('[NOTIFY] Email failed:',error.message);}
    }));
  }
  return {disabled:false,recipients:target.length,sentPush,sentEmail};
}
module.exports={deliver,initPush,safePath};
