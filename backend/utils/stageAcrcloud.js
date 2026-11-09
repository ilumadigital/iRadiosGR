'use strict';
// ACRCloud Identify API v1: only authenticated, user-initiated recognition.
// Results are published through the station-wide MongoDB Now Playing + playlist.
const crypto=require('node:crypto');
const axios=require('axios');
const FormData=require('form-data');
const Station=require('../models/Station');
const {captureAudio}=require('./stageAcrcloudAudio');
const {publishAI,validTrackFromAcr}=require('./stageSmartTracks');

const API_PATH='/v1/identify';
const WINDOW_MS=15*60*1000,MAX_CALLS=3,MAX_CAPTURES=6;
const attempts=new Map(),captures=new Map(),inFlightStations=new Map();
const problems=Object.freeze({
  ACR_DISABLED:[503,'Η χειροκίνητη αναγνώριση δεν έχει ενεργοποιηθεί.'],
  ACR_CONFIG:[503,'Δεν έχουν ρυθμιστεί σωστά τα στοιχεία του ACRCloud.'],
  ACR_RATE_LIMIT:[429,'Έχεις κάνει αρκετές προσπάθειες. Δοκίμασε ξανά σε 15 λεπτά.'],
  ACR_AUTH:[502,'Το ACRCloud δεν δέχτηκε τα στοιχεία σύνδεσης.'],
  ACR_QUOTA:[429,'Το ACRCloud έχει φτάσει το όριο κλήσεών του.'],
  ACR_TIMEOUT:[504,'Το ACRCloud δεν απάντησε εγκαίρως.'],
  ACR_PROVIDER:[502,'Η υπηρεσία ACRCloud δεν είναι διαθέσιμη.'],
  ACR_RESPONSE:[502,'Το ACRCloud επέστρεψε μη έγκυρα δεδομένα.'],
  ACR_TRACK_FILTERED:[502,'Το τραγούδι αναγνωρίστηκε, αλλά δεν έχει έγκυρα στοιχεία.'],
  ACR_STORAGE:[503,'Το τραγούδι αναγνωρίστηκε, αλλά δεν αποθηκεύτηκε στην κοινή playlist.'],
  STREAM_UNAVAILABLE:[502,'Δεν ήταν δυνατό να ληφθεί ήχος από τον σταθμό.'],
  STREAM_FORMAT:[502,'Ο ήχος του σταθμού δεν υποστηρίζει αναγνώριση.'],
  STREAM_SHORT:[502,'Δεν καταγράφηκε αρκετό δείγμα μουσικής.']
});

