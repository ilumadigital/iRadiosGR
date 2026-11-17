'use strict';
// An upstream outage is a payment-service failure, not an application/network
// outage. Never infer that a timed-out POST did not charge a card.
function gatewayRoute(handler){
 return (req,res,next)=>Promise.resolve().then(()=>handler(req,res,next)).catch(error=>{
  const code=String(error?.code||'');
  if(!/^GATEWAY_(?:HTTP_[1-5][0-9]{2}|UNAVAILABLE|NETWORK_ERROR|TIMEOUT|BAD_RESPONSE)$/.test(code))
   return next(error);
  if(res.headersSent)return next(error);
  return res.status(503).json({
   code:'PAYMENT_SERVICE_UNAVAILABLE',
   error:'Η υπηρεσία πληρωμών δεν είναι διαθέσιμη αυτή τη στιγμή. Αν έχεις ήδη ξεκινήσει πληρωμή, έλεγξε την υπάρχουσα συναλλαγή πριν από νέα προσπάθεια.'
  });
 });
}
module.exports={gatewayRoute};
