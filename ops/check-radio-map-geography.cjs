'use strict';
// Regression QA for the bug where MapLibre markers accumulated normal-flow offsets
// and ended up rendered in the Mediterranean instead of their actual locations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');

const {normalizeStationCity} = require('../backend/utils/stationLocations');
const geoSource = read('frontend/src/utils/mapLocations.js')
  .replace(/^import .*;\s*$/gm,'')
  .replace(/^export (const|function) /gm, '$1 ');
const geo = vm.runInNewContext(geoSource + '\n({CITY_COORDINATES, stationMapLocation, stationMapPosition, locationMapCenter})', {
  canonicalStationLocation: station => normalizeStationCity(station).data
});

const seats = {
  'Κεντρική Μακεδονία': 'Θεσσαλονίκη',
  'Ανατολική Μακεδονία & Θράκη': 'Κομοτηνή',
  'Δυτική Μακεδονία': 'Κοζάνη',
  'Ήπειρος': 'Ιωάννινα',
  'Θεσσαλία': 'Λάρισα',
  'Ιόνια Νησιά': 'Κέρκυρα',
  'Δυτική Ελλάδα': 'Πάτρα',
  'Στερεά Ελλάδα': 'Λαμία',
  'Πελοπόννησος': 'Τρίπολη',
  'Βόρειο Αιγαίο': 'Μυτιλήνη',
  'Νότιο Αιγαίο': 'Σύρος',
  'Κρήτη': 'Ηράκλειο'
};
for (const [region, city] of Object.entries(seats)) {
  const capital = geo.CITY_COORDINATES[city];
  const center = geo.locationMapCenter(region);
  assert.ok(capital && center, 'missing map coordinate for ' + region);
  assert.equal(JSON.stringify(center), JSON.stringify(capital), region + ' must use a real city on land, not offshore midpoint');
}
assert.equal(JSON.stringify(geo.locationMapCenter('Αθήνα')), JSON.stringify([37.9838,23.7275]));
assert.equal(JSON.stringify(geo.locationMapCenter('Κύπρος')), JSON.stringify([35.1666,33.3666]));
const city = geo.stationMapLocation({city:'Χανιά',region:'Κρήτη'});
assert.equal(city.precision, 'city');
assert.equal(city.label, 'Χανιά');
assert.equal(JSON.stringify(city.position), JSON.stringify([35.5138,24.018]));
assert.equal(geo.stationMapLocation({city:'Αθηνα',region:'Αττική'}).label, 'Αθήνα', 'accent normalization');
assert.equal(geo.stationMapLocation({city:'Athens',region:'Αττική'}).label, 'Αθήνα', 'English alias');
const municipality = geo.stationMapLocation({city:'Νέα Σμύρνη',region:'Αττική'});
assert.equal(municipality.label, 'Νέα Σμύρνη', 'selected municipality must retain its own name');
assert.equal(JSON.stringify(municipality.position), JSON.stringify([37.9450,23.7136]),
  'the selected municipality must map to its own coordinates rather than central Athens');
const region = geo.stationMapLocation({city:'Άλλη',region:'Ιόνια Νησιά'});
assert.equal(region.precision, 'region');
assert.equal(region.label, 'Ιόνια Νησιά');
assert.equal(JSON.stringify(region.position), JSON.stringify([39.62,19.9197]), 'Corfu, not Ionian Sea');
assert.equal(geo.stationMapLocation({city:'Web Radio',region:'Unknown'}), null, 'no fake radio positions');
assert.equal(geo.stationMapPosition({city:'???',region:'Εξωτερικό'}), null, 'no fabricated international coordinates');

const css = read('frontend/src/components/RadioGeoMap.css');
const markerRootRule = css.match(/\.ir-radio-map-marker\s*\{([^}]+)\}/);
assert.ok(markerRootRule, 'custom marker CSS exists');
assert.match(markerRootRule[1], /position:\s*absolute\s*;/, 'the MapLibre marker root must be positioned absolutely');
assert.doesNotMatch(markerRootRule[1], /transition\s*:\s*[^;]*\btransform\b/, 'transform must not be animated on marker root');
const markerHoverRule = css.match(/\.ir-radio-map-marker:hover,[^{]*\{([^}]+)\}/);
assert.ok(markerHoverRule, 'marker hover CSS exists');
assert.doesNotMatch(markerHoverRule[1], /\btransform\s*:/, 'marker root hover must not override the geographic transform');
assert.match(css, /\.ir-radio-geo-map\s+\.maplibregl-marker\s*\{[^}]*position:\s*absolute\s*!important/, 'position lock');
assert.match(css, /\.ir-radio-geo-map\s+\.maplibregl-marker\s*\{[^}]*transition-property:\s*box-shadow,\s*background-color\s*!important/, 'transform transition disabled');
const map = read('frontend/src/components/RadioGeoMap.jsx');
assert.ok(map.includes('new maplibre.Marker({ element, anchor:'), 'MapLibre places custom button root');
assert.ok(map.includes('stationMapLocation(station)'), 'labels and geographic accuracy come from shared resolver');
assert.ok(map.includes("group.approximate ||= location.precision === 'region'"), 'regional estimates clearly marked');
assert.ok(!map.includes('getStaticFallbackPosition'), 'no random Athens fallback');

console.log('Radio map geography QA passed: marker position contract, accurate regional seats, station location resolution.');
