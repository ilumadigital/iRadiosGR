'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const {notificationPreferencesOf,canNotify,validateChange,TOPICS}
  =require('../backend/utils/notificationPreferences');
const {tokenFor,verifyToken}=require('../backend/utils/notificationUnsubscribe');

const legacy={email:'listener@example.org',pushNotifications:true};
const prefs=notificationPreferencesOf(legacy);
assert.equal(prefs.push,true);
assert.equal(prefs.email,true);
for(const key of TOPICS.filter(s=>s!=='promotions'))assert.equal(prefs.topics[key],true);
assert.equal(prefs.topics.promotions,false,'marketing is opt-in only');
assert.equal(canNotify(legacy,'push','shows'),true);
assert.equal(canNotify({...legacy,pushNotifications:false},'push','shows'),false);
assert.equal(canNotify(legacy,'email','promotions'),false);
const opted={notificationPreferences:{
  push:true,email:true,topics:{promotions:true,news:false},marketingConsentAt:new Date()
}};
assert.equal(canNotify(opted,'email','promotions'),true);
assert.equal(canNotify(opted,'email','news'),false);
assert.equal(canNotify({...opted,notificationPreferences:{...opted.notificationPreferences,
  marketingConsentAt:null}},'email','promotions'),false);
assert.deepEqual(validateChange({channel:'push',enabled:false}),
  {path:'notificationPreferences.push',enabled:false,channel:'push'});
assert.deepEqual(validateChange({topic:'favoriteSchedule',enabled:false}),
  {path:'notificationPreferences.topics.favoriteSchedule',enabled:false,topic:'favoriteSchedule'});
assert.deepEqual(validateChange({newsCategories:['Business','Αθλητικά']}),
  {path:'notificationPreferences.newsCategories',newsCategories:['Business','Αθλητικά']});
for(const invalid of [
  {topic:'$set',enabled:true},{channel:'admin',enabled:true},
  {channel:'push',enabled:'yes'},{topic:'news',enabled:true,isPremium:true},
  {newsCategories:['$where']},{newsCategories:new Array(13).fill('Business')}
])assert.equal(validateChange(invalid),null,'invalid notification switch payload');

const previousSecret=process.env.JWT_SECRET;
process.env.JWT_SECRET='unit-test-secret-not-for-production';
const user={_id:'507f1f77bcf86cd799439011',email:'alice@example.org'};
const token=tokenFor(user);
assert.equal(verifyToken(token,user.email),String(user._id));
assert.equal(verifyToken(token,'other@example.org'),null);
assert.equal(verifyToken(token.slice(0,-2)+'aa',user.email),null);
if(previousSecret===undefined)delete process.env.JWT_SECRET;
else process.env.JWT_SECRET=previousSecret;

const authRoutes=read('backend/routes/authRoutes.js');
assert.match(authRoutes,/router\.get\('\/users\/me\/notification-preferences', protect/);
assert.match(authRoutes,/router\.patch\('\/users\/me\/notification-preferences', protect/);
assert.match(authRoutes,/router\.put\('\/users\/me', protect/);
const auth=read('backend/controllers/authController.js');
assert.match(auth,/notificationPreferences\.marketingConsentAt/);
assert.match(auth,/findByIdAndUpdate\(req\.user\._id/);
const pushRoutes=read('backend/routes/extraRoutes.js');
assert.match(pushRoutes,/my-device', protect/);
assert.match(pushRoutes,/notifications\/send', protect, authorizeRoles\('admin'\)/);
assert.match(pushRoutes,/notifications\/unsubscribe/);
const controller=read('backend/controllers/notificationController.js');
assert.match(controller,/userId:null/,'anonymous push cannot attach arbitrary account IDs');
assert.match(controller,/req\.user\._id/,'device registration must use the authenticated user');
const delivery=read('backend/utils/notificationDelivery.js');
assert.match(delivery,/if\(isStaging\(\)\)return/);
assert.match(delivery,/canNotify\(user,'push',topic\)/);
assert.match(delivery,/canNotify\(u,'email',topic\)/);
assert.match(delivery,/newsCategories/);
assert.match(delivery,/notificationUnsubscribe/);
const scheduler=read('backend/utils/listenerNotificationScheduler.js');
assert.match(scheduler,/Europe\/Athens/);
for(const type of ['shows','favoriteSchedule','news'])assert.ok(scheduler.includes("topic:'"+type+"'"));
assert.match(scheduler,/process\.env\.APP_ENV==='staging'/);
const station=read('backend/controllers/stationController.js');
assert.match(station,/topic:'newStations'/);
assert.match(read('backend/controllers/paymentController.js'),/const owned=req\.user\?\.activeSubscriptions/);

const profile=read('frontend/src/pages/Profile.jsx');
const css=read('frontend/src/styles/profile.css');
assert.match(profile,/notification-preferences/);
assert.match(profile,/role="switch"/);
assert.match(profile,/aria-checked=\{Boolean\(checked\)\}/);
assert.match(profile,/PATCH/);
assert.match(profile,/my-device/);
assert.match(profile,/subscriptionId:sub\.stripeSubscriptionId/);
assert.match(profile,/onClick=\{registerDevice\}/);
assert.match(profile,/Πρόγραμμα αγαπημένων σταθμών/);
assert.match(profile,/Ειδήσεις που σε αφορούν/);
assert.match(profile,/newsCategories/);
assert.match(css,/prefers-reduced-motion/);
assert.match(read('frontend/src/pages/NewPush.jsx'),/alsoEmail/);
console.log('Profile, notification permissions, opt-outs and billing safety contracts passed.');
