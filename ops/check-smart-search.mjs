import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSearchIndex, directVoiceMatch, groupedSearch,
  normalizeSearch, rankSearch, spokenQuery
} from '../frontend/src/utils/smartSearch.js';

const stations = [
  {_id:'one',name:'Deseo Radio',slug:'deseo-radio',genre:'Dance',region:'Αττική',city:'Αθήνα',status:'approved',logo:'/deseo.png'},
  {_id:'two',name:'Athens Rock',slug:'athens-rock',genre:'Ροκ',region:'Αττική',city:'Αθήνα',status:'approved'},
  {_id:'three',name:'Sport FM',genre:'Αθλητικά',region:'Κεντρική Μακεδονία',city:'Θεσσαλονίκη',status:'approved',isOffline:true},
  {_id:'hidden',name:'Hidden Station',genre:'Jazz',status:'pending'}
];
const articles = [
  {key:'aaaaaaaaaaaaaaaaaaaaaaaa',title:'Νέα για την οικονομία σήμερα',source:'Capital',category:'Business',summary:'Δείκτες και αποτελέσματα',publishedAt:'2026-11-08T20:00:00Z'},
  {key:'bbbbbbbbbbbbbbbbbbbbbbbb',title:'Αθλητικά νέα της ημέρας',source:'Sport News',category:'Αθλητικά',publishedAt:'2026-11-08T19:00:00Z'}
];
const index = createSearchIndex(stations, articles);
const first = (query, scope) => rankSearch(index, query, scope)[0];
assert.equal(normalizeSearch('Ειδήσεις'), 'ειδησεισ');
assert.equal(first('Deseo', 'station').path, '/station/deseo-radio');
assert.equal(first('Athina', 'region').label, 'Αθήνα');
assert.equal(first('ροκ', 'genre').path, '/genre/' + encodeURIComponent('Ροκ'));
assert.equal(first('οικονομία', 'news').path, '/newsfeed/aaaaaaaaaaaaaaaaaaaaaaaa');
assert.equal(first('hidden station', 'station'), undefined, 'unapproved stations must not leak');
assert.ok(!rankSearch(index,'οικονομία','station').some(row=>row.type==='news'), 'scoped results stay scoped');
assert.equal(spokenQuery('Άνοιξε την Αθήνα'), 'αθηνα');
assert.equal(spokenQuery('Θέλω να ακούσω ροκ'), 'ροκ');
assert.equal(directVoiceMatch(index,'Άνοιξε την Αθήνα')?.path, '/region/' + encodeURIComponent('Αθήνα'));
assert.equal(directVoiceMatch(index,'Βάλε ροκ')?.path, '/genre/' + encodeURIComponent('Ροκ'));
assert.equal(directVoiceMatch(index,'Άνοιξε τις ειδήσεις')?.path, '/newsfeed');
assert.equal(directVoiceMatch(index,'Βρες μου Deseo Radio')?.path, '/station/deseo-radio');
assert.equal(directVoiceMatch(index,'Αθλητικά νέα')?.path, '/newsfeed/bbbbbbbbbbbbbbbbbbbbbbbb', 'unique article title prefixes may route directly');
const groups = groupedSearch(index,'αθλητικά');
assert.ok(groups.groups.every(group=>group.items.every(item=>item.type===group.id)));
assert.ok(groups.visible.length <= 12, 'limit results per category in All view');

const header = readFileSync(new URL('../frontend/src/components/TopBar.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../frontend/src/components/smart-header.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../frontend/src/App.jsx', import.meta.url), 'utf8');
assert.match(header,/window\.webkitSpeechRecognition/);
assert.match(header,/recognition\.lang = 'el-GR'/);
assert.match(header,/onKeyDown=\{handleKeyDown\}/);
assert.match(header,/fetch\('\/api\/newsfeed'/);
assert.match(header,/directVoiceMatch\(indexRef\.current, heard\)/);
assert.match(css,/@media \(max-width: 430px\)/);
assert.match(css,/prefers-reduced-motion: reduce/);
assert.match(app,/<TopBar[^>]*stations=\{stations\}/);
console.log('Smart header/search: routing, grouping, speech confidence and responsive contracts passed.');
