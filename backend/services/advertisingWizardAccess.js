'use strict';
// Keep staging draft workflows available; production checkout and Admin
// approval workflows require the independently approved financial delivery.
function wizardEnabled(env=process.env, paidDeliveryReady=null){
 if(env.APP_ENV==='staging')return true;
 if(env.APP_ENV!=='production'||
    env.IRADIOS_PRODUCTION_CUTOVER_APPROVED!=='1'||
    env.IRADIOS_BILLING_ENABLED!=='1'||
    env.ADVERTISING_V2_PRODUCTION_APPROVED!=='1'||
    env.ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED!=='1')return false;
 const ready=paidDeliveryReady||(()=>require('./advertisingV2Ledger').enabled());
 return ready()===true;
}
module.exports={wizardEnabled};
