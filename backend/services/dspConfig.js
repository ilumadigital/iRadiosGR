'use strict';

// WebDSP settings are station-scoped. The master peak ceiling is fixed and
// deliberately not writable by clients.
const DSP_PRESETS=Object.freeze(['OFF','SOFT','NORMALIZE','ULTRABAND','ULTRA','OMNIA','0DB_LEVELER']);
const DSP_DEFAULTS=Object.freeze({bass:0,mid:0,treble:0,output:0,stereoWidth:100});
const DSP_RANGES=Object.freeze({
  bass:[-12,12],mid:[-12,12],treble:[-12,12],
  output:[-12,3],stereoWidth:[0,150]
});
const PEAK_CEILING_DBFS=-0.5;
function validateDSPUpdate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))
    return {error:'Μη έγκυρο DSP payload.'};
  const keys=Object.keys(body);
  if(!keys.length||keys.some(key=>!['dspPreset','dspSettings'].includes(key)))
    return {error:'Μη έγκυρα πεδία DSP.'};
  const value={};
  if(Object.hasOwn(body,'dspPreset')){
    if(typeof body.dspPreset!=='string'||!DSP_PRESETS.includes(body.dspPreset))
      return {error:'Μη έγκυρο DSP preset.'};
    value.dspPreset=body.dspPreset;
  }
  if(Object.hasOwn(body,'dspSettings')){
    const settings=body.dspSettings;
    if(!settings||typeof settings!=='object'||Array.isArray(settings)||
       Object.keys(settings).length!==Object.keys(DSP_RANGES).length||
       Object.keys(settings).some(key=>!Object.hasOwn(DSP_RANGES,key)))
      return {error:'Μη έγκυρες ρυθμίσεις DSP.'};
    const normalized={};
    for(const [key,[min,max]] of Object.entries(DSP_RANGES)){
      const n=settings[key];
      if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)
        return {error:'Μη έγκυρη τιμή DSP: '+key};
      normalized[key]=n;
    }
    value.dspSettings=normalized;
  }
  return {value};
}
module.exports={DSP_PRESETS,DSP_DEFAULTS,DSP_RANGES,PEAK_CEILING_DBFS,validateDSPUpdate};
