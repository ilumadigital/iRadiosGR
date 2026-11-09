'use strict';
const LOCATION_DATA = require('./stationLocationData.json');

const clean = value => String(value || '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el-GR');

function inferPrefecture(country, region, city) {
  const group = LOCATION_DATA[country]?.[region];
  if (!group) return '';
  const entries = Object.entries(group);
  const key = clean(city);
  const found = entries.find(([name, cities]) => clean(name) === key ||
    cities.some(value => clean(value) === key));
  return found?.[0] || (entries.length === 1 ? entries[0][0] : '');
}

function normalizeStationCity(input) {
  const data = { ...input };
  if (!data.region || !data.city) return {data};
  const country = data.country || 'Ελλάδα';
  if (country === 'Εξωτερικό') return {data};
  const group = LOCATION_DATA[country]?.[data.region];
  if (!group) return {data, error: 'Μη έγκυρη περιφέρεια.'};
  const prefecture = data.prefecture || inferPrefecture(country, data.region, data.city);
  if (!prefecture || !group[prefecture]) {
    return {data, error: 'Επέλεξε έγκυρο νομό και την πρωτεύουσά του.'};
  }
  data.country = country;
  data.prefecture = prefecture;
  data.city = country === 'Ελλάδα' && prefecture === 'Κυκλάδες'
    ? 'Ερμούπολη' : group[prefecture][0];
  return {data};
}

// Strict shared contract for station creation/editing in the modern backoffice.
// Existing stations can omit prefecture; non-location edits must not rewrite them.
function validateStationLocation(input, {current = {}, required = false} = {}) {
  const keys = ['country', 'region', 'prefecture', 'city'];
  if (!required && !keys.some(key => Object.hasOwn(input, key))) return {data:input};
  const location = Object.fromEntries(keys.map(key => [key,
    Object.hasOwn(input, key) ? input[key] : (current[key] || (key === 'country' ? 'Ελλάδα' : ''))]));
  if (keys.some(key => !location[key])) {
    return {data:input, error:'Επέλεξε χώρα, περιφέρεια, νομό και πόλη.'};
  }
  const cities = LOCATION_DATA[location.country]?.[location.region]?.[location.prefecture];
  if (!cities?.length) {
    return {data:input, error:'Επέλεξε έγκυρη χώρα, περιφέρεια και νομό.'};
  }
  const permitted = location.country === 'Εξωτερικό' ? cities :
    [location.country === 'Ελλάδα' && location.prefecture === 'Κυκλάδες' ? 'Ερμούπολη' : cities[0]];
  if (!permitted.includes(location.city)) {
    return {data:input, error:'Η πόλη πρέπει να είναι η πρωτεύουσα του επιλεγμένου νομού.'};
  }
  return {data:{...input, ...location}};
}

module.exports = {normalizeStationCity, inferPrefecture, validateStationLocation};
