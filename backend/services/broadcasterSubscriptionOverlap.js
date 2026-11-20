'use strict';
// B-PREM includes all three separately billable add-ons. An active/pending
// recurring contract for both would cause overlapping future monthly charges.
const ADDONS=Object.freeze(['ADD-DSP','ADD-AN','ADD-ADS']);
const BLOCKING=new Set(['pending','active','past_due','verification_pending']);
function isConflict(sku,otherSku,state){
 if(!BLOCKING.has(state))return false;
 if(sku==='B-PREM')return ADDONS.includes(otherSku);
 return ADDONS.includes(sku)&&otherSku==='B-PREM';
}
function candidateAddons(rows){
 const seen=new Set(),items=[];
 for(const row of rows||[]){
  if(!ADDONS.includes(row.sku)||!/^[a-f0-9]{24}$/i.test(String(row.resourceId||'')))continue;
  const key=row.sku+':'+String(row.resourceId);
  if(seen.has(key))continue;
  seen.add(key);
  items.push({sku:row.sku,stationId:String(row.resourceId)});
 }
 return items;
}
module.exports={ADDONS,isConflict,candidateAddons};
