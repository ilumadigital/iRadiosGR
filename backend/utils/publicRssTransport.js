'use strict';
// Network transport for user-added RSS feeds. SSRF guard verifies AND pins the
// resolved public IP at TLS connection time. No redirects, ports or private IPs.
const dns=require('node:dns');
const net=require('node:net');
const https=require('node:https');
const MAX_XML_BYTES=2_000_000;
const MAX_HTML_BYTES=1_000_000;
const blockedSuffixes=['.localhost','.local','.internal','.test','.example','.invalid','.onion','.home','.lan'];
const invalid=msg=>{throw Object.assign(new Error(msg),{status:400});};
function validatePublicUrl(value,{feed=false}={}){
  if(typeof value!=='string'||value.length>1200)invalid('Δώσε έγκυρο HTTPS RSS/XML URL (έως 1200 χαρακτήρες).');
  let u;try{u=new URL(value.trim());}catch{invalid('Μη έγκυρο RSS/XML URL.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)
    invalid('Το RSS πρέπει να είναι HTTPS, χωρίς port, κωδικούς ή #fragment.');
  const h=u.hostname.toLowerCase();
  if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)||
    net.isIP(h)||blockedSuffixes.some(s=>h.endsWith(s))||
    ['localhost','localdomain'].includes(h))invalid('Μη επιτρεπτό RSS hostname.');
  if(feed){
    const path=decodeURIComponent(u.pathname).toLowerCase();
    const params=u.searchParams;
    if(!/(?:^|\/)(?:feed|feeds|rss|atom)(?:\/|$|[._-])|(?:\.xml|\.rss|\.atom)$/i.test(path)&&
      !['rss','rss2','atom','rdf'].includes((params.get('feed')||'').toLowerCase())&&
      !['rss','rss2','atom','xml'].includes((params.get('format')||'').toLowerCase()))
      invalid('Ο σύνδεσμος πρέπει να οδηγεί σε RSS/XML feed (π.χ. /feed ή .xml).');
  }
  if(/%00|%0d|%0a/i.test(u.pathname+u.search))invalid('Μη έγκυρο RSS path.');
  return u.href;
}
function ipv4Public(ip){
  const b=ip.split('.').map(Number);
  if(b.length!==4||b.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const [a,c,d]=b;
  if(a===0||a===10||a===127||a>=224||a===169&&c===254||
    a===172&&c>=16&&c<=31||a===192&&c===168||
    a===100&&c>=64&&c<=127||a===192&&c===0||
    a===192&&c===88&&d===99||a===192&&c===0&&d===2||
    a===198&&(c===18||c===19||c===51&&d===100)||
    a===203&&c===0&&d===113||a===192&&c===0&&d===0)return false;
  return true;
}
function publicIp(ip){
  if(net.isIP(ip)===4)return ipv4Public(ip);
  if(net.isIP(ip)!==6)return false;
  // Only global IPv6 unicast, excluding reserved/documentation and mapped IPs.
  const lower=ip.toLowerCase();
  if(lower.includes('.'))return false; // IPv4-mapped or IPv4-embedded
  const first=parseInt(lower.split(':')[0]||'0',16);
  if(first<0x2000||first>0x3fff)return false;
  if(lower.startsWith('2001:db8:')||lower==='2001:db8::'||
    lower.startsWith('2001:0:')||lower.startsWith('2001:10:'))return false;
  return true;
}
function safeLookup(host,options,cb){
  dns.lookup(host,{all:true,verbatim:true},(err,addresses)=>{
    if(err)return cb(err);
    if(!addresses?.length||addresses.some(r=>!publicIp(r.address)))
      return cb(new Error('Η DNS διεύθυνση του RSS server δεν είναι δημόσια.'));
    const preferred=addresses.find(r=>r.family===4)||addresses[0];
    cb(null,preferred.address,preferred.family);
  });
}
// Follow a maximum of two HTTPS redirects on the exact same host only.
// Feed URLs still must match the RSS/XML form; HTML article fetches are likewise
// constrained to the starting publisher. DNS is public-only and pinned on EVERY hop.
function redirectTarget(current,location,{feed}){
  let target;
  try{target=new URL(location,current);}
  catch{throw new Error('Το RSS έκανε μη έγκυρη ανακατεύθυνση.');}
  const original=new URL(current);
  if(target.hostname!==original.hostname||target.protocol!=='https:'||
    target.username||target.password||target.port)
    throw new Error('Η πηγή RSS ανακατευθύνει σε διαφορετικό domain. Χρησιμοποίησε το τελικό HTTPS RSS URL.');
  return validatePublicUrl(target.href,{feed});
}
function requestText(value,{feed=false,html=false}={}){
  const href=validatePublicUrl(value,{feed});
  const max=html?MAX_HTML_BYTES:MAX_XML_BYTES;
  const fetchHop=(url,hops)=>new Promise((resolve,reject)=>{
    let done=false;
    const finish=(error,body)=>{
      if(done)return;done=true;
      if(error)reject(error);else resolve(body);
    };
    const req=https.request(new URL(url),{
      method:'GET',agent:false,lookup:safeLookup,
      headers:{
        Accept:html?'text/html, application/xhtml+xml':'application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain',
        'Accept-Encoding':'gzip, deflate, br, identity',
        'User-Agent':'iRadiosGR-NewsFeed/3.1'
      },
      timeout:html?4000:9000
    },res=>{
      const status=res.statusCode||0;
      if([301,302,303,307,308].includes(status)){
        res.resume();
        if(hops>=2)return finish(new Error('Υπερβολικές ανακατευθύνσεις από το RSS.'));
        let target;
        try{target=redirectTarget(url,res.headers.location,{feed});}
        catch(e){return finish(e);}
        fetchHop(target,hops+1).then(body=>finish(null,body),finish);
        return;
      }
      if(status<200||status>=300){
        res.resume();return finish(new Error('Ο RSS server επέστρεψε HTTP '+status+'.'));
      }
      const type=String(res.headers['content-type']||'');
      if(type&&!(html?/html/i:/xml|text\/plain|application\/octet-stream/i).test(type)){
        res.resume();return finish(new Error('Η πηγή δεν επέστρεψε '+(html?'HTML':'RSS/Atom XML')+'.'));
      }
      const encoding=String(res.headers['content-encoding']||'identity').toLowerCase();
      if(!['identity','gzip','deflate','br'].includes(encoding)){
        res.resume();return finish(new Error('Μη υποστηριζόμενη συμπίεση RSS.'));
      }
      if(Number(res.headers['content-length']||0)>max){
        res.resume();return finish(new Error('Το RSS/XML ξεπερνά το όριο μεγέθους.'));
      }
      let decoder;
      if(encoding==='gzip')decoder=require('node:zlib').createGunzip();
      else if(encoding==='br')decoder=require('node:zlib').createBrotliDecompress();
      else if(encoding==='deflate')decoder=require('node:zlib').createInflate();
      const input=decoder||res;
      if(decoder){
        decoder.on('error',e=>finish(new Error('Αποτυχία αποσυμπίεσης RSS: '+e.message)));
        res.pipe(decoder);
      }
      let bytes=0,rawBytes=0;
      const parts=[];
      if(decoder){
        res.on('data',part=>{
          rawBytes+=part.length;
          if(rawBytes>max)res.destroy(new Error('Το συμπιεσμένο RSS ξεπερνά το όριο.'));
        });
      }
      input.on('data',part=>{
        bytes+=part.length;
        if(bytes>max){
          input.destroy(new Error('Το RSS/XML ξεπερνά το όριο μεγέθους.'));
          res.destroy();
          return;
        }
        parts.push(part);
      });
      input.on('end',()=>finish(null,Buffer.concat(parts).toString('utf8')));
      input.on('error',error=>finish(error));
      res.on('error',error=>finish(error));
    });
    req.on('timeout',()=>req.destroy(new Error('Η πηγή RSS δεν αποκρίθηκε έγκαιρα.')));
    req.on('error',error=>finish(error));
    req.end();
  });
  return fetchHop(href,0);
}
module.exports={validatePublicUrl,publicIp,safeLookup,redirectTarget,requestText};
