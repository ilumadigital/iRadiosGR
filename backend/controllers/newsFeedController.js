'use strict';
const crypto=require('crypto');
const NewsFeed=require('../models/NewsFeed');
const {DEFAULT_FEED_URL,normalizeSource,download}=require('../utils/rssNews');
const CACHE_MS=5*60*1000,RETRY_MS=60*1000,MAX_SOURCES=12;
let pending=null;
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const sourceOf=(input,id)=>({
  id:id||crypto.randomUUID(),...normalizeSource(input),label:typeof input?.label==='string'?input.label.trim().slice(0,80):'',
  enabled:input?.enabled!==false
});
async function settings(){
  let doc=await NewsFeed.findOneAndUpdate({_id:'primary'},
    {$setOnInsert:{feedUrl:DEFAULT_FEED_URL,enabled:true}},
    {upsert:true,new:true,setDefaultsOnInsert:true});
  if(!doc.sources?.length){
    const legacyUrl=doc.feedUrl||DEFAULT_FEED_URL;
    const first=sourceOf({url:legacyUrl},'legacy-'+crypto.createHash('sha256').update(legacyUrl).digest('hex').slice(0,32));
    doc.sources=[first];
    doc.articles.forEach(item=>{if(!item.sourceId)item.sourceId=first.id;});
    doc.markModified('articles');
    await doc.save();
  }
  return doc;
}
function currentView(doc){
  return {enabled:doc.enabled,feedUrl:doc.feedUrl,feedTitle:doc.feedTitle,
    sources:doc.sources||[],articles:doc.articles||[],
    lastSyncedAt:doc.lastSyncedAt,lastAttemptAt:doc.lastAttemptAt,lastError:doc.lastError};
}
const fail=(res,e)=>res.status(e.status||503).json({error:e.status?e.message:'Το Newsfeed δεν είναι προσωρινά διαθέσιμο.'});
const due=s=>!s.lastAttemptAt||Date.now()-new Date(s.lastAttemptAt).getTime()>RETRY_MS &&
  (!s.lastSyncedAt||Date.now()-new Date(s.lastSyncedAt).getTime()>CACHE_MS);
async function sync(doc,force=false){
  if(pending)return pending;
  const sources=doc.sources.filter(s=>s.enabled&&(force||due(s)));
  if(!sources.length)return doc;
  pending=(async()=>{
    const started=new Date(),revision=doc.configRevision||0;
    // A failure in one publisher must never take down the others.
    const results=await Promise.all(sources.map(async s=>{
      try{return {id:s.id,data:await download(s)};}
      catch(e){return {id:s.id,error:String(e.message||e).slice(0,220)};}
    }));
    const current=await NewsFeed.findById('primary');
    if(!current||(current.configRevision||0)!==revision)return current||doc;
    const matched=new Map(results.map(r=>[r.id,r]));
    const fresh=[],failed=[],successful=new Set();
    for(const s of current.sources){
      const r=matched.get(s.id);if(!r)continue;
      s.lastAttemptAt=started;
      if(r.error){s.lastError=r.error;failed.push(s.label||s.domain||s.url);}
      else{
        s.feedTitle=r.data.feedTitle||s.label||s.domain||'';
        s.lastSyncedAt=started;s.lastError=(r.data.warnings||[]).join(' | ').slice(0,220);
        s.fetchedCount=r.data.articles.length;
        s.retrievalMode=r.data.retrievalMode;successful.add(s.id);
        fresh.push(...r.data.articles.map(article=>({...article,sourceId:s.id})));
      }
    }
    const retained=(current.articles||[]).filter(a=>current.sources.some(s=>s.enabled&&s.id===a.sourceId)&&!successful.has(a.sourceId));
    const all=[...fresh,...retained];
    const seen=new Set();
    current.articles=all.sort((a,b)=>(new Date(b.publishedAt||0).getTime()||0)-(new Date(a.publishedAt||0).getTime()||0))
      .filter(item=>{
        const fingerprint=(item.source||'').toLowerCase().trim()+'|'+(item.title||'').toLowerCase().trim();
        if(seen.has(item.url)||seen.has(fingerprint))return false;
        seen.add(item.url);seen.add(fingerprint);return true;
      }).slice(0,150);
    current.lastAttemptAt=started;
    if(successful.size)current.lastSyncedAt=started;
    current.lastError=failed.length?failed.length+' πηγές με σφάλμα. Δες λεπτομέρειες ανά εκδότη.':'';
    current.feedTitle=current.sources.length===1?current.sources[0].feedTitle:'Ειδήσεις από επιλεγμένους εκδότες';
    await current.save();
    return current;
  })().finally(()=>{pending=null;});
  return pending;
}
exports.publicFeed=async(_req,res)=>{
  try{
    let doc=await settings();
    if(doc.enabled)doc=await sync(doc);
    res.setHeader('Cache-Control','public, max-age=30');
    res.json({enabled:doc.enabled,feedTitle:doc.feedTitle,
      articles:doc.enabled?doc.articles.filter(a=>doc.sources.some(s=>s.enabled&&s.id===a.sourceId)):[],lastSyncedAt:doc.lastSyncedAt});
  }catch(e){fail(res,e);}
};
exports.adminFeed=async(_req,res)=>{try{res.json(currentView(await settings()));}catch(e){fail(res,e);}};
exports.save=async(req,res)=>{
  try{
    if(typeof req.body?.enabled!=='boolean')throw error('Μη έγκυρη κατάσταση Newsfeed.');
    const doc=await settings();
    let raw=req.body?.sources;
    if(!Array.isArray(raw)){
      if(typeof req.body?.feedUrl==='string')raw=[{url:req.body.feedUrl}];
      else throw error('Χρειάζεται λίστα πηγών ειδήσεων.');
    }
    if(!raw.length||raw.length>MAX_SOURCES)throw error('Επίλεξε 1 έως 12 publishers ή RSS feeds.');
    const previous=new Map(doc.sources.map(s=>[s.id,s]));
    const items=raw.map(item=>{
      const id=typeof item.id==='string'&&previous.has(item.id)?item.id:crypto.randomUUID();
      const normalized=sourceOf(item,id),old=previous.get(id);
      if(old&&old.url===normalized.url&&old.domain===normalized.domain){
        for(const k of ['feedTitle','lastSyncedAt','lastAttemptAt','lastError','fetchedCount','retrievalMode'])
          normalized[k]=old[k];
      }
      return normalized;
    });
    if(new Set(items.map(s=>s.url)).size!==items.length)throw error('Η ίδια πηγή υπάρχει δύο φορές.');
    doc.enabled=req.body.enabled;doc.sources=items;doc.configRevision=(doc.configRevision||0)+1;
    const ids=new Set(items.map(x=>x.id));
    doc.articles=doc.articles.filter(a=>ids.has(a.sourceId)&&items.some(s=>s.enabled&&s.id===a.sourceId&&s.url===previous.get(s.id)?.url));
    doc.feedUrl=items[0].url;doc.lastError='';doc.lastAttemptAt=null;
    await doc.save();res.json(currentView(doc));
  }catch(e){fail(res,e);}
};
exports.refresh=async(_req,res)=>{
  try{
    let doc=await settings();doc=await sync(doc,true);
    res.json(currentView(doc));
  }catch(e){fail(res,e);}
};
