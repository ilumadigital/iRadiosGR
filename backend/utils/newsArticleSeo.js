'use strict';
// Social crawlers do not reliably execute the React app. Serve a short, safely
// escaped article card so sharing an iRadios preview shows the real RSS headline
// and artwork instead of the generic app title.
const NewsFeed=require('../models/NewsFeed');
const Archive=require('../models/NewsFeedArchive');
const {keyFor}=require('./newsFeedArticle');
const crawler=ua=>/bot|crawler|spider|facebookexternalhit|twitterbot|whatsapp|telegram|viber|discord|slack|linkedin|pinterest/i.test(String(ua||''));
const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
async function injectNewsArticleSeo(req,res,next){
  if(!crawler(req.headers['user-agent'])&&req.query.bot!=='1')return next();
  const key=String(req.params.key||'').toLowerCase();
  if(!/^[a-f0-9]{24}$/.test(key))return next();
  try{
    const doc=await NewsFeed.findById('primary').lean();
    if(!doc?.enabled)return next();
    const allowed=new Set((doc.sources||[]).filter(s=>s.enabled).map(s=>s.id));
    const live=(doc.articles||[]).find(a=>allowed.has(a.sourceId)&&keyFor(a.url)===key);
    const found=live||await Archive.findById(key).lean();
    if(!found||!allowed.has(found.sourceId)||keyFor(found.url)!==key||
      (doc.hiddenArticleKeys||[]).includes(key))return next();
    const origin=process.env.APP_ENV==='staging'?
      'https://stage.iradios.gr':'https://iradios.gr';
    const internal=origin+'/newsfeed/'+key;
    const title=esc((found.title||'Ειδήσεις').slice(0,260));
    const description=esc((found.summary||'Διάβασε την προεπισκόπηση ειδήσεων στο iRadios GR.').slice(0,240));
    const image=found.imageUrl?
      '<meta property="og:image" content="'+esc(found.imageUrl)+'">'+
      '<meta name="twitter:card" content="summary_large_image">':
      '<meta name="twitter:card" content="summary">';
    res.setHeader('Cache-Control','public, max-age=120');
    res.type('html').send('<!doctype html><html lang="el"><head><meta charset="UTF-8">'+
      '<meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<meta name="robots" content="noindex,follow">'+
      '<title>'+title+' | iRadios News</title>'+
      '<meta name="description" content="'+description+'">'+
      '<meta property="og:type" content="article">'+
      '<meta property="og:title" content="'+title+'">'+
      '<meta property="og:description" content="'+description+'">'+
      '<meta property="og:url" content="'+internal+'">'+
      '<meta name="twitter:title" content="'+title+'">'+
      '<meta name="twitter:description" content="'+description+'">'+image+
      '</head><body><main><h1>'+title+'</h1><p>'+description+'</p>'+
      '<p>Πηγή: '+esc(found.source||'Ειδήσεις')+'</p>'+
      '<a href="'+esc(internal)+'">Προεπισκόπηση iRadios</a> · '+
      '<a href="'+esc(found.url)+'">Πλήρες άρθρο στην πηγή</a></main></body></html>');
  }catch(error){
    console.warn('[NEWSFEED] Social preview unavailable:',error.message);
    next();
  }
}
module.exports={injectNewsArticleSeo,crawler,esc};
