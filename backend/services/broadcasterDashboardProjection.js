'use strict';

// This projection is the only source of premium values for the Broadcaster
// landing page. Unlicensed stations never contribute plays or expose DSP modes.
function projectBroadcasterDashboard(stations=[],rightsForStation=()=>new Set()){
 const projected=stations.map(station=>{
  const stationId=String(station._id);
  const rights=rightsForStation(station);
  const webdsp=rights.has('broadcaster.webdsp');
  const radar=rights.has('broadcaster.analytics');
  return {
   id:stationId,name:station.name,status:station.status,stream:station.stream,
   ...(webdsp?{dspMode:station.dspPreset||'AUTO_MODE'}:{}),
   ...(radar?{appPlays:Math.max(0,Number(station.plays)||0)}:{})
  };
 });
 const dspStation=projected.find(station=>station.status==='approved'&&station.dspMode!==undefined)
  ||projected.find(station=>station.dspMode!==undefined);
 const radarStations=projected.filter(station=>station.appPlays!==undefined);
 return {
  stations:projected.map(({id,name,status,stream})=>({id,name,status,stream})),
  dsp:dspStation?{enabled:true,stationId:dspStation.id,
   stationName:dspStation.name,mode:dspStation.dspMode}:{enabled:false},
  appPlays:radarStations.length?{
   enabled:true,total:radarStations.reduce((sum,station)=>sum+station.appPlays,0),
   stationCount:radarStations.length
  }:{enabled:false}
 };
}
module.exports={projectBroadcasterDashboard};
