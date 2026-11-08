'use strict';
// rssnews.io "s=" lists publisher websites, not feed URLs.
// Discover a public RSS endpoint for each selected publisher, with bounded
// requests and no undocumented rssnews.io API or scraping.
const transport=require('./publicRssTransport');
const RSS_GUESS=Object.freeze({
  'cnn.gr':['/rss','/feed/'],
  'capital.gr':['/rss','/feed/'],
  'in.gr':['/feed/','/rss'],
  'naftemporiki.gr':['/feed/','/rss'],
  'newsit.gr':['/feed/','/rss'],
  'protothema.gr':['/rss','/feed/'],
  'skai.gr':['/feed/','/rss'],
  'tanea.gr':['/feed/','/rss'],
  'tovima.gr':['/feed/','/rss']
});
const ALLOWED_HOST=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
function normalizePublishers(value){
  if(typeof value!=='string'||value.length>1600)throw Object.assign(new Error('Μη έγκυρη επιλογή εκδοτών.'),{status:400});
  const domains=value.split(',').map(d=>d.trim().toLowerCase().replace(/^www\./,'')).filter(Boolean);
  if(!domains.length||domains.length>30)
    throw Object.assign(new Error('Μπορείς να επιλέξεις από 1 έως 30 εκδότες ανά σύνδεσμο rssnews.io.'),{status:400});
  const unique=[...new Set(domains)];
  for(const domain of unique){
    if(!ALLOWED_HOST.test(domain)||domain.endsWith('.local')||domain.endsWith('.internal')||
      domain.endsWith('.test')||domain.endsWith('.example')||domain.endsWith('.localhost'))
      throw Object.assign(new Error('Μη έγκυρο domain εκδότη: '+domain.slice(0,80)),{status:400});
  }
  return unique;
}
function publisherPlans(preset,categoryFeeds){
  const plans=[];
  for(const domain of preset.publishers){
    if(domain==='feeds.feedburner.com'){
      plans.push({domain,candidates:[],note:'Χρειάζεται συγκεκριμένο Feedburner URL, όχι μόνο το domain.'});
      continue;
    }
    if(domain==='newsbeast.gr'){
      const items=[];
      for(const category of preset.categories)
        for(const [url] of categoryFeeds[category]||[])
          if(new URL(url).hostname.replace(/^www\./,'')===domain)
            items.push({url,category});
      plans.push({domain,candidates:[...new Map(items.map(x=>[x.url,x])).values()],sectioned:true});
      continue;
    }
    const paths=RSS_GUESS[domain]||['/feed/','/rss'];
    const host='www.'+domain;
    plans.push({domain,candidates:paths.map(path=>({url:'https://'+host+path,category:''}))});
  }
  return plans;
}
async function parallel(items,max,iterator){
  const result=new Array(items.length);
  let next=0;
  await Promise.all(Array.from({length:Math.min(max,items.length)},async()=>{
    while(next<items.length){
      const index=next++;
      result[index]=await iterator(items[index],index);
    }
  }));
  return result;
}
function samePublisher(a,domain){
  try{
    const host=new URL(a).hostname.replace(/^www\./,'');
    return host===domain;
  }catch{return false;}
}
async function collectSelected(preset,{categoryFeeds,parseFeed,existingImages,sourceId}){
  const plans=publisherPlans(preset,categoryFeeds);
  const requests=plans.flatMap(plan=>plan.sectioned?
    plan.candidates.map(feed=>({...feed,domain:plan.domain,sectioned:true})):
    [{domain:plan.domain,candidates:plan.candidates,sectioned:false,note:plan.note}]);
  const results=await parallel(requests,8,async item=>{
    if(item.note)return {...item,error:item.note};
    const candidates=item.sectioned?[item]:item.candidates;
    let last='';
    for(const candidate of candidates){
      try{
        const xml=await transport.requestText(candidate.url,{feed:true});
        const parsed=parseFeed(xml,{feedUrl:candidate.url});
        return {...item,url:candidate.url,category:candidate.category,result:parsed};
      }catch(e){last=String(e.message||e).slice(0,120);}
    }
    return {...item,error:last||'Δεν εντοπίστηκε δημόσιο RSS feed.'};
  });
  const valid=results.filter(r=>r.result);
  if(!valid.length)throw new Error('Δεν βρέθηκε διαθέσιμο RSS στους επιλεγμένους εκδότες. Δες τα επιμέρους RSS URLs ή δοκίμασε ξανά.');
  const categorySet=new Set(preset.categories);
  const candidates=valid.flatMap(r=>r.result.articles.slice(0,35)
    .filter(a=>!r.sectioned||samePublisher(a.url,r.domain))
    .map(a=>({
      ...a,
      category:r.category||a.category,
      source:r.result.feedTitle||r.domain,
      _publisher:r.domain,_feed:r.url
    }))
    .filter(a=>categorySet.has(a.category)));
  candidates.sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
  const seen=new Set();
  const unique=candidates.filter(a=>{
    const key=a.url;
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,220);
  let inspected=0;
  const articles=await parallel(unique,6,async article=>{
    let enriched=article;
    const cached=existingImages?.get(String(sourceId||'')+'|'+article.url);
    if(!article.imageUrl&&cached)enriched={...article,imageUrl:cached};
    if(!enriched.imageUrl&&inspected<12&&samePublisher(article.url,article._publisher)){
      inspected++;
      try{
        const url=new URL(article.url);
        if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port){
          const html=await transport.requestText(url.href,{html:true});
          const image=extractOgImage(html,url.href);
          if(image)enriched={...enriched,imageUrl:image};
        }
      }catch{/* keep the RSS item without cover artwork */}
    }
    const {_publisher,_feed,...publicItem}=enriched;
    return publicItem;
  });
  const warnings=results.filter(r=>r.error).map(r=>r.domain+': '+r.error);
  if(!articles.length)warnings.push('Τα feeds απάντησαν, αλλά δεν επέστρεψαν άρθρα στις επιλεγμένες κατηγορίες.');
  return {feedTitle:preset.categories.join(' · '),articles,
    warnings,retrievalMode:'selected-publisher-rss',categoryCount:preset.categories.length};
}
// Does not request an untrusted URL; only reads bounded HTML already obtained
// through transport.requestText with DNS rebinding and redirect protection.
function extractOgImage(html,url){
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const attr=(name)=>{
      const m=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1','i'));
      return m?m[2].replace(/&amp;/gi,'&'):'';
    };
    const key=(attr('property')||attr('name')).toLowerCase();
    if(!['og:image','og:image:url','og:image:secure_url','twitter:image'].includes(key))continue;
    try{
      const image=new URL(attr('content'),url);
      if(image.protocol==='https:'&&!image.username&&!image.password&&!image.port&&image.href.length<2048)
        return image.href;
    }catch{/* invalid image */}
  }
  return '';
}
module.exports={normalizePublishers,publisherPlans,collectSelected,extractOgImage};
