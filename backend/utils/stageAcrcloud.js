'use strict';
// Staging only: approved station streams, DNS-pinned public IPs, bounded audio samples.
const crypto=require('node:crypto');
const axios=require('axios');
const FormData=require('form-data');
const Station=require('../models/Station');
const {readPublicUrl}=require('./stageSafeRadioFetch');
const {publishAI}=require('./stageSmartTracks');

const attempts=new Map(),captures=new Map();
const WINDOW_MS=15*60*1000,MAX_CALLS=3,MAX_CAPTURES=6;
function validAcrHost(value){
  return typeof value==='string'&&value.length<=253&&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.acrcloud\.com$/i.test(value);
}
function readyForAcr(){
  return process.env.STAGE_ENABLE_ACRCLOUD==='1' &&
    validAcrHost(process.env.ACRCLOUD_HOST) &&
    Boolean(process.env.ACRCLOUD_ACCESS_KEY&&process.env.ACRCLOUD_ACCESS_SECRET);
}
function allowWithinWindow(bucket,userId,max){
  const now=Date.now();
  if(bucket.size>4096)bucket.clear();
  const before=bucket.get(userId);
  const state=!before||now-before.start>=WINDOW_MS?{start:now,count:0}:before;
  if(state.count>=max)return false;
  state.count++;bucket.set(userId,state);return true;
}
const problems=Object.freeze({
  ACR_DISABLED:[503,'Η αναγνώριση δεν έχει ενεργοποιηθεί ακόμη.'],
  ACR_CONFIG:[503,'Η αναγνώριση χρειάζεται ρύθμιση στον server.'],
  ACR_AUTH:[502,'Η αναγνώριση δεν συνδέθηκε με την υπηρεσία μουσικής.'],
  ACR_QUOTA:[429,'Η υπηρεσία αναγνώρισης έφτασε το όριό της. Δοκίμασε αργότερα.'],
  ACR_RATE_LIMIT:[429,'Έχεις κάνει αρκετές προσπάθειες. Δοκίμασε ξανά σε 15 λεπτά.'],
  ACR_UPSTREAM:[502,'Η υπηρεσία αναγνώρισης δεν ανταποκρίνεται. Δοκίμασε αργότερα.'],
  STREAM_UNAVAILABLE:[502,'Δεν μπορέσαμε να ακούσουμε τον σταθμό. Δοκίμασε άλλον σταθμό.'],
  STREAM_FORMAT:[502,'Ο σταθμός δεν υποστηρίζει αυτή τη στιγμή την αναγνώριση.'],
  STREAM_SHORT:[502,'Δεν ακούστηκε αρκετή μουσική. Δοκίμασε ξανά σε λίγο.']
});
function fail(res,code){
  const [http,error]=problems[code]||problems.ACR_UPSTREAM;
  if(http===429)res.setHeader('Retry-After','900');
  return res.status(http).json({error,code});
}
function acrFailure(code){
  switch(Number(code)){
    case 3001:case 3014:return 'ACR_AUTH';
    case 3003:case 3015:return 'ACR_QUOTA';
    default:return 'ACR_UPSTREAM';
  }
}
function recognizedCode(payload){return Number(payload?.status?.code);}
function recognitionError(code){
  const err=new Error(code);err.code=code;return err;
}
// Reusable by BOTH manual recognition and the centrally scheduled Top-10 fallback.
// beforeVendorCall lets manual requests enforce per-user billed request limits.
async function recognizeApprovedStation(station,{beforeVendorCall}={}){
  if(process.env.STAGE_ENABLE_ACRCLOUD!=='1')throw recognitionError('ACR_DISABLED');
  const {ACRCLOUD_HOST:host,ACRCLOUD_ACCESS_KEY:key,ACRCLOUD_ACCESS_SECRET:secret}=process.env;
  if(!validAcrHost(host)||!key||!secret)throw recognitionError('ACR_CONFIG');
  let sample;
  try{
    sample=await readPublicUrl(station.stream,{
      maxBytes:600000,timeoutMs:12000,allowPartialOnDeadline:true,
      headers:{'Icy-MetaData':'0','Accept':'audio/*,application/octet-stream'}
    });
  }catch(error){
    console.warn('[STAGE_ACRCLOUD] stream_capture_failed',error?.code||'fetch');
    throw recognitionError('STREAM_UNAVAILABLE');
  }
  const type=String(sample.headers['content-type']||'audio/mpeg').toLowerCase();
  if(/(?:mpegurl|m3u8|x-scpls|playlist)/.test(type)||
     (!type.startsWith('audio/')&&!/^(application\/ogg|application\/octet-stream)(;|$)/.test(type))){
    throw recognitionError('STREAM_FORMAT');
  }
  if(sample.buffer.length<16000)throw recognitionError('STREAM_SHORT');
  if(beforeVendorCall && !(await beforeVendorCall()))throw recognitionError('ACR_RATE_LIMIT');
  const endpoint='/v1/identify';
  const timestamp=Math.floor(Date.now()/1000);
  const signature=crypto.createHmac('sha1',secret)
    .update(['POST',endpoint,key,'audio','1',timestamp].join('\n')).digest('base64');
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
  let data;
  try{
    const response=await axios.post('https://'+host+endpoint,form,{
      headers:form.getHeaders(),maxRedirects:0,timeout:14000,
      maxBodyLength:1048576,maxContentLength:131072
    });
    data=response.data;
  }catch(error){
    const status=Number(error?.response?.status),code=Number(error?.response?.data?.status?.code);
    const reason=status===429||code===3003||code===3015?'ACR_QUOTA':
      status===401||status===403||code===3001||code===3014?'ACR_AUTH':'ACR_UPSTREAM';
    console.warn('[STAGE_ACRCLOUD] service_request_failed',reason,status||'network');
    throw recognitionError(reason);
  }
  const code=recognizedCode(data);
  if(code===0||code===1001)return data;
  const reason=acrFailure(code);
  console.warn('[STAGE_ACRCLOUD] service_status',Number.isFinite(code)?code:'unknown');
  throw recognitionError(reason);
}
async function stageRecognizeProxy(req,res){
  if(process.env.STAGE_ENABLE_ACRCLOUD!=='1')return fail(res,'ACR_DISABLED');
  if(!readyForAcr())return fail(res,'ACR_CONFIG');
  const stationId=req.body?.stationId;
  if(typeof stationId!=='string'||!/^[a-f0-9]{24}$/i.test(stationId))
    return res.status(400).json({error:'Επίλεξε έναν σταθμό.',code:'STATION_INVALID'});
  const userId=String(req.user?._id||'');
  if(!userId)return res.status(401).json({error:'Συνδέσου για να βρεις το τραγούδι.',code:'AUTH_REQUIRED'});
  let station;
  try{
    station=await Station.findOne({_id:stationId,status:'approved'}).select('_id name stream status').lean();
  }catch{
    return fail(res,'ACR_UPSTREAM');
  }
  if(!station?.stream)return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.',code:'STATION_MISSING'});
  if(!allowWithinWindow(captures,userId,MAX_CAPTURES))return fail(res,'ACR_RATE_LIMIT');
  try{
    const result=await recognizeApprovedStation(station,{
      beforeVendorCall:()=>allowWithinWindow(attempts,userId,MAX_CALLS)
    });
    if(recognizedCode(result)===0){
      try{await publishAI(station,result,'manual');}
      catch(error){console.warn('[STAGE_ACRCLOUD] shared_track_persist_failed',error?.name||'persist');}
    }
    return res.json(result);
  }catch(error){
    return fail(res,problems[error?.code]?error.code:'ACR_UPSTREAM');
  }
}
module.exports={stageRecognizeProxy,recognizeApprovedStation,readyForAcr,
  validAcrHost,acrFailure,recognizedCode};
