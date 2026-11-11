'use strict';

// Combine legacy transactions with paid, signed Gateway order records.
// Deduplicate by provider transaction/order ID; never count pending checkouts,
// admin grants or subscription entitlements as new payments.
function summarizePayments(transactions=[],listenerOrders=[],broadcasterOrders=[]){
  const seen=new Set(),monthly=new Map();
  let totalCents=0,payments=0,pendingInvoices=0;
  const rows=[
    ...listenerOrders.map(order=>({source:'order',record:order})),
    ...broadcasterOrders.map(order=>({source:'order',record:order})),
    ...transactions.map(tx=>({source:'legacy',record:tx}))
  ];
  for(const {source,record:r} of rows){
    if(source==='order'&&r.status!=='paid')continue;
    if(source==='legacy'&&r.status!=='completed')continue;
    const currency=String(r.currency||'EUR').toUpperCase();
    if(currency!=='EUR')continue;
    const amount=source==='order'?Number(r.amountCents):Math.round(Number(r.amount)*100);
    if(!Number.isSafeInteger(amount)||amount<=0)continue;
    const timestamp=source==='order'?(r.paidAt||r.createdAt):r.createdAt;
    const date=new Date(timestamp);
    if(!Number.isFinite(date.getTime()))continue;
    const providerId=r.gatewayPaymentId||r.externalPaymentId||
      r.gatewayOrderId||r.externalOrderId;
    const id=providerId?'provider:'+String(providerId):
      source+':'+String(r._id||r.requestKey||'');
    if(id==='legacy:'||id==='order:'||seen.has(id))continue;
    seen.add(id);
    const month=date.toISOString().slice(0,7);
    monthly.set(month,(monthly.get(month)||0)+amount);
    totalCents+=amount;
    payments++;
    if(source==='legacy'&&!r.invoiceSent)pendingInvoices++;
  }
  const revenueData=[...monthly].sort(([a],[b])=>a.localeCompare(b))
    .map(([month,cents])=>({name:Number(month.slice(5))+'/'+month.slice(0,4),
      amount:cents/100}));
  return {revenue:totalCents/100,payments,pendingInvoices,revenueData};
}
function adDashboardStats(audioPlays,audioClicks,bannerViews,bannerClicks){
  const safe=v=>Math.max(0,Number(v)||0);
  const plays=safe(audioPlays),clicks=safe(audioClicks);
  const views=safe(bannerViews),bannerClickCount=safe(bannerClicks);
  return {
    audio:{plays,clicks,ctr:plays?100*clicks/plays:0},
    banner:{views,clicks:bannerClickCount,ctr:views?100*bannerClickCount/views:0}
  };
}
module.exports={summarizePayments,adDashboardStats};
