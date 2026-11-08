'use strict';
// Offline regression checks: no DB, JWT secrets, network, browser or paid services.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../frontend/src');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const backoffice=read('pages/Backoffice.jsx');
const schedule=backoffice.slice(backoffice.indexOf('function Scheduler('),
  backoffice.indexOf('function Review('));
assert.ok(backoffice.includes('function AdminWorkspace('),'admin hub exists');
assert.ok(backoffice.includes('path="/backoffice/admin"'),'admin hub has a direct route');
assert.ok(backoffice.includes("const ADMIN_TOOLS=["),'all admin tools have a shared catalog');
for(const section of ['analytics','users','ads','banners','slides','emails',
  'billing','radioset','boost','adcontrol','push']){
  assert.ok(backoffice.includes("id:'"+section+"'"),'tool '+section+' is discoverable');
}
for(const route of ['/backoffice','/backoffice/stations','/backoffice/schedules',
  '/backoffice/admin','/backoffice/insights','/backoffice/team']){
  assert.ok(backoffice.includes('path="'+route+'"'),'route '+route+' exists');
}
assert.ok(backoffice.includes('Quick actions')&&backoffice.includes('Ενημέρωση σταθμού'),
  'broadcaster landing screen offers focused shortcuts');
assert.ok(backoffice.includes('Επόμενες εκπομπές'),'landing shows upcoming programs');
for(const feature of ['role="tablist"','Αντιγραφή ημέρας','Νέα εκπομπή',
  'Μη αποθηκευμένες αλλαγές','beforeunload','Επικάλυψη με άλλη εκπομπή',
  'schedule.length>80','startTime>=show.endTime']){
  assert.ok(schedule.includes(feature),'schedule usability safeguard: '+feature);
}
const adminNames=['AdminDashboard','AdminUsers','AdminAds','AdminBanners',
  'AdminHomeSlides','AdminEmails','AdminPaid','AdminRadioSet','AdminAdControl',
  'Boost','NewPush'];
for(const name of adminNames)
  assert.ok(read('pages/'+name+'.jsx').startsWith(
    "import {adminFetch as fetch} from '../utils/adminFetch';"),
    name+' uses same-origin authenticated API requests');

const fetchModule=read('utils/adminFetch.js')
  .replace('export function adminFetch','function adminFetch')+'\nadminFetch;';
const calls=[];
const token='dummy-session-token';
let storedToken=token;
const sandbox={
  window:{location:{origin:'https://stage.iradios.gr'}},
  localStorage:{getItem:()=>storedToken},
  globalThis:{fetch:(input,init)=>{calls.push({input,init});return Promise.resolve({ok:true});}},
  Headers,Request,URL
};
const adminFetch=vm.runInNewContext(fetchModule,sandbox);
async function main(){
  const body={a:1};
  await adminFetch('/api/admin/users',{method:'POST',body,headers:{'X-Test':'hello'}});
  assert.equal(calls[0].init.headers.get('Authorization'),'Bearer '+token);
  assert.equal(calls[0].init.headers.get('X-Test'),'hello');
  assert.equal(calls[0].init.body,body);
  await adminFetch('https://unrelated.example/api/users',{method:'GET'});
  assert.equal(calls[1].init.headers,undefined,'never attach JWT to external origins');
  await adminFetch('/station/demo');
  assert.equal(calls[2].init,undefined,'do not modify public or listener requests');
  storedToken=null;
  await adminFetch('/api/admin/users',{method:'GET'});
  assert.equal(calls[3].init.headers,undefined,'no fabricated JWT when signed out');
  console.log('Phase 4.1 Backoffice routes, admin UX, schedule guards and token boundaries passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
