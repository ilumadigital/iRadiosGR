'use strict';
// req.geo must originate from a trusted server-side resolver, never from a
// client-submitted header or browser-supplied city. If no trusted location is
// available, only national campaigns are eligible.
const clean=value=>String(value||'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR').trim();
function matchesAgencyGeo(campaign,geo) {
  const targets=campaign.targetLocations||['All'];
  const target=targets[0]||'All';
  const country=campaign.targetCountry||'All';
  const region=campaign.targetRegion||'All';
  if(country==='All'&&region==='All'&&target==='All')return true;
  if(region==='All'&&(clean(target)===clean(country))) {
    // No inferred Greek nationality from app language or missing proxy geo.
    // Country-only trusted geo may match national campaigns; unknown cannot.
    return Boolean(geo?.country)&&clean(geo.country)===clean(country);
  }
  if(!geo?.country||!geo?.region)return false;
  if(clean(country)!==clean(geo.country)||clean(region)!==clean(geo.region))
    return false;
  if(clean(target)===clean(region))return true;
  return Boolean(geo.prefecture)&&clean(target)===clean(geo.prefecture);
}
module.exports={matchesAgencyGeo};
