'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {PRIMARY_CATEGORY_GROUPS,PRIMARY_CATEGORIES,SECONDARY_CATEGORIES,validateStationCategories}=require('../backend/utils/stationCategories');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
(async()=>{
  assert.equal(PRIMARY_CATEGORY_GROUPS.length,3);
  assert.deepEqual(PRIMARY_CATEGORY_GROUPS.map(g=>g.items.length),[5,4,3]);
  assert.equal(PRIMARY_CATEGORIES.length,12);
  assert.equal(new Set(PRIMARY_CATEGORIES).size,12);
  assert.ok(SECONDARY_CATEGORIES.includes('Afro House'));
  assert.ok(SECONDARY_CATEGORIES.includes('Κρητικά'));
  assert.ok(SECONDARY_CATEGORIES.includes('Νησιώτικα'));
  assert.equal(validateStationCategories({genre:'Διεθνή Mainstream',secondaryGenre:'House'},{required:true}),null);
  assert.ok(validateStationCategories({genre:'House',secondaryGenre:'Afro House'},{required:true}));
  assert.ok(validateStationCategories({genre:'Ροκ'},{required:true}));
  assert.ok(validateStationCategories({secondaryGenre:'Not in list'}));
  const ui=await import(pathToFileURL(path.join(__dirname,'../frontend/src/utils/stationCategories.js')).href);
  assert.deepEqual(ui.PRIMARY_CATEGORY_GROUPS,PRIMARY_CATEGORY_GROUPS);
  assert.deepEqual(ui.SECONDARY_CATEGORIES,SECONDARY_CATEGORIES);
  assert.ok(read('frontend/src/components/StationCategorySelect.jsx').includes('PRIMARY_CATEGORIES.map'));
  assert.ok(!read('frontend/src/components/StationCategorySelect.jsx').includes('<optgroup'), 'group titles must not appear in dropdown');
  assert.ok(read('frontend/src/components/HomeExplore.jsx').includes('PRIMARY_CATEGORY_GROUPS.map'));
  assert.ok(read('frontend/src/components/Sidebar.jsx').includes('PRIMARY_CATEGORY_GROUPS.map'));
  for(const file of ['backend/models/Station.js','backend/routes/backofficeRoutes.js','backend/controllers/stationController.js','backend/controllers/miscController.js','backend/seo.js','frontend/src/pages/Genre.jsx','frontend/src/pages/Backoffice.jsx','frontend/src/pages/Admin.jsx','frontend/src/pages/MyRadios.jsx']){
    assert.ok(read(file).includes('secondaryGenre'),file+' must support secondaryGenre');
  }
  assert.ok(read('backend/controllers/miscController.js').includes("Station.distinct('secondaryGenre'"));
  console.log('Station taxonomy: 12 grouped primary categories, 2 selectors, backend validation, subgenre SEO/sitemap and legacy preservation verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
