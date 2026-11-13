'use strict';
const crypto=require('node:crypto');
const CATALOG=require('./stationLocationData.json');
const normal=v=>String(v||'').trim().normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR');
const eq=(a,b)=>normal(a)===normal(b);
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
 const requestedRegion=headers['x-iradios-geo-region'];
 const region=Object.keys(regions).find(k=>eq(k,requestedRegion));
 if(!region)return {country}; // Trusted country-only hint; not a local match.
 const requestedPrefecture=headers['x-iradios-geo-prefecture'];
 const prefecture=Object.keys(regions[region]).find(k=>eq(k,requestedPrefecture));
 return prefecture?{country,region,prefecture}:{country,region};
}
function trustedAdGeo(req,res,next){
 // Never trust a client query string, arbitrary browser header or raw CF-*.
 // Reverse proxy must overwrite ALL x-iradios-geo-* values and keep its
 // shared secret out of client reach.
 const trusted=resolveGeo(req.headers,process.env.IRADIOS_TRUSTED_GEO_SECRET);
 // This public staging host currently has no trusted reverse-proxy geo.
 // Show Greece / Attica test placements ONLY while the non-billable preview
 // switch is explicitly enabled. This is FIXTURE geo, NOT a visitor location.
 // Do not use this fallback in production or for any real paid accounting.
 const {paidPlacementPreviewEnabled}=require('../services/advertisingStagePaidPreview');
 req.geo=trusted||(paidPlacementPreviewEnabled()?{
  country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'
 }:null);
 next();
}
module.exports={authorizedToken,resolveGeo,trustedAdGeo};
