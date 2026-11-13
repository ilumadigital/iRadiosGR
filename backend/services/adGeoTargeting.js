'use strict';
const catalog=require('../data/adRegions.json');
function validAgencyGeo(patch){
 const country=patch.targetCountry||'Ελλάδα';
 const region=patch.targetRegion||'All';
 const areas=patch.targetLocations||[region==='All'?'Ελλάδα':region];
 if(country!=='Ελλάδα'||!Array.isArray(areas)||areas.length!==1)return false;
 if(region==='All')return areas[0]==='Ελλάδα';
 const prefectures=catalog['Ελλάδα']?.[region];
 return Boolean(prefectures&&(areas[0]===region||Object.hasOwn(prefectures,areas[0])));
}
module.exports={validAgencyGeo};
