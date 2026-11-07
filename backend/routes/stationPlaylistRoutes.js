'use strict';
const router=require('express').Router();
const mongoose=require('mongoose');
const Station=require('../models/Station');
const Playlist=require('../models/StationPlaylist');
const {protect}=require('../utils/authMiddleware');
router.get('/stations/:id/playlist', protect, async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Μη έγκυρος σταθμός.'});
  try {
    const station=await Station.findOne({_id:req.params.id,status:'approved'}).select('_id name logo').lean();
    if(!station) return res.status(404).json({error:'Ο σταθμός δεν βρέθηκε.'});
    const history=await Playlist.findOne({stationId:station._id}).select('tracks updatedAt').lean();
    res.setHeader('Cache-Control','private, no-store');
    // No embedded cover files: UI resolves remote cover URLs as needed.
    res.json({station:{_id:station._id,name:station.name,logo:station.logo},tracks:(history?.tracks||[]).slice(0,12)});
  } catch {
    res.status(503).json({error:'Το ιστορικό δεν είναι διαθέσιμο αυτή τη στιγμή.'});
  }
});
module.exports=router;
