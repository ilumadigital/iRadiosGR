'use strict';
// RSS.app and Google News URL-based sources. No arbitrary network hosts, redirects or HTML scraping.
const DEFAULT_FEED_URL='https://rss.app/feeds/k4AEhunSwl50WyaC.xml';
const rssNewsPreset=require('./rssNewsPreset');
const publicRss=require('./publicRssTransport');
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
const hostPattern=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
function checkDomain(value){
  const domain=String(value||'').trim().toLowerCase().replace(/\.$/,'');
  if(!hostPattern.test(domain)||domain.endsWith('.local')||domain.endsWith('.internal'))
    invalid('Μη έγκυρο domain εκδότη.');
  return domain;
}
function publisherDomain(id){
  // Google publisher IDs are opaque. Some happen to carry a nested base64-encoded domain;
  // this is a best-effort hint, never a guarantee nor a URL to fetch directly.
  try{
    if(!/^[A-Za-z0-9_-]{16,200}$/.test(id))return '';
    const bytes=Buffer.from(id,'base64url').toString('latin1');
    const tokens=[...bytes.matchAll(/[A-Za-z0-9_-]{24,140}/g)].map(x=>x[0]);
    for(const part of tokens.slice(0,5)){
      const inner=Buffer.from(part,'base64url').toString('latin1');
      const matches=[...inner.matchAll(/(?:[a-z0-9-]+\.)+[a-z]{2,16}/gi)];
      for(const m of matches){
        const host=m[0].toLowerCase();
        if(hostPattern.test(host)&&!host.includes('google.com'))return host;
      }
    }
  }catch{/* opaque ids are not guaranteed to encode a domain */}
  return '';
}
function normalizeSource(value){
  const raw=typeof value==='string'?value:value?.url;
  if(typeof raw!=='string'||raw.length>1024)invalid('Δώσε έγκυρο link Google News ή RSS.app.');
  let input;try{input=new URL(raw.trim());}catch{invalid('Μη έγκυρη διεύθυνση ειδήσεων.');}
  if(input.protocol!=='https:'||input.username||input.password||input.port||input.hash)
    invalid('Επιτρέπονται μόνο ασφαλείς HTTPS διευθύνσεις.');
  if(input.hostname==='rssnews.io')return rssNewsPreset.normalizePreset(raw.trim());
  if(!['rss.app','news.google.com'].includes(input.hostname)){
    const url=publicRss.validatePublicUrl(raw.trim(),{feed:true});
    return {type:'direct_rss',url,domain:new URL(url).hostname};
  }
  if(input.hostname==='rss.app'){
    if(!/^\/feeds\/[A-Za-z0-9_-]+\.xml$/.test(input.pathname)||input.search)
      invalid('Το RSS.app link πρέπει να τελειώνει σε /feeds/…xml.');
    return {type:'rss_app',url:input.href,domain:''};
  }
  const p=input.pathname,publication=p.match(/^\/(?:rss\/)?publications\/([A-Za-z0-9_-]{16,200})\/?$/);
  const locale=String(input.searchParams.get('ceid')||'GR:el');
  const loc=locale.match(/^([A-Z]{2}):([a-z]{2}(?:-[A-Z]{2})?)$/);
  if(!loc)invalid('Μη έγκυρη περιοχή Google News.');
  const gl=loc[1],hl=loc[2];
  if(publication){
    const domain=value?.domain?checkDomain(value.domain):publisherDomain(publication[1]);
    const canonical=new URL('https://news.google.com/publications/'+publication[1]);
    canonical.searchParams.set('ceid',loc[0]);
    return {type:'google_publisher',url:canonical.href,domain};
  }
  // Also allow Google News topic and RSS search URLs, but never other Google paths.
  if(!/^\/(?:rss\/)?(?:topics\/[A-Za-z0-9_-]{16,200}|search)\/?$/.test(p) &&
     p!=='/rss'&&p!=='/rss/')invalid('Δώσε link Google News Publisher, θέμα ή αναζήτηση.');
  const query=String(input.searchParams.get('q')||'');
  if(/search\/?$/.test(p)&&(!query||query.length>180))invalid('Η αναζήτηση Google News πρέπει να έχει όρους.');
  const target=new URL('https://news.google.com'+(p.startsWith('/rss')?p:'/rss'+p));
  if(query)target.searchParams.set('q',query);
  target.searchParams.set('hl',hl);target.searchParams.set('gl',gl);
  target.searchParams.set('ceid',loc[0]);
  return {type:'google_rss',url:target.href,domain:''};
}
function validateUrl(value){return normalizeSource(value).url;}
const decode=value=>String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,'$1')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';})
  .replace(/&(amp|quot|apos|lt|gt|nbsp|hellip|mdash|ndash);/gi,(_,e)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',hellip:'…',mdash:'—',ndash:'–'})[e.toLowerCase()]);
function field(xml,name){
  const escaped=name.replace(/[.*+?^$()|[\]{}]/g,'\\$&');
  const found=xml.match(new RegExp('<'+escaped+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+escaped+'\\s*>','i'));
  return found?decode(found[1]).trim():'';
}
const plain=html=>decode(html).replace(/<\s*br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const safeHttp=value=>{
  try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&value.length<=2048?u.href:'';}catch{return '';}
};
function attr(xml,name){
  const found=xml.match(new RegExp('\\b'+name+'\\s*=\\s*(["\x27])([\\s\\S]*?)\\1','i'));
  return found?decode(found[2]).trim():'';
}
function picture(item,description){
  for(const tag of item.match(/<(?:media:content|media:thumbnail|enclosure|image|itunes:image)\b[^>]*>/gi)||[]){
    const image=safeHttp(attr(tag,'url')||attr(tag,'href'));
    const type=attr(tag,'type').toLowerCase(),medium=attr(tag,'medium').toLowerCase();
    if(image&&(!type||type.startsWith('image/')||medium==='image'))return image;
  }
  const embedded=field(item,'media:thumbnail')||field(item,'image')||field(item,'thumbnail');
  if(safeHttp(embedded))return safeHttp(embedded);
  const inline=(description||'').match(/<img\b[^>]*>/i);
  if(inline){
    for(const name of ['src','data-src','data-original','data-lazy-src']){
      const url=safeHttp(attr(inline[0],name));
      if(url)return url;
    }
    const srcset=attr(inline[0],'srcset')||attr(inline[0],'data-srcset');
    if(srcset){
      const url=safeHttp(srcset.split(',')[0]?.trim().split(/\s+/)[0]);
      if(url)return url;
    }
  }
  return '';
}
const categoryAliases=new Map(Object.entries({
  'ελλαδα':'Ελλάδα','greece':'Ελλάδα','greek news':'Ελλάδα',
  'κοσμος':'Κόσμος','world':'Κόσμος','international':'Κόσμος',
  'πολιτικη':'Πολιτική','politics':'Πολιτική','politiki':'Πολιτική',
  'οικονομια':'Business','οικονομικα':'Business','business':'Business','finance':'Business','financial':'Business',
  'εκπαιδευση':'Education','παιδεια':'Education','education':'Education',
  'αθλητικα':'Αθλητικά','αθλητισμος':'Αθλητικά','sports':'Αθλητικά','sport':'Αθλητικά',
  'τεχνολογια':'Τεχνολογία','technology':'Τεχνολογία','tech':'Τεχνολογία',
  'lifestyle':'Lifestyle','life style':'Lifestyle',
  'κοινωνια':'Κοινωνία','society':'Κοινωνία',
  'υγεια':'Υγεία','health':'Υγεία',
  'media':'Media','ψυχαγωγια':'Διασκέδαση','διασκεδαση':'Διασκέδαση','entertainment':'Διασκέδαση',
  'ταξιδι':'Ταξίδι','travel':'Ταξίδι','περιβαλλον':'Περιβάλλον','environment':'Περιβάλλον',
  'αυτοκινητο':'Auto','auto':'Auto','car':'Auto','moto':'Μότο','motorcycle':'Μότο','μοτο':'Μότο','weird':'Διάφορα','γενικα':''
}));
const categoryKey=value=>plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_\-\/]+/g,' ').replace(/\s+/g,' ').trim();
function categoryFrom(item,articleUrl,feedUrl=''){
  const candidates=[...item.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category\s*>/gi)]
    .map(m=>plain(m[1]));
  for(const tag of item.match(/<category\b[^>]*\/>/gi)||[]){
    const label=attr(tag,'label')||attr(tag,'term');
    if(label)candidates.push(plain(label));
  }
  const subject=field(item,'dc:subject');
  if(subject)candidates.push(plain(subject));
  for(const candidate of candidates){
    const category=categoryAliases.get(categoryKey(candidate));
    if(category)return category;
  }
  // WordPress posts commonly expose their section in the path; trust it over
  // arbitrary category tags that may represent people, keywords or article tags.
  for(const value of [articleUrl,feedUrl]){
    try{
      const slug=new URL(value).pathname.split('/').filter(Boolean)[0]?.toLowerCase()||'';
      const canonical=categoryAliases.get(categoryKey(slug));
      if(canonical)return canonical;
    }catch{}
  }
  const generic=new Set(['news','ειδησεις','uncategorized','χωρις κατηγορια','general']);
  const first=candidates.find(s=>s.length>=2&&s.length<=44&&!generic.has(categoryKey(s)));
  return first?first.slice(0,44):'';
}
function parse(xml,{google=false,publisherDomain:domain='',feedUrl=''}={}){
  if(typeof xml!=='string'||!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw new Error('Η πηγή δεν επέστρεψε RSS/Atom XML.');
  const channel=plain(field(xml,'title')).slice(0,120);
  const blocks=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)];
  const articles=[],seen=new Set();
  for(const [,kind,raw] of blocks.slice(0,200)){
    const sourceName=plain(field(raw,'source')||field(raw,'dc:creator')||(google?'':channel)).slice(0,100);
    const sourceTag=raw.match(/<source\b[^>]*>/i);
    const sourceHome=sourceTag?safeHttp(attr(sourceTag[0],'url')):'';
    if(domain&&sourceHome){
      const host=new URL(sourceHome).hostname.toLowerCase();
      if(host!==domain&&!host.endsWith('.'+domain))continue;
    }
    let title=plain(field(raw,'title')).slice(0,260);
    if(google&&sourceName&&title.endsWith(' - '+sourceName))title=title.slice(0,-sourceName.length-3).trim();
    const rich=field(raw,'content:encoded')||field(raw,'description')||field(raw,'summary')||field(raw,'content');
    let link=field(raw,'link');
    if(!safeHttp(link)){
      const linkTag=raw.match(/<link\b[^>]*\bhref\s*=\s*[^>]+>/i);
      link=linkTag?attr(linkTag[0],'href'):'';
    }
    const url=safeHttp(link);
    if(!title||!url||seen.has(url))continue;
    seen.add(url);
    const rawDate=field(raw,'pubDate')||field(raw,'published')||field(raw,'updated')||field(raw,'dc:date')||field(raw,'date');
    const date=rawDate?new Date(rawDate):null;
    articles.push({
      id:(plain(field(raw,'guid')||field(raw,'id'))||url).slice(0,400),
      title,
      // Google News descriptions are related-article HTML lists, not summaries.
      summary:google?'':plain(rich).slice(0,420),
      imageUrl:picture(raw,google?'':rich),url,
      publishedAt:date&&Number.isFinite(date.getTime())?date:null,
      source:sourceName||channel||domain||'Ειδήσεις',
      category:google?'':categoryFrom(raw,url,feedUrl)
    });
  }
  articles.sort((a,b)=>(b.publishedAt?.getTime()||0)-(a.publishedAt?.getTime()||0));
  if(!articles.length)throw new Error('Δεν βρέθηκαν δημοσιεύσεις στο RSS feed.');
  return {feedTitle:channel,articles:articles.slice(0,100)};
}
async function fetchXml(url,google=false,publisherDomain=''){
  // Every fetch target is constructed from a strict host allowlist. Redirects blocked.
  const host=new URL(url).hostname;
  if(!['rss.app','news.google.com','www.newsbeast.gr','www.pes.gr','www.esos.gr','www.alfavita.gr'].includes(host))
    throw new Error('Unsupported feed host');
  const response=await fetch(url,{
    redirect:'error',signal:AbortSignal.timeout(host==='news.google.com'||host==='rss.app'?9000:6000),
    headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent':'iRadiosGR-NewsFeed/2.0'}
  });
  if(!response.ok)throw new Error('HTTP '+response.status+' από '+host);
  const type=response.headers.get('content-type')||'';
  if(type&&!/xml|text\/plain|application\/octet-stream/i.test(type))
    throw new Error('Η πηγή δεν επέστρεψε XML.');
  if(Number(response.headers.get('content-length')||0)>2_000_000)
    throw new Error('XML μεγαλύτερο από 2MB.');
  const xml=await response.text();
  if(xml.length>2_000_000)throw new Error('XML μεγαλύτερο από 2MB.');
  return parse(xml,{google,publisherDomain});
}
function googleEndpoint(source){
  const page=new URL(source.url);
  const url=new URL('https://news.google.com/rss'+page.pathname);
  const ceid=page.searchParams.get('ceid')||'GR:el';
  url.searchParams.set('ceid',ceid);
  url.searchParams.set('hl',ceid.split(':')[1]);
  url.searchParams.set('gl',ceid.split(':')[0]);
  return url.href;
}
function googleDomainEndpoint(source){
  const page=new URL(source.url),ceid=page.searchParams.get('ceid')||'GR:el';
  const url=new URL('https://news.google.com/rss/search');
  url.searchParams.set('q','site:'+source.domain+' when:7d');
  url.searchParams.set('hl',ceid.split(':')[1]);
  url.searchParams.set('gl',ceid.split(':')[0]);
  url.searchParams.set('ceid',ceid);
  return url.href;
}
async function download(source){
  const normalized=normalizeSource(source);
  if(normalized.type==='rssnews_preset')
    return rssNewsPreset.downloadPreset(normalized,{fetchXml});
  if(normalized.type==='direct_rss'){
    const xml=await publicRss.requestText(normalized.url,{feed:true});
    const parsed=parse(xml,{feedUrl:normalized.url});
    // WordPress often omits image elements. Check only a bounded number
    // of direct publisher articles, with DNS pinning and redirect rejection.
    let checked=0,cursor=0;
    const articles=new Array(parsed.articles.length);
    const worker=async()=>{
      while(cursor<parsed.articles.length){
        const index=cursor++,article=parsed.articles[index];
        let enriched=article;
        if(!article.imageUrl&&checked<12){
          try{
            const origin=new URL(normalized.url),target=new URL(article.url);
            const site=origin.hostname.replace(/^www\./,'');
            if(target.protocol==='https:'&&
               target.hostname.replace(/^www\./,'')===site&&
               !target.username&&!target.password&&!target.port){
              checked++;
              const html=await publicRss.requestText(target.href,{html:true});
              const cover=rssNewsPreset.extractImage(html,target.href);
              if(cover)enriched={...article,imageUrl:cover};
            }
          }catch{/* leave original feed article without an image */}
        }
        articles[index]=enriched;
      }
    };
    await Promise.all(Array.from({length:3},worker));
    return {...parsed,articles,retrievalMode:'direct-rss'};
  }
  if(normalized.type==='rss_app')
    return {...await fetchXml(normalized.url),retrievalMode:'rss'};
  if(normalized.type==='google_rss')
    return {...await fetchXml(normalized.url,true),retrievalMode:'google-rss'};
  try{
    return {...await fetchXml(googleEndpoint(normalized),true,normalized.domain),retrievalMode:'publisher-rss'};
  }catch(error){
    // Publisher-specific RSS is undocumented and frequently unavailable.
    // When the publisher ID reveals its domain, use a bounded site-search fallback.
    if(!normalized.domain)throw new Error('Το Google News δεν παρείχε publisher RSS. Συμπλήρωσε domain εκδότη για εναλλακτική αναζήτηση.');
    const xml=await fetchXml(googleDomainEndpoint(normalized),true,normalized.domain);
    // Site-filtered results can include mixed coverage, so keep only the named publisher
    // when an explicit source URL is available (the Google RSS may omit it).
    return {...xml,retrievalMode:'domain-search'};
  }
}
module.exports={DEFAULT_FEED_URL,validateUrl,normalizeSource,publisherDomain,parse,categoryFrom,download,googleEndpoint,googleDomainEndpoint};
