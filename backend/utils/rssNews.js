'use strict';
// Bounded RSS.app RSS/Atom importer: no arbitrary URLs, redirects, or XML entity expansion.
const DEFAULT_FEED_URL='https://rss.app/feeds/k4AEhunSwl50WyaC.xml';
function validateUrl(value){
  if(typeof value!=='string'||value.length>250)throw Object.assign(new Error('Δώσε ένα HTTPS RSS.app XML feed URL.'),{status:400});
  let url;
  try{url=new URL(value.trim());}catch{throw Object.assign(new Error('Μη έγκυρο RSS URL.'),{status:400});}
  if(url.protocol!=='https:'||url.hostname!=='rss.app'||url.username||url.password||
     !/^\/feeds\/[a-zA-Z0-9_-]+\.xml$/.test(url.pathname)||url.search||url.hash)
    throw Object.assign(new Error('Επιτρέπονται μόνο σύνδεσμοι https://rss.app/feeds/…xml.'),{status:400});
  return url.href;
}
const decode=value=>String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,'$1')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0]==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';})
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
  const m=xml.match(new RegExp('\\b'+name+'\\s*=\\s*(["\x27])([\\s\\S]*?)\\1','i'));
  return m?decode(m[2]).trim():'';
}
function picture(item,description){
  for(const tag of item.match(/<(?:media:content|media:thumbnail|enclosure|image)\b[^>]*>/gi)||[]){
    const image=safeHttp(attr(tag,'url')||attr(tag,'href'));
    const type=attr(tag,'type').toLowerCase(),medium=attr(tag,'medium').toLowerCase();
    if(image && (!type||type.startsWith('image/')||medium==='image'))return image;
  }
  const embedded=field(item,'media:thumbnail')||field(item,'image')||field(item,'thumbnail');
  if(safeHttp(embedded))return safeHttp(embedded);
  const htmlImage=(description||'').match(/<img\b[^>]*>/i);
  return htmlImage?safeHttp(attr(htmlImage[0],'src')):'';
}
function parse(xml){
  if(typeof xml!=='string'||!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw new Error('Η απάντηση δεν είναι RSS ή Atom XML.');
  const channel=field(xml,'title');
  const blocks=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)];
  const articles=[],seen=new Set();
  for(const [,kind,raw] of blocks.slice(0,200)){
    const title=plain(field(raw,'title')).slice(0,260);
    const text=field(raw,'description')||field(raw,'summary')||field(raw,'content:encoded')||field(raw,'content');
    let link=field(raw,'link');
    if(!safeHttp(link)){
      const linkTag=raw.match(/<link\b[^>]*\bhref\s*=\s*[^>]+>/i);
      link=linkTag?attr(linkTag[0],'href'):'';
    }
    const url=safeHttp(link);
    if(!title||!url||seen.has(url))continue;
    seen.add(url);
    const rawDate=field(raw,'pubDate')||field(raw,'published')||field(raw,'updated')||field(raw,'dc:date')||field(raw,'date');
    const parsed=rawDate?new Date(rawDate):null;
    const publishedAt=parsed&&Number.isFinite(parsed.getTime())?parsed:null;
    articles.push({
      id:(plain(field(raw,'guid')||field(raw,'id'))||url).slice(0,400),
      title,summary:plain(text).slice(0,420),imageUrl:picture(raw,text),url,
      publishedAt,source:plain(field(raw,'source')||field(raw,'dc:creator')||channel).slice(0,100)
    });
  }
  articles.sort((a,b)=>(b.publishedAt?.getTime()||0)-(a.publishedAt?.getTime()||0));
  if(!articles.length)throw new Error('Το RSS XML δεν περιέχει έγκυρες ειδήσεις.');
  return {feedTitle:plain(channel).slice(0,120),articles:articles.slice(0,100)};
}
async function download(url){
  const response=await fetch(validateUrl(url),{
    redirect:'error',signal:AbortSignal.timeout(9000),
    headers:{'Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml','User-Agent':'iRadiosGR-NewsFeed/1.0'}
  });
  if(!response.ok)throw new Error('Το RSS.app επέστρεψε HTTP '+response.status);
  const type=response.headers.get('content-type')||'';
  if(type&&!/xml|text\/plain|application\/octet-stream/i.test(type))throw new Error('Το feed δεν επέστρεψε XML.');
  const length=Number(response.headers.get('content-length')||0);
  if(length>2_000_000)throw new Error('Το XML ξεπερνά τα 2MB.');
  const xml=await response.text();
  if(xml.length>2_000_000)throw new Error('Το XML ξεπερνά τα 2MB.');
  return parse(xml);
}
module.exports={DEFAULT_FEED_URL,validateUrl,parse,download};
