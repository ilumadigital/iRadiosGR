'use strict';
const crypto=require('crypto');
const secret=()=>process.env.JWT_SECRET || '';
const validId=id=>/^[a-f0-9]{24}$/i.test(String(id||''));
function signature(id,email){
  if(!secret()||!validId(id))return '';
  return crypto.createHmac('sha256',secret()).update('iradios-unsubscribe-v1:'+id+':'+String(email||'').toLowerCase()).digest('hex');
}
function tokenFor(user){
  const id=String(user?._id||'');
  const sig=signature(id,user?.email);
  return sig?id+'.'+sig:'';
}
function verifyToken(token,email){
  const parts=String(token||'').split('.');
  if(parts.length!==2||!validId(parts[0])||!/^[a-f0-9]{64}$/i.test(parts[1]))return null;
  const expected=signature(parts[0],email);
  if(!expected)return null;
  return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(parts[1],'hex'))?parts[0]:null;
}
module.exports={tokenFor,verifyToken};
