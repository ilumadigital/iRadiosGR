#!/usr/bin/env bash
# Read-only, safe diagnostics of outbound DNS/TCP reachability of approved radio
# stations from inside the stage backend container (no stream URLs or secrets printed).
set -euo pipefail
LIMIT="${1:-6}"
[[ "$LIMIT" =~ ^[1-9][0-9]*$ ]] && (( LIMIT <= 20 )) || { echo "Usage: bash ops/check-stage-radio-egress.sh [1..20]" >&2; exit 1; }
docker exec -i -e "RADIO_EGRESS_LIMIT=$LIMIT" iradios_stage-backend-1 node - <<'JS'
const mongoose=require('mongoose');
const dns=require('node:dns').promises;
const net=require('node:net');
const Station=require('./models/Station');
const {parseRadioUrl,isPublicIPv4}=require('./utils/stageStreamProxy');
async function probe(s) {
  let url;
  try {url=parseRadioUrl(s.stream);} catch (e) {return 'URL_BLOCKED';}
  let entries;
  try {entries=await dns.lookup(url.hostname,{all:true});}
  catch(e){return 'DNS_'+String(e.code||'FAILED');}
  const addresses=entries.filter(x=>x.family===4);
  if(!addresses.length)return 'DNS_NO_IPV4';
  if(addresses.some(x=>!isPublicIPv4(x.address)))return 'DNS_PRIVATE_IP_BLOCKED';
  const address=addresses[0].address;
  const port=url.port?Number(url.port):url.protocol==='https:'?443:80;
  return new Promise(resolve=>{
    const socket=net.connect({host:address,port});
    let ended=false;
    const finish=(s)=>{if(ended)return;ended=true;socket.destroy();resolve(s);};
    socket.setTimeout(4000,()=>finish('TCP_TIMEOUT'));
    socket.on('connect',()=>finish('TCP_CONNECTED'));
    socket.on('error',e=>finish('TCP_'+String(e.code||'ERROR')));
  });
}
(async()=>{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:5000});
  const n=Number(process.env.RADIO_EGRESS_LIMIT||6);
  const items=await Station.find({status:'approved',stream:{$type:'string',$ne:''}})
    .select('name stream').sort({name:1}).limit(n).lean();
  if(!items.length)throw Error('No approved station URLs');
  for(const [i,s] of items.entries()) {
    const result=await probe(s);
    console.log(String(i+1).padStart(2,'0')+' '+String(s.name).slice(0,44)+': '+result);
  }
  await mongoose.disconnect();
})().catch(e=>{console.error('Network diagnostic failed: '+e.message);process.exitCode=1});
JS
