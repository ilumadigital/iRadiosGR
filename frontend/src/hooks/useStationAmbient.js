import { useEffect, useState } from 'react';

// Best-effort actual color sampling from the station's logo; external images
// without CORS naturally use the safe neutral-lime fallback, not fake palette data.
const fallback='134 165 56';
export function useStationAmbient(logoUrl) {
  const [rgb,setRgb]=useState(fallback);
  useEffect(()=>{
    setRgb(fallback);
    if(!logoUrl || typeof logoUrl!=='string')return;
    let live=true;
    const image=new Image();
    image.crossOrigin='anonymous';
    const done=()=>{
      if(!live)return;
      try{
        const canvas=document.createElement('canvas');
        canvas.width=32;canvas.height=32;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx)return;
        ctx.drawImage(image,0,0,32,32);
        const {data}=ctx.getImageData(0,0,32,32);
        let best=[],strength=0;
        for(let i=0;i<data.length;i+=4){
          const [r,g,b,a]=data.slice(i,i+4);
          if(a<210)continue;
          const max=Math.max(r,g,b),min=Math.min(r,g,b);
          const chroma=max-min,lum=(r+g+b)/3;
          if(chroma<32||lum<42||lum>223)continue;
          const score=chroma*(1-Math.abs(138-lum)/240);
          if(score>strength){strength=score;best=[r,g,b];}
        }
        if(best.length)setRgb(best.map(n=>Math.max(55,Math.min(210,n))).join(' '));
      }catch{ /* CORS-restricted logos keep the neutral fallback. */ }
    };
    image.onload=done;
    image.onerror=()=>{};
    image.src=logoUrl;
    return ()=>{live=false;image.onload=null;image.onerror=null;};
  },[logoUrl]);
  return rgb;
}
