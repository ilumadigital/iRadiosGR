'use strict';
// Only a bounded, anonymous, user-initiated radio playback session is counted.
// Never send station streams or location to third-party services.
async function heartbeat(req,res){
  const tracker=req.app.get('stageListenerTracker');
  if(!tracker)return res.status(503).json({error:'Listening metrics unavailable'});
  try{
    const status=await tracker.report(req.body||{});
    if(status===204)return res.status(204).end();
    const message=status===400?'Μη έγκυρα στοιχεία ακρόασης.':
      status===404?'Μη διαθέσιμος σταθμός.':
      status===429?'Too many concurrent sessions.':'Session identifier conflict.';
    return res.status(status).json({error:message});
  }catch(error){
    console.error('[LISTENING] Unable to persist playback heartbeat',error);
    return res.status(503).json({error:'Listening metrics temporarily unavailable'});
  }
}
module.exports={heartbeat};
