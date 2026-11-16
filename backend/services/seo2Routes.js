'use strict';
// Public SEO endpoints. Never read authenticated playlist history, account data or
// pending station edits; do not vary output based on User-Agent.
const express = require('express');
const Station = require('../models/Station');
const {origin,urlFor,pick,escapeXml,escapeHtml,stationUrl,stationId,stationSeo,
  stationFaq,directorySeo,homeSeo} = require('./seo2Core');
const {stationBody,directoryBody,homeBody,sendSeoHtml} = require('./seo2Render');
const {generateStationOgImage} = require('./seo2Image');
const {LLMS_STATION_FIELDS,headline,indexes,stationEntry,stationDetails,
  applicationDocument,directoryIntro,schemaForApplication,schemaForStation} = require('./seo2Llms');
const router = express.Router();
const ONLY_APPROVED = {status:'approved'};
const PAGES_PER_SITEMAP = 20000;
function fail(res,err) {
  console.error('[SEO 2.0]',err && err.message || err);
  if (res.headersSent) return;
  res.set('Cache-Control','private, no-store');
  res.status(503).type('text/plain').send('SEO page temporarily unavailable');
}
function missing(res){
  return res.status(404).set('X-Robots-Tag','noindex, nofollow')
    .set('Cache-Control','no-store').type('text/html')
    .send('<!doctype html><html lang="el"><head><meta name="robots" content="noindex, nofollow">'+
      '<title>Η σελίδα δεν βρέθηκε | iRadios</title></head><body><h1>404</h1></body></html>');
}
function xmlResponse(res,body) {
  return res.status(200).type('application/xml; charset=utf-8')
    .set('Cache-Control','public, max-age=300, s-maxage=600')
    .send('<?xml version="1.0" encoding="UTF-8"?>\n'+body);
}
function xmlUrl(url,lastmod,image) {
  return '<url><loc>'+escapeXml(url)+'</loc>'+
    (lastmod?'<lastmod>'+escapeXml(new Date(lastmod).toISOString())+'</lastmod>':'')+
    (image?'<image:image><image:loc>'+escapeXml(image)+'</image:loc></image:image>':'')+
    '</url>\n';
}
async function stationList(max=60) {
  return Station.find(ONLY_APPROVED)
    .select('_id slug name description genre secondaryGenre secondaryGenres city region country logo cover createdAt')
    .sort({position:1,createdAt:-1}).limit(max).lean();
}
// Public FAQ projection uses the EXACT same builder as server-rendered HTML/JSON-LD.
// No reads from StationPlaylist or authenticated, Premium-only track history.
router.get('/api/public/stations/:slug/faq',async(req,res)=>{
  try {
    const slug=String(req.params.slug||'');
    if (!slug || slug.length>180) return res.status(404).json({error:'Not found'});
    const isId=/^[0-9a-f]{24}$/i.test(slug);
    const station=await Station.findOne({...ONLY_APPROVED,$or:[
      {slug},...(isId?[{_id:slug}]:[])]})
      .select('slug name genre secondaryGenre secondaryGenres city region transmissionType frequency schedule scheduleDayBase')
      .lean();
    if (!station) return res.status(404).set('Cache-Control','no-store').json({error:'Not found'});
    return res.status(200).set('Cache-Control','public, max-age=60')
      .json({stationId:String(station._id),faq:stationFaq(station)});
  } catch (error) { return fail(res,error); }
});
router.get('/station/:slug',async(req,res)=>{
  try {
    const slug=String(req.params.slug||'');
    if(slug.length>180 || !slug) return missing(res);
    const objectId=/^[0-9a-f]{24}$/i.test(slug);
    const station=await Station.findOne({...ONLY_APPROVED,
      $or:[{slug},...(objectId?[{_id:slug}]:[])]}).lean();
    if(!station){
      const moved=await Station.findOne({...ONLY_APPROVED,previousSlugs:slug})
        .select('_id slug').lean();
      return moved?res.redirect(301,stationUrl(moved)):missing(res);
    }
    if(objectId && station.slug && station.slug!==slug)
      return res.redirect(301,stationUrl(station));
    if(station.slug && station.slug !== slug) return res.redirect(301,stationUrl(station));
    const seo=stationSeo(station);
    const similar=await Station.find({...ONLY_APPROVED,genre:station.genre,_id:{$ne:station._id}})
      .select('_id slug name').limit(5).lean();
    return await sendSeoHtml(res,seo,stationBody(station,seo,similar));
  }catch(error){return fail(res,error);}
});
router.get('/genre/:name',async(req,res)=>{
  try{
    const name=pick(req.params.name,120); if(!name)return missing(res);
    const stations=await Station.find({...ONLY_APPROVED,$or:[
      {genre:name},{secondaryGenre:name},{secondaryGenres:name}]})
      .select('_id slug name description city region genre')
      .sort({position:1}).limit(300).lean();
    if(!stations.length)return missing(res);
    const seo=directorySeo({type:'genre',name,stations});
    return await sendSeoHtml(res,seo,directoryBody(seo,stations));
  }catch(error){return fail(res,error);}
});
router.get('/region/:name',async(req,res)=>{
  try{
    const name=pick(req.params.name,120); if(!name)return missing(res);
    const stations=await Station.find({...ONLY_APPROVED,$or:[{region:name},{city:name}]})
      .select('_id slug name description city region genre')
      .sort({position:1}).limit(300).lean();
    if(!stations.length)return missing(res);
    const seo=directorySeo({type:'region',name,stations});
    return await sendSeoHtml(res,seo,directoryBody(seo,stations));
  }catch(error){return fail(res,error);}
});
router.get('/',async(_req,res)=>{
  try{
    const stations=await stationList(100);
    const seo=homeSeo(stations);
    return await sendSeoHtml(res,seo,homeBody(seo,stations));
  }catch(error){return fail(res,error);}
});
router.get('/map',async(_req,res)=>{
  try{
    const stations=await stationList(100);
    const seo=homeSeo(stations);
    seo.url=urlFor('/map');
    seo.title='Χάρτης ελληνικών ραδιοφωνικών σταθμών | iRadios';
    seo.h1='Χάρτης ραδιοφωνικών σταθμών';
    seo.description='Εξερεύνησε ραδιοφωνικούς σταθμούς από πόλεις και περιοχές της Ελλάδας στον χάρτη του iRadios.';
    seo.ld={'@context':'https://schema.org','@type':'CollectionPage',
      url:seo.url,name:seo.title,description:seo.description};
    return await sendSeoHtml(res,seo,homeBody(seo,stations));
  }catch(error){return fail(res,error);}
});
router.get('/og-image/:slug.png',async(req,res)=>{
  try{
    const slug=String(req.params.slug||'');
    if(slug.length>180)return missing(res);
    const isId=/^[0-9a-f]{24}$/i.test(slug);
    const station=await Station.findOne({...ONLY_APPROVED,
      $or:[{slug},...(isId?[{_id:slug}]:[])]})
      .select('name slogan cover logo genre city frequency schedule scheduleDayBase').lean();
    if(!station)return missing(res);
    const bytes=await generateStationOgImage(station);
    res.set('Content-Type','image/png');
    res.set('Cache-Control','public, max-age=86400, s-maxage=86400');
    return res.send(bytes);
  }catch(error){return fail(res,error);}
});
router.get('/robots.txt',(_req,res)=>{
  const stage=process.env.APP_ENV==='staging';
  const text=stage?'User-agent: *\nDisallow: /\n':
    'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /backoffice/\n'+
    'Disallow: /profile\nDisallow: /login\nDisallow: /register\n'+
    'Disallow: /checkout\nSitemap: '+urlFor('/sitemap.xml')+'\n';
  return res.type('text/plain; charset=utf-8').set('Cache-Control','public,max-age=300').send(text);
});
// Full dynamic LLMS 2.0: render every APPROVED station with bounded memory,
// shared schema and public-only fields. No bot-specific content or hard 25/40 cap.
const DOC_CACHE='public, max-age=180, s-maxage=300';
function publicDocument(res,format='text/plain; charset=utf-8'){
  if(process.env.APP_ENV==='staging')res.set('X-Robots-Tag','noindex, nofollow, noarchive');
  return res.set('Content-Type',format).set('Cache-Control',DOC_CACHE)
    .set('X-Content-Type-Options','nosniff');
}
function approvedBySlug(slug){
  const isId=/^[a-f0-9]{24}$/i.test(slug);
  return Station.findOne({...ONLY_APPROVED,$or:[{slug},...(isId?[{_id:slug}]:[])]})
    .select(LLMS_STATION_FIELDS).lean();
}
function safeSegment(value){
  return typeof value==='string'&&value.length>0&&value.length<=180&&
    !/[/\\\u0000-\u001f]/.test(value);
}
// Category and city names can legitimately contain a slash (e.g. Rock/Pop).
// They are never used as filesystem paths and are matched exactly in Mongo.
function safeDirectoryName(value){
  return typeof value==='string'&&value.length>0&&value.length<=120&&
    !/[\\\u0000-\u001f]/.test(value);
}
async function approvedOrMoved(slug){
  const station=await approvedBySlug(slug);
  if(station)return station;
  return Station.findOne({...ONLY_APPROVED,previousSlugs:slug})
    .select(LLMS_STATION_FIELDS).lean();
}
function canonicalDoc(st,format){
  return urlFor('/llms/'+(format==='jsonld'?'schema/stations/':'stations/')+
    stationId(st)+(format==='jsonld'?'.jsonld':'.md'));
}
async function loadPublicNames(){
  const [a,b,c,r,city]=await Promise.all([
    Station.distinct('genre',ONLY_APPROVED),
    Station.distinct('secondaryGenre',ONLY_APPROVED),
    Station.distinct('secondaryGenres',ONLY_APPROVED),
    Station.distinct('region',ONLY_APPROVED),
    Station.distinct('city',ONLY_APPROVED)
  ]);
  const clean=list=>[...new Set(list.flat().filter(x=>typeof x==='string')
    .map(x=>pick(x,120)).filter(Boolean))]
    .sort((x,y)=>x.localeCompare(y,'el'));
  return {genres:clean([a,b,c]),regions:clean([r,city])};
}
async function writeWithDrain(res,chunk){
  if(res.destroyed)return false;
  if(res.write(chunk))return true;
  await new Promise(resolve=>{
    const finished=()=>{
      res.off('drain',finished);
      res.off('close',finished);
      resolve();
    };
    res.once('drain',finished);
    res.once('close',finished);
  });
  return !res.destroyed;
}
async function streamStations(res,query,prefix,format){
  const cursor=Station.find(query).select(LLMS_STATION_FIELDS)
    .sort({name:1,_id:1}).lean().cursor({batchSize:128});
  try{
    publicDocument(res);
    if(!await writeWithDrain(res,prefix))return;
    for await(const station of cursor){
      if(!await writeWithDrain(res,format(station)))break;
    }
    if(!res.destroyed)res.end('\n');
  }catch(error){
    if(res.headersSent){res.destroy(error);return;}
    throw error;
  }finally{await cursor.close().catch(()=>{});}
}
router.get('/llms.txt',async(_req,res)=>{
  try{
    const {genres,regions}=await loadPublicNames();
    const count=await Station.countDocuments(ONLY_APPROVED);
    return await streamStations(res,ONLY_APPROVED,
      headline()+indexes(genres,regions)+'\n## Όλοι οι εγκεκριμένοι σταθμοί ('+count+')\n\n',
      stationEntry);
  }catch(error){return fail(res,error);}
});
router.get('/llms-full.txt',async(_req,res)=>{
  try{
    const {genres,regions}=await loadPublicNames();
    const count=await Station.countDocuments(ONLY_APPROVED);
    return await streamStations(res,ONLY_APPROVED,
      headline()+'\n## Αναλυτικά για την εφαρμογή\n\n'+applicationDocument()+'\n'+
      indexes(genres,regions)+'\n## Αναλυτικά δημόσια προφίλ ('+count+')\n\n',
      st=>stationDetails(st)+'\n---\n\n');
  }catch(error){return fail(res,error);}
});
router.get('/llms/application.md',(_req,res)=>
  publicDocument(res,'text/markdown; charset=utf-8').status(200).send(applicationDocument()));
