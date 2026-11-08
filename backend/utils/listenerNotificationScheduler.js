'use strict';
const cron=require('node-cron');
const mongoose=require('mongoose');
const Station=require('../models/Station');
const User=require('../models/User');
const NewsFeed=require('../models/NewsFeed');
const NotificationDispatch=require('../models/NotificationDispatch');
const {keyFor}=require('./newsFeedArticle');
const {canNotify}=require('./notificationPreferences');
const {followKey}=require('./programFollows');
const {deliver}=require('./notificationDelivery');
let started=false;
const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function athensParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit',
    weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  const pick=type=>parts.find(part=>part.type===type)?.value||'';
  return {
    day:WEEKDAYS.indexOf(pick('weekday')),
    time:pick('hour')+':'+pick('minute'),
    date:pick('year')+'-'+pick('month')+'-'+pick('day')
  };
}
function scheduledToday(station,day){
  const base=station.scheduleDayBase===1?1:0;
  return (station.schedule||[]).filter(row=>Number(row.day)===day+base);
}
async function once(key,task){
  try{await NotificationDispatch.create({_id:key});}
  catch(error){if(error.code===11000)return false;throw error;}
  try{await task();}
  catch(error){
    console.error('[NOTIFY] Dispatch failed:',key,error.message);
    // Allow retry after transient failure rather than silently losing the event.
    await NotificationDispatch.deleteOne({_id:key}).catch(()=>{});
  }
  return true;
}
async function upcomingShows(now){
  const target=athensParts(new Date(now.getTime()+5*60*1000));
  const stations=await Station.find({status:'approved','schedule.0':{$exists:true}})
    .select('_id name slug schedule scheduleDayBase').limit(2000).lean();
  const jobs=[];
  for(const station of stations){
    for(const row of scheduledToday(station,target.day).filter(row=>row.startTime===target.time)){
      const path='/station/'+encodeURIComponent(station.slug||String(station._id));
      const title='Σε 5′ ξεκινά: '+row.title;
      const body=station.name+(row.host?' · '+row.host:'');
      const key='show:'+station._id+':'+row._id+':'+target.date+':'+target.time;
      const followKeys=[followKey('show',station._id,row.title),
        row.host?followKey('dj',station._id,row.host):null].filter(Boolean);
      jobs.push(()=>once(key,()=>deliver({
        topic:'shows',title,body,path,eventKey:key,
        recipientFilter:{$or:[{favorites:station._id},{'followedPrograms.key':{$in:followKeys}}]}
      })));
    }
  }
  for(const job of jobs.slice(0,200))await job();
}
async function todayFavoritePrograms(now){
  const target=athensParts(now);
  if(target.time!=='08:00')return;
  const users=await User.find({isVerified:true,'favorites.0':{$exists:true}})
    .select('_id favorites notificationPreferences pushNotifications').limit(5000).lean();
  if(!users.length)return;
  const stationIds=[...new Set(users.flatMap(u=>(u.favorites||[]).map(String)))];
  const stations=await Station.find({_id:{$in:stationIds},status:'approved'})
    .select('_id name slug schedule scheduleDayBase').lean();
  const byId=new Map(stations.map(s=>[String(s._id),s]));
  for(const user of users){
    if(!canNotify(user,'email','favoriteSchedule')&&!canNotify(user,'push','favoriteSchedule'))continue;
    const shows=[];
    for(const id of user.favorites||[]){
      const station=byId.get(String(id));if(!station)continue;
      const first=scheduledToday(station,target.day).sort((a,b)=>a.startTime.localeCompare(b.startTime))[0];
      if(first)shows.push({station,first});
    }
    if(!shows.length)continue;
    const selected=shows.slice(0,3);
    await once('program:'+user._id+':'+target.date,()=>deliver({
      topic:'favoriteSchedule',title:'Σήμερα στους αγαπημένους σου σταθμούς',
      body:selected.map(({station,first})=>station.name+' '+first.startTime+' – '+first.title).join(' | '),
      path:'/favorites',eventKey:'program:'+user._id+':'+target.date,recipientFilter:{_id:user._id}
    }));
  }
}
async function dailyNews(now){
  const target=athensParts(now);
  if(target.time!=='09:00')return;
  const doc=await NewsFeed.findById('primary').select('enabled articles');
  if(!doc?.enabled)return;
  const fresh=(doc.articles||[]).filter(row=>row.url&&row.title
    && Date.now()-(new Date(row.publishedAt).getTime()||0)<36*3600*1000)
    .sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,30);
  if(!fresh.length)return;
  const users=await User.find({isVerified:true}).select('_id notificationPreferences pushNotifications').limit(5000).lean();
  const grouped=new Map();
  for(const user of users){
    if(!canNotify(user,'email','news')&&!canNotify(user,'push','news'))continue;
    const chosen=fresh.find(row=>{
      const categories=user.notificationPreferences?.newsCategories||[];
      return !categories.length||categories.includes(row.category);
    });
    if(!chosen)continue;
    const key=keyFor(chosen.url);
    if(!grouped.has(key))grouped.set(key,{article:chosen,users:[]});
    grouped.get(key).users.push(user._id);
  }
  await once('news:'+target.date,async()=>{
    for(const {article,users:ids} of grouped.values()){
      await deliver({topic:'news',title:article.title,
        body:article.summary||'Οι σημαντικότερες ειδήσεις, στο iRadiosGR.',
        path:'/newsfeed/'+keyFor(article.url),category:article.category||'',
        eventKey:'news:'+target.date+':'+keyFor(article.url),
        recipientFilter:{_id:{$in:ids}}
      });
    }
  });
}
async function run(now=new Date()){
  if(process.env.APP_ENV==='staging'||mongoose.connection.readyState!==1)return;
  await upcomingShows(now);
  await todayFavoritePrograms(now);
  await dailyNews(now);
}
function start(){
  if(started||process.env.APP_ENV==='staging')return;
  started=true;
  cron.schedule('* * * * *',()=>run().catch(e=>console.error('[NOTIFY] Scheduled job:',e.message)));
}
module.exports={start,run,athensParts,scheduledToday};
