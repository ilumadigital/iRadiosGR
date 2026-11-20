// Serialized paid station-switch proofs; 400 ms server threshold stays intact.
export const STATION_TRANSITION_GAP_MS=550;
export const STATION_TRANSITION_RETRY_MS=650;
export function createPaidTransitionScheduler({
 now=()=>Date.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 onFailure=()=>{}
}={}){
 let tail=Promise.resolve(),token=null,lastAccepted=null,lastThrottled=null;
 function register({stationId,isCurrent=()=>true,request}){
  const job=tail.catch(()=>null).then(async()=>{
   if(!isCurrent()||!stationId||typeof request!=='function')return null;
   for(let attempt=0;attempt<3;attempt++){
    const last=Math.max(lastAccepted??-Infinity,lastThrottled??-Infinity);
    if(Number.isFinite(last)){
     const remaining=last+STATION_TRANSITION_GAP_MS-now();
     if(remaining>0)await wait(remaining);
    }
    if(!isCurrent())return null;
    let response;
    try{response=await request({stationId,sessionToken:token});}
    catch{onFailure({status:0,reason:'network'});return null;}
    if(response?.ok&&response?.data&&
       String(response.data.stationId)===String(stationId)&&
       typeof response.data.sessionToken==='string'&&
       Number.isSafeInteger(response.data.count)&&response.data.count>=1&&
       typeof response.data.proof==='string'){
     token=response.data.sessionToken;
     lastAccepted=now();
     return isCurrent()?response.data:null;
    }
    const status=Number(response?.status)||0;
    const reason=String(response?.data?.error||'unavailable').slice(0,120);
    if(status===429&&attempt<2){
     lastThrottled=now();
     const retry=Number(response?.retryAfterMs);
     if(Number.isFinite(retry)&&retry>5000){onFailure({status,reason});return null;}
     await wait(Math.max(STATION_TRANSITION_RETRY_MS,
       Number.isFinite(retry)?retry:0));
     continue;
    }
    if(attempt<2&&
       ((status===409&&reason==='Listening session expired')||
        (status===403&&reason==='Invalid listening session'))){
     token=null;continue;
    }
    onFailure({status,reason});return null;
   }
   return null;
  });
  tail=job.then(()=>null,()=>null);
  return job;
 }
 return {register};
}
