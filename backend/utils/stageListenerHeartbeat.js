'use strict';
// Playback heartbeat retained for frontend compatibility. No longer drives any
// music identification, queue, scheduler or external paid service.
function heartbeat(req,res){
  const {stationId,sessionId,playing}=req.body||{};
  if(typeof stationId!=='string'||!/^[a-f0-9]{24}$/i.test(stationId)||
     typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/i.test(sessionId)||
     typeof playing!=='boolean')
    return res.status(400).json({error:'Μη έγκυρα στοιχεία ακρόασης.'});
  return res.status(204).end();
}
module.exports={heartbeat};
