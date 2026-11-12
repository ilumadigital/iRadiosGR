/**
 * Picks a saturated dominant accent from the locally uploaded cover.
 * Optional enhancement: image decoding/CORS failures leave the manual color intact.
 * Only the file selected by the advertiser is sampled; no third-party image fetch.
 */
export async function deriveCreativeAccent(file) {
  if(!file || typeof createImageBitmap!=='function')return null;
  const bitmap=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas');
    canvas.width=48;canvas.height=48;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return null;
    ctx.drawImage(bitmap,0,0,48,48);
    const pixels=ctx.getImageData(0,0,48,48).data;
    const groups=new Map();
    for(let i=0;i<pixels.length;i+=16){
      if(pixels[i+3]<190)continue;
      const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
      const saturation=hi?((hi-lo)/hi):0;
      if(saturation<.27||hi<45||lo>205)continue;
      const hue=Math.round(Math.atan2(Math.sqrt(3)*(g-b),2*r-g-b)*180/Math.PI+180);
      const bucket=Math.floor(hue/18);
      const group=groups.get(bucket)||{r:0,g:0,b:0,count:0};
      group.r+=r;group.g+=g;group.b+=b;group.count+=1;
      groups.set(bucket,group);
    }
    const winner=[...groups.values()].sort((a,b)=>b.count-a.count)[0];
    if(!winner||winner.count<4)return null;
    let r=winner.r/winner.count,g=winner.g/winner.count,b=winner.b/winner.count;
    const max=Math.max(r,g,b),scale=max>180?180/max:max<105?105/max:1;
    const hex=n=>Math.max(0,Math.min(255,Math.round(n*scale))).toString(16).padStart(2,'0');
    return '#'+hex(r)+hex(g)+hex(b);
  } finally {bitmap.close?.();}
}
