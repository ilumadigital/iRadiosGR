'use strict';
const router=require('express').Router();
const mongoose=require('mongoose');
const Station=require('../models/Station');
const Playlist=require('../models/StationPlaylist');
const {protect}=require('../utils/authMiddleware');
const {THIRTY_MINUTES,MAX_HISTORY_TRACKS}=require('../utils/recordStationTrack');
router.get('/stations/:id/playlist', protect, async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Μη έγκυρος σταθμός.'});
  if(req.user.role==='user' && req.user.isVerified!==true){
    res.setHeader('Cache-Control','private, no-store');
    return res.status(403).json({code:'email_verification_required',error:'Επιβεβαίωσε το email σου για να δεις την playlist του σταθμού.'});
  }
  try {
    const station=await Station.findOne({_id:req.params.id,status:'approved'}).select('_id name logo').lean();
    if(!station) return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.'});
    const history=await Playlist.findOne({stationId:station._id}).select('tracks updatedAt').lean();
    res.setHeader('Cache-Control','private, no-store');
    // Read only real songs played within the rolling last 30 minutes.
    // The database is shared, so every signed-in listener sees the same history.
    const cutoff=Date.now()-THIRTY_MINUTES;
    const tracks=(history?.tracks||[]).filter(track=>{
      const time=new Date(track.playedAt).getTime();
      return Number.isFinite(time)&&time>=cutoff&&time<=Date.now();
    }).slice(0,MAX_HISTORY_TRACKS);
    res.json({station:{_id:station._id,name:station.name,logo:station.logo},tracks});
  } catch {
    res.status(503).json({error:'Το ιστορικό δεν είναι διαθέσιμο αυτή τη στιγμή.'});
  }
});
module.exports=router;
