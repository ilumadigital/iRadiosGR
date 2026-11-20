#!/usr/bin/env bash
# Read-only validation of MongoDB 4.4 -> 9.0 isolated review restore.
# Intentionally prints aggregate counts only: NEVER prints users, hashes, emails, IDs, or payloads.
set -euo pipefail
container="${STAGE_MONGO_CONTAINER:-iradios_stage-mongo-1}"
docker inspect "$container" >/dev/null
docker exec -i "$container" sh -ec 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "$(cat)"' <<'JS'
const d = db.getSiblingDB("iradios_import_review");
const stage = db.getSiblingDB("iradios_stage");
const expected = {stationanalytics:88,users:240,stations:68,subscriptions:96,emailhistories:17,transactions:5,ads:4,bannerads:2,chatmessages:0};
let fail = false, total = 0;
print("=== iRadiosGR review namespace (counts only) ===");
for (const [name, n] of Object.entries(expected)) {
  const actual = d.getCollection(name).countDocuments({});
  total += actual;
  const ok = actual === n;
  if (!ok) fail = true;
  print(name+": "+actual+"/"+n+" "+(ok?"OK":"MISMATCH"));
}
const actualNames = d.getCollectionNames();
const extra = actualNames.filter(n=>!(n in expected));
print("Extra collections: "+extra.length);
if (extra.length) fail=true;
print("TOTAL: "+total+"/520");
if (total !== 520) fail=true;
function duplicates(coll,field) {
  const seen = new Set(); let n=0;
  const q={};q[field]={$exists:true};
  const proj={};proj[field]=1;
  for (const doc of d.getCollection(coll).find(q,proj)) {
    const val=doc[field]; if (val===null||val===undefined||val==="") continue;
    const key=String(val);
    if(seen.has(key))n++;else seen.add(key);
  }
  return n;
}
print("=== Unique-key preflight ===");
for (const [c,field] of [["users","username"],["stations","slug"],["subscriptions","endpoint"]]) {
  const n=duplicates(c,field);
  print(c+"."+field+" duplicates: "+n);
  if(n)fail=true;
}
print("=== Password hash shape (counts only) ===");
let bcrypt=0;
for (const u of d.users.find({}, {password:1})) {
  if(typeof u.password==="string" && /^\$2[aby]\$\d\d\$/.test(u.password))bcrypt++;
}
print("bcrypt-looking passwords: "+bcrypt+"/240");
if(bcrypt!==240)fail=true;
print("=== Relationships ===");
const userIds=new Set(d.users.find({},{_id:1}).toArray().map(u=>String(u._id)));
const stationIds=new Set(d.stations.find({},{_id:1}).toArray().map(s=>String(s._id)));
let orphanStationOwners=0, orphanAnalytics=0, orphanPushOwners=0;
for (const s of d.stations.find({},{broadcasterId:1})) {
  if(s.broadcasterId && !userIds.has(String(s.broadcasterId)))orphanStationOwners++;
}
for (const a of d.stationanalytics.find({},{stationId:1})) {
  if(a.stationId && !stationIds.has(String(a.stationId)))orphanAnalytics++;
}
for (const p of d.subscriptions.find({},{userId:1})) {
  if(p.userId && !userIds.has(String(p.userId)))orphanPushOwners++;
}
print("orphan station broadcasters: "+orphanStationOwners);
print("orphan station analytics: "+orphanAnalytics);
print("orphan push subscription owners: "+orphanPushOwners);
if(orphanStationOwners||orphanAnalytics)fail=true;
print("=== Current app database ===");
let activeCount=0;
for(const name of Object.keys(expected))activeCount+=stage.getCollection(name).countDocuments({});
print("iradios_stage total documents: "+activeCount);
if(activeCount!==0)fail=true;
print("=== Stage unique index availability ===");
for (const [c,field] of [["users","username"],["stations","slug"],["subscriptions","endpoint"]]) {
  const indexes=stage.getCollection(c).getIndexes();
  const present=indexes.some(ix=>ix.unique===true && ix.key && ix.key[field]===1);
  print(c+"."+field+": "+(present?"UNIQUE PRESENT":"MISSING"));
  if(!present)fail=true;
}
print("RESULT: "+(fail?"REVIEW REQUIRED":"COUNTS, HASH SHAPES, KEY UNIQUENESS AND STAGE INDEXES OK"));
if(fail)quit(2);
JS
