'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('automatic Car Mode is strictly connection-driven without GPS or landscape',()=>{
  const prompt=read('frontend/src/components/CarModePrompt.jsx');
  const detector=read('frontend/src/utils/carAudioDetection.js');
  assert.match(prompt,/detectCarAudioConnection/);
  assert.match(prompt,/result === 'connected'/);
  assert.match(prompt,/isPhoneClient\(navigator\)/);
  assert.doesNotMatch(prompt,/geolocation|watchPosition|getCurrentPosition|innerWidth|innerHeight|setTimeout|setInterval|enumerateDevices/);
  assert.doesNotMatch(detector,/navigator\.geolocation|watchPosition|orientationchange|innerWidth|innerHeight/);
  assert.match(detector,/sinkId/);
  assert.match(detector,/kind === 'audiooutput'/);
});
test('modal uses exact driving safety copy and preserves manual Car Mode',()=>{
  const prompt=read('frontend/src/components/CarModePrompt.jsx');
  const app=read('frontend/src/App.jsx');
  assert.match(prompt,/Οδήγηση και κινητό, δεν πάνε μαζί!/);
  assert.match(prompt,/Βάλε τη λειτουργία οδήγησης και έχε τα μάτια σου στο δρόμο! Καλή Διαδρομή!/);
  assert.match(prompt,/Ενεργοποίηση Car Mode/);
  assert.match(prompt,/aria-modal="true"/);
  assert.match(app,/onOpenCarMode=\{\(\) => setIsCarModeActive\(true\)\}/);
  assert.match(app,/audioRef=\{audioRef\}/);
  assert.match(app,/onAccept=\{\(\) => setIsCarModeActive\(true\)\}/);
});
