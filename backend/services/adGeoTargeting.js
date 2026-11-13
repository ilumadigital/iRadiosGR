'use strict';
const catalog=require('../data/adRegions.json');
function validAgencyGeo(patch){
 const country=patch.targetCountry||'Ελλάδα';
 const region=patch.targetRegion||'All';
 const areas=patch.targetLocations||[region==='All'?'Ελλάδα':region];
 if(country!=='Ελλάδα'||!Array.isArray(areas)||areas.length<1||areas.length>20||
   areas.some(x=>typeof x!=='string'||x.length>80)||new Set(areas).size!==areas.length)return false;
 const regions=catalog['Ελλάδα']||{};
 const valid=new Set(['Ελλάδα',...Object.keys(regions),
  ...Object.values(regions).flatMap(prefs=>Object.keys(prefs))]);
 if(areas.some(area=>!valid.has(area)))return false;
 if(areas.includes('Ελλάδα'))return region==='All'&&areas.length===1;
 if(region==='All')return true;
 const counties=regions[region];
 return Boolean(counties&&areas.every(area=>area===region||Object.hasOwn(counties,area)));
}
module.exports={validAgencyGeo};