router.get('/llms/schema/application.jsonld',async(_req,res)=>{
  try{
    const stations=await stationList(100);
    const data=schemaForApplication(stations);
    return publicDocument(res,'application/ld+json; charset=utf-8')
      .status(200).send(JSON.stringify(data));
  }catch(error){return fail(res,error);}
});
router.get('/llms/stations/:slug.md',async(req,res)=>{
  try{
    const slug=String(req.params.slug||'');
    if(!safeSegment(slug))return missing(res);
    const st=await approvedOrMoved(slug);
    if(!st)return missing(res);
    if(st.slug && st.slug!==slug)
      return res.redirect(301,canonicalDoc(st,'md'));
    return publicDocument(res,'text/markdown; charset=utf-8')
      .status(200).send(stationDetails(st));
  }catch(error){return fail(res,error);}
});
router.get('/llms/schema/stations/:slug.jsonld',async(req,res)=>{
  try{
    const slug=String(req.params.slug||'');
    if(!safeSegment(slug))return missing(res);
    const st=await approvedOrMoved(slug);
    if(!st)return missing(res);
    if(st.slug && st.slug!==slug)
      return res.redirect(301,canonicalDoc(st,'jsonld'));
    return publicDocument(res,'application/ld+json; charset=utf-8')
      .status(200).send(JSON.stringify(schemaForStation(st)));
  }catch(error){return fail(res,error);}
});
function scopeQuery(kind,name){
  return {...ONLY_APPROVED,$or:kind==='category'?
    [{genre:name},{secondaryGenre:name},{secondaryGenres:name}]:
    [{region:name},{city:name}]};
}
function directoryDoc(kind){
  return async(req,res)=>{
    try{
      const name=pick(req.params.name,120);
      if(!safeDirectoryName(name))return missing(res);
      const filter=scopeQuery(kind,name);
      if(!await Station.exists(filter))return missing(res);
      return await streamStations(res,filter,directoryIntro(kind,name),stationEntry);
    }catch(error){return fail(res,error);}
  };
}
router.get('/llms/categories/:name.md',directoryDoc('category'));
router.get('/llms/regions/:name.md',directoryDoc('region'));
router.get('/sitemap.xml',async(_req,res)=>{
  try{
    const count=await Station.countDocuments(ONLY_APPROVED);
    const files=[];
    for(let page=1;page<=Math.ceil(count/PAGES_PER_SITEMAP);page++)
      files.push('sitemap-stations-'+page+'.xml');
    files.push('sitemap-categories.xml','sitemap-regions.xml','sitemap-pages.xml');
    for(let page=1;page<=Math.ceil(count/PAGES_PER_SITEMAP);page++)
      files.push('sitemap-images-'+page+'.xml');
    const body='<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
      files.map(file=>'<sitemap><loc>'+escapeXml(urlFor('/'+file))+'</loc></sitemap>').join('')+
      '</sitemapindex>';
    return xmlResponse(res,body);
  }catch(error){return fail(res,error);}
});
router.get('/sitemap-stations-:page.xml',async(req,res)=>{
  try{
    const page=Number(req.params.page);
    if(!Number.isSafeInteger(page)||page<1||page>10000)return missing(res);
    const stations=await Station.find(ONLY_APPROVED)
      .select('_id slug seoUpdatedAt')
      .sort({_id:1}).skip((page-1)*PAGES_PER_SITEMAP).limit(PAGES_PER_SITEMAP).lean();
    if(!stations.length)return missing(res);
    const body='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
      stations.map(st=>xmlUrl(stationUrl(st),st.seoUpdatedAt)).join('')+'</urlset>';
    return xmlResponse(res,body);
  }catch(error){return fail(res,error);}
});
router.get('/sitemap-stations.xml',(_req,res)=>res.redirect(301,urlFor('/sitemap-stations-1.xml')));
router.get('/sitemap-categories.xml',async(_req,res)=>{
  try{
    const fields=await Promise.all(['genre','secondaryGenre','secondaryGenres']
      .map(field=>Station.distinct(field,ONLY_APPROVED)));
    const names=[...new Set(fields.flat().filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))];
    return xmlResponse(res,'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
      names.map(x=>xmlUrl(urlFor('/genre/'+encodeURIComponent(x)))).join('')+'</urlset>');
  }catch(error){return fail(res,error);}
});
router.get('/sitemap-regions.xml',async(_req,res)=>{
  try{
    const fields=await Promise.all(['region','city'].map(field=>Station.distinct(field,ONLY_APPROVED)));
    const names=[...new Set(fields.flat().filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))];
    return xmlResponse(res,'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
      names.map(x=>xmlUrl(urlFor('/region/'+encodeURIComponent(x)))).join('')+'</urlset>');
  }catch(error){return fail(res,error);}
});
router.get('/sitemap-pages.xml',(_req,res)=>{
  return xmlResponse(res,'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    [urlFor('/'),urlFor('/map')].map(x=>xmlUrl(x)).join('')+'</urlset>');
});
router.get('/sitemap-images-:page.xml',async(req,res)=>{
  try{
    const page=Number(req.params.page);
    if(!Number.isSafeInteger(page)||page<1||page>10000)return missing(res);
    const stations=await Station.find(ONLY_APPROVED)
      .select('_id slug name slogan description genre city cover logo frequency schedule')
      .sort({_id:1}).skip((page-1)*PAGES_PER_SITEMAP).limit(PAGES_PER_SITEMAP).lean();
    if(!stations.length)return missing(res);
    const body='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '+
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+
      stations.map(st=>{const seo=stationSeo(st);return xmlUrl(seo.url,null,seo.image);}).join('')+
      '</urlset>';
    return xmlResponse(res,body);
  }catch(error){return fail(res,error);}
});
router.get('/sitemap-images.xml',(_req,res)=>res.redirect(301,urlFor('/sitemap-images-1.xml')));
module.exports=router;
