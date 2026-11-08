'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const {normalize,followKey}=require('../backend/utils/programFollows');
const station1='507f1f77bcf86cd799439011',station2='507f191e810c19729de860ea';
assert.equal(normalize('Έντεχνος  DJ'),normalize('εντεχνοσ DJ'));
assert.equal(followKey('dj',station1,'DJ Στέλιος'),followKey('dj',station2,'dj στελιοσ'),
  'DJs must be followed across station changes');
assert.notEqual(followKey('show',station1,'Music Zone'),followKey('show',station2,'Music Zone'),
  'Shows are station-scoped');
assert.equal(followKey('unknown',station1,'Music Zone'),null);
assert.equal(followKey('show',station1,''),null);
assert.ok(followKey('show',station1,'Music Zone').startsWith('show:'+station1+':'));

const stage=read('backend/utils/stagePublicAccess.js');
for(const p of [
  '/api/users/me/notification-preferences','/api/users/me/follows',
  '/api/users/me/inbox','/api/users/me/inbox/count'
])assert.ok(stage.includes("'"+p+"'"),'staging must whitelist authenticated '+p);
assert.match(stage,/if \(listenerSelfRead \|\| listenerSelfWrite\) return protect\(req,res,next\)/,
  'staging self-service must require JWT');
assert.match(stage,/req\.method === 'PUT' && path === '\/api\/users\/me'/);
assert.doesNotMatch(stage,/listenerSelfRead[\s\S]*?\/api\/users\/me\/delete/,
  'must not accidentally allow destructive staging account deletion');

const profile=read('frontend/src/pages/Profile.jsx');
const app=read('frontend/src/App.jsx');
assert.match(profile,/const \[user,setUser\]=useState\(currentUser\|\|null\)/,
  'use authenticated session for initial profile hydration');
assert.match(profile,/const response=await fetch\(API_URL\+'\/auth\/me'/);
assert.match(profile,/setUser\(loaded\);[\s\S]*?setFields\(toFields\(loaded\)\);[\s\S]*?const prefsResponse=await fetch/,
  'account data must be committed before preference fetch');
assert.doesNotMatch(profile,/Promise\.all\(\[\s*fetch\(API_URL\+'\/auth\/me'/,
  'preferences failure must never blank the account form');
assert.match(profile,/user\?\.isPremium===true/);
assert.match(app,/<Profile API_URL=\{API_URL\} currentUser=\{currentUser\}/);
assert.match(app,/<Route path="\/settings" element=\{<Navigate to="\/profile\?tab=details" replace \/>\}/);
for(const component of ['ProfileFollows','ProfileInbox','ProfileSecurity'])
  assert.ok(profile.includes('<'+component),'missing integrated '+component);
assert.match(profile,/id:'follows'/);
assert.match(profile,/id:'inbox'/);
const station=read('frontend/src/components/StationScheduleTimeline.jsx');
assert.match(station,/toggleFollow\('?/);
assert.match(station,/Aκολούθησε|Ακολούθησε/);
assert.match(station,/\/api\/users\/me\/follows/);
const stationPage=read('frontend/src/pages/StationProfile.jsx');
assert.match(stationPage,/currentShow=\{currentShow\} today=\{athensClock\} currentUser=\{currentUser\}/);

const routes=read('backend/routes/authRoutes.js');
for(const r of ["'/users/me/follows'","'/users/me/inbox'","'/users/me/inbox/count'","'/users/me/inbox/read-all'"])
  assert.ok(routes.includes(r),'missing listener route '+r);
assert.match(routes,/router\.delete\('\/users\/me', protect/);
const center=read('backend/controllers/listenerCenterController.js');
assert.match(center,/req\.user\._id/);
assert.match(center,/status:'approved'/);
assert.match(center,/followedPrograms\.key/);
assert.match(center,/readAt:null/);
assert.match(center,/recipient:req\.user\._id/);
assert.match(center,/countDocuments/);
const model=read('backend/models/ListenerInbox.js');
assert.match(model,/\{recipient:1,eventKey:1\},\{unique:true\}/);
assert.match(model,/expires:90\*24\*60\*60/);
const delivery=read('backend/utils/notificationDelivery.js');
const inboxAt=delivery.indexOf('await Inbox.bulkWrite');
const stageExit=delivery.indexOf('if(isStaging())return');
assert.ok(inboxAt>0&&stageExit>inboxAt,
  'staging must persist internal inbox while disabling outbound push/email');
assert.match(delivery,/notificationPreferencesOf\(user\)\.topics\[topic\]/);
const sched=read('backend/utils/listenerNotificationScheduler.js');
assert.match(sched,/followKey\('dj'/);
assert.match(sched,/followKey\('show'/);
assert.match(sched,/followedPrograms\.key/);
const header=read('frontend/src/components/TopBar.jsx');
assert.match(header,/\/api\/users\/me\/inbox\/count/);
assert.match(header,/to="\/profile\?tab=inbox"/);
assert.match(read('frontend/src/components/ProfileInbox.jsx'),/ir-inbox-changed/);
assert.match(read('frontend/src/components/ProfileFollows.jsx'),/method:'DELETE'/);
assert.match(read('frontend/src/components/ProfileSecurity.jsx'),/ΔΙΑΓΡΑΦΗ/);
console.log('Profile hydration, Settings redirect, follows and notification center contracts passed.');
