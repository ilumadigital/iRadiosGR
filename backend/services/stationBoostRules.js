'use strict';

// The legacy Admin switch is a *separate*, time-limited, non-billing placement.
// Never infer a purchased entitlement from boostStatus, and never edit paid orders.
// Manual boosts use global/category-affinity placement; paid scope always wins.
function effectiveStationBoost(billingBoost,station,now=new Date()){
  const current=now instanceof Date?now.getTime():new Date(now).getTime();
  const expiry=new Date(station?.boostExpiresAt).getTime();
  const manualActive=station?.boostStatus===true&&Number.isFinite(expiry)&&
    expiry>current;
  const manualEndsAt=manualActive?new Date(expiry).toISOString():null;
  const paid=billingBoost||{tier:'organic',placement:null,endsAt:null,priority:0};
  const manual={manualActive,manualEndsAt};
  if(paid.tier==='purchased')return {...paid,...manual};
  if(manualActive)return {...paid,...manual,tier:'manual',
    placement:'global',endsAt:manualEndsAt,priority:0};
  return {...paid,...manual};
}

module.exports={effectiveStationBoost};
