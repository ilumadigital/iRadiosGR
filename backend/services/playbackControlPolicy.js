'use strict';
// Pure playback state machine; none of these actions changes device ownership.
const STATES=new Set(['pending','playing','paused']);
const ACTIONS=new Set(['pause','resume','station']);
function nextPlaybackState(state,action){
  if(!STATES.has(state)||!ACTIONS.has(action))
    throw new TypeError('Invalid playback transition');
  if(action==='pause')return 'paused';
  if(action==='station')return 'pending';
  return state==='playing'?'playing':'pending';
}
module.exports={nextPlaybackState};
