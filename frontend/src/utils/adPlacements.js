import {geoAllowsCanonicalArea} from './adGeoTargeting.js';
// Public Ad Network placement rules. Every slot has ONE explicit purpose.
export const BANNER_PLACEMENTS = Object.freeze({
  hero:'Hero · αρχική',home:'Home Feed · αρχική',
  radio_feed:'Radio Grid · είδη/περιοχές',
  news_feed:'News Feed · ειδήσεις',
  station_profile:'Station Profile · σταθμός'
});
export function geoAllowsAd(targetLocations, location, _legacyMatch) {
  return geoAllowsCanonicalArea(targetLocations,location);
}
export function bannerMatchesPlacement(banner, placement, location, checkGeoMatch) {
  return banner?.status==='active'&&
    (!banner.expiresAt||Date.parse(banner.expiresAt)>Date.now())&&
    Array.isArray(banner.placement)&&banner.placement.includes(placement)&&
    geoAllowsAd(banner.targetLocations,location,checkGeoMatch);
}
