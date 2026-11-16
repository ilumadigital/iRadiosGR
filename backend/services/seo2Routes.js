'use strict';
// Public SEO endpoints. Never read authenticated playlist history, account data or
// pending station edits; do not vary output based on User-Agent.
const express = require('express');
const Station = require('../models/Station');
const {origin,urlFor,pick,escapeXml,escapeHtml,stationUrl,stationId,stationSeo,
  directorySeo,homeSeo} = require('./seo2Core');
const {stationBody,directoryBody,homeBody,sendSeoHtml} = require('./seo2Render');
const {generateStationOgImage} = require('./seo2Image');
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
router.get('/station/:slug',async(req,res)=>{
  try {
    const slug=String(req.params.slug||'');
    if(slug.length>180 || !slug) return missing(res);
    const objectId=/^[0-9a-f]{24}$/i.test(slug);
    const station=await Station.findOne({...ONLY_APPROVED,
      $or:[{slug},...(objectId?[{_id:slug}]:[])]}).lean();
    if(!station)return missing(res);
    if(objectId && station.slug && station.slug!==slug)
      return res.redirect(301,stationUrl(station));
    if(station.slug && station.slug !== slug) return res.redirect(301,stationUrl(station));
    const seo=stationSeo(station);
    const similar=await Station.find({...ONLY_APPROVED,genre:station.genre,_id:{$ne:station._id}})
      .select('_id slug name').limit(5).lean();
    return sendSeoHtml(res,seo,stationBody(station,seo,similar));
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
    return sendSeoHtml(res,seo,directoryBody(seo,stations));
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
    return sendSeoHtml(res,seo,directoryBody(seo,stations));
  }catch(error){return fail(res,error);}
});
router.get('/',async(_req,res)=>{
  try{
    const stations=await stationList(100);
    const seo=homeSeo(stations);
    return sendSeoHtml(res,seo,homeBody(seo,stations));
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
    return sendSeoHtml(res,seo,homeBody(seo,stations));
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
router.get('/llms.txt',async(_req,res)=>{
  try{
    const stations=await stationList(40);
    const byGenre=[...new Set(stations.map(x=>pick(x.genre,90)).filter(Boolean))].slice(0,15);
    const text=[
      '# iRadios',
      '',
      '> Δημόσιος κατάλογος ελληνικών και διαδικτυακών ραδιοφωνικών σταθμών. Ακρόαση ζωντανού ραδιοφώνου.',
      '',
      '## Βασικές σελίδες',
      '- [Αρχική]('+urlFor('/')+')',
      '- [Χάρτης ραδιοφωνικών σταθμών]('+urlFor('/map')+')',
      '- [XML sitemap]('+urlFor('/sitemap.xml')+')',
      '',
      '## Μουσικές κατηγορίες',
      ...byGenre.map(x=>'- ['+x.replace(/[\[\]()]/g,'')+']('+urlFor('/genre/'+encodeURIComponent(x))+')'),
      '',
      '## Επιλεγμένα δημόσια προφίλ',
      ...stations.slice(0,25).map(x=>'- ['+pick(x.name,100).replace(/[\[\]()]/g,'')+']('+stationUrl(x)+')'),
      '',
      '## Χρήση',
      'Οι περιγραφές, οι συχνότητες και τα προγράμματα ακολουθούν όσα έχουν δηλώσει οι σταθμοί.',
      'Το πρόγραμμα χρησιμοποιεί ώρα Ελλάδας (Europe/Athens).',
      'Τα now-playing δεδομένα αλλάζουν συνεχώς και δεν αποτελούν μόνιμη playlist.',
      'Ιδιωτικές πληροφορίες λογαριασμών και προστατευμένο ιστορικό ακρόασης δεν δημοσιεύονται.',
      ''
    ].join('\n');
    return res.type('text/plain; charset=utf-8').set('Cache-Control','public,max-age=3600').send(text);
  }catch(error){return fail(res,error);}
});
router.get('/sitemap.xml',async(_req,res)=>{
  try{
    const count=await Station.countDocuments(ONLY_APPROVED);
    const files=[];
    for(let page=1;page<=Math.ceil(count/PAGES_PER_SITEMAP);page++)
      files.push('sitemap-stations-'+page+'.xml');
    files.push('sitemap-categories.xml','sitemap-regions.xml','sitemap-pages.xml','sitemap-images.xml');
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
router.get('/sitemap-images.xml',async(_req,res)=>{
  try{
    const stations=await Station.find(ONLY_APPROVED)
      .select('_id slug name slogan description genre city cover logo frequency schedule')
      .limit(PAGES_PER_SITEMAP).lean();
    const body='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '+
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+
      stations.map(st=>{const seo=stationSeo(st);return xmlUrl(seo.url,null,seo.image);}).join('')+
      '</urlset>';
    return xmlResponse(res,body);
  }catch(error){return fail(res,error);}
});
module.exports=router;
