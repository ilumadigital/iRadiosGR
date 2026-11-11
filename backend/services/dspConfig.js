'use strict';
// DSP is station-scoped. Headroom compensation is computed transparently by
// the shared WebAudio engine, NOT persisted as a forced master limiter.
// The station's single DSP selection is now a MODE, not an audio preset.
// Existing legacy values are still readable in Mongo and treated as FM_MODE
// by the frontend until an Admin/Broadcaster explicitly saves the new mode.
const DSP_PRESETS=Object.freeze(['OFF','ENHANCER','FM_MODE','AUTO_MODE']);
const DSP_DEFAULTS=Object.freeze({bass:0,mid:0,treble:0,output:0,stereoWidth:100});
const DSP_RANGES=Object.freeze({
  bass:[-12,12],mid:[-12,12],treble:[-12,12],output:[-7,7],stereoWidth:[0,150]
});
// Booster intensity is 0–8, backed by the legacy dspClipper field.
// Peak Headroom is permanently ON at -0.5 dBFS in both active DSP modes.
const DSP_CLIPPER_DEFAULTS=Object.freeze({
  ENHANCER:Object.freeze({headroomEnabled:true,level:0}),
  FM_MODE:Object.freeze({headroomEnabled:true,level:0})
});
const DSP_COMPRESSOR_DEFAULTS=Object.freeze({
  mode:'preset',threshold:-18,ratio:2.1,attack:.045,release:.34,makeup:0
});
const DSP_COMPRESSOR_RANGES=Object.freeze({
  threshold:[-42,0],ratio:[1,8],attack:[.003,.2],release:[.08,1.2],makeup:[-6,6]
});
function validateDSPUpdate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))
    return {error:'Μη έγκυρο DSP payload.'};
  const keys=Object.keys(body);
  if(!keys.length||keys.some(key=>!['dspPreset','dspSettings','dspCompressor','dspClipper','dspAutoBalance'].includes(key)))
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
  if(Object.hasOwn(body,'dspCompressor')){
    const compressor=body.dspCompressor;
    if(!compressor||typeof compressor!=='object'||Array.isArray(compressor)||
       Object.keys(compressor).length!==Object.keys(DSP_COMPRESSOR_DEFAULTS).length||
       Object.keys(compressor).some(key=>!Object.hasOwn(DSP_COMPRESSOR_DEFAULTS,key))||
       !['preset','manual','off'].includes(compressor.mode))
      return {error:'Μη έγκυρες ρυθμίσεις Compressor.'};
    const normalized={mode:compressor.mode};
    for(const [key,[min,max]] of Object.entries(DSP_COMPRESSOR_RANGES)){
      const n=compressor[key];
      if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)
        return {error:'Μη έγκυρη τιμή Compressor: '+key};
      normalized[key]=n;
    }
    value.dspCompressor=normalized;
  }
  if(Object.hasOwn(body,'dspAutoBalance')){
    if(!Number.isInteger(body.dspAutoBalance)||body.dspAutoBalance< -100||body.dspAutoBalance>100)
      return {error:'Μη έγκυρη ρύθμιση Auto Mode: επιτρέπονται ακέραιοι -100 έως +100.'};
    value.dspAutoBalance=body.dspAutoBalance;
  }
  if(Object.hasOwn(body,'dspClipper')){
    const modes=body.dspClipper;
    if(!modes||typeof modes!=='object'||Array.isArray(modes)||
      Object.keys(modes).length!==2||
      Object.keys(modes).some(mode=>!Object.hasOwn(DSP_CLIPPER_DEFAULTS,mode)))
      return {error:'Μη έγκυρες ρυθμίσεις Booster.'};
    const normalized={};
    for(const mode of Object.keys(DSP_CLIPPER_DEFAULTS)){
      const item=modes[mode];
      if(!item||typeof item!=='object'||Array.isArray(item)||
        Object.keys(item).length!==2||
        !Object.hasOwn(item,'headroomEnabled')||!Object.hasOwn(item,'level')||
        typeof item.headroomEnabled!=='boolean'||
        !Number.isInteger(item.level)||item.level<0||item.level>8)
        return {error:'Μη έγκυρη ρύθμιση Booster: '+mode};
      // The historic flag must never disable final peak protection.
      // Accept old client payloads but normalize all writes to always ON.
      normalized[mode]={headroomEnabled:true,level:item.level};
    }
    value.dspClipper=normalized;
  }
  return {value};
}
module.exports={DSP_PRESETS,DSP_DEFAULTS,DSP_RANGES,DSP_COMPRESSOR_DEFAULTS,
  DSP_COMPRESSOR_RANGES,DSP_CLIPPER_DEFAULTS,validateDSPUpdate};
