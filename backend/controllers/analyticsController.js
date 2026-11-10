const Station = require('../models/Station');
const User = require('../models/User');
const {hasStationRight}=require('../services/billingEntitlements');
const StationAnalytics = require('../models/StationAnalytics');
const Ad = require('../models/Ad');

exports.getBroadcasterAnalytics = async (req, res) => {
  try {
    // Entitlements for add-ons are station-scoped. A broadcaster may only
    // inspect analytics for stations they own and currently have access to.
    if(!req.user)return res.status(401).json({error:'Χρειάζεται σύνδεση.'});
    const isAdmin=req.user.role==='admin';
    if(!isAdmin && (req.user.role!=='broadcaster' ||
      String(req.user._id)!==String(req.params.userId)))
      return res.status(403).json({error:'Forbidden'});
    const stations=await Station.find({broadcasterId:req.params.userId});
    const eligible=[];
    for(const station of stations){
      if(await hasStationRight(req.user,station,'broadcaster.analytics'))
        eligible.push(station);
    }
    if(!eligible.length && !isAdmin)
      return res.status(403).json({error:'Δεν υπάρχει ενεργό Analytics για τους σταθμούς σας.'});
    const stationIds=eligible.map(s=>s._id.toString());

    // 🚀 LIVE MEMORY STATE
    const activeListeners = req.app.get('activeListeners') || {};
    const socketSessions = req.app.get('socketSessions') || {};

    let liveListeners = 0;
    let totalTime = 0;
    let totalSessions = 0;
    
    const liveLocationMap = {}; // 🟢 Για το Live Box
    let totalLiveWithLocation = 0;
    
    const historicalLocationMap = {}; // 🟣 Για το Top Origins (Ιστορικό)

    for (let sid of stationIds) {
      
      // 1. LIVE ΔΕΔΟΜΕΝΑ
      if (activeListeners[sid]) {
        liveListeners += activeListeners[sid].size;
        activeListeners[sid].forEach(socketId => {
          const session = socketSessions[socketId];
          if (session && session.location && session.location.city && session.location.city !== 'Unknown') {
            const city = session.location.city;
            liveLocationMap[city] = (liveLocationMap[city] || 0) + 1;
            totalLiveWithLocation++;
          }
        });
      }
      
      // 2. ΙΣΤΟΡΙΚΑ ΔΕΔΟΜΕΝΑ (Από τη βάση)
      const stat = await StationAnalytics.findOne({ stationId: sid });
      if (stat) {
        totalTime += stat.totalListenTime || 0;
        totalSessions += stat.totalSessions || 0;
        if (stat.locations) {
          for (const [key, val] of Object.entries(stat.locations)) {
            // Το key είναι "City_Country", π.χ. "Athens_GR"
            const city = key.split('_')[0];
            historicalLocationMap[city] = (historicalLocationMap[city] || 0) + val;
          }
        }
      }
    }

    // Υπολογισμός Avg Listen Time
    const avgListenTimeSecs = totalSessions > 0 ? Math.floor(totalTime / totalSessions) : 0;
    const mins = Math.floor(avgListenTimeSecs / 60);
    const secs = avgListenTimeSecs % 60;
    const avgListenTime = `${mins}m ${secs}s`;

    // 🟣 ΙΣΤΟΡΙΚΑ (Top Origins)
    const totalHistoricalLocs = Object.values(historicalLocationMap).reduce((sum, val) => sum + val, 0);
    const topOrigins = Object.entries(historicalLocationMap)
      .map(([city, count]) => ({
        city,
        percentage: totalHistoricalLocs > 0 ? Math.round((count / totalHistoricalLocs) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // 🟢 LIVE (Live Locations)
    const liveLocations = Object.entries(liveLocationMap)
      .map(([city, count]) => ({
        city,
        percentage: totalLiveWithLocation > 0 ? Math.round((count / totalLiveWithLocation) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);
    
    // Advertising statistics
    const ads = await Ad.find({ broadcasterId: req.params.userId, stationId: { $in: stationIds } });
    let totalImpressions = 0;
    let topAdName = "N/A";
    let maxImp = -1;
    ads.forEach(ad => {
      totalImpressions += (ad.impressions || 0);
      if ((ad.impressions || 0) > maxImp) {
        maxImp = ad.impressions;
        topAdName = ad.title;
      }
    });

    res.json({
      liveListeners,
      avgListenTime,
      topOrigins,     // 🟣 Πάνε στο Top Origins (Όλα τα ιστορικά)
      liveLocations,  // 🟢 Πάνε στο Live box
      adStats: { totalImpressions, topAd: totalImpressions > 0 ? topAdName : "No Data" }
    });

  } catch (err) { res.status(500).json({ error: err.message }); }
};
