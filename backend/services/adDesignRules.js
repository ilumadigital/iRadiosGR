'use strict';
// Server-side creative designer gate. Admin and Agency submit exactly the same
// constrained per-placement configuration; never store arbitrary CSS or HTML.
const LIMITS=Object.freeze({
  hero:{desktop:[220,460],mobile:[180,320]},
  home:{desktop:[140,300],mobile:[130,260]},
  station_profile:{desktop:[160,380],mobile:[150,280]},
  news_feed:{desktop:[180,360],mobile:[160,300]}
});
const LAYOUTS=new Set(['background','image-left','image-right','center']);
const EFFECTS=new Set(['clean','soft','glow','vignette','glass']);
const ALIGNS=new Set(['left','center','right']);
const KEYS=new Set(['heightMode','desktopHeight','mobileHeight','layout','visualWidth',
  'imageX','imageY','zoom','overlay','effect','overlayColor','secondaryColor',
  'textAlign','titleScale','glowIntensity']);
const FIELDS={
  heightMode:value=>['auto','custom'].includes(value),
  desktopHeight:(v,p)=>Number.isInteger(v)&&v>=LIMITS[p].desktop[0]&&v<=LIMITS[p].desktop[1],
  mobileHeight:(v,p)=>Number.isInteger(v)&&v>=LIMITS[p].mobile[0]&&v<=LIMITS[p].mobile[1],
  layout:v=>LAYOUTS.has(v),
  visualWidth:v=>Number.isInteger(v)&&v>=35&&v<=75,
  imageX:v=>Number.isInteger(v)&&v>=0&&v<=100,
  imageY:v=>Number.isInteger(v)&&v>=0&&v<=100,
  zoom:v=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=1.6,
  overlay:v=>Number.isInteger(v)&&v>=20&&v<=95,
  effect:v=>EFFECTS.has(v),
  overlayColor:v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v),
  secondaryColor:v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v),
  textAlign:v=>ALIGNS.has(v),
  titleScale:v=>Number.isInteger(v)&&v>=85&&v<=120,
  glowIntensity:v=>Number.isInteger(v)&&v>=0&&v<=70
};
function sanitizeAdDesign(input){
  if(input===null||typeof input!=='object'||Array.isArray(input))throw Error('Invalid design configuration');
  const result={};
  for(const [placement,settings] of Object.entries(input)){
    if(!Object.hasOwn(LIMITS,placement))throw Error('Unsupported banner design placement');
    if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Invalid design settings');
    const config={};
    for(const [key,value] of Object.entries(settings)){
      if(!KEYS.has(key)||!FIELDS[key](value,placement))throw Error('Unsafe or out-of-range design value: '+key);
      config[key]=value;
    }
    result[placement]=config;
  }
  return result;
}
module.exports={LIMITS,sanitizeAdDesign};