function providerConfig(){
  const host=String(process.env.ACRCLOUD_HOST||'').trim().toLowerCase();
  const accessKey=String(process.env.ACRCLOUD_ACCESS_KEY||'').trim();
  const accessSecret=String(process.env.ACRCLOUD_ACCESS_SECRET||'').trim();
  // Server-selected ACRCloud hostname only: no arbitrary URL, IP, port or path.
  if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+acrcloud\.com$/.test(host)||
    !accessKey||!accessSecret||accessKey.length>256||accessSecret.length>256)
    return null;
  return {host,accessKey,accessSecret};
}
function readyForAcrCloud(){
  return process.env.STAGE_ENABLE_ACRCLOUD==='1'&&Boolean(providerConfig());
}
function fail(res,code,retrySeconds){
  const [status,error]=problems[code]||problems.ACR_PROVIDER;
  res.setHeader('Cache-Control','private, no-store');
  if(status===429)res.setHeader('Retry-After',String(
    Number.isInteger(retrySeconds)?Math.min(86400,Math.max(1,retrySeconds)):900));
  return res.status(status).json({code,error});
}
function recognitionError(code,retrySeconds){
  const error=new Error(code);error.code=code;
  if(Number.isInteger(retrySeconds))error.retrySeconds=retrySeconds;
  return error;
}
function withinWindow(bucket,key,limit){
  const now=Date.now();
  if(bucket.size>4096)bucket.clear();
  const before=bucket.get(key);
  const value=!before||now-before.start>=WINDOW_MS?{start:now,count:0}:before;
  if(value.count>=limit)return false;
  value.count++;
  bucket.set(key,value);
  return true;
}
function signature(config,timestamp){
  const toSign=['POST',API_PATH,config.accessKey,'audio','1',timestamp].join('\n');
  return crypto.createHmac('sha1',config.accessSecret)
    .update(toSign,'utf8').digest('base64');
}
const noMatch=()=>({status:{code:1001},metadata:{music:[]}});
function normalizeMatch(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     !Number.isInteger(Number(payload?.status?.code)))
    throw recognitionError('ACR_RESPONSE');
  const code=Number(payload.status.code);
  if(code===1001)return noMatch();
  if(code!==0)throw recognitionError('ACR_PROVIDER');
  const track=Array.isArray(payload?.metadata?.music)?payload.metadata.music[0]:null;
  if(!track)return noMatch();
  const artist=track?.artists?.find(x=>typeof x?.name==='string'&&x.name.trim())?.name?.trim();
  const title=typeof track?.title==='string'?track.title.trim():'';
  if(!artist||!title||artist.length>150||title.length>150)
    throw recognitionError('ACR_TRACK_FILTERED');
  const spotifyId=track?.external_metadata?.spotify?.track?.id;
  return {status:{code:0},metadata:{music:[{
    title,artists:[{name:artist}],
    ...(typeof spotifyId==='string'&&/^[a-zA-Z0-9]{22}$/.test(spotifyId)?
      {external_metadata:{spotify:{track:{id:spotifyId}}}}:{})
  }]}};
}
function upstreamFailure(error){
  const status=Number(error?.response?.status);
  const retry=Number(error?.response?.headers?.['retry-after']);
  const code=status===401||status===403?'ACR_AUTH':status===429?'ACR_QUOTA':
    ['ECONNABORTED','ETIMEDOUT'].includes(error?.code)?'ACR_TIMEOUT':'ACR_PROVIDER';
  console.warn('[ACRCLOUD] identify_failed',code,
    Number.isInteger(status)&&status>0?status:'transport');
  return recognitionError(code,Number.isInteger(retry)&&retry>0?retry:undefined);
}
async function identify(station,config,beforeVendorCall){
  const sample=await captureAudio(station);
  if(!Buffer.isBuffer(sample)||sample.length<16000||sample.length>1048576)
    throw recognitionError('STREAM_FORMAT');
  if(beforeVendorCall&&!beforeVendorCall())
    throw recognitionError('ACR_RATE_LIMIT');
  const timestamp=String(Math.floor(Date.now()/1000));
  const form=new FormData();
  form.append('sample',sample,{filename:'sample.mp3',contentType:'audio/mpeg',knownLength:sample.length});
  form.append('sample_bytes',String(sample.length));
  form.append('access_key',config.accessKey);
  form.append('data_type','audio');
  form.append('signature_version','1');
  form.append('timestamp',timestamp);
  form.append('signature',signature(config,timestamp));
  let payload;
  try{
    const result=await axios.post('https://'+config.host+API_PATH,form,{
      headers:{...form.getHeaders(),Accept:'application/json'},
      timeout:30000,maxRedirects:0,
      maxBodyLength:2*1024*1024,maxContentLength:256*1024
    });
    payload=result.data;
  }catch(error){throw upstreamFailure(error);}
  const normalized=normalizeMatch(payload);
  console.info('[ACRCLOUD] manual_identify',
    normalized.status.code===0?'matched':'no_match','sample_bytes',sample.length);
  return normalized;
}
async function recognizeApprovedStation(station,config,beforeVendorCall){
  const id=String(station?._id||'');
  if(inFlightStations.has(id))return inFlightStations.get(id);
  const work=(async()=>{
    const result=await identify(station,config,beforeVendorCall);
    if(result.status.code===0){
      // Publish only provider-confirmed, well-formed songs.
      if(!validTrackFromAcr(result))throw recognitionError('ACR_TRACK_FILTERED');
      let shared;
      try{shared=await publishAI(station,result,'manual');}
      catch(error){
        console.warn('[ACRCLOUD] playlist_write_failed',error?.name||'database');
        throw recognitionError('ACR_STORAGE');
      }
      if(!shared)throw recognitionError('ACR_TRACK_FILTERED');
      return {...result,recognizedAt:shared.recognizedAt,
        expiresAt:new Date(shared.expiresAt).toISOString()};
    }
    return result;
  })();
  if(inFlightStations.size>64)inFlightStations.clear();
  inFlightStations.set(id,work);
  try{return await work;}
  finally{if(inFlightStations.get(id)===work)inFlightStations.delete(id);}
}
async function stageRecognizeProxy(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(process.env.STAGE_ENABLE_ACRCLOUD!=='1')return fail(res,'ACR_DISABLED');
  const config=providerConfig();
  if(!config)return fail(res,'ACR_CONFIG');
  const stationId=req.body?.stationId;
  if(typeof stationId!=='string'||!/^[a-f0-9]{24}$/i.test(stationId))
    return res.status(400).json({code:'STATION_INVALID',error:'Επίλεξε έναν σταθμό.'});
  const userId=String(req.user?._id||'');
  if(!userId)return res.status(401).json({
    code:'AUTH_REQUIRED',error:'Συνδέσου για να βρεις το τραγούδι.'
  });
  let station;
  try{station=await Station.findOne({_id:stationId,status:'approved',isOffline:{$ne:true}})
    .select('_id name stream status').lean();}
  catch{return fail(res,'ACR_STORAGE');}
  if(!station?.stream)return res.status(404).json({
    code:'STATION_MISSING',error:'Ο σταθμός δεν είναι διαθέσιμος.'
  });
  if(!withinWindow(captures,userId,MAX_CAPTURES))
    return fail(res,'ACR_RATE_LIMIT');
  try{
    const result=await recognizeApprovedStation(station,config,
      ()=>withinWindow(attempts,userId,MAX_CALLS));
    return res.json(result);
  }catch(error){
    return fail(res,problems[error?.code]?error.code:'ACR_PROVIDER',error?.retrySeconds);
  }
}
module.exports={stageRecognizeProxy,recognizeApprovedStation,readyForAcrCloud,
  providerConfig,signature,normalizeMatch,upstreamFailure};
