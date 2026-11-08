'use strict';
const crypto=require('crypto');
const NewsFeed=require('../models/NewsFeed');
const NewsFeedArchive=require('../models/NewsFeedArchive');
const {keyFor,publicArticle,relatedArticles}=require('../utils/newsFeedArticle');
const {DEFAULT_FEED_URL,normalizeSource,download}=require('../utils/rssNews');
const newsbeast=require('../utils/newsbeastSources');
const initialPreset=require('../utils/newsFeedInitialPreset');
// Ten-minute server refresh; public requests serve the persisted cache.
const CACHE_MS=10*60*1000,RETRY_MS=10*60*1000,MAX_SOURCES=32,MAX_ARTICLES=500;
let pending=null;
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const sourceOf=(input,id)=>({
  id:id||crypto.randomUUID(),...normalizeSource(input),label:typeof input?.label==='string'?input.label.trim().slice(0,80):'',
  category:typeof input?.category==='string'&&input.category.trim()?input.category.trim().slice(0,50):
    newsbeast.categoryOfUrl(input?.url),
  enabled:input?.enabled!==false
});
async function settings(){
  let doc=await NewsFeed.findOneAndUpdate({_id:'primary'},
    {$setOnInsert:{feedUrl:DEFAULT_FEED_URL,enabled:true}},
    {upsert:true,new:true,setDefaultsOnInsert:true});
  // Staging-only one-time reset. Keep subsequent admin changes across restarts.
  if(process.env.APP_ENV==='staging'&&doc.bootstrapVersion!==initialPreset.VERSION){
    const seed=sourceOf({url:initialPreset.FEED_URL,label:initialPreset.FEED_LABEL},
      'rssnews-selected-2026-11-08');
    const updated=await NewsFeed.findOneAndUpdate({
      _id:'primary',bootstrapVersion:{$ne:initialPreset.VERSION}
    },{
      $set:{bootstrapVersion:initialPreset.VERSION,sources:[seed],
        feedUrl:seed.url,enabled:true,articles:[],hiddenArticleKeys:[],
        feedTitle:initialPreset.FEED_LABEL,
        lastSyncedAt:null,lastAttemptAt:null,lastError:''},
      $inc:{configRevision:1}
    },{new:true});
    doc=updated||await NewsFeed.findById('primary');
  }
  if(!doc.sources?.length && !doc.configRevision){
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
    sources:doc.sources||[],articles:doc.articles||[],syncing:Boolean(pending),
    refreshIntervalSeconds:600,maxArticles:MAX_ARTICLES,hiddenArticleCount:(doc.hiddenArticleKeys||[]).length,
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
    // A failure in one publisher must never take down the others. Reuse covers
    // already cached for this article before requesting publisher Open Graph.
    const existingImages=new Map((doc.articles||[]).filter(a=>a.imageUrl)
      .map(a=>[a.sourceId+'|'+a.url,a.imageUrl]));
    const results=await Promise.all(sources.map(async s=>{
      try{return {id:s.id,data:await download(s,{existingImages})};}
      catch(e){return {id:s.id,error:String(e.message||e).slice(0,220)};}
    }));
    const current=await NewsFeed.findById('primary');
    if(!current||(current.configRevision||0)!==revision)return current||doc;
    const matched=new Map(results.map(r=>[r.id,r]));
    const fresh=[],failed=[],successful=new Set();
    const before=current.articles||[];
    const previousArticle=new Map((current.articles||[]).map(a=>[a.sourceId+'|'+a.url,a]));
    for(const s of current.sources){
      const r=matched.get(s.id);if(!r)continue;
      s.lastAttemptAt=started;
      if(r.error){s.lastError=r.error;failed.push(s.label||s.domain||s.url);}
      else{
        s.feedTitle=r.data.feedTitle||s.label||s.domain||'';
        s.lastSyncedAt=started;s.lastError=(r.data.warnings||[]).join(' | ').slice(0,220);
        s.fetchedCount=r.data.articles.length;
        s.retrievalMode=r.data.retrievalMode;
        s.publisherReports=r.data.publisherReports||[];successful.add(s.id);
        fresh.push(...r.data.articles.map(article=>{
          const old=previousArticle.get(s.id+'|'+article.url);
          return {...article,sourceId:s.id,
            imageUrl:article.imageUrl||old?.imageUrl||'',
            previewParagraphs:article.previewParagraphs?.length?article.previewParagraphs:(old?.previewParagraphs||[]),
            category:s.category||article.category||old?.category||''};
        }));
      }
    }
    // Keep prior items until displaced by newer publications; a feed may only
    // expose its last 10-30 posts on subsequent refreshes.
    const retained=(current.articles||[]).filter(a=>current.sources.some(s=>s.enabled&&s.id===a.sourceId));
    const all=[...fresh,...retained];
    const seen=new Set(),hidden=new Set(current.hiddenArticleKeys||[]);
    current.articles=all.sort((a,b)=>(new Date(b.publishedAt||0).getTime()||0)-(new Date(a.publishedAt||0).getTime()||0))
      .filter(item=>{
        const fingerprint=(item.source||'').toLowerCase().trim()+'|'+(item.title||'').toLowerCase().trim();
        if(hidden.has(keyFor(item.url))||seen.has(item.url)||seen.has(fingerprint))return false;
        seen.add(item.url);seen.add(fingerprint);return true;
      }).slice(0,MAX_ARTICLES);
    current.lastAttemptAt=started;
    if(successful.size)current.lastSyncedAt=started;
    current.lastError=failed.length?failed.length+' πηγές με σφάλμα. Δες λεπτομέρειες ανά εκδότη.':'';
    current.feedTitle=current.sources.length===1?current.sources[0].feedTitle:'Ειδήσεις από επιλεγμένους εκδότες';
    await current.save();
    // Preserve evicted RSS previews for up to fourteen days so copied links
    // continue to work after newer articles displace them from the live list.
    const currentKeys=new Set(current.articles.map(a=>keyFor(a.url)));
    const archived=new Set();
    const expiresAt=new Date(Date.now()+14*86400000);
    const writes=before.filter(a=>{
      const key=keyFor(a.url);
      if(currentKeys.has(key)||archived.has(key)||!a.url||!a.title)return false;
      archived.add(key);return true;
    }).slice(0,MAX_ARTICLES).map(a=>({
      updateOne:{filter:{_id:keyFor(a.url)},update:{$setOnInsert:{
        _id:keyFor(a.url),title:a.title,summary:a.summary||'',
        previewParagraphs:a.previewParagraphs||[],imageUrl:a.imageUrl||'',
        url:a.url,source:a.source||'',category:a.category||'',
        sourceId:a.sourceId,publishedAt:a.publishedAt||null,expiresAt
      }},upsert:true}
    }));
    if(writes.length){
      try{await NewsFeedArchive.bulkWrite(writes,{ordered:false});}
      catch(e){console.warn('[NEWSFEED] Archive unavailable:',e.message);}
    }
    return current;
  })().finally(()=>{pending=null;});
  return pending;
}
exports.publicFeed=async(_req,res)=>{
  try{
    let doc=await settings();
    // First load may bootstrap if the cache has not been populated yet.
    if(doc.enabled&&!doc.articles.length&&!pending){
      // Public reads must never wait for dozens of publisher requests.
      sync(doc).catch(e=>console.warn('[NEWSFEED] Initial sync:',e.message));
    }
    const active=doc.sources.filter(s=>s.enabled);
    const articles=doc.enabled?doc.articles.filter(a=>active.some(s=>s.id===a.sourceId)):[];
    const categories=[],seen=new Set();
    const add=category=>{
      if(typeof category==='string'&&category.trim()&&!seen.has(category.trim())){
        seen.add(category.trim());categories.push(category.trim());
      }
    };
    if(doc.enabled){
      for(const source of active){
        add(source.category);
        if(source.type!=='rssnews_preset')continue;
        try{(normalizeSource(source).categories||[]).forEach(add);}catch{/* invalid old source */}
      }
      articles.forEach(a=>add(a.category));
    }
    res.setHeader('Cache-Control','public, max-age=30');
    res.json({enabled:doc.enabled,feedTitle:doc.feedTitle,articles:articles.map(publicArticle),categories,
      lastSyncedAt:doc.lastSyncedAt,refreshIntervalSeconds:600});
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
    if(raw.length>MAX_SOURCES)throw error('Μέχρι 32 publishers ή RSS feeds.');
    const previous=new Map(doc.sources.map(s=>[s.id,s]));
    const items=raw.map(item=>{
      const id=typeof item.id==='string'&&previous.has(item.id)?item.id:crypto.randomUUID();
      const normalized=sourceOf(item,id),old=previous.get(id);
      if(old&&old.url===normalized.url&&old.domain===normalized.domain){
        for(const k of ['feedTitle','lastSyncedAt','lastAttemptAt','lastError','fetchedCount','retrievalMode','publisherReports'])
          normalized[k]=old[k];
      }
      return normalized;
    });
    if(new Set(items.map(s=>s.url)).size!==items.length)throw error('Η ίδια πηγή υπάρχει δύο φορές.');
    doc.enabled=req.body.enabled;doc.sources=items;doc.configRevision=(doc.configRevision||0)+1;
    const ids=new Set(items.map(x=>x.id));
    doc.articles=doc.articles.filter(a=>ids.has(a.sourceId)&&items.some(s=>s.enabled&&s.id===a.sourceId&&s.url===previous.get(s.id)?.url));
    doc.feedUrl=items[0]?.url||'';doc.lastError='';doc.lastAttemptAt=null;
    if(!items.length){doc.feedTitle='';doc.lastSyncedAt=null;}
    await doc.save();res.json(currentView(doc));
  }catch(e){fail(res,e);}
};
exports.refresh=async(_req,res)=>{
  try{
    const doc=await settings();
    if(!doc.enabled||!doc.sources.some(s=>s.enabled))
      return res.status(400).json({error:'Ενεργοποίησε τουλάχιστον μία πηγή πριν από τον συγχρονισμό.'});
    if(!pending)sync(doc,true).catch(e=>
      console.error('[NEWSFEED] Manual refresh failed:',e.message));
    // Never keep the browser waiting on publisher networking and OG lookups.
    res.status(202).json({...currentView(doc),syncing:true});
  }catch(e){fail(res,e);}
};

