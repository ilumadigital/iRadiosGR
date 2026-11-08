'use strict';
// Keep the follow identity stable when program time or artwork changes.
const normalize=value=>String(value||'').trim().toLocaleLowerCase('el-GR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/ς/g,'σ')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function followKey(kind,stationId,label){
  const normalized=normalize(label);
  if(!normalized || normalized.length>150) return null;
  if(kind==='show')return 'show:'+String(stationId)+':'+normalized;
  if(kind==='dj')return 'dj:'+normalized;
  return null;
}
module.exports={normalize,followKey};
