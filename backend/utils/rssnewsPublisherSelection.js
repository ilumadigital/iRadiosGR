'use strict';
// rssnews.io "s=" lists publisher websites, not feed URLs.
// Discover a public RSS endpoint for each selected publisher, with bounded
// requests and no undocumented rssnews.io API or scraping.
const transport=require('./publicRssTransport');
const RSS_GUESS=Object.freeze({
  // Both are documented RSS endpoints although their URL paths are nonstandard.
  'cnn.gr':['/eidhseis?format=feed&type=rss','/rss','/feed/'],
  'capital.gr':['/api/tags/all','/rss','/feed/'],
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
    const hosts=['www.'+domain,domain];
    plans.push({domain,candidates:hosts.flatMap(host=>paths.map(path=>({
      url:'https://'+host+path,category:'',
      vettedNonstandard:domain==='cnn.gr'&&path.startsWith('/eidhseis?')||
        domain==='capital.gr'&&path.startsWith('/api/tags/all')
    })))});
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
    return host===domain||host.endsWith('.'+domain);
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
    // Alternative RSS paths can be checked in parallel instead of sequential
    // timeouts, keeping the admin's manual refresh reasonably responsive.
    // Probe alternative endpoints in parallel, but keep the total work bounded.
    const attempts=await Promise.all(candidates.map(async candidate=>{
      try{
        const xml=await transport.requestText(candidate.url,{feed:!candidate.vettedNonstandard,timeoutMs:4300});
        const parsed=parseFeed(xml,{feedUrl:candidate.url});
        return {url:candidate.url,category:candidate.category,result:parsed};
      }catch(e){return {error:String(e.message||e).slice(0,120)};}
    }));
    const success=attempts.find(result=>result.result);
    if(success)return {...item,...success};
    return {...item,error:attempts.map(a=>a.error).filter(Boolean).join(' / ').slice(0,160)||
      'Δεν εντοπίστηκε δημόσιο RSS feed.'};
  });
  const valid=results.filter(r=>r.result);
  if(!valid.length)throw new Error('Δεν βρέθηκε διαθέσιμο RSS στους επιλεγμένους εκδότες. Δες τα επιμέρους RSS URLs ή δοκίμασε ξανά.');
  const categorySet=new Set(preset.categories);
  const candidates=valid.flatMap(r=>r.result.articles.slice(0,55)
    .filter(a=>samePublisher(a.url,r.domain))
    .map(a=>({
      ...a,
      // Publisher feeds often use tags instead of the rssnews.io seven
      // categories. Do not discard valid articles solely for a tag mismatch.
      category:categorySet.has(r.category||a.category)?(r.category||a.category):
        (categorySet.has('Ελλάδα')?'Ελλάδα':preset.categories[0]),
      source:r.domain,
      _publisher:r.domain,_feed:r.url
    })));
  candidates.sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
  const seen=new Set();
  const unique=candidates.filter(a=>{
    const key=a.url;
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,500);
  let inspected=0;
  const articles=await parallel(unique,6,async article=>{
    let enriched=article;
    const cached=existingImages?.get(String(sourceId||'')+'|'+article.url);
    if(!article.imageUrl&&cached)enriched={...article,imageUrl:cached};
    if(!enriched.imageUrl&&inspected<8&&samePublisher(article.url,article._publisher)){
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
  const reports=[...new Map(plans.map(plan=>[plan.domain,{
    domain:plan.domain,status:'error',count:0,feedUrl:'',error:''
  }])).values()];
  for(const report of reports){
    const rows=results.filter(r=>r.domain===report.domain);
    report.count=rows.filter(r=>r.result).reduce((sum,r)=>sum+r.result.articles.length,0);
    report.status=report.count?'ok':'error';
    report.feedUrl=rows.find(r=>r.result)?.url||'';
    report.error=rows.filter(r=>r.error).map(r=>r.error).join(' / ').slice(0,220);
    if(report.count)report.error='';
  }
  if(!articles.length)warnings.push('Τα feeds απάντησαν, αλλά δεν επέστρεψαν δημοσιεύσεις από τους επιλεγμένους εκδότες.');
  return {feedTitle:preset.categories.join(' · '),articles,
    warnings,publisherReports:reports,retrievalMode:'selected-publisher-rss',categoryCount:preset.categories.length};
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
