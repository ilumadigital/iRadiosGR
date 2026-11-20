import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPhoneClient, carAudioKind, isConfirmedNativeCarConnection,
  isExplicitCarAudioLabel, isSelectedCarAudioOutput, detectCarAudioConnection
} from './carAudioDetection.js';

const iphone = {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'};
const android = {userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'};
const desktop = {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0'};
const mac = {userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'};

test('only real phone-like user agents are eligible for automatic prompt', () => {
  assert.equal(isPhoneClient(iphone), true);
  assert.equal(isPhoneClient(android), true);
  assert.equal(isPhoneClient(desktop), false);
  assert.equal(isPhoneClient(mac), false);
  assert.equal(isPhoneClient({userAgent:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'}), false);
  assert.equal(isPhoneClient({userAgent:'Mozilla/5.0 (Linux; Android 12; Android TV)'}), false);
  assert.equal(isPhoneClient({...android,userAgentData:{mobile:false}}), false);
});
test('native CarPlay/Android Auto/car Bluetooth must be explicitly connected', () => {
  assert.equal(carAudioKind('Android Auto'), 'android_auto');
  for (const kind of ['carplay','apple_carplay','android_auto','car_bluetooth','bluetooth_car'])
    assert.equal(isConfirmedNativeCarConnection({connected:true,kind}), true);
  assert.equal(isConfirmedNativeCarConnection({connected:false,kind:'carplay'}), false);
  assert.equal(isConfirmedNativeCarConnection({connected:true,kind:'bluetooth'}), false);
  assert.equal(isConfirmedNativeCarConnection({connected:true,kind:'headphones'}), false);
  assert.equal(isConfirmedNativeCarConnection({kind:'carplay'}), false);
});
test('generic sound brands and Bluetooth are not proof of car audio', () => {
  for(const label of ['Sony Bluetooth Headphones','JBL Speaker','Bose QC35','Apple AirPods',
    'BT Speaker','Pioneer Headphones','Bluetooth Audio','Hands Free','Audio Output'])
    assert.equal(isExplicitCarAudioLabel(label),false,label);
  for(const label of ['Car Audio','Car Bluetooth','Ford SYNC','Uconnect','Android Auto','Apple CarPlay'])
    assert.equal(isExplicitCarAudioLabel(label),true,label);
});
test('unselected/discoverable car devices never trigger the modal', async () => {
  const devices=[{kind:'audiooutput',deviceId:'car',label:'Car Bluetooth'},
    {kind:'audiooutput',deviceId:'buds',label:'JBL Speaker'}];
  let enumerated=0;
  const mediaDevices={enumerateDevices:async()=>{enumerated++;return devices;}};
  assert.equal(await isSelectedCarAudioOutput({sinkId:''},mediaDevices),false);
  assert.equal(await isSelectedCarAudioOutput({sinkId:'default'},mediaDevices),false);
  assert.equal(await isSelectedCarAudioOutput({sinkId:'buds'},mediaDevices),false);
  assert.equal(enumerated,1);
  assert.equal(await isSelectedCarAudioOutput({sinkId:'car'},mediaDevices),true);
  assert.equal(await isSelectedCarAudioOutput({sinkId:'car'},{
    enumerateDevices:async()=>[{kind:'audioinput',deviceId:'car',label:'Car Bluetooth'}]
  }),false);
});
test('desktop always blocks bridge and output detection even if claimed connected',async()=>{
  let called=0;
  const win={iRadiosCarAudioBridge:{getConnectionState:()=>{called++;return {connected:true,kind:'carplay'};}}};
  const result=await detectCarAudioConnection({nav:desktop,win,audioElement:{sinkId:'car'}});
  assert.equal(result,'disconnected');
  assert.equal(called,0);
});
test('mobile native bridge can confirm active CarPlay and disconnection',async()=>{
  const makeWin=state=>({iRadiosCarAudioBridge:{getConnectionState:async()=>state}});
  assert.equal(await detectCarAudioConnection({nav:iphone,win:makeWin({connected:true,kind:'carplay'})}),'connected');
  assert.equal(await detectCarAudioConnection({nav:android,win:makeWin({connected:true,kind:'android_auto'})}),'connected');
  assert.equal(await detectCarAudioConnection({nav:android,win:makeWin({connected:false,kind:'car_bluetooth'})}),'disconnected');
  assert.equal(await detectCarAudioConnection({nav:iphone,win:makeWin({connected:true,kind:'bluetooth'})}),'unknown');
});
test('unavailable native and browser APIs must fail closed without requesting permission',async()=>{
  assert.equal(await detectCarAudioConnection({nav:iphone,win:{}}),'unknown');
  assert.equal(await detectCarAudioConnection({nav:android,win:{
    iRadiosCarAudioBridge:{getConnectionState:()=>{throw Error('Unavailable');}}
  }}),'unknown');
  assert.equal(await detectCarAudioConnection({nav:{userAgent:'Mobile'},win:{}}),'disconnected');
});
test('mobile explicit selected sink is sufficient only with a car-specific label',async()=>{
  const nav={...android,mediaDevices:{enumerateDevices:async()=>[
    {kind:'audiooutput',deviceId:'car',label:'Car Audio'},
    {kind:'audiooutput',deviceId:'headset',label:'Sony Bluetooth Headphones'}
  ]}};
  assert.equal(await detectCarAudioConnection({nav,win:{},audioElement:{sinkId:'car'}}),'connected');
  assert.equal(await detectCarAudioConnection({nav,win:{},audioElement:{sinkId:'headset'}}),'unknown');
});
