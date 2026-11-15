'use strict';
// Trusted origin geolocation for billable ads. A browser cannot authenticate
// location; only a root-configured, header-overwriting staging Nginx proxy can.
const crypto=require('node:crypto');
const CATALOG=require('./stationLocationData.json');
const normal=v=>String(v||'').trim().normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR');
const eq=(a,b)=>normal(a)===normal(b);
const REGION_ALIASES=Object.freeze({
 'attica':'Αττική','attiki':'Αττική',
 'central macedonia':'Κεντρική Μακεδονία',
 'thessaly':'Θεσσαλία','thessalia':'Θεσσαλία',
 'western greece':'Δυτική Ελλάδα','west greece':'Δυτική Ελλάδα',
 'peloponnese':'Πελοπόννησος','peloponnesus':'Πελοπόννησος',
 'epirus':'Ήπειρος','ipeiros':'Ήπειρος',
 'central greece':'Στερεά Ελλάδα',
 'eastern macedonia and thrace':'Ανατολική Μακεδονία & Θράκη',
 'east macedonia and thrace':'Ανατολική Μακεδονία & Θράκη',
 'eastern macedonia & thrace':'Ανατολική Μακεδονία & Θράκη',
 'western macedonia':'Δυτική Μακεδονία','west macedonia':'Δυτική Μακεδονία',
 'ionian islands':'Ιόνια Νησιά',
 'north aegean':'Βόρειο Αιγαίο','northern aegean':'Βόρειο Αιγαίο',
 'south aegean':'Νότιο Αιγαίο','southern aegean':'Νότιο Αιγαίο',
 'crete':'Κρήτη','kriti':'Κρήτη',
 // The iRadios Cyprus catalog has one encompassing region.
 'cyprus':'Κύπρος',
 'nicosia':'Κύπρος','limassol':'Κύπρος','larnaca':'Κύπρος',
 'paphos':'Κύπρος','famagusta':'Κύπρος','kyrenia':'Κύπρος'
});
// Only exact city aliases tied to catalog entries. Never geocode a city name
// alone across different regions. Unrecognized or coarse city => region only.
const CITY_ALIASES=Object.freeze({
 'athens':'Αθήνα','piraeus':'Πειραιάς','kallithea':'Καλλιθέα',
 'thessaloniki':'Θεσσαλονίκη','salonica':'Θεσσαλονίκη',
 'patras':'Πάτρα','patra':'Πάτρα',
 'larissa':'Λάρισα','larisa':'Λάρισα','volos':'Βόλος',
 'ioannina':'Ιωάννινα','kalamata':'Καλαμάτα','corinth':'Κόρινθος',
 'heraklion':'Ηράκλειο','iraklio':'Ηράκλειο','chania':'Χανιά',
 'rhodes':'Ρόδος','rodos':'Ρόδος','mytilene':'Μυτιλήνη',
 'nicosia':'Λευκωσία','limassol':'Λεμεσός','larnaca':'Λάρνακα',
 'paphos':'Πάφος'
});
function authorizedToken(expected,supplied){
 if(typeof expected!=='string'||expected.length<32||
    typeof supplied!=='string'||supplied.length!==expected.length)return false;
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
function bounded(value){return typeof value==='string'&&value.length<=128?value.trim():'';}
function getCountry(input){
 const value=bounded(input);
 if(value==='GR'||eq(value,'Ελλάδα'))return 'Ελλάδα';
 if(value==='CY'||eq(value,'Κύπρος'))return 'Κύπρος';
 return null; // Unknown / foreign IP cannot satisfy GR/CY targeting.
}
function getRegion(country,value){
 const name=bounded(value);
 const options=CATALOG[country]||{};
 const canonical=options[REGION_ALIASES[normal(name)]]?
  REGION_ALIASES[normal(name)]:name;
 return Object.keys(options).find(k=>eq(k,canonical))||null;
}
function cityPrefecture(country,region,rawCity,rawAccuracy){
 const city=bounded(rawCity);
 // The free GeoLite city point can be inaccurate by many kilometres.
 // Do not infer district/prefecture without explicitly bounded accuracy.
 const accuracy=Number(rawAccuracy);
 if(!city||typeof rawAccuracy!=='string'||!rawAccuracy.trim()||
    !Number.isFinite(accuracy)||accuracy<=0||accuracy>25)return null;
 const normalizedCity=CITY_ALIASES[normal(city)]||city;
 const prefectures=CATALOG[country][region];
 const candidates=Object.entries(prefectures).filter(([,cities])=>
   Array.isArray(cities)&&cities.some(name=>eq(name,normalizedCity)));
 return candidates.length===1?candidates[0][0]:null;
}
function resolveGeo(headers,secret){
 if(!authorizedToken(secret,headers?.['x-iradios-geo-auth']))return null;
 const country=getCountry(headers['x-iradios-geo-country']);
 if(!country)return null;
 const region=getRegion(country,headers['x-iradios-geo-region']);
 if(!region)return {country};
 const prefectures=CATALOG[country][region];
 const explicit=bounded(headers['x-iradios-geo-prefecture']);
 const matched=Object.keys(prefectures).find(p=>eq(p,explicit));
 if(matched)return {country,region,prefecture:matched};
 // The sole catalog prefecture is determined by a verified region alone.
 const unique=Object.keys(prefectures);
 if(unique.length===1)return {country,region,prefecture:unique[0]};
 const inferred=cityPrefecture(country,region,headers['x-iradios-geo-city'],
    headers['x-iradios-geo-accuracy-km']);
 return inferred?{country,region,prefecture:inferred}:{country,region};
}
function trustedAdGeo(req,res,next){
 // Nginx MUST overwrite all x-iradios-geo-* headers and authenticate the
 // GeoIP2 result with its root-only secret. Never trust CF-* or browser hints.
 const trusted=resolveGeo(req.headers,process.env.IRADIOS_TRUSTED_GEO_SECRET);
 req.adGeoTrusted=Boolean(trusted);
 // Nonbillable fixture geo remains confined to explicit QA preview.
 const {paidPlacementPreviewEnabled}=require('../services/advertisingStagePaidPreview');
 const {enabled:paidV2Enabled}=require('../services/advertisingV2Ledger');
 req.geo=trusted||(!paidV2Enabled()&&paidPlacementPreviewEnabled()?{
  country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'
 }:null);
 next();
}
module.exports={authorizedToken,resolveGeo,trustedAdGeo};
