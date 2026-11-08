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

module.exports = {normalizeStationCity, inferPrefecture};
