'use strict';

// Every login/registration challenge MUST be validated with Cloudflare Siteverify.
// Never ship private keys to the client or bypass validation when configuration is missing.
const VERIFY_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TEST_KEY_PATTERN=/^[123]x00000000000000000000/;
const siteKey=()=>String(process.env.TURNSTILE_SITE_KEY||'').trim();
const secretKey=()=>String(process.env.TURNSTILE_SECRET_KEY||'').trim();

function isConfigured() {
  const site=siteKey(),secret=secretKey();
  return Boolean(site && secret && (
    process.env.APP_ENV!=='staging' ||
    (!TEST_KEY_PATTERN.test(site) && !TEST_KEY_PATTERN.test(secret))
  ));
}

async function verifyTurnstileToken(token,{action,ip}={}){
  if(!isConfigured())return {ok:false,status:503,code:'turnstile_not_configured',
    error:'Η επαλήθευση Cloudflare δεν έχει ρυθμιστεί στον διακομιστή. Δοκίμασε αργότερα.'};
  if(typeof token!=='string' || !token.trim() || token.length>2048)
    return {ok:false,status:400,code:'turnstile_missing',
      error:'Επιβεβαίωσε πρώτα τον έλεγχο Cloudflare και προσπάθησε ξανά.'};
  let expectedHost;
  try{expectedHost=new URL(process.env.FRONTEND_URL).hostname.toLowerCase();}
  catch{return {ok:false,status:503,code:'turnstile_origin_not_configured',
    error:'Η επαλήθευση Cloudflare δεν έχει ρυθμιστεί σωστά.'};}
  try{
    const body=new URLSearchParams({secret:secretKey(),response:token});
    if(typeof ip==='string' && /^[0-9a-f:.]+$/i.test(ip) && ip.length<64)
      body.set('remoteip',ip);
    const result=await fetch(VERIFY_URL,{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
      body,signal:AbortSignal.timeout(8000)
    });
    if(!result.ok)throw new Error('Siteverify HTTP '+result.status);
    const data=await result.json();
    if(data?.success!==true){
      console.warn('[TURNSTILE] Verification rejected:',JSON.stringify(data?.['error-codes']||[]).slice(0,150));
      return {ok:false,status:403,code:'turnstile_invalid',
        error:'Η επαλήθευση Cloudflare απέτυχε ή έληξε. Δοκίμασε ξανά.'};
    }
    if(String(data.hostname||'').toLowerCase()!==expectedHost ||
       (action && data.action!==action)){
      console.warn('[TURNSTILE] Hostname/action mismatch; refusing token.');
      return {ok:false,status:403,code:'turnstile_mismatch',
        error:'Η επαλήθευση Cloudflare δεν αντιστοιχεί στη σελίδα. Ανανέωσε και προσπάθησε ξανά.'};
    }
    return {ok:true};
  }catch(err){
    console.error('[TURNSTILE] Siteverify unavailable:',err.name||'error');
    return {ok:false,status:503,code:'turnstile_unavailable',
      error:'Η υπηρεσία Cloudflare δεν απαντά προσωρινά. Προσπάθησε ξανά.'};
  }
}

function requireTurnstile(action){
  return async(req,res,next)=>{
    const outcome=await verifyTurnstileToken(req.body?.cfToken,{
      action,ip:String(req.headers?.['x-real-ip']||req.socket?.remoteAddress||'')
    });
    if(!outcome.ok)return res.status(outcome.status).json({error:outcome.error,code:outcome.code});
    next();
  };
}

module.exports={isConfigured,siteKey,verifyTurnstileToken,requireTurnstile};
