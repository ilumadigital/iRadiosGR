'use strict';
// Restricted, dependency-free XML/JSON schedule ingestion. External URLs are resolved
// and pinned to public DNS addresses; redirects are re-validated to avoid SSRF.
const http=require('node:http');
const https=require('node:https');
const dns=require('node:dns/promises');
const net=require('node:net');
const crypto=require('node:crypto');
const Station=require('../models/Station');
const {normalize}=require('../utils/scheduleNormalization');

const FEED_LIMIT=1024*1024;
const ROW_LIMIT=160;
const FIELD_NAMES=['title','producer','day','start','end','imageurl','description'];
const ALIASES={
  title:['title','showtitle','show_name','programtitle','programme','program','show','name','ekpompi'],
  producer:['producer','host','presenter','dj','artist','person','paragogos'],
  day:['day','weekday','dayofweek','day_of_week','mera'],
  start:['start','starttime','start_time','from','begin','beginning','hourfrom'],
  end:['end','endtime','end_time','to','finish','until','hourto'],
  imageurl:['imageurl','image_url','image','artwork','cover','photo','picture','thumbnail'],
  description:['description','summary','desc','details','info']
};
const DAY_NAMES={
  monday:1,mon:1,deftera:1,δευτερα:1,
  tuesday:2,tue:2,triti:2,τριτη:2,
  wednesday:3,wed:3,tetarti:3,τεταρτη:3,
  thursday:4,thu:4,pempti:4,πεμπτη:4,
  friday:5,fri:5,paraskevi:5,παρασκευη:5,
  saturday:6,sat:6,savvato:6,σαββατο:6,
  sunday:7,sun:7,kyriaki:7,κυριακη:7
};
function invalid(message,status=400){const e=new Error(message);e.status=status;return e;}
function keyName(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u0370-\u03ff]/g,'');}
function publicIp(address){
  const version=net.isIP(address);
  if(version===6){
    const x=address.toLowerCase();
    return /^[23][0-9a-f]/.test(x)&&!x.startsWith('2001:db8')&&!x.includes('::ffff:');
  }
  if(version!==4)return false;
  const [a,b,c]=address.split('.').map(Number);
  if(a===0||a===10||a===127||a>=224)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&(b===168||(b===0&&c===0)||(b===0&&c===2)))return false;
  if(a===198&&(b===18||b===19||(b===51&&c===100)))return false;
  if(a===203&&b===0&&c===113)return false;
  return true;
}
function publicHttpUrl(value){
  try{
    const u=new URL(value);
    const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'');
    if(!['http:','https:'].includes(u.protocol)||!host||u.username||u.password||
      value.length>1600||u.port&&!['80','443'].includes(u.port))return false;
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
      host.endsWith('.internal')||host.endsWith('.lan'))return false;
    return net.isIP(host)?publicIp(host):!host.includes(':')&&!/^\d+(?:\.\d+)*$/.test(host);
  }catch{return false;}
}
// Node.js 20+ may request DNS lookup({all:true}) for network-family selection.
// Returning (address, family) in that case triggers ERR_INVALID_IP_ADDRESS.
// Always pin the connection to the already-validated DNS address while
// respecting Node's requested lookup callback shape.
function createPinnedLookup(pinned){
  return (_hostname,options,callback)=>{
    if(options?.all)callback(null,[{address:pinned.address,family:pinned.family}]);
    else callback(null,pinned.address,pinned.family);
  };
}
async function fetchXml(url,hops=0){
  if(!publicHttpUrl(url))throw invalid('Το XML URL πρέπει να είναι δημόσιο HTTP/HTTPS χωρίς ιδιωτικό host ή μη επιτρεπτή θύρα.');
  const u=new URL(url),host=u.hostname.replace(/^\[|\]$/g,'');
  const addresses=net.isIP(host)?[{address:host,family:net.isIP(host)}]:
    await dns.lookup(host,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(item=>!publicIp(item.address)))
    throw invalid('Το feed URL οδηγεί σε μη δημόσια διεύθυνση δικτύου.');
  // Prefer a validated public IPv4 address on hosts without IPv6 egress.
  const pinned=addresses.find(item=>item.family===4)||addresses[0];
  const response=await new Promise((resolve,reject)=>{
    const driver=u.protocol==='https:'?https:http;
    const request=driver.get(u,{
      agent:false,timeout:10000,
      lookup:createPinnedLookup(pinned),
      headers:{'Accept':'application/xml,text/xml,application/json,text/plain;q=0.8',
        'User-Agent':'iRadiosGR-Schedule-Sync/1.0'}
    },res=>{
      if([301,302,303,307,308].includes(res.statusCode)){
        const location=res.headers.location;
        res.resume();
        return location?resolve({redirect:new URL(location,u).toString()}):
          reject(invalid('Το XML URL ανακατευθύνει χωρίς προορισμό.'));
      }
      if(res.statusCode!==200){res.resume();return reject(invalid('Το XML URL επέστρεψε HTTP '+res.statusCode,422));}
      let size=0;const buffers=[];
      res.on('data',chunk=>{
        size+=chunk.length;
        if(size>FEED_LIMIT){
          res.destroy(invalid('Το XML ξεπερνά το όριο του 1 MB.'));
        }else buffers.push(chunk);
      });
      res.on('end',()=>resolve({body:Buffer.concat(buffers).toString('utf8')}));
      res.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(invalid('Το XML URL δεν απάντησε εγκαίρως.',422)));
    request.on('error',reject);
  });
  if(response.redirect){
    if(hops>=2)throw invalid('Το XML URL έκανε υπερβολικές ανακατευθύνσεις.');
    return fetchXml(response.redirect,hops+1);
  }
  return response.body;
}
function decodeXml(value){
  return String(value||'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,(_full,entity)=>{
    const name=entity.toLowerCase();
    if(name==='amp')return '&';if(name==='lt')return '<';if(name==='gt')return '>';
    if(name==='quot')return '"';if(name==='apos')return "'";
    const cp=name.startsWith('#x')?parseInt(name.slice(2),16):parseInt(name.slice(1),10);
    return cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):'';
  });
}
function parseXml(xml){
  if(typeof xml!=='string'||!xml.trim()||xml.length>FEED_LIMIT)
    throw invalid('Το XML είναι κενό ή πολύ μεγάλο.');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw invalid('Τα XML DTD και entities δεν επιτρέπονται.');
  const source=xml.replace(/^\uFEFF/,'');
  const tokens=source.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/g)||[];
  if(tokens.join('')!==source)throw invalid('Το XML δεν έχει έγκυρη σύνταξη.');
  const root={name:'#document',attributes:{},children:[],text:''};
  const stack=[root];let count=0;
  for(const token of tokens){
    if(token.startsWith('<!--')||token.startsWith('<?'))continue;
    if(token.startsWith('<![CDATA[')){stack[stack.length-1].text+=token.slice(9,-3);continue;}
    if(token.startsWith('</')){
      const close=token.slice(2,-1).trim().toLowerCase();
      if(stack.length<2||stack[stack.length-1].name.toLowerCase()!==close)
        throw invalid('Το XML έχει ασύμβατα closing tags.');
      stack.pop();continue;
    }
    if(token.startsWith('<')){
      const selfClose=/\/>$/.test(token);
      const inside=token.slice(1,selfClose?-2:-1).trim();
      const match=inside.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);
      if(!match)throw invalid('Το XML περιέχει μη υποστηριζόμενο tag.');
      const attributes={};const leftovers=match[2].replace(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,(_s,k,v1,v2)=>{
        attributes[k]=decodeXml(v1===undefined?v2:v1);return '';
      });
      if(leftovers.trim())throw invalid('Το XML περιέχει μη έγκυρα attributes.');
      if(++count>10000||stack.length>16)throw invalid('Το XML περιέχει υπερβολικά πολλά στοιχεία.');
      const node={name:match[1],attributes,children:[],text:''};
      stack[stack.length-1].children.push(node);
      if(!selfClose)stack.push(node);
    }else{
      if(stack.length===1&&token.trim())throw invalid('Το XML περιέχει κείμενο εκτός root.');
      stack[stack.length-1].text+=decodeXml(token);
    }
  }
  if(stack.length!==1||root.children.length!==1)throw invalid('Το XML πρέπει να έχει ένα root element και σωστά closing tags.');
  return root.children[0];
}
function rowFields(row){
  const values={};
  const add=(name,value)=>{
    if(typeof value==='string'&&value.trim()&&!Object.prototype.hasOwnProperty.call(values,name))
      values[name]=value.trim();
  };
  Object.entries(row.attributes).forEach(([key,value])=>add(key,value));
  function visit(node,prefix='',depth=0){
    if(depth>3)return;
    const tag=node.name.replace(/^.*:/,'');
    const name=prefix?prefix+'.'+tag:tag;
    if(node.children.length===0)add(name,node.text);
    else{
      node.children.forEach(child=>visit(child,name,depth+1));
      if(!prefix&&node.children.length===1)add(tag,node.children[0].text);
    }
  }
  row.children.forEach(child=>visit(child));
  return values;
}
function rowsFromXml(root,chosenTag){
  const groups=new Map();
  function walk(node){
    if(node.children.length||Object.keys(node.attributes).length){
      const name=node.name.replace(/^.*:/,'');
      const fields=rowFields(node);
      if(Object.keys(fields).length>=2){
        const group=groups.get(name)||[];
        group.push(node);groups.set(name,group);
      }
    }
    node.children.forEach(walk);
  }
  walk(root);
  const candidates=[...groups.entries()].filter(([,nodes])=>nodes.length&&nodes.length<=ROW_LIMIT)
    .sort((a,b)=>b[1].length-a[1].length)
    .map(([tag,nodes])=>({tag,count:nodes.length}));
  const selected=chosenTag?
    candidates.find(item=>keyName(item.tag)===keyName(chosenTag)):
    candidates.find(item=>['show','item','programme','program','entry','event','broadcast','ekpompi'].includes(keyName(item.tag)))||candidates[0];
  if(!selected)throw invalid('Δεν αναγνωρίστηκαν εγγραφές εκπομπών. Έλεγξε το XML ή το row tag.');
  const rows=groups.get(selected.tag).map(rowFields);
  const fields=[...new Set(rows.slice(0,15).flatMap(row=>Object.keys(row)))];
  return {rows,fields,rowTags:candidates.slice(0,25),rowTag:selected.tag};
}
function rowsFromJson(raw){
  let data;
  try{data=JSON.parse(raw);}catch{throw invalid('Το feed περιέχει μη έγκυρο JSON.');}
  const obj=item=>item&&typeof item==='object'&&!Array.isArray(item);
  let entries,dayFormat;
  if(obj(data)&&Array.isArray(data.days)){
    if(data.ok===false)throw invalid('Το JSON feed επέστρεψε σφάλμα αντί για πρόγραμμα.');
    entries=data.days.flatMap(day=>{
      if(!obj(day)||!Array.isArray(day.shows))throw invalid('Το JSON περιέχει ημέρα χωρίς λίστα εκπομπών.');
      return day.shows.map(show=>{
        if(!obj(show))throw invalid('Το JSON περιέχει μη έγκυρη εκπομπή.');
        // Deseo publishes end_time=23:59 for a slot whose end_at is
        // 00:00 on the next day. Preserve the real midnight boundary.
        const midnight=show.end_time==='23:59'&&
          typeof show.start_at==='string'&&typeof show.end_at==='string'&&
          /^\d{4}-\d{2}-\d{2}T00:00:00/.test(show.end_at)&&
          show.start_at.slice(0,10)!==show.end_at.slice(0,10);
        return {...show,day_of_week:day.day_of_week??day.day,
          ...(midnight?{end_time:'24:00'}:{})};
      });
    });
    if(data.days.every(day=>Number.isInteger(Number(day.day_of_week))&&
      Number(day.day_of_week)>=1&&Number(day.day_of_week)<=7))dayFormat='iso';
  }else if(Array.isArray(data))entries=data;
  else if(obj(data)&&Array.isArray(data.shows))entries=data.shows;
  else if(obj(data)&&Array.isArray(data.schedule))entries=data.schedule;
  else throw invalid('Δεν βρέθηκε λίστα εκπομπών JSON (days[].shows, shows ή schedule).');
  if(!entries.length||entries.length>ROW_LIMIT)
    throw invalid('Το feed πρέπει να περιέχει από 1 έως 160 εκπομπές.');
  const rows=entries.map(item=>{
    if(!obj(item))throw invalid('Μη έγκυρη εκπομπή JSON.');
    return Object.fromEntries(Object.entries(item)
      .filter(([key,value])=>key.length<=100&&
        (typeof value==='string'||typeof value==='number'))
      .map(([key,value])=>[key,String(value)]));
  });
  const fields=[...new Set(rows.slice(0,30).flatMap(row=>Object.keys(row)))];
  return {rows,fields,rowTag:'shows',rowTags:[],format:'json',dayFormat};
}
function autoMapping(fields,mapping){
  const configured=mapping&&typeof mapping==='object'&&!Array.isArray(mapping)?mapping:{};
  const result={};
  for(const target of FIELD_NAMES){
    const requested=configured[target];
    if(typeof requested==='string'&&fields.some(f=>f===requested))result[target]=requested;
    else if(requested==='')result[target]='';
    else result[target]=fields.find(f=>ALIASES[target].some(a=>keyName(a)===keyName(f)))||'';
  }
  return result;
}
function mapped(row,field){
  if(!field)return '';
  const key=Object.keys(row).find(x=>x===field);
  return key?row[key]:'';
}
function dayNumber(value,dayFormat){
  const raw=String(value||'').trim();
  if(/^[0-7]$/.test(raw)){
    const n=Number(raw);
    if(dayFormat==='monday0')return n+1;
    if(dayFormat==='sunday0')return n===0?7:n;
    return n;
  }
  return DAY_NAMES[keyName(raw)]||NaN;
}
function timeString(value,canEnd){
  const match=String(value||'').trim().replace('.',':').match(/^(\d{1,2}):(\d{2})(?::00)?$/);
  if(!match)return '';
  const h=Number(match[1]),m=Number(match[2]);
  if(m>59||h>23&&!(canEnd&&h===24&&m===0))return '';
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function mapRows(payload,options={}){
  const chosenMapping=autoMapping(payload.fields,options.mapping);
  const dayFormat=payload.dayFormat||(['iso','monday0','sunday0'].includes(options.dayFormat)?options.dayFormat:'iso');
  const required=['day','start','end'];
  if(required.some(key=>!chosenMapping[key])||!chosenMapping.title&&!chosenMapping.producer)
    throw invalid('Επίλεξε mapping για ημέρα, έναρξη, λήξη και τίτλο ή παραγωγό.');
  const source=payload.rows.map((row,index)=>{
    const producer=mapped(row,chosenMapping.producer).trim();
    const title=mapped(row,chosenMapping.title).trim()||producer;
    const entry={
      day:dayNumber(mapped(row,chosenMapping.day),dayFormat),
      startTime:timeString(mapped(row,chosenMapping.start),false),
      endTime:timeString(mapped(row,chosenMapping.end),true),
      title,host:producer,
      imageUrl:mapped(row,chosenMapping.imageurl).trim(),
      description:mapped(row,chosenMapping.description).trim()
    };
    if(!Number.isInteger(entry.day)||entry.day<1||entry.day>7||!entry.startTime||!entry.endTime||!title)
      throw invalid('Λανθασμένη εγγραφή XML στη γραμμή '+(index+1)+': ημέρα, ώρες ή τίτλος/παραγωγός.');
    return entry;
  });
  if(!source.length)throw invalid('Το XML δεν περιέχει εκπομπές. Δεν θα διαγραφεί το υπάρχον πρόγραμμα.');
  let normalized;
  try{normalized=normalize(source);}catch(e){throw invalid('Το XML δεν αποθηκεύτηκε: '+e.message);}
  return {...payload,mapping:chosenMapping,dayFormat,sourceCount:source.length,
    schedule:normalized.schedule,split:normalized.split,
    hash:crypto.createHash('sha256').update(JSON.stringify(normalized.schedule)).digest('hex')};
}
async function readFeedRows(options){
  let body;
  try{body=await fetchXml(String(options.url||'').trim());}
  catch(error){
    if(error.status)throw error;
    const code=String(error.code||'').toUpperCase();
    const detail=['ENOTFOUND','EAI_AGAIN'].includes(code)?
      'Δεν επιλύεται το DNS του feed από τον server ('+code+').':
      ['ENETUNREACH','EHOSTUNREACH','ETIMEDOUT','ECONNREFUSED','ECONNRESET'].includes(code)?
        'Αποτυχία δικτυακής σύνδεσης από τον staging server ('+code+').':
        /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)?
          'Σφάλμα πιστοποιητικού SSL/TLS του feed ('+code+').':
          'Αποτυχία σύνδεσης από τον staging server'+(code?' ('+code+')':'')+'.';
    throw invalid(detail+' Έλεγξε τον σύνδεσμο και την εξερχόμενη πρόσβαση του server.',422);
  }
  const trimmed=body.trimStart();
  if(trimmed.startsWith('{')||trimmed.startsWith('['))return rowsFromJson(body);
  return {...rowsFromXml(parseXml(body),String(options.rowTag||'').trim()),format:'xml'};
}
async function loadFeed(options){
  return mapRows(await readFeedRows(options),options);
}
// Preview must return discovered fields even when no valid mapping exists yet.
// Only the final import/sync performs the strict all-or-nothing validation.
function previewRows(rows,options={}){
  const mapping=autoMapping(rows.fields,options.mapping);
  const dayFormat=rows.dayFormat||(['iso','monday0','sunday0'].includes(options.dayFormat)?options.dayFormat:'iso');
  try{
    return {...mapRows(rows,{...options,mapping,dayFormat}),valid:true,validationError:''};
  }catch(error){
    if(error.status!==400)throw error;
    return {...rows,mapping,dayFormat,sourceCount:rows.rows.length,
      schedule:[],split:0,valid:false,validationError:error.message};
  }
}
async function previewFeed(options){
  return previewRows(await readFeedRows(options),options);
}
function publicPreview(result){
  return {rowTag:result.rowTag,rowTags:result.rowTags,fields:result.fields,
    format:result.format||'xml',
    mapping:result.mapping,dayFormat:result.dayFormat,valid:result.valid!==false,
    validationError:result.validationError||'',
    count:result.schedule.length,sourceCount:result.sourceCount,split:result.split,
    sample:result.schedule.slice(0,18)};
}
async function syncOne(stationId){
  const now=new Date();
  const station=await Station.findOneAndUpdate({
    _id:stationId,'scheduleFeed.enabled':true,
    $or:[{'scheduleFeed.lockUntil':{$lte:now}},{'scheduleFeed.lockUntil':null},
      {'scheduleFeed.lockUntil':{$exists:false}}]
  },{$set:{'scheduleFeed.lockUntil':new Date(Date.now()+120000)}},{new:true}).select('+scheduleFeed');
  if(!station)return {skipped:true};
  try{
    const config=station.scheduleFeed;
    const parsed=await loadFeed(config);
    const oldHash=crypto.createHash('sha256').update(JSON.stringify(
      normalize(station.scheduleDayBase===1?station.schedule.map(s=>s.toObject?s.toObject():s):[]).schedule
    )).digest('hex');
    const changed=parsed.hash!==oldHash;
    if(changed){station.schedule=parsed.schedule;station.scheduleDayBase=1;}
    config.lastCheckedAt=new Date();config.lastSuccessAt=new Date();
    if(changed)config.lastChangedAt=new Date();
    config.lastHash=parsed.hash;config.lastCount=parsed.schedule.length;
    config.lastError='';config.failures=0;config.lockUntil=null;
    await station.save();
    return {changed,count:parsed.schedule.length};
  }catch(e){
    const message=(e.message||'Αποτυχία XML sync').slice(0,400);
    await Station.updateOne({_id:stationId},{$set:{
      'scheduleFeed.lastCheckedAt':new Date(),'scheduleFeed.lastError':message,
      'scheduleFeed.lockUntil':null
    },$inc:{'scheduleFeed.failures':1}});
    return {error:message};
  }
}
async function syncAll(){
  // All configured stations, with bounded concurrency; do not truncate the catalog.
  const ids=await Station.find({'scheduleFeed.enabled':true}).select('_id').lean();
  let index=0;const summary={checked:0,changed:0,failed:0,skipped:0};
  await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{
    while(index<ids.length){
      const stationId=ids[index++]._id;
      const result=await syncOne(stationId);
      if(result.skipped){summary.skipped++;continue;}
      summary.checked++;
      if(result.error)summary.failed++;
      else if(result.changed)summary.changed++;
    }
  }));
  console.info('[SCHEDULE XML] Sync completed',summary);
  return summary;
}
function startCron(){
  const cron=require('node-cron');
  cron.schedule('0 3 * * *',()=>syncAll().catch(e=>
    console.error('[SCHEDULE XML] Sync failed',e.message)),{timezone:'Europe/Athens'});
  console.info('[SCHEDULE XML] Daily sync scheduled 03:00 Europe/Athens');
}
module.exports={loadFeed,previewFeed,publicPreview,publicHttpUrl,syncOne,syncAll,startCron,
  __testing:{parseXml,rowsFromXml,rowsFromJson,mapRows,previewRows,dayNumber,timeString,
    createPinnedLookup}};
