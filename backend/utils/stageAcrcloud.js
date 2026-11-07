'use strict';
// STAGING ACRCloud recognition: signed-in listener, approved DB-owned station,
// public IPv4-only audio fetch, bounded sampling and limited requests per user.
const crypto = require('node:crypto');
const axios = require('axios');
const FormData = require('form-data');
const Station = require('../models/Station');
const { readPublicUrl } = require('./stageSafeRadioFetch');

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_CALLS = 3;

function validAcrHost(value) {
  return typeof value === 'string' &&
    value.length <= 253 &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.acrcloud\.com$/i.test(value);
}
function allowAcrRequest(userId) {
  const now = Date.now();
  if (attempts.size > 4096) attempts.clear();
  const record = attempts.get(userId);
  const state = !record || now - record.start >= WINDOW_MS
    ? {start:now,count:0} : record;
  if(state.count >= MAX_CALLS)return false;
  state.count++;
  attempts.set(userId,state);
  return true;
}
const problems = Object.freeze({
  ACR_DISABLED: [503, 'Η αναγνώριση δεν έχει ενεργοποιηθεί ακόμη.'],
  ACR_CONFIG: [503, 'Η αναγνώριση χρειάζεται ρύθμιση στον server.'],
  ACR_AUTH: [502, 'Η αναγνώριση δεν συνδέθηκε με την υπηρεσία μουσικής.'],
  ACR_QUOTA: [429, 'Η υπηρεσία αναγνώρισης έφτασε το όριό της. Δοκίμασε αργότερα.'],
  ACR_RATE_LIMIT: [429, 'Έχεις κάνει αρκετές προσπάθειες. Δοκίμασε ξανά σε 15 λεπτά.'],
  ACR_UPSTREAM: [502, 'Η υπηρεσία αναγνώρισης δεν ανταποκρίνεται. Δοκίμασε αργότερα.'],
  STREAM_UNAVAILABLE: [502, 'Δεν μπορέσαμε να ακούσουμε τον σταθμό. Δοκίμασε άλλον σταθμό.'],
  STREAM_FORMAT: [502, 'Ο σταθμός δεν υποστηρίζει αυτή τη στιγμή την αναγνώριση.'],
  STREAM_SHORT: [502, 'Δεν ακούστηκε αρκετή μουσική. Δοκίμασε ξανά σε λίγο.']
});
function fail(res, code) {
  const [status,error] = problems[code] || problems.ACR_UPSTREAM;
  return res.status(status).json({error,code});
}
function acrFailure(code) {
  switch(Number(code)){
    case 3001: case 3014: return 'ACR_AUTH';
    case 3003: case 3015: return 'ACR_QUOTA';
    default: return 'ACR_UPSTREAM';
  }
}
function recognizedCode(payload) {
  // ACRCloud success is code=0. No match is code=1001 (both are HTTP 200).
  return Number(payload?.status?.code);
}

async function stageRecognizeProxy(req,res) {
  if(process.env.STAGE_ENABLE_ACRCLOUD !== '1')return fail(res,'ACR_DISABLED');
  const {ACRCLOUD_HOST:host,ACRCLOUD_ACCESS_KEY:key,ACRCLOUD_ACCESS_SECRET:secret}=process.env;
  if(!validAcrHost(host) || !key || !secret)return fail(res,'ACR_CONFIG');
  const stationId=req.body?.stationId;
  if(typeof stationId!=='string' || !/^[a-f0-9]{24}$/i.test(stationId)){
    return res.status(400).json({error:'Επίλεξε έναν σταθμό.',code:'STATION_INVALID'});
  }
  const userId=String(req.user?._id||'');
  if(!userId)return res.status(401).json({error:'Συνδέσου για να βρεις το τραγούδι.',code:'AUTH_REQUIRED'});

  let station;
  try{
    station=await Station.findOne({_id:stationId,status:'approved'})
      .select('stream status').lean();
  }catch{
    console.warn('[STAGE_ACRCLOUD] station_lookup_failed');
    return fail(res,'ACR_UPSTREAM');
  }
  if(!station?.stream){
    return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.',code:'STATION_MISSING'});
  }

  // Fetch from the approved station DB, never from req.body.streamUrl (SSRF).
  // 12 seconds gives fingerprint matching more musical context, stays <15s guidance.
  let sample;
  try{
    sample=await readPublicUrl(station.stream,{
      maxBytes:600000,
      timeoutMs:12000,
      allowPartialOnDeadline:true,
      headers:{'Icy-MetaData':'0','Accept':'audio/*,application/octet-stream'}
    });
  }catch(error){
    console.warn('[STAGE_ACRCLOUD] stream_capture_failed',error?.code||'fetch');
    return fail(res,'STREAM_UNAVAILABLE');
  }
  const type=String(sample.headers['content-type']||'audio/mpeg').toLowerCase();
  if(!type.startsWith('audio/') &&
     !/^(application\/ogg|application\/octet-stream)(;|$)/.test(type)){
    console.warn('[STAGE_ACRCLOUD] unsupported_stream_content_type');
    return fail(res,'STREAM_FORMAT');
  }
  if(sample.buffer.length<16000)return fail(res,'STREAM_SHORT');

  // Only bill/count attempts that have a usable audio sample, not failed streams.
  if(!allowAcrRequest(userId)){
    res.setHeader('Retry-After','900');
    return fail(res,'ACR_RATE_LIMIT');
  }
  const endpoint='/v1/identify';
  const timestamp=Math.floor(Date.now()/1000);
  const signature=crypto.createHmac('sha1',secret)
    .update(['POST',endpoint,key,'audio','1',timestamp].join('\n'))
    .digest('base64');

  const form=new FormData();
  const ext=type.includes('ogg')?'ogg':type.includes('aac')?'aac':'mp3';
  const mime=ext==='ogg'?'audio/ogg':ext==='aac'?'audio/aac':'audio/mpeg';
  form.append('sample',sample.buffer,{filename:'sample.'+ext,contentType:mime});
  form.append('access_key',key);
  form.append('data_type','audio');
  form.append('signature_version','1');
  form.append('signature',signature);
  form.append('sample_bytes',sample.buffer.length);
  form.append('timestamp',timestamp);

  let result;
  try{
    const identified=await axios.post('https://'+host+endpoint,form,{
      headers:form.getHeaders(),
      maxRedirects:0,
      timeout:14000,
      maxBodyLength:1048576,
      maxContentLength:131072
    });
    result=identified.data;
  }catch(error){
    const status=error?.response?.status;
    const code=error?.response?.data?.status?.code;
    const reason=(status===429||code===3003||code===3015)?'ACR_QUOTA':
      (status===401||status===403||code===3001||code===3014)?'ACR_AUTH':'ACR_UPSTREAM';
    console.warn('[STAGE_ACRCLOUD] service_request_failed',reason,status||'network');
    if(reason==='ACR_QUOTA')res.setHeader('Retry-After','900');
    return fail(res,reason);
  }

  const code=recognizedCode(result);
  if(code===0 || code===1001)return res.json(result);
  const reason=acrFailure(code);
  console.warn('[STAGE_ACRCLOUD] service_status',Number.isFinite(code)?code:'unknown');
  if(reason==='ACR_QUOTA')res.setHeader('Retry-After','900');
  return fail(res,reason);
}

module.exports={stageRecognizeProxy,validAcrHost,acrFailure,recognizedCode};
