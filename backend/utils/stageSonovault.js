'use strict';
// Manual-only SonoVault identification. All public response fields preserve
// the existing ACR-shaped iRadios UI, media-session, and MongoDB contracts.
const axios=require('axios');
const Station=require('../models/Station');
const {captureAudio}=require('./stageSonovaultAudio');
const {publishAI}=require('./stageSmartTracks');

const IDENTIFY_URL='https://api.sonovault.now/v1/tracks/identify';
const WINDOW_MS=15*60*1000,MAX_CALLS=3,MAX_CAPTURES=6;
const attempts=new Map(),captures=new Map(),inFlightStations=new Map();
const problems=Object.freeze({
  // Legacy codes are kept for compatibility with already cached clients.
  ACR_DISABLED:[503,'Η αναγνώριση δεν έχει ενεργοποιηθεί ακόμη.'],
  ACR_CONFIG:[503,'Λείπει το SONOVAULT_API_KEY από τον server.'],
  ACR_RATE_LIMIT:[429,'Έχεις κάνει αρκετές προσπάθειες. Δοκίμασε ξανά σε 15 λεπτά.'],
  SONO_KEY_TEST:[503,'Το SonoVault key είναι δοκιμαστικό (svk_test_). Χρειάζεται svk_live_ για πραγματικά τραγούδια.'],
  SONO_KEY_FORMAT:[503,'Το SONOVAULT_API_KEY δεν έχει έγκυρη μορφή. Χρειάζεται κλειδί svk_live_.'],
  SONO_AUTH:[502,'SonoVault HTTP 401: το API key δεν είναι έγκυρο.'],
  SONO_PLAN:[502,'SonoVault HTTP 403: απαιτείται ενεργό πληρωμένο πρόγραμμα και επιβεβαιωμένο email.'],
  SONO_PAYMENT:[502,'SonoVault HTTP 402: απαιτείται μέθοδος πληρωμής στον λογαριασμό.'],
  SONO_QUOTA:[429,'SonoVault HTTP 429: εξαντλήθηκαν τα credits ή το όριο κλήσεων.'],
  SONO_BAD_REQUEST:[502,'SonoVault HTTP 400: απορρίφθηκε το δείγμα ήχου.'],
  SONO_AUDIO_FORMAT:[502,'SonoVault HTTP 415: δεν υποστηρίζεται η μορφή του ήχου.'],
  SONO_AUDIO_SIZE:[502,'SonoVault HTTP 413: το αρχείο ήχου είναι πολύ μεγάλο.'],
  SONO_NOT_AVAILABLE:[502,'Το SonoVault δεν δέχεται αιτήματα στο endpoint αναγνώρισης (HTTP 404/410).'],
  SONO_TIMEOUT:[504,'Το SonoVault δεν ολοκλήρωσε εγκαίρως την αναγνώριση.'],
  SONO_NETWORK:[502,'Δεν ήταν δυνατή η επικοινωνία με το SonoVault.'],
  SONO_RESPONSE:[502,'Το SonoVault επέστρεψε μη έγκυρα δεδομένα αναγνώρισης.'],
  SONO_TRACK_FILTERED:[502,'Το SonoVault αναγνώρισε τραγούδι, αλλά τα στοιχεία του δεν πέρασαν τον έλεγχο μουσικών metadata.'],
  SONO_STORAGE:[503,'Το τραγούδι αναγνωρίστηκε, αλλά δεν αποθηκεύτηκε στην κοινή playlist.'],
  STREAM_UNAVAILABLE:[502,'Δεν μπορέσαμε να λάβουμε ήχο από τον σταθμό.'],
  STREAM_FORMAT:[502,'Ο ήχος αυτού του σταθμού δεν μπορεί να μετατραπεί σε κατάλληλο δείγμα.'],
  STREAM_SHORT:[502,'Ο σταθμός δεν παρείχε αρκετό δείγμα μουσικής.']
});
function keyState(){
  const key=String(process.env.SONOVAULT_API_KEY||'').trim();
  if(!key)return 'ACR_CONFIG';
  if(key.startsWith('svk_test_'))return 'SONO_KEY_TEST';
  if(!/^svk_live_\S+$/.test(key))return 'SONO_KEY_FORMAT';
  return null;
}
function readyForSonoVault(){
  return process.env.STAGE_ENABLE_SONOVAULT==='1'&&!keyState();
}
function fail(res,code,retrySeconds){
  const [http,error]=problems[code]||problems.SONO_NETWORK;
  res.setHeader?.('Cache-Control','private, no-store');
  if(http===429)res.setHeader?.('Retry-After',String(Number.isInteger(retrySeconds)?
    Math.max(1,Math.min(86400,retrySeconds)):900));
  return res.status(http).json({error,code});
}
function recognitionError(code,retrySeconds){
  const error=new Error(code);
  error.code=code;
  if(Number.isInteger(retrySeconds))error.retrySeconds=retrySeconds;
  return error;
}
function allowWithinWindow(bucket,userId,max){
  const now=Date.now();
  if(bucket.size>4096)bucket.clear();
  const previous=bucket.get(userId);
  const state=!previous||now-previous.start>=WINDOW_MS?{start:now,count:0}:previous;
  if(state.count>=max)return false;
  state.count++;bucket.set(userId,state);
  return true;
}
const noMatch=()=>({status:{code:1001},metadata:{music:[]}});
// The provider explicitly declares matched=true only for candidates passing
// ITS confidence gate. Never invent a second >0.5 threshold in iRadios.
function toExistingRecognitionShape(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
      typeof payload.matched!=='boolean'||!Array.isArray(payload.results))
    throw recognitionError('SONO_RESPONSE');
  if(payload.matched===false)return noMatch();
  if(!payload.results.length)throw recognitionError('SONO_RESPONSE');
  for(const item of payload.results){
    const title=typeof item?.title==='string'?item.title.trim():'';
    const artist=Array.isArray(item?.artists)?item.artists
      .map(a=>typeof a==='string'?a.trim():
        typeof a?.name==='string'?a.name.trim():'').find(Boolean):'';
    if(title&&artist&&title.length<=150&&artist.length<=150){
      return {status:{code:0},metadata:{music:[{
        title,artists:[{name:artist}]
      }]}};
    }
  }
  throw recognitionError('SONO_RESPONSE');
}
function upstreamFailure(error){
  const status=Number(error?.response?.status);
  const resetRaw=error?.response?.headers?.['ratelimit-reset'];
  const reset=Number(resetRaw);
  const retry=Number.isInteger(reset)&&reset>0?Math.min(reset,86400):undefined;
  const code=status===401?'SONO_AUTH':status===403?'SONO_PLAN':
    status===402?'SONO_PAYMENT':status===429?'SONO_QUOTA':
    status===400?'SONO_BAD_REQUEST':status===415?'SONO_AUDIO_FORMAT':
    status===413?'SONO_AUDIO_SIZE':status===404||status===410?'SONO_NOT_AVAILABLE':
    error?.code==='ECONNABORTED'||error?.code==='ETIMEDOUT'?'SONO_TIMEOUT':'SONO_NETWORK';
  console.warn('[STAGE_SONOVAULT] identify_failed',code,
    Number.isInteger(status)&&status>0?status:'transport');
  return recognitionError(code,retry);
}
async function performRecognition(station,{beforeVendorCall}={}){
  if(process.env.STAGE_ENABLE_SONOVAULT!=='1')throw recognitionError('ACR_DISABLED');
  const badKey=keyState();
  if(badKey)throw recognitionError(badKey);
  const sample=await captureAudio(station);
  if(!Buffer.isBuffer(sample)||sample.length<16000||sample.length>1048576)
    throw recognitionError('STREAM_FORMAT');
  if(beforeVendorCall&&!(await beforeVendorCall()))
    throw recognitionError('ACR_RATE_LIMIT');
  let payload;
  try{
    const response=await axios.post(IDENTIFY_URL,sample,{
      headers:{
        'x-api-key':process.env.SONOVAULT_API_KEY.trim(),
        'Content-Type':'application/octet-stream',
        'Accept':'application/json'
      },
      maxRedirects:0,
      timeout:55000,
      maxBodyLength:1048576,
      maxContentLength:262144
    });
    payload=response.data;
  }catch(error){throw upstreamFailure(error);}
  const normalized=toExistingRecognitionShape(payload);
  // Only status, upload size and documented credit count are logged. Never
  // log audio, track title, the station URL, key or upstream response body.
  console.info('[STAGE_SONOVAULT] identify_status',
    normalized.status.code===0?'matched':'no_match',
    'upload_bytes',sample.length,
    'credits_charged',Number.isInteger(payload.credits_charged)?payload.credits_charged:'unknown');
  return normalized;
}
async function recognizeApprovedStation(station,options={}){
  const key=String(station?._id||'');
  if(inFlightStations.has(key))return inFlightStations.get(key);
  const work=(async()=>{
    const result=await performRecognition(station,options);
    if(Number(result?.status?.code)===0){
      let published;
      try{published=await publishAI(station,result,'manual');}
      catch(error){
        console.warn('[STAGE_SONOVAULT] shared_playlist_write_failed',
          error?.name==='MongoServerError'?'DB_WRITE':'DATABASE');
        throw recognitionError('SONO_STORAGE');
      }
      if(!published)throw recognitionError('SONO_TRACK_FILTERED');
    }
    return result;
  })();
  if(inFlightStations.size>64)inFlightStations.clear();
  inFlightStations.set(key,work);
  try{return await work;}
  finally{if(inFlightStations.get(key)===work)inFlightStations.delete(key);}
}
async function stageRecognizeProxy(req,res){
  res.setHeader?.('Cache-Control','private, no-store');
  if(process.env.STAGE_ENABLE_SONOVAULT!=='1')return fail(res,'ACR_DISABLED');
  const badKey=keyState();
  if(badKey)return fail(res,badKey);
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
  }catch{return fail(res,'SONO_STORAGE');}
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
    return fail(res,problems[error?.code]?error.code:'SONO_NETWORK',error?.retrySeconds);
  }
}
module.exports={stageRecognizeProxy,recognizeApprovedStation,readyForSonoVault,
  keyState,toExistingRecognitionShape,upstreamFailure};
