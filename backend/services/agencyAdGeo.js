'use strict';
const locations = require('../utils/stationLocationData.json');
const norm = value => String(value || '').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR').trim();
function validateAgencyGeo(patch,current={}) {
  const country=patch.targetCountry ?? current.targetCountry ?? 'All';
  const region=patch.targetRegion ?? current.targetRegion ?? 'All';
  const targets=patch.targetLocations ?? current.targetLocations ?? ['All'];
  if(!Array.isArray(targets)||targets.length!==1||typeof targets[0]!=='string')
    throw Error('Επίλεξε χώρα, περιφέρεια ή νομό.');
  const value=targets[0];
  if(country==='All') {
    if(region!=='All'||value!=='All')throw Error('Μη έγκυρη πανελλαδική στόχευση.');
    return {targetCountry:'All',targetRegion:'All',targetLocations:['All']};
  }
  const regions=locations[country];
  if(!regions)throw Error('Μη έγκυρη χώρα.');
  if(region==='All') {
    if(norm(value)!==norm(country))throw Error('Η στόχευση χώρας δεν συμφωνεί.');
    return {targetCountry:country,targetRegion:'All',targetLocations:[country]};
  }
  const prefectures=regions[region];
  if(!prefectures)throw Error('Μη έγκυρη περιφέρεια.');
  if(norm(value)===norm(region))return {targetCountry:country,targetRegion:region,targetLocations:[region]};
  const prefecture=Object.keys(prefectures).find(name=>norm(name)===norm(value));
  if(!prefecture)throw Error('Η στόχευση επιτρέπεται έως νομό, όχι πόλη.');
  return {targetCountry:country,targetRegion:region,targetLocations:[prefecture]};
}
module.exports={validateAgencyGeo};
