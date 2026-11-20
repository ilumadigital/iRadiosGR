'use strict';
const Station=require('../models/Station');
const StationAnalytics=require('../models/StationAnalytics');
const Ad=require('../models/Ad');
const {hasStationRight}=require('../services/billingEntitlements');
const {projectListening,validPeriod,adTotals}=require('../services/analyticsMetrics');

exports.getBroadcasterAnalytics=async(req,res)=>{
  try{
    if(!req.user)return res.status(401).json({error:'Χρειάζεται σύνδεση.'});
    const admin=req.user.role==='admin';
    if(!admin&&(req.user.role!=='broadcaster'||
        String(req.user._id)!==String(req.params.userId)))
      return res.status(403).json({error:'Forbidden'});

    const requestedPeriod=req.query?.period||'all';
    if(validPeriod(requestedPeriod)!==requestedPeriod)
      return res.status(400).json({error:'Μη έγκυρο χρονικό διάστημα.'});
    const stations=await Station.find({
      broadcasterId:req.params.userId,status:'approved'
    }).select('_id name plays broadcasterId');
    const eligible=[];
    for(const station of stations){
      if(await hasStationRight(req.user,station,'broadcaster.analytics'))eligible.push(station);
    }
    if(!eligible.length&&!admin)
      return res.status(403).json({error:'Δεν υπάρχει ενεργό Analytics για τους σταθμούς σας.'});
    const requestedStation=req.query?.stationId;
    if(requestedStation&&
       !eligible.some(station=>String(station._id)===String(requestedStation)))
      return res.status(403).json({error:'Δεν υπάρχει ενεργό Analytics για αυτόν τον σταθμό.'});
    const selected=requestedStation?
      eligible.filter(station=>String(station._id)===String(requestedStation)):eligible;
    const stationIds=selected.map(station=>String(station._id));
    const [stats,ads]=await Promise.all([
      stationIds.length?
        StationAnalytics.find({stationId:{$in:stationIds}}):[],
      stationIds.length?
        Ad.find({broadcasterId:req.params.userId,stationId:{$in:stationIds}}):[]
    ]);
    const listening=projectListening(stats,requestedPeriod);
    const socketSessions=req.app.get('socketSessions')||{};
    const activeListeners=req.app.get('activeListeners')||{};
    const tracker=req.app.get('stageListenerTracker');
    let liveListeners=tracker?tracker.liveCount(stationIds):0;
    const liveCities=new Map();
    if(!tracker){
      const distinctSockets=new Set();
      for(const id of stationIds){
        for(const socketId of activeListeners[id]||[]){
          if(distinctSockets.has(socketId))continue;
          distinctSockets.add(socketId);
          const city=socketSessions[socketId]?.location?.city;
          if(typeof city==='string'&&city.trim()&&city!=='Unknown')
            liveCities.set(city,(liveCities.get(city)||0)+1);
        }
      }
      liveListeners=distinctSockets.size;
    }
    const located=[...liveCities.values()].reduce((a,b)=>a+b,0);
    const liveLocations=[...liveCities].sort((a,b)=>b[1]-a[1])
      .map(([city,count])=>({city,percentage:Math.round(100*count/located)}));
    const totalPlays=requestedPeriod==='all'?
      selected.reduce((sum,station)=>sum+(Number(station.plays)||0),0):
      listening.totalSessions;
    return res.json({
      liveListeners,avgListenTime:listening.avgListenTime,
      totalSessions:listening.totalSessions,
      totalListenTime:listening.totalListenTime,totalPlays,
      topOrigins:listening.topOrigins,liveLocations,adStats:adTotals(ads),
      // Ad model contains lifetime counters only; never imply the period
      // selector applies to advertising or legacy geographic data.
      adStatsPeriod:'all',geoPeriod:'all',period:requestedPeriod,timeZone:'UTC',
      measurement:'browser-playback-estimate',
      stations:eligible.map(station=>({id:String(station._id),name:station.name})),
      selectedStationId:requestedStation||null
    });
  }catch(error){
    console.error('Broadcaster analytics failed',error);
    return res.status(500).json({error:'Σφάλμα φόρτωσης Analytics.'});
  }
};
