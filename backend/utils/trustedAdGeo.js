'use strict';
const crypto=require('node:crypto');
const CATALOG=require('./stationLocationData.json');
const normal=v=>String(v||'').trim().normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR');
const eq=(a,b)=>normal(a)===normal(b);
// Cloudflare's official cf-region headers use English region names. Only
// explicit, one-to-one administrative translations are accepted; unknown
// values retain country-only scope (never an assumed region/prefecture).
const REGION_ALIASES=Object.freeze({
 attica:'Αττική','central macedonia':'Κεντρική Μακεδονία',
 thessaly:'Θεσσαλία','western greece':'Δυτική Ελλάδα',
 peloponnese:'Πελοπόννησος',epirus:'Ήπειρος',
 'central greece':'Στερεά Ελλάδα',
 'eastern macedonia and thrace':'Ανατολική Μακεδονία & Θράκη',
 'east macedonia and thrace':'Ανατολική Μακεδονία & Θράκη',
 'western macedonia':'Δυτική Μακεδονία',
 'ionian islands':'Ιόνια Νησιά','north aegean':'Βόρειο Αιγαίο',
 'south aegean':'Νότιο Αιγαίο',crete:'Κρήτη',cyprus:'Κύπρος'
});
function authorizedToken(expected,supplied){
 if(typeof expected!=='string'||expected.length<32||
    typeof supplied!=='string'||supplied.length!==expected.length)return false;
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
function resolveGeo(headers,secret){
 if(!authorizedToken(secret,headers?.['x-iradios-geo-auth']))return null;
 let country=String(headers['x-iradios-geo-country']||'').trim();
 if(country==='GR')country='Ελλάδα';
 if(country==='CY')country='Κύπρος';
 const regions=CATALOG[country];
 if(!regions)return null;
 const regionHint=headers['x-iradios-geo-region'];
 const requestedRegion=REGION_ALIASES[normal(regionHint)]||regionHint;
 const region=Object.keys(regions).find(k=>eq(k,requestedRegion));
 if(!region)return {country}; // Trusted country-only hint; not a local match.
 const prefectures=regions[region];
 const requestedPrefecture=headers['x-iradios-geo-prefecture'];
 let prefecture=Object.keys(prefectures).find(k=>eq(k,requestedPrefecture));
 if(!prefecture){
  // City-to-prefecture is allowed only for a unique exact catalog match.
  // Never infer prefecture from IP country or a general region with many.
  const city=headers['x-iradios-geo-city'];
  const matches=city?Object.entries(prefectures).filter(([,cities])=>
   Array.isArray(cities)&&cities.some(item=>eq(item,city))):[];
  if(matches.length===1)prefecture=matches[0][0];
 }
 if(!prefecture&&Object.keys(prefectures).length===1)
  prefecture=Object.keys(prefectures)[0];
 return prefecture?{country,region,prefecture}:{country,region};
}
function trustedAdGeo(req,res,next){
 // Never trust a client query string, arbitrary browser header or raw CF-*.
 // Reverse proxy must overwrite ALL x-iradios-geo-* values and keep its
 // shared secret out of client reach.
 const trusted=resolveGeo(req.headers,process.env.IRADIOS_TRUSTED_GEO_SECRET);
 // Required by delivery checks: a fixture location must NEVER be mistaken
 // for a signed reverse-proxy location when previewing a regional campaign.
 req.adGeoTrusted=Boolean(trusted);
 // This public staging host currently has no trusted reverse-proxy geo.
 // Show Greece / Attica test placements ONLY while the non-billable preview
 // switch is explicitly enabled. This is FIXTURE geo, NOT a visitor location.
 // Do not use this fallback in production or for any real paid accounting.
 const {paidPlacementPreviewEnabled}=require('../services/advertisingStagePaidPreview');
 const {enabled:paidV2Enabled}=require('../services/advertisingV2Ledger');
 req.geo=trusted||(!paidV2Enabled()&&paidPlacementPreviewEnabled()?{
  country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'
 }:null);
 next();
}
module.exports={authorizedToken,resolveGeo,trustedAdGeo};