// Shared backend scheduler. This never triggers paid song recognition.
exports.refreshInBackground=async()=>{
  const doc=await settings();
  if(!doc.enabled)return doc;
  return sync(doc,true);
};

exports.removeArticle=async(req,res)=>{
  try{
    const requestedKey=String(req.params.key||'').toLowerCase();
    const requestedUrl=String(req.body?.url||'');
    if(requestedKey&&!/^[a-f0-9]{24}$/.test(requestedKey))throw error('Μη έγκυρο άρθρο.');
    if(!requestedKey&&(requestedUrl.length>2048||!requestedUrl.startsWith('https://')))
      throw error('Μη έγκυρο άρθρο.');
    const doc=await settings();
    const item=doc.articles.find(a=>requestedKey?keyFor(a.url)===requestedKey:a.url===requestedUrl);
    const key=item?keyFor(item.url):requestedKey;
    if(!item)return res.status(404).json({error:'Το άρθρο δεν βρέθηκε στη ροή.'});
    const updated=await NewsFeed.findOneAndUpdate({_id:'primary'},
      {$pull:{articles:{url:item.url}},$addToSet:{hiddenArticleKeys:key},$inc:{configRevision:1}},
      {new:true});
    res.json(currentView(updated));
  }catch(e){fail(res,e);}
};
exports.restoreHiddenArticles=async(_req,res)=>{
  try{
    const doc=await NewsFeed.findOneAndUpdate({_id:'primary'},
      {$set:{hiddenArticleKeys:[]},$inc:{configRevision:1}},{new:true});
    res.json(currentView(doc||await settings()));
  }catch(e){fail(res,e);}
};

exports.articleDetail=async(req,res)=>{
  try{
    const key=String(req.params.key||'').toLowerCase();
    if(!/^[a-f0-9]{24}$/.test(key))return res.status(404).json({error:'Το άρθρο δεν βρέθηκε.'});
    const doc=await settings();
    if(!doc.enabled)return res.status(404).json({error:'Το Newsfeed δεν είναι ενεργό.'});
    const allowed=new Set(doc.sources.filter(s=>s.enabled).map(s=>s.id));
    const articles=doc.articles.filter(a=>allowed.has(a.sourceId));
    const item=articles.find(a=>keyFor(a.url)===key)||
      await NewsFeedArchive.findById(key).lean();
    if(!item||!allowed.has(item.sourceId)||keyFor(item.url)!==key||
      (doc.hiddenArticleKeys||[]).includes(key))
      return res.status(404).json({error:'Το άρθρο δεν είναι πλέον διαθέσιμο. Επίστρεψε στις ειδήσεις.'});
    res.setHeader('Cache-Control','public, max-age=30');
    res.json({article:publicArticle(item),
      related:relatedArticles(articles,item,4)});
  }catch(e){fail(res,e);}
};
