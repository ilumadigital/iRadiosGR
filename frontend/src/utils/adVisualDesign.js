/** Shared safe visual presets for the interactive studio and public banner.
 * Catalog cards keep their exact existing geometry and never accept heights.
 */
export const AD_DESIGN_LIMITS={
  hero:{desktop:[220,460],mobile:[180,320],defaultDesktop:300,defaultMobile:230},
  home:{desktop:[140,300],mobile:[130,260],defaultDesktop:190,defaultMobile:175},
  station_profile:{desktop:[160,380],mobile:[150,280],defaultDesktop:210,defaultMobile:180},
  news_feed:{desktop:[180,360],mobile:[160,300],defaultDesktop:320,defaultMobile:260}
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const defaultAdDesign=placement=>({
  heightMode:'auto',
  desktopHeight:AD_DESIGN_LIMITS[placement]?.defaultDesktop||190,
  mobileHeight:AD_DESIGN_LIMITS[placement]?.defaultMobile||175,
  layout:'background',visualWidth:55,
  imageX:50,imageY:50,zoom:1,overlay:72,effect:'clean',
  overlayColor:'#170e25',secondaryColor:'#27133d',
  textAlign:'left',titleScale:100,glowIntensity:30
});
export function adDesignFor(banner,placement){
  const id=placement==='strip'?'home':placement==='profile'?'station_profile':
    placement==='news'?'news_feed':placement;
  const base=defaultAdDesign(id);
  const custom=banner?.designConfig?.[id];
  const settings=custom&&typeof custom==='object'&&!Array.isArray(custom)?custom:{};
  const limits=AD_DESIGN_LIMITS[id]||AD_DESIGN_LIMITS.home;
  const pixel=(value,range,fallback)=>Number.isFinite(Number(value))?
    clamp(Math.round(Number(value)),range[0],range[1]):fallback;
  const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback;
  const allowed=(value,values,fallback)=>values.includes(value)?value:fallback;
  return {...base,
    heightMode:allowed(settings.heightMode,['auto','custom'],'auto'),
    desktopHeight:pixel(settings.desktopHeight,limits.desktop,base.desktopHeight),
    mobileHeight:pixel(settings.mobileHeight,limits.mobile,base.mobileHeight),
    layout:allowed(settings.layout,['background','image-left','image-right','center'],'background'),
    visualWidth:pixel(settings.visualWidth,[35,75],base.visualWidth),
    imageX:pixel(settings.imageX,[0,100],Number(banner?.focalX??50)),
    imageY:pixel(settings.imageY,[0,100],Number(banner?.focalY??50)),
    zoom:clamp(Number(settings.zoom)||1,1,1.6),
    overlay:pixel(settings.overlay,[20,95],base.overlay),
    effect:allowed(settings.effect,['clean','soft','glow','vignette','glass'],'clean'),
    overlayColor:color(settings.overlayColor,base.overlayColor),
    secondaryColor:color(settings.secondaryColor,base.secondaryColor),
    textAlign:allowed(settings.textAlign,['left','center','right'],'left'),
    titleScale:pixel(settings.titleScale,[85,120],100),
    glowIntensity:pixel(settings.glowIntensity,[0,70],30)
  };
}
export const designPreset=(name,placement)=>{
  const common=defaultAdDesign(placement);
  if(name==='cinema')return {...common,layout:'image-right',overlay:78,effect:'vignette',
    visualWidth:58,imageX:50,titleScale:110};
  if(name==='minimal')return {...common,layout:'image-left',overlay:42,effect:'clean',
    visualWidth:52,titleScale:90};
  if(name==='spotlight')return {...common,layout:'center',overlay:84,effect:'glow',
    glowIntensity:55,titleScale:112};
  return common;
};
