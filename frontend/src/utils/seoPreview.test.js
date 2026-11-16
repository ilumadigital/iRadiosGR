import test from 'node:test';
import assert from 'node:assert/strict';
import {stationSeoPreview} from './seoPreview.js';

test('client navigation preserves genuine public programme context',()=>{
  const previous=globalThis.window;
  globalThis.window={location:{origin:'https://stage.iradios.gr'}};
  try {
    const station={
      name:'Παράδειγμα FM',slug:'example-fm',genre:'Rock',city:'Αθήνα',
      description:'Επιλεγμένη μουσική όλη μέρα',
      schedule:[{day:1,startTime:'09:00',endTime:'10:00',title:'Morning Rock',host:'Παρουσιαστής'}],
      privatePlaylist:[{title:'PRIVATE SONG'}]
    };
    const seo=stationSeoPreview(station);
    assert.match(seo.description,/Επιλεγμένη μουσική/);
    assert.match(seo.description,/Morning Rock/);
    assert.match(seo.description,/Rock/);
    assert.match(seo.description,/Αθήνα/);
    assert.equal(seo.url,'https://stage.iradios.gr/station/example-fm');
    assert.ok(seo.description.length<=158);
    assert.doesNotMatch(JSON.stringify(seo),/PRIVATE SONG/);
  } finally {
    globalThis.window=previous;
  }
});
