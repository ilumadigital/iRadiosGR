'use strict';
// Only a signed-in user's existing "Βρες το τραγούδι" action can invoke SonoVault.
// Keep the historical iRadios recognition JSON shape and source enum unchanged so
// player UI, playlists, covers, RDS and iOS/browser media metadata stay identical.
const axios=require('axios');
const Station=require('../models/Station');
const {readPublicUrl}=require('./stageSafeRadioFetch');
const {publishAI}=require('./stageSmartTracks');

const IDENTIFY_URL='https://api.sonovault.now/v1/tracks/identify';
const WINDOW_MS=15*60*1000,MAX_CALLS=3,MAX_CAPTURES=6;
const attempts=new Map(),captures=new Map(),inFlightStations=new Map();
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
// ACR_* are legacy public error identifiers, NOT calls to ACRCloud.
// The frontend deliberately keeps its existing error-message mapping.
function readyForSonoVault(){
  return process.env.STAGE_ENABLE_SONOVAULT==='1' &&
    typeof process.env.SONOVAULT_API_KEY==='string' &&
    Boolean(process.env.SONOVAULT_API_KEY.trim());
}
function fail(res,code){
  const [http,error]=problems[code]||problems.ACR_UPSTREAM;
  if(http===429)res.setHeader('Retry-After','900');
  return res.status(http).json({error,code});
}
function recognitionError(code){
  const err=new Error(code);err.code=code;return err;
}
function allowWithinWindow(bucket,userId,max){
  const now=Date.now();
  if(bucket.size>4096)bucket.clear();
  const previous=bucket.get(userId);
  const state=!previous||now-previous.start>=WINDOW_MS?{start:now,count:0}:previous;
  if(state.count>=max)return false;
  state.count++;bucket.set(userId,state);return true;
}
const noMatch=()=>({status:{code:1001},metadata:{music:[]}});
// Adapter: Sonovault {matched,results} -> the exact ACR-shaped contract already
// consumed by stageSmartTracks and frontend App.jsx. No UI changes required.
function toExistingRecognitionShape(payload){
  if(!payload||payload.matched!==true||!Array.isArray(payload.results)||
     payload.results.length===0)return noMatch();
  const first=payload.results[0];
  const title=typeof first?.title==='string'?first.title.trim():'';
  const artists=Array.isArray(first?.artists)?first.artists:[];
  const artist=artists.find(value=>typeof value?.name==='string'&&value.name.trim())?.name?.trim();
  if(!title||!artist||title.length>150||artist.length>150)return noMatch();
  // Sonovault's confidence is 0..1; reject extremely weak results.
  if(Number.isFinite(Number(first.confidence))&&first.confidence!==null &&
     Number(first.confidence)<0.5)return noMatch();
  return {status:{code:0},metadata:{music:[{
    title,artists:[{name:artist}]
  }]}};
}
async function performRecognition(station,{beforeVendorCall}={}){
  if(process.env.STAGE_ENABLE_SONOVAULT!=='1')throw recognitionError('ACR_DISABLED');
  if(!readyForSonoVault())throw recognitionError('ACR_CONFIG');
  let sample;
  try{
    sample=await readPublicUrl(station.stream,{
      maxBytes:800000,timeoutMs:15000,allowPartialOnDeadline:true,
      headers:{'Icy-MetaData':'0','Accept':'audio/*,application/octet-stream'}
    });
  }catch(error){
    console.warn('[STAGE_SONOVAULT] stream_capture_failed',error?.code||'fetch');
    throw recognitionError('STREAM_UNAVAILABLE');
  }
  const type=String(sample.headers['content-type']||'audio/mpeg').toLowerCase();
  if(/(?:mpegurl|m3u8|x-scpls|playlist)/.test(type)||
     (!type.startsWith('audio/')&&!/^(application\/(?:ogg|octet-stream))(;|$)/.test(type)))
    throw recognitionError('STREAM_FORMAT');
  if(!Buffer.isBuffer(sample.buffer)||sample.buffer.length<16000)
    throw recognitionError('STREAM_SHORT');
  if(beforeVendorCall && !(await beforeVendorCall()))
    throw recognitionError('ACR_RATE_LIMIT');
  let payload;
  try{
    const response=await axios.post(IDENTIFY_URL,sample.buffer,{
      headers:{
        'x-api-key':process.env.SONOVAULT_API_KEY.trim(),
        'Content-Type':'application/octet-stream','Accept':'application/json'
      },
      // Audio fingerprint matching can exceed 20 seconds even for a valid sample.
      // Do not prematurely discard a billable successful provider response.
      maxRedirects:0,timeout:50000,maxBodyLength:1048576,maxContentLength:262144
    });
    payload=response.data;
  }catch(error){
    const status=Number(error?.response?.status);
    // 403 also covers the free tier, which cannot use the paid identify endpoint.
    const reason=status===429?'ACR_QUOTA':
      status===401||status===403?'ACR_AUTH':
      status===413||status===415?'STREAM_FORMAT':'ACR_UPSTREAM';
    console.warn('[STAGE_SONOVAULT] identify_failed',reason,status||'network');
    throw recognitionError(reason);
  }
  return toExistingRecognitionShape(payload);
}
async function recognizeApprovedStation(station,options={}){
  const key=String(station?._id||'');
  if(inFlightStations.has(key))return inFlightStations.get(key);
  const work=(async()=>{
    const result=await performRecognition(station,options);
    if(Number(result?.status?.code)===0){
      // This is one shared MongoDB publication per in-flight manual request.
      // Current AI metadata keeps its existing 4-minute precedence/expiry,
      // while the same track lives in station playlist history for 30 minutes.
      const published=await publishAI(station,result,'manual');
      if(!published)return noMatch();
    }
    return result;
  })();
  if(inFlightStations.size>64)inFlightStations.clear();
  inFlightStations.set(key,work);
  try{return await work;}
  finally{if(inFlightStations.get(key)===work)inFlightStations.delete(key);}
}
async function stageRecognizeProxy(req,res){
  if(process.env.STAGE_ENABLE_SONOVAULT!=='1')return fail(res,'ACR_DISABLED');
  if(!readyForSonoVault())return fail(res,'ACR_CONFIG');
  const stationId=req.body?.stationId;
  if(typeof stationId!=='string'||!/^[a-f0-9]{24}$/i.test(stationId))
    return res.status(400).json({error:'Επίλεξε έναν σταθμό.',code:'STATION_INVALID'});
  const userId=String(req.user?._id||'');
  if(!userId)return res.status(401).json({
    error:'Συνδέσου για να βρεις το τραγούδι.',code:'AUTH_REQUIRED'
  });
  let station;
  try{
    station=await Station.findOne({_id:stationId,status:'approved'})
      .select('_id name stream status').lean();
  }catch{return fail(res,'ACR_UPSTREAM');}
  if(!station?.stream)return res.status(404).json({
    error:'Ο σταθμός δεν βρέθηκε.',code:'STATION_MISSING'
  });
  if(!allowWithinWindow(captures,userId,MAX_CAPTURES))
    return fail(res,'ACR_RATE_LIMIT');
  try{
    const result=await recognizeApprovedStation(station,{
      beforeVendorCall:()=>allowWithinWindow(attempts,userId,MAX_CALLS)
    });
    return res.json(result);
  }catch(error){
    return fail(res,problems[error?.code]?error.code:'ACR_UPSTREAM');
  }
}
module.exports={stageRecognizeProxy,recognizeApprovedStation,readyForSonoVault,
  toExistingRecognitionShape};
