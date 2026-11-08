'use strict';
const NewsFeed=require('../models/NewsFeed');
const {DEFAULT_FEED_URL,validateUrl,download}=require('../utils/rssNews');
const CACHE_MS=5*60*1000,RETRY_MS=60*1000;
let pending=null;
async function settings(){
  return NewsFeed.findOneAndUpdate({_id:'primary'},{$setOnInsert:{feedUrl:DEFAULT_FEED_URL,enabled:true}},
    {upsert:true,new:true,setDefaultsOnInsert:true});
}
async function sync(doc,force=false){
  if(pending)return pending;
  if(!force&&doc.lastAttemptAt&&Date.now()-new Date(doc.lastAttemptAt).getTime()<RETRY_MS)return doc;
  pending=(async()=>{
    const target=doc.feedUrl;
    doc.lastAttemptAt=new Date();
    try{
      const {articles,feedTitle}=await download(target);
      // Never publish results from a feed superseded while download was underway.
      const latest=await NewsFeed.findById('primary');
      if(latest && latest.feedUrl!==target)return latest;
      doc.articles=articles;doc.feedTitle=feedTitle;doc.lastSyncedAt=new Date();doc.lastError='';
    }catch(error){
      doc.lastError=String(error.message||'Αποτυχία συγχρονισμού.').slice(0,220);
      await doc.save();
      if(force)throw Object.assign(new Error(doc.lastError),{status:422});
      return doc;
    }
    await doc.save();
    return doc;
  })().finally(()=>{pending=null;});
  return pending;
}
const fail=(res,error)=>res.status(error.status||503).json({error:error.status?error.message:'Το Newsfeed δεν είναι προσωρινά διαθέσιμο.'});
const view=doc=>({
  enabled:doc.enabled,feedUrl:doc.feedUrl,feedTitle:doc.feedTitle,
  articles:doc.articles||[],lastSyncedAt:doc.lastSyncedAt,lastAttemptAt:doc.lastAttemptAt,lastError:doc.lastError
});
exports.publicFeed=async(_req,res)=>{
  try{
    let doc=await settings();
    if(doc.enabled && (!doc.lastSyncedAt||Date.now()-new Date(doc.lastSyncedAt).getTime()>CACHE_MS))
      doc=await sync(doc);
    res.setHeader('Cache-Control','public, max-age=30');
    res.json({enabled:doc.enabled,feedTitle:doc.feedTitle,articles:doc.enabled?doc.articles:[],
      lastSyncedAt:doc.lastSyncedAt});
  }catch(e){fail(res,e);}
};
exports.adminFeed=async(_req,res)=>{try{res.json(view(await settings()));}catch(e){fail(res,e);}};
exports.save=async(req,res)=>{
  try{
    const feedUrl=validateUrl(req.body?.feedUrl);
    if(typeof req.body?.enabled!=='boolean')return res.status(400).json({error:'Μη έγκυρη κατάσταση Newsfeed.'});
    const doc=await settings();
    if(doc.feedUrl!==feedUrl){doc.articles=[];doc.feedTitle='';doc.lastSyncedAt=null;doc.lastAttemptAt=null;doc.lastError='';}
    doc.feedUrl=feedUrl;doc.enabled=req.body.enabled;
    await doc.save();
    res.json(view(doc));
  }catch(e){fail(res,e);}
};
exports.refresh=async(_req,res)=>{
  try{
    const doc=await settings();
    res.json(view(await sync(doc,true)));
  }catch(e){fail(res,e);}
};
