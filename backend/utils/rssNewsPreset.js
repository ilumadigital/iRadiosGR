'use strict';
// rssnews.io "feed=my&c=..." is a category-share URL, NOT an RSS/API endpoint.
// Use the selected category names as a preset for verified, public publisher RSS URLs.
// No scraping or requests to undocumented rssnews.io endpoints.
const CATEGORIES=Object.freeze({
  'Πολιτική':[['https://www.newsbeast.gr/politiki/feed','Newsbeast']],
  'Lifestyle':[['https://www.newsbeast.gr/lifestyle/feed','Newsbeast']],
  'Ελλάδα':[
    ['https://www.newsbeast.gr/greece/feed','Newsbeast'],
    ['https://www.pes.gr/c/greece/feed/','PES.gr']
  ],
  'Business':[
    ['https://www.newsbeast.gr/financial/feed','Newsbeast'],
    ['https://www.pes.gr/c/finance/feed/','PES.gr']
  ],
  'Education':[
    ['https://www.esos.gr/rss.xml','esos.gr'],
    ['https://www.alfavita.gr/rss.xml','Alfavita']
  ],
  'Κόσμος':[
    ['https://www.newsbeast.gr/world/feed','Newsbeast'],
    ['https://www.pes.gr/c/world/feed/','PES.gr']
  ],
  'Αθλητικά':[
    ['https://www.newsbeast.gr/sports/feed','Newsbeast']
  ],
  'Τεχνολογία':[
    ['https://www.newsbeast.gr/technology/feed','Newsbeast'],
    ['https://www.pes.gr/c/science/technology/feed/','PES.gr']
  ]
});
const ALIASES=new Map([
  ['Ελλάδα','Ελλάδα'],['Greece','Ελλάδα'],
  ['Πολιτική','Πολιτική'],['Politics','Πολιτική'],
  ['Lifestyle','Lifestyle'],['Διασκέδαση','Lifestyle'],
  ['Business','Business'],['Οικονομία','Business'],['Οικονομικά','Business'],
  ['Education','Education'],['Παιδεία','Education'],['Εκπαίδευση','Education'],
  ['Κόσμος','Κόσμος'],['World','Κόσμος'],
  ['Αθλητικά','Αθλητικά'],['Sports','Αθλητικά'],
  ['Τεχνολογία','Τεχνολογία'],['Technology','Τεχνολογία']
]);
const bad=msg=>{throw Object.assign(new Error(msg),{status:400});};
function normalizePreset(raw){
  let url;try{url=new URL(raw);}catch{bad('Μη έγκυρο link rssnews.io.');}
  if(url.protocol!=='https:'||url.hostname!=='rssnews.io'||url.port||url.username||
     url.password||url.hash||url.pathname!=='/')
    bad('Δώσε το δημόσιο link από τη «Ροή μου» στο rssnews.io.');
  if(url.searchParams.get('feed')!=='my'||!url.searchParams.get('c'))
    bad('Το rssnews.io link χρειάζεται feed=my και επιλεγμένες κατηγορίες (c).');
  if([...url.searchParams.keys()].some(k=>!['feed','c'].includes(k))||
     url.searchParams.getAll('feed').length!==1||url.searchParams.getAll('c').length!==1)
    bad('Το rssnews.io link έχει μη υποστηριζόμενες παραμέτρους.');
  const entries=url.searchParams.get('c').split(',').map(c=>c.trim()).filter(Boolean);
  if(!entries.length||entries.length>10)bad('Επίλεξε έως 10 κατηγορίες.');
  const categories=[...new Set(entries.map(c=>{
    const category=ALIASES.get(c);
    if(!category)bad('Μη υποστηριζόμενη κατηγορία rssnews.io: '+c.slice(0,60));
    return category;
  }))];
  const canonical=new URL('https://rssnews.io/');
  canonical.searchParams.set('feed','my');
  canonical.searchParams.set('c',categories.join(','));
  return {type:'rssnews_preset',url:canonical.href,domain:'',categories};
}
const uniqueFeeds=preset=>{
  const seen=new Set(),result=[];
  for(const category of preset.categories)
    for(const [url,name] of CATEGORIES[category]){
      if(seen.has(url))continue;
      seen.add(url);result.push({url,name,category});
    }
  return result;
};
const safePublisherPage=(value,feedUrl)=>{
  try{
    const url=new URL(value),publisher=new URL(feedUrl);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
      url.hostname===publisher.hostname&&url.href.length<=2048?url.href:'';
  }catch{return '';}
};
function htmlAttribute(tag,name){
  const rx=new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1','i');
  const m=tag.match(rx);
  return m?m[2].replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'"):'';
}
function extractImage(html,pageUrl){
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const key=(htmlAttribute(tag,'property')||htmlAttribute(tag,'name')).toLowerCase();
    if(!['og:image','og:image:url','og:image:secure_url','twitter:image','twitter:image:src'].includes(key))continue;
    const value=htmlAttribute(tag,'content');
    try{
      const url=new URL(value,pageUrl);
      if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&url.href.length<=2048)return url.href;
    }catch{/* ignore invalid metadata */}
  }
  return '';
}
async function coverFromPage(article,feedUrl){
  if(article.imageUrl)return article;
  const link=safePublisherPage(article.url,feedUrl);
  if(!link)return article;
  try{
    const response=await fetch(link,{redirect:'error',signal:AbortSignal.timeout(2800),
      headers:{Accept:'text/html','User-Agent':'iRadiosGR-NewsFeed/2.1'}});
    if(!response.ok||!/text\/html/i.test(response.headers.get('content-type')||'')||
       Number(response.headers.get('content-length')||0)>1_000_000)return article;
    const html=await response.text();
    if(html.length>1_000_000)return article;
    const image=extractImage(html,link);
    return image?{...article,imageUrl:image}:article;
  }catch{return article;}
}
async function mapLimited(items,limit,mapper){
  const result=new Array(items.length),count=Math.min(items.length,limit);
  let cursor=0;
  await Promise.all(Array.from({length:count},async()=>{
    while(cursor<items.length){
      const i=cursor++;result[i]=await mapper(items[i],i);
    }
  }));
  return result;
}
async function downloadPreset(source,{fetchXml}){
  const preset=normalizePreset(typeof source==='string'?source:source.url);
  const feeds=uniqueFeeds(preset);
  // A bounded set of allowlisted publisher RSS endpoints, up to six concurrent.
  const fetched=await mapLimited(feeds,6,async feed=>{
    try{return {...feed,result:await fetchXml(feed.url)};}
    catch(e){return {...feed,error:String(e.message||e).slice(0,100)};}
  });
  const available=fetched.filter(f=>f.result);
  if(!available.length)throw new Error('Οι RSS πηγές των επιλεγμένων κατηγοριών δεν αποκρίθηκαν. Δοκίμασε ξανά.');
  const all=available.flatMap(feed=>feed.result.articles.slice(0,18).map(article=>({
    ...article,source:feed.name,category:feed.category,_feed:feed.url
  })));
  const prioritized=all.sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
  // Only inspect publisher article pages to fill missing image metadata; bounded and allowlisted.
  let inspected=0;
  const enriched=await mapLimited(prioritized,5,async article=>{
    if(!article.imageUrl&&inspected<15){
      inspected++;
      article=await coverFromPage(article,article._feed);
    }
    const {_feed,...publicArticle}=article;
    return publicArticle;
  });
  const seen=new Set();
  const articles=enriched.filter(a=>{
    if(seen.has(a.url))return false;
    seen.add(a.url);return true;
  }).slice(0,150);
  const warnings=fetched.filter(f=>f.error).map(f=>f.name+' ('+f.category+'): '+f.error);
  return {feedTitle:preset.categories.join(' · '),articles,retrievalMode:'publisher-rss-images',
    warnings,categoryCount:preset.categories.length};
}
module.exports={CATEGORIES,normalizePreset,uniqueFeeds,safePublisherPage,extractImage,coverFromPage,downloadPreset};
