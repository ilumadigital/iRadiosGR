'use strict';
// Short-lived top-level widget-preview authorization. The public iframe URL
// intentionally does not contain or require this capability.
const crypto=require('node:crypto');
const PREVIEW_TTL_MS=3*60*1000;
const PREVIEW_VARIANTS=new Set([
  'player-square','player-mini','program-square','program-mini','hero'
]);
const stationIdValid=value=>typeof value==='string'&&/^[0-9a-f]{24}$/i.test(value);
function validRequest(stationId,variant){
  return stationIdValid(stationId)&&PREVIEW_VARIANTS.has(variant);
}
function signature(encoded,secret){
  return crypto.createHmac('sha256',secret)
    .update('iradios.widget-preview.v1:'+encoded).digest();
}
function mintWidgetPreviewToken({stationId,variant,secret=process.env.JWT_SECRET,now=Date.now()}={}){
  if(!validRequest(stationId,variant)||typeof secret!=='string'||secret.length<24||
     !Number.isFinite(now))throw new Error('Widget preview signing unavailable');
  const payload=Buffer.from(JSON.stringify({
    sid:stationId.toLowerCase(),variant,
    exp:now+PREVIEW_TTL_MS,nonce:crypto.randomBytes(12).toString('hex')
  })).toString('base64url');
  return payload+'.'+signature(payload,secret).toString('base64url');
}
function verifyWidgetPreviewToken({token,stationId,variant,secret=process.env.JWT_SECRET,now=Date.now()}={}){
  if(!validRequest(stationId,variant)||typeof secret!=='string'||secret.length<24||
    typeof token!=='string'||token.length>1200||token.length<80||
    !Number.isFinite(now))return false;
  const parts=token.split('.');
  if(parts.length!==2||!/^[a-zA-Z0-9_-]+$/.test(parts[0])||
    !/^[a-zA-Z0-9_-]+$/.test(parts[1]))return false;
  try{
    const supplied=Buffer.from(parts[1],'base64url');
    const expected=signature(parts[0],secret);
    if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))
      return false;
    const value=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    return value?.sid===stationId.toLowerCase()&&value.variant===variant&&
      Number.isFinite(value.exp)&&value.exp>now&&
      value.exp<=now+PREVIEW_TTL_MS&&/^[0-9a-f]{24}$/.test(value.nonce);
  }catch{return false;}
}
module.exports={PREVIEW_TTL_MS,PREVIEW_VARIANTS,validRequest,
  mintWidgetPreviewToken,verifyWidgetPreviewToken};
