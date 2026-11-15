// Frontend convenience check; the API always re-probes the uploaded bytes.
export const MAX_AUDIO_SPOT_SECONDS=46;
export const AUDIO_SPOT_TOO_LONG_MESSAGE=
  'Το Audio Spot υπερβαίνει τη μέγιστη επιτρεπόμενη διάρκεια των 46 δευτερολέπτων. Παρακαλούμε ανεβάστε νέο αρχείο μικρότερης διάρκειας.';

export function assertAudioSpotDuration(file){
  if(!file)return Promise.reject(new Error('Επίλεξε αρχείο Audio Spot.'));
  const src=URL.createObjectURL(file);
  return new Promise((resolve,reject)=>{
    const media=document.createElement('audio');
    let complete=false;
    const finish=(error,duration)=>{
      if(complete)return;
      complete=true;
      clearTimeout(timer);
      media.onloadedmetadata=null;
      media.onerror=null;
      media.removeAttribute('src');
      URL.revokeObjectURL(src);
      if(error)reject(error);else resolve(duration);
    };
    const timer=setTimeout(()=>finish(
      new Error('Δεν ήταν δυνατός ο έλεγχος διάρκειας του Audio Spot.')),10000);
    media.preload='metadata';
    media.onloadedmetadata=()=>{
      const duration=media.duration;
      if(!Number.isFinite(duration)||duration<0.5)
        return finish(new Error('Μη έγκυρη διάρκεια Audio Spot.'));
      if(duration>MAX_AUDIO_SPOT_SECONDS)
        return finish(new Error(AUDIO_SPOT_TOO_LONG_MESSAGE));
      return finish(null,duration);
    };
    media.onerror=()=>finish(new Error('Το αρχείο Audio Spot δεν αναγνωρίζεται.'));
    media.src=src;
  });
}
