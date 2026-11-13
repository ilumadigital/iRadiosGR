'use strict';
// The canonical billed balance is nano-EUR. Existing micros-only lots are
// readable but NOT eligible for new atomic settlement until reviewed/backfilled.
function fromLot(lot){
 const funded=lot.budgetNanos===undefined||lot.budgetNanos===null?
  Number(lot.budgetMicros)*1000:lot.budgetNanos;
 const remaining=lot.remainingNanos===undefined||lot.remainingNanos===null?
  Number(lot.remainingMicros)*1000:lot.remainingNanos;
 if(!Number.isSafeInteger(funded)||!Number.isSafeInteger(remaining)||
    funded<0||remaining<0||remaining>funded)
  throw Error('Invalid advertising funding-lot balance');
 return {fundedNanos:funded,remainingNanos:remaining};
}
function aggregateBalances(lots){
 let funded=0n,remaining=0n;
 for(const lot of lots){
  const row=fromLot(lot);
  funded+=BigInt(row.fundedNanos);
  remaining+=BigInt(row.remainingNanos);
 }
 if(funded>BigInt(Number.MAX_SAFE_INTEGER)||
    remaining>BigInt(Number.MAX_SAFE_INTEGER))
  throw Error('Advertising balance exceeds safe JSON precision');
 const fundedNanos=Number(funded),remainingNanos=Number(remaining);
 return {fundedNanos,remainingNanos,spentNanos:fundedNanos-remainingNanos,
  fundedMicros:Math.floor(fundedNanos/1000),
  remainingMicros:Math.floor(remainingNanos/1000),
  spentMicros:Math.floor((fundedNanos-remainingNanos)/1000)};
}
module.exports={fromLot,aggregateBalances};
