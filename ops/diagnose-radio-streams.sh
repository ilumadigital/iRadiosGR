#!/usr/bin/env bash
# Test genuine approved radio streams through the running staging Express proxy.
# Reads only public station names and stream URLs internally; prints no URLs or keys.
# Run on Hostinger VPS after deployment. Defaults to first 8 approved stations.
set -euo pipefail
LIMIT="${1:-8}"
[[ "$LIMIT" =~ ^[1-9][0-9]*$ ]] && ((LIMIT<=30)) || { echo "Usage: bash ops/diagnose-radio-streams.sh [1..30]" >&2; exit 1; }
docker exec -i -e "STAGE_RADIO_TEST_LIMIT=$LIMIT" iradios_stage-backend-1 node - <<'JS'
const mongoose = require('mongoose');
const http = require('node:http');
const Station = require('./models/Station');

async function test(s) {
  return new Promise(resolve => {
    let completed = false;
    const finish = (r) => { if (completed) return; completed=true; resolve(r); };
    const u = 'http://127.0.0.1:5011/api/proxy-stream?url=' + encodeURIComponent(s.stream);
    const req = http.get(u, res => {
      const status = res.statusCode;
      const type = String(res.headers['content-type'] || '');
      const diagnostic = String(res.headers['x-iradios-stream-diagnostic'] || '');
      res.once('data', chunk => {
        finish({status,type,bytes:chunk.length,diagnostic});
        res.destroy();
      });
      res.once('end',() => finish({status,type,bytes:0,diagnostic}));
      res.once('error',e => finish({status,type,error:e.code||e.message,diagnostic}));
    });
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.once('error',e => finish({status:0,error:e.code||e.message}));
  });
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS:5000 });
  const limit = Number(process.env.STAGE_RADIO_TEST_LIMIT || 8);
  const radios = await Station.find({status:'approved',stream:{$type:'string',$ne:''}})
    .select('name stream').sort({name:1}).limit(limit).lean();
  if (!radios.length) throw new Error('No approved radio streams in staging');
  let passed=0;
  for (const [i,s] of radios.entries()) {
    const r = await test(s);
    const good = r.status===200 && /^(audio\/|application\/ogg|application\/octet-stream)/i.test(r.type) && r.bytes>0;
    if (good) passed++;
    console.log(String(i+1).padStart(2,'0')+' '+String(s.name).slice(0,48)+': HTTP '+r.status+
      ' '+(r.type||'-')+' '+(r.bytes||0)+' bytes'+(good?' PLAYABLE':' NOT READY')+
      (r.diagnostic?' reason='+r.diagnostic:'')+
      (r.error?' '+r.error:''));
  }
  console.log('Audio headers with bytes: '+passed+'/'+radios.length);
  await mongoose.disconnect();
})().catch(err => { console.error('Radio diagnostics failed: '+err.message); process.exitCode=1; });
JS
