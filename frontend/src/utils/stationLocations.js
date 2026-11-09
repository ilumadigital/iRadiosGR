import LOCATION_DATA from './stationLocationData.json';

export { LOCATION_DATA };

const clean = value => String(value || '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el-GR');

export function inferStationPrefecture(country, region, city) {
  const prefectures = LOCATION_DATA[country || 'Ελλάδα']?.[region];
  if (!prefectures) return '';
  const entries = Object.entries(prefectures);
  const key = clean(city);
  const exact = entries.find(([prefecture, cities]) => clean(prefecture) === key ||
    cities.some(item => clean(item) === key));
  return exact?.[0] || (entries.length === 1 ? entries[0][0] : '');
}

export function stationCapital(country, region, prefecture) {
  const actualCountry = country || 'Ελλάδα';
  const cities = LOCATION_DATA[actualCountry]?.[region]?.[prefecture];
  if (!cities?.length) return '';
  // Keep the canonical seat even for existing Cyclades records saved as Syros.
  if (actualCountry === 'Ελλάδα' && prefecture === 'Κυκλάδες') return 'Ερμούπολη';
  return cities[0];
}

export function stationCityOptions(country, region, prefecture) {
  if (country === 'Εξωτερικό') return LOCATION_DATA[country]?.[region]?.[prefecture] || [];
  const capital = stationCapital(country, region, prefecture);
  return capital ? [capital] : [];
}

export function canonicalStationLocation(station) {
  if (!station || !station.region) return station;
  const country = station.country || 'Ελλάδα';
  if (country === 'Εξωτερικό') return station;
  const prefecture = station.prefecture ||
    inferStationPrefecture(country, station.region, station.city);
  const city = stationCapital(country, station.region, prefecture);
  return city ? { ...station, country, prefecture, city } : station;
}
