'use strict';

// Pure projections shared by the API and regression tests. Daily buckets begin
// when Phase D tracking is deployed: never synthesize older daily statistics.
const PERIODS=Object.freeze({all:0,'7d':7,'30d':30,'90d':90});
function validPeriod(period){return Object.hasOwn(PERIODS,period)?period:'all';}
function dailyData(stat){
  const daily=stat?.daily||{};
  return daily instanceof Map?Object.fromEntries(daily):daily;
}
function projectListening(stats,period='all',now=new Date()){
  const selected=validPeriod(period);
  const dayLimit=PERIODS[selected];
  const threshold=dayLimit?new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(dayLimit-1)))
    .toISOString().slice(0,10):null;
  let totalSeconds=0,totalSessions=0;
  const origins=new Map();
  for(const stat of stats){
    if(!stat)continue;
    if(!threshold){
      totalSeconds+=Number(stat.totalListenTime)||0;
      totalSessions+=Number(stat.totalSessions)||0;
    }else{
      for(const [day,entry] of Object.entries(dailyData(stat))){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<threshold||
           day>now.toISOString().slice(0,10))continue;
        totalSeconds+=Number(entry?.listenSeconds)||0;
        totalSessions+=Number(entry?.sessions)||0;
      }
    }
    // Historical location counts are lifetime-only; never label these as
    // period-scoped measurements when no daily location series exists.
    if(!threshold){
      const locs=stat.locations instanceof Map?Object.fromEntries(stat.locations):stat.locations||{};
      for(const [key,count] of Object.entries(locs)){
        const city=key.split('_')[0].trim();
        const n=Number(count);
        if(city&&city!=='Unknown'&&Number.isFinite(n)&&n>0)
          origins.set(city,(origins.get(city)||0)+n);
      }
    }
  }
  const sum=[...origins.values()].reduce((a,b)=>a+b,0);
  return {
    totalListenTime:totalSeconds,totalSessions,
    avgListenTime:totalSessions?formatDuration(Math.floor(totalSeconds/totalSessions)):'0m 0s',
    topOrigins:[...origins].sort((a,b)=>b[1]-a[1]).map(([city,count])=>({
      city,count,percentage:Math.round(count*100/sum)
    }))
  };
}
function formatDuration(seconds){
  const safe=Math.max(0,Number(seconds)||0);
  return Math.floor(safe/60)+'m '+Math.floor(safe%60)+'s';
}
function adTotals(ads){
  const plays=ads.reduce((sum,ad)=>sum+(Number(ad.plays)||0),0);
  const clicks=ads.reduce((sum,ad)=>sum+(Number(ad.clicks)||0),0);
  const top=[...ads].sort((a,b)=>(Number(b.plays)||0)-(Number(a.plays)||0))[0];
  return {totalPlays:plays,totalClicks:clicks,
    totalImpressions:plays, // legacy client compatibility (audio starts, not views)
    topAd:plays>0?(top?.title||'Χωρίς τίτλο'):'No Data'};
}
module.exports={projectListening,validPeriod,formatDuration,adTotals};
